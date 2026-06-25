// Orchestration for f1-ingest: resolves the work list per mode and dispatches
// the right ingester per (domain, season, round[, session_type]), recording
// f1_sync_state for each. Modes:
//   backfill — explicit (season[,round]) or a domain list; force re-run unless complete
//   sync     — steady-state current-season refresh (schedule, standings, new rounds)
//   poll     — retry pending/partial rows whose next_retry_at <= now within weekend window
//   latest   — resolve the latest/current round and sync it

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  ingestConstructorStandings,
  ingestDriverStandings,
  ingestLaps,
  ingestOpenF1Crosswalk,
  ingestOpenF1Session,
  ingestPitStops,
  ingestQualifying,
  ingestResults,
  ingestSchedule,
  ingestSprint,
} from "./ingesters.ts";
import { recordSyncState, type SyncKey, type SyncResult } from "./syncState.ts";
import { sleep, toInt } from "./util.ts";

// Domains that are keyed by (season,round). Session-keyed OpenF1 domains and
// season-keyed domains are handled separately.
export const ROUND_DOMAINS = [
  "results",
  "qualifying",
  "sprint",
  "pitstops",
  "laps",
] as const;

export type RunReport = {
  domain: string;
  season: number;
  round?: number | null;
  session_type?: string | null;
  status: SyncResult["status"];
  row_count: number;
};

const REQUEST_DELAY_MS = 250; // rate-safe inter-request pause

function currentSeason(): number {
  return new Date().getUTCFullYear();
}

/** Dispatch one round-keyed domain ingester. */
async function runRoundDomain(
  admin: SupabaseClient,
  domain: string,
  season: number,
  round: number,
): Promise<SyncResult> {
  switch (domain) {
    case "results":
      return ingestResults(admin, season, round);
    case "qualifying":
      return ingestQualifying(admin, season, round);
    case "sprint":
      return ingestSprint(admin, season, round);
    case "pitstops":
      return ingestPitStops(admin, season, round);
    case "laps":
      return ingestLaps(admin, season, round);
    case "driver_standings":
      return ingestDriverStandings(admin, season, round);
    case "constructor_standings":
      return ingestConstructorStandings(admin, season, round);
    default:
      return { status: "not_applicable", last_error: `unknown domain ${domain}` };
  }
}

async function execAndRecord(
  admin: SupabaseClient,
  key: SyncKey,
  fn: () => Promise<SyncResult>,
  reports: RunReport[],
): Promise<void> {
  let result: SyncResult;
  try {
    result = await fn();
  } catch (e) {
    result = { status: "error", last_error: (e as Error).message };
  }
  await recordSyncState(admin, key, result);
  reports.push({
    domain: key.domain,
    season: key.season,
    round: key.round ?? null,
    session_type: key.session_type ?? null,
    status: result.status,
    row_count: result.row_count ?? 0,
  });
  await sleep(REQUEST_DELAY_MS);
}

/** Was this round's race already run (date in the past)? */
async function roundIsCompleted(
  admin: SupabaseClient,
  season: number,
  round: number,
): Promise<boolean> {
  const { data } = await admin
    .from("f1_race")
    .select("date, sprint_weekend")
    .eq("season", season)
    .eq("round", round)
    .maybeSingle();
  if (!data?.date) return false;
  return new Date(data.date).getTime() <= Date.now();
}

async function isSprintWeekend(
  admin: SupabaseClient,
  season: number,
  round: number,
): Promise<boolean> {
  const { data } = await admin
    .from("f1_race")
    .select("sprint_weekend")
    .eq("season", season)
    .eq("round", round)
    .maybeSingle();
  return !!data?.sprint_weekend;
}

/** Final completed round of a season (max round whose date has passed). */
async function latestCompletedRound(
  admin: SupabaseClient,
  season: number,
): Promise<number | null> {
  const { data } = await admin
    .from("f1_race")
    .select("round")
    .eq("season", season)
    .lte("date", new Date().toISOString().slice(0, 10))
    .order("round", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.round ?? null;
}

/**
 * Ingest every fact domain for a single completed round (dependency-correct).
 * Future/unrun rounds are marked not_applicable (no results yet).
 */
export async function syncRound(
  admin: SupabaseClient,
  season: number,
  round: number,
  reports: RunReport[],
): Promise<void> {
  const completed = await roundIsCompleted(admin, season, round);
  if (!completed) {
    for (const domain of ROUND_DOMAINS) {
      await recordSyncState(
        admin,
        { domain, season, round },
        { status: "not_applicable", source: "ergast" },
      );
    }
    return;
  }

  await execAndRecord(
    admin,
    { domain: "results", season, round },
    () => runRoundDomain(admin, "results", season, round),
    reports,
  );
  await execAndRecord(
    admin,
    { domain: "qualifying", season, round },
    () => runRoundDomain(admin, "qualifying", season, round),
    reports,
  );

  if (await isSprintWeekend(admin, season, round)) {
    await execAndRecord(
      admin,
      { domain: "sprint", season, round },
      () => runRoundDomain(admin, "sprint", season, round),
      reports,
    );
  } else {
    await recordSyncState(
      admin,
      { domain: "sprint", season, round },
      { status: "not_applicable", source: "ergast" },
    );
  }

  await execAndRecord(
    admin,
    { domain: "pitstops", season, round },
    () => runRoundDomain(admin, "pitstops", season, round),
    reports,
  );
  await execAndRecord(
    admin,
    { domain: "laps", season, round },
    () => runRoundDomain(admin, "laps", season, round),
    reports,
  );

  // Per-round standings snapshot.
  await execAndRecord(
    admin,
    { domain: "driver_standings", season, round },
    () => runRoundDomain(admin, "driver_standings", season, round),
    reports,
  );
  await execAndRecord(
    admin,
    { domain: "constructor_standings", season, round },
    () => runRoundDomain(admin, "constructor_standings", season, round),
    reports,
  );

  // OpenF1 resources for the race session (post-session snapshot).
  await execAndRecord(
    admin,
    { domain: "openf1_session", season, round, session_type: "R" },
    () => ingestOpenF1Session(admin, season, round, "R"),
    reports,
  );
}

/** Full season sync: schedule -> crosswalk -> per-round facts -> final standings. */
export async function syncSeason(
  admin: SupabaseClient,
  season: number,
  reports: RunReport[],
  opts: { onlyIncomplete?: boolean } = {},
): Promise<void> {
  // 1. Schedule (spine) — always cheap, catches calendar changes.
  await execAndRecord(
    admin,
    { domain: "schedule", season },
    () => ingestSchedule(admin, season),
    reports,
  );

  // 2. OpenF1 crosswalk (must run before OpenF1 resources).
  await execAndRecord(
    admin,
    { domain: "openf1_crosswalk", season },
    () => ingestOpenF1Crosswalk(admin, season),
    reports,
  );

  // 3. Per-round facts for every round in the schedule.
  const { data: rounds } = await admin
    .from("f1_race")
    .select("round")
    .eq("season", season)
    .order("round", { ascending: true });

  for (const r of rounds ?? []) {
    if (opts.onlyIncomplete) {
      const { data: done } = await admin
        .from("f1_sync_state")
        .select("status")
        .eq("domain", "results")
        .eq("season", season)
        .eq("round", r.round)
        .maybeSingle();
      if (done?.status === "complete") continue;
    }
    await syncRound(admin, season, r.round, reports);
  }

  // 4. End-of-season standings keyed at the final completed round.
  const finalRound = await latestCompletedRound(admin, season);
  if (finalRound !== null) {
    await execAndRecord(
      admin,
      { domain: "driver_standings", season, round: finalRound },
      () => runRoundDomain(admin, "driver_standings", season, finalRound),
      reports,
    );
    await execAndRecord(
      admin,
      { domain: "constructor_standings", season, round: finalRound },
      () => runRoundDomain(admin, "constructor_standings", season, finalRound),
      reports,
    );
  }
}

/**
 * POLL mode — re-attempt pending/partial sync_state rows whose next_retry_at
 * has elapsed, self-gated to the active race-weekend window (any session
 * within +/- 48h). A no-op most of the week.
 */
export async function runPoll(
  admin: SupabaseClient,
  season: number,
  reports: RunReport[],
): Promise<void> {
  // Weekend gate: is any session within +/- 48h?
  const lo = new Date(Date.now() - 48 * 3600_000).toISOString();
  const hi = new Date(Date.now() + 48 * 3600_000).toISOString();
  const { data: nearby } = await admin
    .from("f1_session")
    .select("round")
    .eq("season", season)
    .gte("date_start", lo)
    .lte("date_start", hi)
    .limit(1);

  // Fallback gate using scheduled_date when date_start is unknown.
  let gateOpen = (nearby?.length ?? 0) > 0;
  if (!gateOpen) {
    const loD = new Date(Date.now() - 48 * 3600_000).toISOString().slice(0, 10);
    const hiD = new Date(Date.now() + 48 * 3600_000).toISOString().slice(0, 10);
    const { data: nearbyD } = await admin
      .from("f1_session")
      .select("round")
      .eq("season", season)
      .gte("scheduled_date", loD)
      .lte("scheduled_date", hiD)
      .limit(1);
    gateOpen = (nearbyD?.length ?? 0) > 0;
  }
  if (!gateOpen) return; // no-op outside weekend windows

  const nowIso = new Date().toISOString();
  const { data: due } = await admin
    .from("f1_sync_state")
    .select("domain, season, round, session_type")
    .eq("season", season)
    .in("status", ["pending", "partial"])
    .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
    .limit(50);

  for (const row of due ?? []) {
    const { domain, round, session_type } = row as {
      domain: string;
      round: number | null;
      session_type: string | null;
    };
    const key: SyncKey = { domain, season, round, session_type };

    if (domain === "schedule") {
      await execAndRecord(admin, key, () => ingestSchedule(admin, season), reports);
    } else if (domain === "openf1_crosswalk") {
      await execAndRecord(
        admin,
        key,
        () => ingestOpenF1Crosswalk(admin, season),
        reports,
      );
    } else if (domain === "openf1_session" && round !== null) {
      await execAndRecord(
        admin,
        key,
        () => ingestOpenF1Session(admin, season, round, session_type ?? "R"),
        reports,
      );
    } else if (round !== null) {
      await execAndRecord(
        admin,
        key,
        () => runRoundDomain(admin, domain, season, round),
        reports,
      );
    }
  }
}

export type SyncRequest = {
  mode?: "backfill" | "sync" | "poll" | "latest";
  season?: number;
  round?: number | "latest";
  domain?: string; // optional single-domain backfill
};

/** Top-level dispatcher. Returns the run report list. */
export async function runSync(
  admin: SupabaseClient,
  req: SyncRequest,
): Promise<RunReport[]> {
  const reports: RunReport[] = [];
  const mode = req.mode ?? "sync";
  const season = req.season ?? currentSeason();

  if (mode === "poll") {
    await runPoll(admin, season, reports);
    return reports;
  }

  if (mode === "latest") {
    // Ensure spine exists, then sync the latest completed round.
    await execAndRecord(
      admin,
      { domain: "schedule", season },
      () => ingestSchedule(admin, season),
      reports,
    );
    await execAndRecord(
      admin,
      { domain: "openf1_crosswalk", season },
      () => ingestOpenF1Crosswalk(admin, season),
      reports,
    );
    const round = await latestCompletedRound(admin, season);
    if (round !== null) await syncRound(admin, season, round, reports);
    return reports;
  }

  // backfill / sync
  const roundParam =
    req.round === "latest"
      ? await latestCompletedRound(admin, season)
      : toInt(req.round);

  // Single round requested.
  if (roundParam !== null && req.round !== undefined) {
    // Spine first so race_id FKs resolve.
    await execAndRecord(
      admin,
      { domain: "schedule", season },
      () => ingestSchedule(admin, season),
      reports,
    );
    await execAndRecord(
      admin,
      { domain: "openf1_crosswalk", season },
      () => ingestOpenF1Crosswalk(admin, season),
      reports,
    );

    if (req.domain) {
      // Single domain for the round.
      if (req.domain === "openf1_session") {
        await execAndRecord(
          admin,
          { domain: "openf1_session", season, round: roundParam, session_type: "R" },
          () => ingestOpenF1Session(admin, season, roundParam, "R"),
          reports,
        );
      } else {
        await execAndRecord(
          admin,
          { domain: req.domain, season, round: roundParam },
          () => runRoundDomain(admin, req.domain!, season, roundParam),
          reports,
        );
      }
    } else {
      await syncRound(admin, season, roundParam, reports);
    }
    return reports;
  }

  // Whole-season sync. 'sync' skips already-complete rounds; 'backfill' redoes.
  await syncSeason(admin, season, reports, {
    onlyIncomplete: mode === "sync",
  });
  return reports;
}
