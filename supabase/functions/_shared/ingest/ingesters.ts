// Domain ingesters for the f1-ingest edge function.
// Each ingester: fetch via proxyF1Request (warms api_cache, logs api_metrics,
// rate-limit aware), parse MRData/OpenF1 -> typed rows, pure UPSERT on the
// table's UNIQUE natural key, then record f1_sync_state. Re-runs are no-ops
// on unchanged durable data.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { proxyF1Request } from "../f1Cache.ts";
import {
  recordSyncState,
  type SyncResult,
  type SyncStatus,
} from "./syncState.ts";
import {
  deriveIsDnf,
  isTransient,
  sessionTypeFromOpenF1Name,
  slugify,
  toBigInt,
  toDate,
  toInt,
  toNum,
  toStr,
} from "./util.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ErgastFetch = {
  ok: boolean;
  data: any;
  status: number;
  transient: boolean;
};

/** Fetch an Ergast (Jolpica) path via the proxy. Returns parsed MRData. */
async function ergast(
  admin: SupabaseClient,
  path: string,
  params?: Record<string, string>,
): Promise<ErgastFetch> {
  const res = await proxyF1Request(admin, { source: "ergast", path, params });
  const ok = res.status === 200 && res.data != null;
  return {
    ok,
    data: res.data,
    status: res.status,
    transient: !ok && isTransient(res.status),
  };
}

/** Fetch an OpenF1 path via the proxy. Returns a parsed array. */
async function openf1(
  admin: SupabaseClient,
  path: string,
  params?: Record<string, string>,
): Promise<{ ok: boolean; rows: any[]; status: number; transient: boolean }> {
  const res = await proxyF1Request(admin, { source: "openf1", path, params });
  const ok = res.status === 200 && Array.isArray(res.data);
  return {
    ok,
    rows: ok ? (res.data as any[]) : [],
    status: res.status,
    transient: !ok && isTransient(res.status),
  };
}

function firstRace(data: any): any | null {
  const races = data?.MRData?.RaceTable?.Races;
  return Array.isArray(races) && races.length > 0 ? races[0] : null;
}

function mrTotal(data: any): number | null {
  return toInt(data?.MRData?.total);
}

/** Resolve the surrogate race_id for a (season,round). */
async function raceId(
  admin: SupabaseClient,
  season: number,
  round: number,
): Promise<number | null> {
  const { data } = await admin
    .from("f1_race")
    .select("id")
    .eq("season", season)
    .eq("round", round)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Ensure a driver row exists (FK backfill). Auto-expands the dimension from
 * the 22-row current grid to every driver appearing in the window.
 */
async function ensureDriver(admin: SupabaseClient, d: any): Promise<void> {
  if (!d?.driverId) return;
  const slug = slugify(`${d.givenName ?? ""}-${d.familyName ?? ""}`) ||
    slugify(d.driverId);
  await admin.from("f1_driver").upsert(
    {
      ergast_id: d.driverId,
      given_name: toStr(d.givenName) ?? "",
      family_name: toStr(d.familyName) ?? "",
      code: toStr(d.code),
      permanent_number: toStr(d.permanentNumber),
      nationality: toStr(d.nationality),
      date_of_birth: toDate(d.dateOfBirth),
      slug,
    },
    { onConflict: "ergast_id", ignoreDuplicates: false },
  );
}

async function ensureConstructor(admin: SupabaseClient, c: any): Promise<void> {
  if (!c?.constructorId) return;
  const slug = slugify(c.name ?? c.constructorId);
  await admin.from("f1_constructor").upsert(
    {
      ergast_id: c.constructorId,
      name: toStr(c.name) ?? c.constructorId,
      nationality: toStr(c.nationality),
      slug,
    },
    { onConflict: "ergast_id", ignoreDuplicates: false },
  );
}

// ---------------------------------------------------------------------------
// SCHEDULE — builds the spine: f1_season + f1_circuit + f1_race + f1_session
// ---------------------------------------------------------------------------

const SCHEDULE_SESSIONS: Array<[string, string]> = [
  ["FirstPractice", "FP1"],
  ["SecondPractice", "FP2"],
  ["ThirdPractice", "FP3"],
  ["SprintQualifying", "SQ"],
  ["SprintShootout", "SQ"],
  ["Sprint", "S"],
  ["Qualifying", "Q"],
];

export async function ingestSchedule(
  admin: SupabaseClient,
  season: number,
): Promise<SyncResult> {
  const res = await ergast(admin, `/f1/${season}.json`, { limit: "100" });
  if (!res.ok) {
    return {
      status: res.transient ? "pending" : "error",
      source: "ergast",
      last_error: `schedule fetch status ${res.status}`,
    };
  }
  const races = res.data?.MRData?.RaceTable?.Races ?? [];

  // f1_season first (FK target).
  await admin.from("f1_season").upsert(
    {
      year: season,
      race_count: races.length,
      has_results: false,
      source: "ergast",
    },
    { onConflict: "year" },
  );

  let raceCount = 0;
  for (const r of races) {
    const round = toInt(r.round);
    if (round === null) continue;
    const circuit = r.Circuit;

    if (circuit?.circuitId) {
      await admin.from("f1_circuit").upsert(
        {
          circuit_id: circuit.circuitId,
          name: toStr(circuit.circuitName) ?? circuit.circuitId,
          locality: toStr(circuit.Location?.locality),
          country: toStr(circuit.Location?.country),
          lat: toNum(circuit.Location?.lat),
          lng: toNum(circuit.Location?.long),
          url: toStr(circuit.url),
          source: "ergast",
        },
        { onConflict: "circuit_id" },
      );
    }

    const sprintWeekend = !!(r.Sprint || r.SprintQualifying || r.SprintShootout);

    await admin.from("f1_race").upsert(
      {
        season,
        round,
        race_name: toStr(r.raceName) ?? `Round ${round}`,
        circuit_id: circuit?.circuitId ?? null,
        date: toDate(r.date),
        time: toStr(r.time),
        url: toStr(r.url),
        sprint_weekend: sprintWeekend,
        source: "ergast",
        raw: r,
        ingested_at: new Date().toISOString(),
      },
      { onConflict: "season,round" },
    );

    const rid = await raceId(admin, season, round);

    // Sessions: practice/quali/sprint sub-objects + the race itself ('R').
    const sessionRows: Record<string, unknown>[] = [];
    for (const [key, type] of SCHEDULE_SESSIONS) {
      const sub = r[key];
      if (!sub) continue;
      sessionRows.push({
        race_id: rid,
        season,
        round,
        session_type: type,
        session_name: key,
        scheduled_date: toDate(sub.date),
        scheduled_time: toStr(sub.time),
        source: "ergast",
      });
    }
    // The race session ('R') always exists.
    sessionRows.push({
      race_id: rid,
      season,
      round,
      session_type: "R",
      session_name: "Race",
      scheduled_date: toDate(r.date),
      scheduled_time: toStr(r.time),
      source: "ergast",
    });

    if (sessionRows.length) {
      await admin
        .from("f1_session")
        .upsert(sessionRows, { onConflict: "season,round,session_type" });
    }
    raceCount++;
  }

  return {
    status: "complete",
    source: "ergast",
    row_count: raceCount,
    upstream_total: mrTotal(res.data),
  };
}

// ---------------------------------------------------------------------------
// RESULTS
// ---------------------------------------------------------------------------

export async function ingestResults(
  admin: SupabaseClient,
  season: number,
  round: number,
): Promise<SyncResult> {
  const res = await ergast(admin, `/f1/${season}/${round}/results.json`, {
    limit: "100",
  });
  if (!res.ok) {
    return {
      status: res.transient ? "pending" : "error",
      source: "ergast",
      last_error: `results status ${res.status}`,
    };
  }
  const race = firstRace(res.data);
  const results = race?.Results ?? [];
  if (results.length === 0) {
    // Empty right after a session => still pending (retry), not complete.
    return {
      status: "partial",
      source: "ergast",
      row_count: 0,
      upstream_total: mrTotal(res.data),
      last_error: "no results yet",
    };
  }

  const rid = await raceId(admin, season, round);
  const rows: Record<string, unknown>[] = [];
  for (const r of results) {
    await ensureDriver(admin, r.Driver);
    await ensureConstructor(admin, r.Constructor);
    const status = toStr(r.status);
    const fl = r.FastestLap;
    rows.push({
      race_id: rid,
      season,
      round,
      driver_id: r.Driver?.driverId,
      constructor_id: r.Constructor?.constructorId ?? null,
      car_number: toInt(r.number),
      position: toInt(r.position),
      position_text: toStr(r.positionText),
      points: toNum(r.points),
      grid: toInt(r.grid),
      laps: toInt(r.laps),
      status,
      is_dnf: deriveIsDnf(status),
      time_millis: toBigInt(r.Time?.millis),
      time_text: toStr(r.Time?.time),
      fastest_lap_rank: toInt(fl?.rank),
      fastest_lap_number: toInt(fl?.lap),
      fastest_lap_time: toStr(fl?.Time?.time),
      fastest_lap_avg_speed: toNum(fl?.AverageSpeed?.speed),
      fastest_lap_speed_units: toStr(fl?.AverageSpeed?.units),
      source: "ergast",
      raw: r,
    });
  }
  await admin
    .from("f1_race_result")
    .upsert(rows, { onConflict: "season,round,driver_id" });

  // Race happened + has results -> mark season.has_results.
  await admin.from("f1_season").update({ has_results: true }).eq("year", season);

  return {
    status: "complete",
    source: "ergast",
    row_count: rows.length,
    upstream_total: mrTotal(res.data),
  };
}

// ---------------------------------------------------------------------------
// QUALIFYING
// ---------------------------------------------------------------------------

export async function ingestQualifying(
  admin: SupabaseClient,
  season: number,
  round: number,
): Promise<SyncResult> {
  const res = await ergast(admin, `/f1/${season}/${round}/qualifying.json`, {
    limit: "100",
  });
  if (!res.ok) {
    return {
      status: res.transient ? "pending" : "error",
      source: "ergast",
      last_error: `qualifying status ${res.status}`,
    };
  }
  const race = firstRace(res.data);
  const quali = race?.QualifyingResults ?? [];
  if (quali.length === 0) {
    return {
      status: "partial",
      source: "ergast",
      row_count: 0,
      last_error: "no qualifying yet",
    };
  }

  const rid = await raceId(admin, season, round);
  const rows: Record<string, unknown>[] = [];
  for (const q of quali) {
    await ensureDriver(admin, q.Driver);
    await ensureConstructor(admin, q.Constructor);
    rows.push({
      race_id: rid,
      season,
      round,
      driver_id: q.Driver?.driverId,
      constructor_id: q.Constructor?.constructorId ?? null,
      car_number: toInt(q.number),
      position: toInt(q.position),
      q1: toStr(q.Q1),
      q2: toStr(q.Q2),
      q3: toStr(q.Q3),
      source: "ergast",
      raw: q,
    });
  }
  await admin
    .from("f1_qualifying_result")
    .upsert(rows, { onConflict: "season,round,driver_id" });

  return {
    status: "complete",
    source: "ergast",
    row_count: rows.length,
    upstream_total: mrTotal(res.data),
  };
}

// ---------------------------------------------------------------------------
// SPRINT
// ---------------------------------------------------------------------------

export async function ingestSprint(
  admin: SupabaseClient,
  season: number,
  round: number,
): Promise<SyncResult> {
  const res = await ergast(admin, `/f1/${season}/${round}/sprint.json`, {
    limit: "100",
  });
  if (!res.ok) {
    return {
      status: res.transient ? "pending" : "error",
      source: "ergast",
      last_error: `sprint status ${res.status}`,
    };
  }
  const race = firstRace(res.data);
  const sprint = race?.SprintResults ?? [];
  if (sprint.length === 0) {
    // Not a sprint weekend (or not run yet). Caller decides not_applicable.
    return {
      status: "empty",
      source: "ergast",
      row_count: 0,
      last_error: "no sprint results",
    };
  }

  const rid = await raceId(admin, season, round);
  const rows: Record<string, unknown>[] = [];
  for (const r of sprint) {
    await ensureDriver(admin, r.Driver);
    await ensureConstructor(admin, r.Constructor);
    const status = toStr(r.status);
    const fl = r.FastestLap;
    rows.push({
      race_id: rid,
      season,
      round,
      driver_id: r.Driver?.driverId,
      constructor_id: r.Constructor?.constructorId ?? null,
      car_number: toInt(r.number),
      position: toInt(r.position),
      position_text: toStr(r.positionText),
      points: toNum(r.points),
      grid: toInt(r.grid),
      laps: toInt(r.laps),
      status,
      is_dnf: deriveIsDnf(status),
      time_millis: toBigInt(r.Time?.millis),
      time_text: toStr(r.Time?.time),
      fastest_lap_number: toInt(fl?.lap),
      fastest_lap_time: toStr(fl?.Time?.time),
      source: "ergast",
      raw: r,
    });
  }
  await admin
    .from("f1_sprint_result")
    .upsert(rows, { onConflict: "season,round,driver_id" });

  return {
    status: "complete",
    source: "ergast",
    row_count: rows.length,
    upstream_total: mrTotal(res.data),
  };
}

// ---------------------------------------------------------------------------
// PITSTOPS
// ---------------------------------------------------------------------------

export async function ingestPitStops(
  admin: SupabaseClient,
  season: number,
  round: number,
): Promise<SyncResult> {
  const res = await ergast(admin, `/f1/${season}/${round}/pitstops.json`, {
    limit: "100",
  });
  if (!res.ok) {
    return {
      status: res.transient ? "pending" : "error",
      source: "ergast",
      last_error: `pitstops status ${res.status}`,
    };
  }
  const race = firstRace(res.data);
  const stops = race?.PitStops ?? [];
  if (stops.length === 0) {
    return {
      status: "empty",
      source: "ergast",
      row_count: 0,
      last_error: "no pit stops",
    };
  }

  const rid = await raceId(admin, season, round);
  const rows = stops.map((p: any) => ({
    race_id: rid,
    season,
    round,
    driver_id: p.driverId,
    stop: toInt(p.stop),
    lap: toInt(p.lap),
    time_local: toStr(p.time),
    duration_seconds: toNum(p.duration),
    source: "ergast",
  }));
  await admin
    .from("f1_pit_stop")
    .upsert(rows, { onConflict: "season,round,driver_id,stop" });

  return {
    status: "complete",
    source: "ergast",
    row_count: rows.length,
    upstream_total: mrTotal(res.data),
  };
}

// ---------------------------------------------------------------------------
// LAPS — server-side pagination (limit=100, offset loop on MRData.total)
// ---------------------------------------------------------------------------

export async function ingestLaps(
  admin: SupabaseClient,
  season: number,
  round: number,
): Promise<SyncResult> {
  const LIMIT = 100;
  const rid = await raceId(admin, season, round);
  let offset = 0;
  let total: number | null = null;
  let written = 0;
  let pagedTransient = false;

  do {
    const res = await ergast(admin, `/f1/${season}/${round}/laps.json`, {
      limit: String(LIMIT),
      offset: String(offset),
    });
    if (!res.ok) {
      pagedTransient = res.transient;
      break;
    }
    total = mrTotal(res.data) ?? total;
    const race = firstRace(res.data);
    const laps = race?.Laps ?? [];
    if (laps.length === 0) break;

    const rows: Record<string, unknown>[] = [];
    for (const lap of laps) {
      const lapNumber = toInt(lap.number);
      if (lapNumber === null) continue;
      for (const t of lap.Timings ?? []) {
        rows.push({
          race_id: rid,
          season,
          round,
          lap_number: lapNumber,
          driver_id: t.driverId,
          position: toInt(t.position),
          time_text: toStr(t.time),
          source: "ergast",
        });
      }
    }
    if (rows.length) {
      await admin
        .from("f1_lap")
        .upsert(rows, { onConflict: "season,round,lap_number,driver_id" });
      written += rows.length;
    }
    offset += LIMIT;
  } while (total !== null && offset < total);

  if (written === 0) {
    return {
      status: pagedTransient ? "pending" : "empty",
      source: "ergast",
      row_count: 0,
      upstream_total: total,
      last_error: pagedTransient ? "laps fetch transient" : "no laps",
    };
  }

  // If we stopped early due to a transient error mid-pagination, mark partial.
  const status: SyncStatus = pagedTransient ? "partial" : "complete";
  return {
    status,
    source: "ergast",
    row_count: written,
    upstream_total: total,
  };
}

// ---------------------------------------------------------------------------
// STANDINGS — driver + constructor for a (season,round)
// ---------------------------------------------------------------------------

export async function ingestDriverStandings(
  admin: SupabaseClient,
  season: number,
  round: number,
): Promise<SyncResult> {
  const res = await ergast(
    admin,
    `/f1/${season}/${round}/driverStandings.json`,
    { limit: "100" },
  );
  if (!res.ok) {
    return {
      status: res.transient ? "pending" : "error",
      source: "ergast",
      last_error: `driverStandings status ${res.status}`,
    };
  }
  const list =
    res.data?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? [];
  if (list.length === 0) {
    return { status: "empty", source: "ergast", row_count: 0 };
  }

  const rows: Record<string, unknown>[] = [];
  for (const s of list) {
    await ensureDriver(admin, s.Driver);
    // Driver's current constructor = LAST element (mirror getPrimaryConstructor).
    const ctors = s.Constructors ?? [];
    const primary = ctors[ctors.length - 1];
    if (primary) await ensureConstructor(admin, primary);
    rows.push({
      season,
      round,
      driver_id: s.Driver?.driverId,
      constructor_id: primary?.constructorId ?? null,
      position: toInt(s.position),
      position_text: toStr(s.positionText),
      points: toNum(s.points),
      wins: toInt(s.wins),
      source: "ergast",
    });
  }
  await admin
    .from("f1_driver_standing")
    .upsert(rows, { onConflict: "season,round,driver_id" });

  return { status: "complete", source: "ergast", row_count: rows.length };
}

export async function ingestConstructorStandings(
  admin: SupabaseClient,
  season: number,
  round: number,
): Promise<SyncResult> {
  const res = await ergast(
    admin,
    `/f1/${season}/${round}/constructorStandings.json`,
    { limit: "100" },
  );
  if (!res.ok) {
    return {
      status: res.transient ? "pending" : "error",
      source: "ergast",
      last_error: `constructorStandings status ${res.status}`,
    };
  }
  const list =
    res.data?.MRData?.StandingsTable?.StandingsLists?.[0]
      ?.ConstructorStandings ?? [];
  if (list.length === 0) {
    return { status: "empty", source: "ergast", row_count: 0 };
  }

  const rows: Record<string, unknown>[] = [];
  for (const s of list) {
    await ensureConstructor(admin, s.Constructor);
    rows.push({
      season,
      round,
      constructor_id: s.Constructor?.constructorId,
      position: toInt(s.position),
      position_text: toStr(s.positionText),
      points: toNum(s.points),
      wins: toInt(s.wins),
      source: "ergast",
    });
  }
  await admin
    .from("f1_constructor_standing")
    .upsert(rows, { onConflict: "season,round,constructor_id" });

  return { status: "complete", source: "ergast", row_count: rows.length };
}

// ---------------------------------------------------------------------------
// OPENF1 CROSSWALK — resolve openf1_session_key onto f1_session (runs FIRST
// per season before any OpenF1 resource ingester). 2023+ only.
// ---------------------------------------------------------------------------

export async function ingestOpenF1Crosswalk(
  admin: SupabaseClient,
  season: number,
): Promise<SyncResult> {
  if (season < 2023) {
    return {
      status: "not_applicable",
      source: "openf1",
      last_error: "OpenF1 coverage starts 2023",
    };
  }

  const res = await openf1(admin, "/sessions", { year: String(season) });
  if (!res.ok) {
    return {
      status: res.transient ? "pending" : "error",
      source: "openf1",
      last_error: `sessions status ${res.status}`,
    };
  }
  if (res.rows.length === 0) {
    return { status: "empty", source: "openf1", row_count: 0 };
  }

  // Load our spine: f1_race(date,circuit country) + f1_session(season,round,type).
  const { data: races } = await admin
    .from("f1_race")
    .select("round, date, circuit_id, f1_circuit(country)")
    .eq("season", season);

  const raceByRound = new Map<number, { date: string | null; country: string | null }>();
  for (const r of races ?? []) {
    raceByRound.set(r.round, {
      date: r.date,
      country: (r as any).f1_circuit?.country ?? null,
    });
  }

  let resolved = 0;
  const ambiguities: string[] = [];

  for (const s of res.rows) {
    const sessionType = sessionTypeFromOpenF1Name(s.session_name);
    if (!sessionType) continue;
    const sessionKey = toInt(s.session_key);
    const meetingKey = toInt(s.meeting_key);
    if (sessionKey === null) continue;

    // Match to a round by date proximity (+/- 4 days) and country when present.
    const sDate = toDate(s.date_start) ?? toDate(s.date);
    let bestRound: number | null = null;
    let bestDelta = Infinity;
    for (const [round, meta] of raceByRound) {
      if (!meta.date || !sDate) continue;
      const delta =
        Math.abs(
          new Date(meta.date).getTime() - new Date(sDate).getTime(),
        ) /
        86_400_000;
      const countryOk =
        !meta.country ||
        !s.country_name ||
        meta.country.toLowerCase() === String(s.country_name).toLowerCase();
      if (delta <= 4 && countryOk && delta < bestDelta) {
        bestDelta = delta;
        bestRound = round;
      }
    }
    if (bestRound === null) continue;

    // Persist the crosswalk onto the matching f1_session row.
    const { data: updated, error } = await admin
      .from("f1_session")
      .update({
        openf1_session_key: sessionKey,
        openf1_meeting_key: meetingKey,
        date_start: toStr(s.date_start),
        date_end: toStr(s.date_end),
        source: "openf1",
      })
      .eq("season", season)
      .eq("round", bestRound)
      .eq("session_type", sessionType)
      .select("id");

    if (error) {
      ambiguities.push(`${bestRound}/${sessionType}: ${error.message}`);
      continue;
    }
    if (updated && updated.length > 0) {
      resolved++;
      // Also stamp the meeting key on the race.
      if (meetingKey !== null) {
        await admin
          .from("f1_race")
          .update({ openf1_meeting_key: meetingKey })
          .eq("season", season)
          .eq("round", bestRound);
      }
    }
  }

  return {
    status: "complete",
    source: "openf1",
    row_count: resolved,
    last_error: ambiguities.length ? ambiguities.slice(0, 5).join("; ") : null,
  };
}

// ---------------------------------------------------------------------------
// OPENF1 RESOURCES — keyed by openf1_session_key (resolved via crosswalk)
// ---------------------------------------------------------------------------

/** Resolve the openf1_session_key for a (season,round,session_type). */
async function sessionKeyFor(
  admin: SupabaseClient,
  season: number,
  round: number,
  sessionType: string,
): Promise<number | null> {
  const { data } = await admin
    .from("f1_session")
    .select("openf1_session_key")
    .eq("season", season)
    .eq("round", round)
    .eq("session_type", sessionType)
    .maybeSingle();
  return data?.openf1_session_key ?? null;
}

/** Resolve ergast_driver_id for an OpenF1 driver_number within a session. */
async function resolveErgastDriverId(
  admin: SupabaseClient,
  acronym: string | null,
  permanentNumber: number | null,
): Promise<string | null> {
  if (acronym) {
    const { data } = await admin
      .from("f1_driver")
      .select("ergast_id")
      .eq("code", acronym)
      .limit(1)
      .maybeSingle();
    if (data?.ergast_id) return data.ergast_id;
  }
  if (permanentNumber !== null) {
    const { data } = await admin
      .from("f1_driver")
      .select("ergast_id")
      .eq("permanent_number", String(permanentNumber))
      .limit(1)
      .maybeSingle();
    if (data?.ergast_id) return data.ergast_id;
  }
  return null;
}

export async function ingestOpenF1Session(
  admin: SupabaseClient,
  season: number,
  round: number,
  sessionType: string,
): Promise<SyncResult> {
  if (season < 2023) {
    return { status: "not_applicable", source: "openf1" };
  }
  const sessionKey = await sessionKeyFor(admin, season, round, sessionType);
  if (sessionKey === null) {
    return {
      status: "pending",
      source: "openf1",
      last_error: "crosswalk not resolved yet",
    };
  }
  const sk = String(sessionKey);

  let total = 0;

  // --- drivers (also enriches headshots/team_colour + ergast bridge) ---
  const drivers = await openf1(admin, "/drivers", { session_key: sk });
  if (drivers.ok && drivers.rows.length) {
    const rows: Record<string, unknown>[] = [];
    for (const d of drivers.rows) {
      const acronym = toStr(d.name_acronym);
      const num = toInt(d.driver_number);
      const ergastId = await resolveErgastDriverId(admin, acronym, num);
      rows.push({
        openf1_session_key: sessionKey,
        driver_number: num,
        name_acronym: acronym,
        first_name: toStr(d.first_name),
        last_name: toStr(d.last_name),
        full_name: toStr(d.full_name),
        team_name: toStr(d.team_name),
        team_colour: toStr(d.team_colour),
        headshot_url: toStr(d.headshot_url),
        country_code: toStr(d.country_code),
        ergast_driver_id: ergastId,
        source: "openf1",
      });
      // OpenF1 wins for headshots (Ergast has none).
      if (ergastId && toStr(d.headshot_url)) {
        await admin
          .from("f1_driver")
          .update({ headshot_url: toStr(d.headshot_url) })
          .eq("ergast_id", ergastId)
          .is("headshot_url", null);
      }
    }
    await admin
      .from("f1_session_driver")
      .upsert(rows, { onConflict: "openf1_session_key,driver_number" });
    total += rows.length;
  }

  // --- weather ---
  const weather = await openf1(admin, "/weather", { session_key: sk });
  if (weather.ok && weather.rows.length) {
    const rows = weather.rows
      .filter((w: any) => w.date)
      .map((w: any) => ({
        openf1_session_key: sessionKey,
        date: toStr(w.date),
        air_temperature: toNum(w.air_temperature),
        track_temperature: toNum(w.track_temperature),
        humidity: toNum(w.humidity),
        pressure: toNum(w.pressure),
        wind_speed: toNum(w.wind_speed),
        wind_direction: toInt(w.wind_direction),
        rainfall: toInt(w.rainfall),
        source: "openf1",
      }));
    await admin
      .from("f1_weather")
      .upsert(rows, { onConflict: "openf1_session_key,date" });
    total += rows.length;
  }

  // --- starting_grid ---
  const grid = await openf1(admin, "/starting_grid", { session_key: sk });
  if (grid.ok && grid.rows.length) {
    const rows = grid.rows
      .filter((g: any) => g.driver_number != null)
      .map((g: any) => ({
        openf1_session_key: sessionKey,
        position: toInt(g.position),
        driver_number: toInt(g.driver_number),
        source: "openf1",
      }));
    await admin
      .from("f1_starting_grid")
      .upsert(rows, { onConflict: "openf1_session_key,driver_number" });
    total += rows.length;
  }

  // --- overtakes ---
  const overtakes = await openf1(admin, "/overtakes", { session_key: sk });
  if (overtakes.ok && overtakes.rows.length) {
    const rows = overtakes.rows
      .filter(
        (o: any) =>
          o.date && o.overtaking_driver_number != null &&
          o.overtaken_driver_number != null,
      )
      .map((o: any) => ({
        openf1_session_key: sessionKey,
        date: toStr(o.date),
        overtaking_driver_number: toInt(o.overtaking_driver_number),
        overtaken_driver_number: toInt(o.overtaken_driver_number),
        position: toInt(o.position),
        source: "openf1",
      }));
    await admin.from("f1_overtake").upsert(rows, {
      onConflict:
        "openf1_session_key,date,overtaking_driver_number,overtaken_driver_number",
    });
    total += rows.length;
  }

  // --- team_radio ---
  const radio = await openf1(admin, "/team_radio", { session_key: sk });
  if (radio.ok && radio.rows.length) {
    const rows = radio.rows
      .filter((r: any) => r.date && r.driver_number != null)
      .map((r: any) => ({
        openf1_session_key: sessionKey,
        driver_number: toInt(r.driver_number),
        date: toStr(r.date),
        recording_url: toStr(r.recording_url),
        source: "openf1",
      }));
    await admin
      .from("f1_team_radio")
      .upsert(rows, { onConflict: "openf1_session_key,driver_number,date" });
    total += rows.length;
  }

  // --- post-session position snapshot (NOT live; latest is left on proxy) ---
  const positions = await openf1(admin, "/position", { session_key: sk });
  if (positions.ok && positions.rows.length) {
    const rows = positions.rows
      .filter((p: any) => p.date && p.driver_number != null)
      .map((p: any) => ({
        openf1_session_key: sessionKey,
        driver_number: toInt(p.driver_number),
        date: toStr(p.date),
        position: toInt(p.position),
        source: "openf1",
      }));
    // Position can be large; chunk the upsert.
    for (let i = 0; i < rows.length; i += 500) {
      await admin
        .from("f1_position")
        .upsert(rows.slice(i, i + 500), {
          onConflict: "openf1_session_key,driver_number,date",
        });
    }
    total += rows.length;
  }

  return { status: "complete", source: "openf1", row_count: total };
}
