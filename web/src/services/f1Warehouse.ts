/**
 * f1Warehouse — thin Supabase-backed data adapter for the F1 data warehouse.
 *
 * Reads the read-optimized RPCs / views shipped in
 *   supabase/migrations/20260624130000_f1_serving.sql
 * and returns the SAME shapes the existing f1Service.ts hooks already consume,
 * so callers can be rewired one at a time with no parser changes.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DESIGN — DB-first with silent proxy fallback
 * ─────────────────────────────────────────────────────────────────────────────
 * Every function here follows the SAME contract:
 *   - Returns the assembled value when the warehouse has it (X-Source: DB).
 *   - Returns `null` on miss / error / disabled flag / out-of-window season,
 *     so the CALLER falls through to the existing fetchF1Api()/ergastFetch()
 *     proxy path untouched. A DB problem degrades to today's behavior, never a
 *     user-facing failure. (Mirrors entityService's null-on-error pattern.)
 *
 * The adapter is gated by TWO independent conditions:
 *   1. isDbServingEnabled()  — VITE_DB_SERVING_ENABLED === 'true' (default OFF).
 *      Shipping with the flag off makes every call a no-op (returns null).
 *   2. isServedFromDb(year)  — the warehouse only covers
 *      [currentYear-3 .. currentYear + future]. Older seasons return null and
 *      stay on the live proxy (historical fallback).
 *
 * VOLATILE domains (live standings, OpenF1 live/position/car_data) are NOT
 * served here — they keep their short-TTL proxy path. The warehouse only serves
 * DURABLE domains (schedule, results, qualifying, sprint, pitstops, laps) plus
 * end-of-window standings snapshots.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * INTEGRATION NOTE (do NOT rewire hooks yet — this is the seam, added off)
 * ─────────────────────────────────────────────────────────────────────────────
 * When ready to cut over (canonical phase S3/S4), the single touch-point is
 * web/src/lib/api/f1ApiFetch.ts. In fetchF1Api(), before the proxy branch:
 *
 *   import { tryWarehouse } from "@/services/f1Warehouse";
 *   const db = await tryWarehouse(source, pathWithQuery);
 *   if (db) return db;            // Response with X-Source: DB
 *   // ...existing proxy / direct chain unchanged...
 *
 * Because every f1Service.ts function already routes through ergastFetch ->
 * fetchF1Api, that one branch makes the whole app DB-first with ZERO edits to
 * f1Service.ts. The two bypass paths (useQualifyingToRaceDataByRound's raw
 * fetch + the Embeddable* widgets) should be switched to ergastFetch so they
 * inherit the same routing. Until that cutover lands, importing this module has
 * no effect (flag defaults off + nothing calls it).
 */

import { supabase } from "@/integrations/supabase/client";

// ───────────────────────────── flags / window ──────────────────────────────

/** Newest season minus this many years is the oldest the warehouse covers. */
const WINDOW_YEARS = 3;

/** True when DB-serving is explicitly enabled and Supabase is configured. */
export function isDbServingEnabled(): boolean {
  return (
    import.meta.env.VITE_DB_SERVING_ENABLED === "true" &&
    !!import.meta.env.VITE_SUPABASE_URL &&
    !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  );
}

/**
 * True when `year` is inside the warehouse coverage window
 * [currentYear-WINDOW_YEARS .. +inf]. Older seasons stay on the live proxy.
 */
export function isServedFromDb(year: number | undefined | null): boolean {
  if (!year || Number.isNaN(year)) return false;
  return year >= new Date().getFullYear() - WINDOW_YEARS;
}

/** Combined guard used by every adapter call. */
function canServe(year: number | undefined | null): boolean {
  return isDbServingEnabled() && isServedFromDb(year ?? undefined);
}

// ───────────────────────────── low-level RPC ───────────────────────────────

type Jsonish = unknown;

/**
 * Invoke a serving RPC and return its jsonb payload, or null on any error/miss.
 * Never throws — a DB problem must degrade to the proxy, not surface to the UI.
 */
async function rpc<T = Jsonish>(
  fn: string,
  args: Record<string, unknown>,
): Promise<T | null> {
  try {
    // Cast: `fn` is dynamic and the warehouse RPCs aren't in the generated
    // Database types, so the typed rpc() overload can't accept them.
    const { data, error } = await (
      supabase.rpc as unknown as (
        f: string,
        a: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>
    )(fn, args);
    if (error) {
      // Soft-fail: log once, let caller fall through to proxy.
      console.warn(`[f1Warehouse] rpc ${fn} error, falling back:`, error.message);
      return null;
    }
    return (data ?? null) as T | null;
  } catch (err) {
    console.warn(`[f1Warehouse] rpc ${fn} threw, falling back:`, err);
    return null;
  }
}

/** Treat empty arrays / empty objects as a MISS so the caller falls through. */
function isEmpty(value: Jsonish): boolean {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value as object).length === 0;
  return false;
}

/** Number-parse a round that may arrive as `"1"` or `1`. */
function toRound(round: number | string): number {
  return typeof round === "number" ? round : parseInt(round, 10);
}

// ─────────────────────────── public adapter API ────────────────────────────
// Each returns the SAME shape the matching f1Service.ts function exposes today,
// or null to signal "not served — use the proxy".

/**
 * Schedule for a season. Shape matches getRaceSchedule().data:
 *   RaceTable.Races[]  (each: {season, round, raceName, Circuit, date, time, ...})
 */
export async function getScheduleFromDb(year: number): Promise<unknown[] | null> {
  if (!canServe(year)) return null;
  const races = await rpc<unknown[]>("get_schedule", { p_season: year });
  if (races == null || isEmpty(races)) return null;
  return races;
}

/**
 * Race results for one round. Shape matches getRaceResults().data:
 *   RaceTable.Races[0]  (object with .Results[], .raceName, .Circuit, ...)
 */
export async function getRaceResultsFromDb(
  year: number,
  round: number | string,
): Promise<Record<string, unknown> | null> {
  if (!canServe(year)) return null;
  const race = await rpc<Record<string, unknown>>("get_race_results", {
    p_season: year,
    p_round: toRound(round),
  });
  if (race == null || isEmpty(race)) return null;
  // A race header with no Results[] means the round exists but isn't ingested
  // yet — fall through to the proxy rather than serving an empty grid.
  const results = race.Results;
  if (Array.isArray(results) && results.length === 0) return null;
  return race;
}

/** One row of a driver's season results (matches getDriverResultsBySeason().data). */
export interface DbDriverResult {
  round: string;
  raceName: string;
  date: string;
  circuit?: string;
  country?: string;
  position?: string;
  grid?: number;
  qualiPosition?: number;
  status?: string;
  isDNF: boolean;
  points: number;
  constructor?: string;
}

/**
 * A driver's whole-season race results, straight from the warehouse
 * (Modal/FastF1-fed) so the driver page never lags the Jolpica proxy on recent
 * rounds. Returns null for out-of-window (pre-warehouse) seasons so the caller
 * keeps the historical proxy path.
 *
 * NOTE: gated on the coverage WINDOW only — NOT the global
 * VITE_DB_SERVING_ENABLED flag. Driver results are a durable domain and this is a
 * deliberate targeted cutover; the flag governs the broad, all-domain switch.
 */
/** A classified finish (Finished / Lapped / "+N Lap(s)") is never a DNF, whatever
 *  the stored is_dnf flag says — guards against stale/legacy warehouse rows.
 *  Mirrors the same rule in f1Service + the ingest pipeline. */
const isClassifiedFinish = (status: string): boolean => {
  const s = (status ?? "").trim();
  return s === "Finished" || s === "Lapped" || /^\+\d+\s+Lap/i.test(s);
};

export async function getDriverSeasonResultsFromDb(
  year: number,
  driverId: string,
): Promise<DbDriverResult[] | null> {
  if (!isServedFromDb(year) || !driverId || !import.meta.env.VITE_SUPABASE_URL) return null;
  const rows = await rpc<Array<Record<string, unknown>>>("get_driver_season_results", {
    p_season: year,
    p_driver_id: driverId,
  });
  if (rows == null || isEmpty(rows)) return null;
  return rows.map((r) => ({
    round: String(r.round),
    raceName: (r.race_name as string) ?? "",
    date: (r.date as string) ?? "",
    circuit: (r.circuit as string) ?? undefined,
    country: (r.country as string) ?? undefined,
    position: r.position != null ? String(r.position) : undefined,
    grid: r.grid != null ? Number(r.grid) : undefined,
    qualiPosition: r.quali_position != null ? Number(r.quali_position) : undefined,
    status: (r.status as string) ?? "",
    isDNF: !!r.is_dnf && !isClassifiedFinish(String(r.status ?? "")),
    points: Number(r.points ?? 0),
    constructor: (r["constructor"] as string) ?? undefined,
  }));
}

/**
 * Qualifying for one round. Shape matches getRaceQualifying().data:
 *   RaceTable.Races[0]  (object with .QualifyingResults[]).
 */
export interface SeasonResultRow {
  round: number;
  raceName: string;
  driverId: string;
  code: string | null;
  driverName: string;
  constructorId: string | null;
  constructor: string | null;
  country: string | null;
  position: string | null;
  isDNF: boolean;
  status: string | null;
  points: number;
}

/** Whole-season results (all drivers × all rounds) from the warehouse — complete
 *  + correct is_dnf, unlike the lagging Jolpica aggregate. Not gated by the
 *  serving flag: the Reliability board always wants the full warehouse grid. */
export async function getSeasonResultsFromDb(year: number): Promise<SeasonResultRow[] | null> {
  if (!year || !import.meta.env.VITE_SUPABASE_URL) return null;
  const rows = await rpc<Array<Record<string, unknown>>>("get_season_results", { p_season: year });
  if (rows == null) return null;
  return rows.map((r) => ({
    round: Number(r.round),
    raceName: (r.race_name as string) ?? "",
    driverId: String(r.driver_id ?? ""),
    code: (r.code as string) ?? null,
    driverName: (r.driver_name as string) ?? "",
    constructorId: (r.constructor_id as string) ?? null,
    constructor: (r["constructor"] as string) ?? null,
    country: (r.country as string) ?? null,
    position: r.position != null ? String(r.position) : null,
    isDNF: !!r.is_dnf,
    status: (r.status as string) ?? null,
    points: Number(r.points ?? 0),
  }));
}

export async function getQualifyingFromDb(
  year: number,
  round: number | string,
): Promise<Record<string, unknown> | null> {
  if (!canServe(year)) return null;
  const race = await rpc<Record<string, unknown>>("get_qualifying", {
    p_season: year,
    p_round: toRound(round),
  });
  if (race == null || isEmpty(race)) return null;
  const q = race.QualifyingResults;
  if (Array.isArray(q) && q.length === 0) return null;
  return race;
}

/**
 * Laps completed per driver in qualifying, keyed by driverId.
 *
 * Ergast's qualifying payload has no lap count, so this is a DB-only extra — there's no
 * proxy fallback to degrade to. Returns {} (not null) on a miss so the caller can tell
 * "no lap data" apart from "still loading" and render the column as "—".
 */
export async function getQualifyingLapsFromDb(
  year: number,
  round: number | string,
): Promise<Record<string, number>> {
  if (!canServe(year)) return {};
  const laps = await rpc<Record<string, number>>("get_qualifying_laps", {
    p_season: year,
    p_round: toRound(round),
  });
  return laps ?? {};
}

/**
 * Sprint results for one round. Shape matches getSprintResults().data:
 *   RaceTable.Races[0]  (object with .SprintResults[]).
 */
export async function getSprintResultsFromDb(
  year: number,
  round: number | string,
): Promise<Record<string, unknown> | null> {
  if (!canServe(year)) return null;
  const race = await rpc<Record<string, unknown>>("get_sprint", {
    p_season: year,
    p_round: toRound(round),
  });
  if (race == null || isEmpty(race)) return null;
  const s = race.SprintResults;
  if (Array.isArray(s) && s.length === 0) return null;
  return race;
}

/**
 * Pit stops for one round. Shape matches getPitStops().data:
 *   RaceTable  (object; UI reads .Races[0].PitStops[]).
 */
export async function getPitStopsFromDb(
  year: number,
  round: number | string,
): Promise<Record<string, unknown> | null> {
  if (!canServe(year)) return null;
  const raceTable = await rpc<Record<string, unknown>>("get_pitstops", {
    p_season: year,
    p_round: toRound(round),
  });
  if (raceTable == null || isEmpty(raceTable)) return null;
  const races = raceTable.Races as Array<Record<string, unknown>> | undefined;
  const pits = races?.[0]?.PitStops;
  if (Array.isArray(pits) && pits.length === 0) return null;
  return raceTable;
}

/**
 * Lap times for one round. Shape matches getLapTimes().data:
 *   { Races: [{ Laps: [{ number, Timings: [...] }] }] }
 * This re-assembles server-side, replacing the client-side paginated fetch.
 */
export async function getLapTimesFromDb(
  year: number,
  round: number | string,
): Promise<{ Races: unknown[] } | null> {
  if (!canServe(year)) return null;
  const payload = await rpc<{ Races: Array<Record<string, unknown>> }>("get_laps", {
    p_season: year,
    p_round: toRound(round),
  });
  if (payload == null || !Array.isArray(payload.Races)) return null;
  const laps = payload.Races[0]?.Laps;
  if (!Array.isArray(laps) || laps.length === 0) return null;
  return payload;
}

/**
 * Driver standings. Shape matches getDriverStandings().data:
 *   StandingsLists[0].DriverStandings[]  (each: {position, points, wins,
 *   Driver, Constructors[]}). Pass round to pin a snapshot; omit for latest.
 *
 * NOTE: live in-season standings are VOLATILE — leave those on the proxy. Use
 * this only for completed-window snapshots once results have landed.
 */
export async function getDriverStandingsFromDb(
  year: number,
  round?: number,
): Promise<unknown[] | null> {
  if (!canServe(year)) return null;
  const standings = await rpc<unknown[]>("get_driver_standings", {
    p_season: year,
    p_round: round ?? null,
  });
  if (standings == null || isEmpty(standings)) return null;
  return standings;
}

/**
 * Constructor standings. Shape matches getConstructorStandings().data:
 *   StandingsLists[0].ConstructorStandings[].
 */
export async function getConstructorStandingsFromDb(
  year: number,
  round?: number,
): Promise<unknown[] | null> {
  if (!canServe(year)) return null;
  const standings = await rpc<unknown[]>("get_constructor_standings", {
    p_season: year,
    p_round: round ?? null,
  });
  if (standings == null || isEmpty(standings)) return null;
  return standings;
}

/**
 * Coverage check — is (domain, season[, round]) marked 'complete' in
 * f1_sync_state? Useful for the router to decide DB-first vs proxy before
 * paying for a full reassembly RPC. Returns false on any error.
 */
export async function hasCoverage(
  domain: string,
  season: number,
  round?: number,
): Promise<boolean> {
  if (!isDbServingEnabled()) return false;
  const ok = await rpc<boolean>("f1_has_coverage", {
    p_domain: domain,
    p_season: season,
    p_round: round ?? null,
  });
  return ok === true;
}

// ──────────────────────── router seam (path-based) ─────────────────────────

/**
 * Path -> RPC classifier for the eventual fetchF1Api() cutover. Parses the year
 * (and round, when present) out of an Ergast path and, when the warehouse can
 * serve it, returns a Response wrapping the assembled jsonb in the SAME
 * `{ MRData: { ...Table: {...} } }` envelope the upstream returns — so the
 * existing service mappers parse it unchanged. Returns null to fall through.
 *
 * Only DURABLE Ergast domains are routed here. OpenF1 + volatile standings are
 * intentionally NOT matched (they keep their proxy path). This is exported for
 * the f1ApiFetch.ts integration; it does nothing until that branch is wired AND
 * the flag is on.
 */
export async function tryWarehouse(
  source: "ergast" | "openf1",
  pathWithQuery: string,
): Promise<Response | null> {
  if (source !== "ergast") return null; // OpenF1 stays on proxy for now
  if (!isDbServingEnabled()) return null;

  const path = pathWithQuery.split("?")[0];

  // /f1/{year}.json  -> schedule
  let m = path.match(/\/f1\/(\d{4})\.json$/);
  if (m) {
    const races = await getScheduleFromDb(Number(m[1]));
    if (!races) return null;
    return dbResponse({ RaceTable: { season: m[1], Races: races } });
  }

  // /f1/{year}/{round}/results.json
  m = path.match(/\/f1\/(\d{4})\/(\d+)\/results\.json$/);
  if (m) {
    const race = await getRaceResultsFromDb(Number(m[1]), m[2]);
    if (!race) return null;
    return dbResponse({ RaceTable: { season: m[1], round: m[2], Races: [race] } });
  }

  // /f1/{year}/{round}/qualifying.json
  m = path.match(/\/f1\/(\d{4})\/(\d+)\/qualifying\.json$/);
  if (m) {
    const race = await getQualifyingFromDb(Number(m[1]), m[2]);
    if (!race) return null;
    return dbResponse({ RaceTable: { season: m[1], round: m[2], Races: [race] } });
  }

  // /f1/{year}/{round}/sprint.json
  m = path.match(/\/f1\/(\d{4})\/(\d+)\/sprint\.json$/);
  if (m) {
    const race = await getSprintResultsFromDb(Number(m[1]), m[2]);
    if (!race) return null;
    return dbResponse({ RaceTable: { season: m[1], round: m[2], Races: [race] } });
  }

  // /f1/{year}/{round}/pitstops(.json)?  (page params dropped — DB returns full)
  m = path.match(/\/f1\/(\d{4})\/(\d+)\/pitstops(\.json)?$/);
  if (m) {
    const raceTable = await getPitStopsFromDb(Number(m[1]), m[2]);
    if (!raceTable) return null;
    return dbResponse({ RaceTable: raceTable });
  }

  // /f1/{year}/{round}/laps(.json)?  -> reassembled, client no longer paginates
  m = path.match(/\/f1\/(\d{4})\/(\d+)\/laps(\.json)?$/);
  if (m) {
    const payload = await getLapTimesFromDb(Number(m[1]), m[2]);
    if (!payload) return null;
    return dbResponse({ RaceTable: { season: m[1], round: m[2], Races: payload.Races } });
  }

  // /f1/{year}/driverStandings.json
  //
  // These were deliberately left on the proxy as "volatile in-season" data. That reasoning
  // was backwards: Ergast/Jolpica publishes a race hours after the flag, so the proxy is
  // precisely the stale source in the window where standings matter most — for several
  // hours after Spa 2026 the table still showed the pre-race totals, with the winner's 25
  // points missing. Our own standings are recomputed from race + sprint results on every
  // ingest, so serve those and let the adapter fall through to the proxy on a miss.
  m = path.match(/\/f1\/(\d{4})\/driverStandings\.json$/);
  if (m) {
    const standings = await getDriverStandingsFromDb(Number(m[1]));
    if (!standings) return null;
    return dbResponse({
      StandingsTable: {
        season: m[1],
        StandingsLists: [{ season: m[1], DriverStandings: standings }],
      },
    });
  }

  // /f1/{year}/constructorStandings.json
  m = path.match(/\/f1\/(\d{4})\/constructorStandings\.json$/);
  if (m) {
    const standings = await getConstructorStandingsFromDb(Number(m[1]));
    if (!standings) return null;
    return dbResponse({
      StandingsTable: {
        season: m[1],
        StandingsLists: [{ season: m[1], ConstructorStandings: standings }],
      },
    });
  }

  return null;
}

/** Wrap an assembled MRData payload in a Response tagged X-Source: DB. */
function dbResponse(mrData: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ MRData: mrData }), {
    status: 200,
    headers: { "Content-Type": "application/json", "X-Source": "DB" },
  });
}
