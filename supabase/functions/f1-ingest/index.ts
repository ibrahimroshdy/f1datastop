// f1-ingest — F1 data warehouse ingestion edge function.
//
// Ingests a given season/round (or 'latest') from Jolpica (Ergast) + OpenF1,
// normalizes to the canonical f1_* tables, and idempotently UPSERTs via the
// service-role client. Updates f1_sync_state and is safe to re-run.
//
// Request body (POST JSON):
//   { mode: 'backfill'|'sync'|'poll'|'latest', season?: number,
//     round?: number|'latest', domain?: string }
//
//   mode='sync'     (default) steady-state current-season refresh; skips
//                   rounds already 'complete'.
//   mode='backfill' force-(re)ingest a whole season, or a single (season,round),
//                   or a single (season,round,domain).
//   mode='poll'     retry pending/partial sync_state rows whose next_retry_at
//                   has elapsed, gated to the active race weekend window.
//   mode='latest'   resolve + sync the latest completed round of the season.
//
// Reuses _shared/f1Cache.ts proxyF1Request so every upstream fetch also warms
// api_cache and logs api_metrics (rate-limit aware, stale-fallback). Writes
// bypass RLS via the service-role key.
//
// Local only — NOT to be deployed to prod by this function. The user ships.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/f1Cache.ts";
import {
  runSync,
  type SyncRequest,
} from "../_shared/ingest/orchestrator.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: SyncRequest;
  try {
    body = (await req.json()) as SyncRequest;
  } catch {
    body = {};
  }

  const mode = body.mode ?? "sync";
  if (!["backfill", "sync", "poll", "latest"].includes(mode)) {
    return jsonResponse({ error: `invalid mode: ${mode}` }, 400);
  }
  if (body.season !== undefined && !Number.isInteger(body.season)) {
    return jsonResponse({ error: "season must be an integer year" }, 400);
  }

  const startedAt = Date.now();
  try {
    const admin = createServiceClient();
    const reports = await runSync(admin, body);

    const summary = reports.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {});

    return jsonResponse({
      ok: true,
      mode,
      season: body.season ?? new Date().getUTCFullYear(),
      round: body.round ?? null,
      duration_ms: Date.now() - startedAt,
      tasks: reports.length,
      summary,
      reports,
    });
  } catch (error) {
    console.error("f1-ingest error:", error);
    return jsonResponse(
      { ok: false, error: (error as Error).message, duration_ms: Date.now() - startedAt },
      500,
    );
  }
});
