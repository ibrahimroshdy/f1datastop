import { supabase } from "@/integrations/supabase/client";
import { cdnJson } from "@/lib/cdnJson";

/** Thin wrapper over the FastF1-native serving RPCs. Never throws — degrades to
 *  an empty array so the UI shows its own empty-state. */
async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T[]> {
  const { data, error } = await (supabase as unknown as {
    rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  }).rpc(fn, args);
  if (error) {
    console.warn(`[warehouse] ${fn}:`, error.message);
    return [];
  }
  return (Array.isArray(data) ? data : []) as T[];
}

export interface DbWeatherRow {
  time_seconds: number | null;
  air_temp: number | null;
  track_temp: number | null;
  humidity: number | null;
  pressure: number | null;
  wind_speed: number | null;
  wind_direction: number | null;
  rainfall: boolean | null;
}

export interface DbOvertakeRow {
  lap_number: number;
  overtaking_driver_id: string;
  overtaken_driver_id: string;
  position: number | null;
}

export interface DbRaceControlRow {
  time_utc: string | null;
  lap_number: number | null;
  category: string | null;
  message: string | null;
  flag: string | null;
  scope: string | null;
  sector: number | null;
  driver_number: number | null;
}

export interface DbSessionRow {
  season: number;
  round: number;
  session_type: string;
  session_name: string;
  date_start: string | null;
  date_end: string | null;
}

export interface DbLapRow {
  lap_number: number;
  driver_id: string;
  position: number | null;
  time_text: string | null;
  time_millis: number | null;
}

/** Race weather. CDN first (analysis/weather_export.py re-derives it from FastF1 and
 *  publishes the RPC's exact row shape), RPC as the fallback. */
export const getWeather = async (
  season: number,
  round: number,
  session = "R",
): Promise<DbWeatherRow[]> => {
  const fromCdn = await cdnJson<DbWeatherRow[]>(`${season}/${round}/weather_${session}.json`);
  if (Array.isArray(fromCdn) && fromCdn.length > 0) return fromCdn;
  return rpc<DbWeatherRow>("get_weather", { p_season: season, p_round: round, p_session: session });
};

export const getOvertakes = (season: number, round: number, session = "R") =>
  rpc<DbOvertakeRow>("get_overtakes", { p_season: season, p_round: round, p_session: session });

export const getRaceControl = (season: number, round: number, session = "R") =>
  rpc<DbRaceControlRow>("get_race_control", { p_season: season, p_round: round, p_session: session });

/** Map a schedule entry's session blocks to f1_session.session_type codes. */
const SCHEDULE_SESSIONS: [string, string, string][] = [
  ["FirstPractice", "FP1", "Practice 1"],
  ["SecondPractice", "FP2", "Practice 2"],
  ["ThirdPractice", "FP3", "Practice 3"],
  ["SprintQualifying", "SQ", "Sprint Qualifying"],
  ["SprintShootout", "SS", "Sprint Shootout"],
  ["Sprint", "S", "Sprint"],
  ["Qualifying", "Q", "Qualifying"],
];

type ScheduleRace = {
  round?: string;
  date?: string;
  time?: string;
} & Record<string, { date?: string; time?: string } | string | undefined>;

const startOf = (b: { date?: string; time?: string } | undefined) =>
  b?.date ? `${b.date}T${b.time ?? "00:00:00Z"}` : null;

/**
 * Sessions for a round. Derived from the CDN schedule, which already carries every
 * session's start time — so the picker costs no database query at all.
 *
 * This was the last per-round RPC still firing on every page view. It is cheap
 * individually but it is the one call a visitor makes on EVERY race they open, so it
 * dominated the residual load once the results/qualifying/sprint fall-through was closed.
 * Falls back to the RPC when the season's schedule is not on the CDN.
 */
export const getSessionsDb = async (season: number, round?: number): Promise<DbSessionRow[]> => {
  const races = await cdnJson<ScheduleRace[]>(`${season}/schedule.json`);
  if (Array.isArray(races) && races.length) {
    const wanted = races.filter((r) => round == null || Number(r.round) === Number(round));
    const rows: DbSessionRow[] = [];
    for (const race of wanted) {
      const rnd = Number(race.round);
      for (const [key, code, name] of SCHEDULE_SESSIONS) {
        const start = startOf(race[key] as { date?: string; time?: string } | undefined);
        if (start) {
          rows.push({ season, round: rnd, session_type: code, session_name: name,
                      date_start: start, date_end: null });
        }
      }
      const raceStart = startOf({ date: race.date, time: race.time });
      if (raceStart) {
        rows.push({ season, round: rnd, session_type: "R", session_name: "Race",
                    date_start: raceStart, date_end: null });
      }
    }
    if (rows.length) return rows;
  }
  return rpc<DbSessionRow>("get_sessions", { p_season: season, p_round: round ?? null });
};

export const getLapsDb = (season: number, round: number, session = "R") =>
  rpc<DbLapRow>("get_lap_positions", { p_season: season, p_round: round, p_session: session });

export interface DbPitRow {
  driver_id: string;
  lap_number: number;
}

/** Pit stops flattened to {driver_id, lap} rows. get_pitstops returns a nested
 *  RaceTable object (not an array), so it can't use the array rpc() helper — and
 *  it's ungated here (unlike getPitStopsFromDb) so the race replay always sees it. */
export const getPitLaps = async (season: number, round: number): Promise<DbPitRow[]> => {
  const { data, error } = await (supabase as unknown as {
    rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  }).rpc("get_pitstops", { p_season: season, p_round: round });
  if (error) {
    console.warn(`[warehouse] get_pitstops:`, error.message);
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped RaceTable jsonb
  const pits = ((data as any)?.Races?.[0]?.PitStops ?? []) as { driverId?: string; lap?: string | number }[];
  return pits
    .map((p) => ({ driver_id: p.driverId ?? "", lap_number: Number(p.lap) }))
    .filter((r) => r.driver_id && Number.isFinite(r.lap_number));
};
