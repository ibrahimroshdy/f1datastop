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

/** Available telemetry laps for a session (drivers + Storage URLs).
 *
 *  `scope` decides how much of the index you get:
 *    "fastest" (default) — one row per driver, their fastest lap. What every
 *      fastest-lap comparison view wants.
 *    "all" — every exported lap. Only Pit Wall needs this, for any-lap scrubbing.
 *
 *  This used to be unfiltered, which was fine while the index only ever held fastest
 *  laps. Once telemetry_export.py --all-laps ran, a single practice session went from
 *  22 rows to 486, and every consumer that assumed one-lap-per-driver started rendering
 *  a column set per lap. Defaulting to "fastest" restores that assumption; Pit Wall
 *  opts out explicitly.
 */
export async function getTelemetryIndex(
  year: number,
  round: number,
  session = "R",
  scope: "fastest" | "all" = "fastest",
): Promise<TelemetryIndexRow[]> {
  const rows = await rpc<TelemetryIndexRow[]>("get_telemetry_index", {
    p_season: year,
    p_round: round,
    p_session: session,
  });
  if (scope === "all") return rows;
  // Keep one row per driver. Prefer the row explicitly marked fastest; fall back to the
  // first seen so a driver never vanishes if lap_type is missing on older exports.
  const byDriver = new Map<string, TelemetryIndexRow>();
  for (const r of rows) {
    const cur = byDriver.get(r.driver_code);
    if (!cur || (r.lap_type === "fastest" && cur.lap_type !== "fastest")) {
      byDriver.set(r.driver_code, r);
    }
  }
  return [...byDriver.values()];
}

/** Fetch one telemetry blob from public Storage. */
export async function fetchTelemetryBlob(url: string): Promise<TelemetryBlob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`telemetry fetch failed: ${res.status}`);
  return res.json();
}
