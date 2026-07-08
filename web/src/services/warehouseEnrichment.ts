import { supabase } from "@/integrations/supabase/client";

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

export const getWeather = (season: number, round: number, session = "R") =>
  rpc<DbWeatherRow>("get_weather", { p_season: season, p_round: round, p_session: session });

export const getOvertakes = (season: number, round: number, session = "R") =>
  rpc<DbOvertakeRow>("get_overtakes", { p_season: season, p_round: round, p_session: session });

export const getRaceControl = (season: number, round: number, session = "R") =>
  rpc<DbRaceControlRow>("get_race_control", { p_season: season, p_round: round, p_session: session });

export const getSessionsDb = (season: number, round?: number) =>
  rpc<DbSessionRow>("get_sessions", { p_season: season, p_round: round ?? null });

export const getLapsDb = (season: number, round: number, session = "R") =>
  rpc<DbLapRow>("get_lap_positions", { p_season: season, p_round: round, p_session: session });
