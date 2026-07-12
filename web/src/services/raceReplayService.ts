import { supabase } from "@/integrations/supabase/client";

/** Discovery row from get_race_replay — points at a Storage JSON blob. */
export type RaceReplayIndexRow = {
  season: number;
  round: number;
  circuit_id: string;
  circuit_name: string | null;
  storage_path: string;
  public_url: string;
  driver_count: number | null;
  frames: number | null;
  duration_s: number | null;
  rotation: number | null;
  source: string;
};

/** One completed lap's timing for a driver (seconds from green for ts/te, ms sectors). */
export type ReplayLap = {
  n: number;
  ts: number;
  te: number | null;
  last: number | null;
  s1: number | null;
  s2: number | null;
  s3: number | null;
  /** Tyre compound letter (S/M/H/I/W) and age in laps. */
  tyre?: string | null;
  tyl?: number | null;
  pit: boolean;
};

/** One driver's whole-race track, aligned to the blob's shared `times`.
 *  `xy[i]` is [x, y] at `times[i]` (null off-track); `pos`/`gap` are per-frame. */
export type ReplayDriver = {
  driver_id: string;
  code: string | null;
  number: number | null;
  team_color: string | null;
  xy: ([number, number] | null)[];
  /** Live position per frame (1 = leader), null when not classified. */
  pos?: (number | null)[];
  /** Gap to leader in seconds, per frame. */
  gap?: (number | null)[];
  /** Per-completed-lap timing (sectors, last lap, pit). */
  laps?: ReplayLap[];
  /** DRS-open windows [t0, t1] in seconds from green. */
  drs?: [number, number][];
};

/** A safety-car / VSC / red-flag window, in seconds from the green flag. */
export type ReplaySafetyPeriod = {
  kind: "SC" | "VSC" | "RED";
  start_s: number;
  end_s: number;
};

/** A race-control message, stamped in seconds from green. */
export type ReplayRaceControl = { t: number; kind: string; msg: string };

/** A time-stamped overtake (driver ids). */
export type ReplayOvertake = { t: number; by: string | null; on: string | null };

export type RaceReplayBlob = {
  season: number;
  round: number;
  circuit_id: string;
  circuit_name: string | null;
  rotation: number;
  frames: number;
  duration_s: number;
  total_laps?: number;
  bounds: { min_x: number; max_x: number; min_y: number; max_y: number };
  /** Seconds from the green flag, one per frame. */
  times: number[];
  /** SC/VSC/red-flag windows (seconds from green). Absent on pre-safety blobs. */
  safety?: ReplaySafetyPeriod[];
  /** Race-control feed. */
  rc?: ReplayRaceControl[];
  /** Overtake feed. */
  overtakes?: ReplayOvertake[];
  drivers: ReplayDriver[];
  source: string;
};

// Hand-written RPCs aren't in the generated types — untyped cast (mirrors
// circuitGeometryService.ts / telemetryService.ts).
async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (
    supabase.rpc as unknown as (
      f: string,
      a: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>
  )(fn, args);
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

/** Replay index for a race (season, round), or null if not exported yet. */
export async function getRaceReplay(season: number, round: number): Promise<RaceReplayIndexRow | null> {
  const rows = await rpc<RaceReplayIndexRow[]>("get_race_replay", { p_season: season, p_round: round });
  return rows[0] ?? null;
}

/** Fetch a replay blob from public Storage. */
export async function fetchRaceReplayBlob(url: string): Promise<RaceReplayBlob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`race replay fetch failed: ${res.status}`);
  return res.json();
}
