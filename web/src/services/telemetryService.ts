import { supabase } from "@/integrations/supabase/client";

/** One discovery row from get_telemetry_index — points at a Storage JSON blob. */
export type TelemetryIndexRow = {
  season: number;
  round: number;
  session: string;
  driver_id: string | null;
  driver_code: string;
  lap_number: number;
  lap_type: string;
  storage_path: string;
  public_url: string;
  top_speed: number | null;
  source: string;
};

/** A decimated lap telemetry blob (FastF1, ~400 samples by distance). */
export type TelemetryBlob = {
  season: number;
  round: number;
  session: string;
  driver: string;
  driver_id: string | null;
  team: string | null;
  team_color: string | null;
  lap_number: number;
  lap_time: string | null;
  compound: string | null;
  samples: number;
  channels: Record<string, number[]>;
  metrics: {
    top_speed?: number;
    avg_speed?: number;
    full_throttle_pct?: number | null;
    brake_zones?: number;
  };
};

// Generated Database types don't include our hand-written RPCs (Functions: {}),
// so call through an untyped cast — mirrors services/f1Warehouse.ts.
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

/** Available telemetry laps for a session (drivers + Storage URLs). */
export async function getTelemetryIndex(
  year: number,
  round: number,
  session = "R",
): Promise<TelemetryIndexRow[]> {
  return rpc<TelemetryIndexRow[]>("get_telemetry_index", {
    p_season: year,
    p_round: round,
    p_session: session,
  });
}

/** Fetch one telemetry blob from public Storage. */
export async function fetchTelemetryBlob(url: string): Promise<TelemetryBlob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`telemetry fetch failed: ${res.status}`);
  return res.json();
}
