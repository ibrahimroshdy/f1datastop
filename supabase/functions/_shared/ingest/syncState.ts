// f1_sync_state ledger helpers — the coverage + freshness state machine.
// Every ingester converges here so backfill/poll are idempotent and resumable.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { nextRetryAt } from "./util.ts";

export type SyncStatus =
  | "pending"
  | "partial"
  | "complete"
  | "empty"
  | "error"
  | "not_applicable";

export type SyncKey = {
  domain: string;
  season: number;
  round?: number | null;
  session_type?: string | null;
};

export type SyncResult = {
  status: SyncStatus;
  source?: string;
  row_count?: number;
  expected_count?: number | null;
  upstream_total?: number | null;
  last_error?: string | null;
};

/** Read the current sync_state row for a key (null if absent). */
export async function readSyncState(
  admin: SupabaseClient,
  key: SyncKey,
): Promise<{ attempt_count: number; status: SyncStatus } | null> {
  const { data } = await admin
    .from("f1_sync_state")
    .select("attempt_count, status")
    .eq("domain", key.domain)
    .eq("season", key.season)
    .eq("round", key.round ?? null)
    .eq("session_type", key.session_type ?? null)
    .maybeSingle();
  return data
    ? { attempt_count: data.attempt_count ?? 0, status: data.status }
    : null;
}

/**
 * UPSERT a sync_state row after an ingest attempt. Computes next_retry_at /
 * attempt_count for transient (pending/partial/error) outcomes; clears retry
 * for terminal outcomes (complete/empty/not_applicable).
 *
 * NOTE: the natural key includes round + session_type which can be NULL. The
 * table UNIQUE constraint treats NULLs as distinct in Postgres < 15, but the
 * local stack is PG15+ which honors NULLS NOT DISTINCT only when declared;
 * here we read-then-write to stay correct on either: we resolve the existing
 * row id and update it, else insert.
 */
export async function recordSyncState(
  admin: SupabaseClient,
  key: SyncKey,
  result: SyncResult,
): Promise<void> {
  const prior = await readSyncState(admin, key);
  const priorAttempts = prior?.attempt_count ?? 0;
  const now = new Date().toISOString();

  const retrying =
    result.status === "pending" ||
    result.status === "partial" ||
    result.status === "error";

  const attempt_count = retrying ? priorAttempts + 1 : priorAttempts + 1;

  const next_retry_at = retrying ? nextRetryAt(priorAttempts) : null;
  const last_success_at =
    result.status === "complete" ? now : prior ? undefined : null;

  const row: Record<string, unknown> = {
    domain: key.domain,
    season: key.season,
    round: key.round ?? null,
    session_type: key.session_type ?? null,
    status: result.status,
    source: result.source ?? null,
    row_count: result.row_count ?? 0,
    expected_count: result.expected_count ?? null,
    upstream_total: result.upstream_total ?? null,
    attempt_count,
    last_attempt_at: now,
    next_retry_at,
    last_error: result.last_error ?? null,
    updated_at: now,
  };
  if (result.status === "complete") row.last_success_at = now;

  // Resolve existing row by exact key (handles NULL round/session_type).
  const { data: existing } = await admin
    .from("f1_sync_state")
    .select("id")
    .eq("domain", key.domain)
    .eq("season", key.season)
    .eq("round", key.round ?? null)
    .eq("session_type", key.session_type ?? null)
    .maybeSingle();

  if (existing?.id) {
    await admin.from("f1_sync_state").update(row).eq("id", existing.id);
  } else {
    await admin.from("f1_sync_state").insert(row);
  }
}
