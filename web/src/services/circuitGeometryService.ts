import { supabase } from "@/integrations/supabase/client";
import { blobUrl } from "@/lib/blobUrl";
import { cdnJson } from "@/lib/cdnJson";

/** Discovery row from get_circuit_geometry — points at a Storage JSON blob. */
export type CircuitGeometryIndexRow = {
  season: number;
  round: number;
  circuit_id: string;
  circuit_name: string | null;
  storage_path: string;
  public_url: string;
  corner_count: number | null;
  straight_count: number | null;
  rotation: number | null;
  source: string;
};

export type CircuitCorner = {
  n: number;
  letter: string;
  x: number;
  y: number;
  d: number | null;
  angle: number | null;
};
export type CircuitMarshalSector = { n: number | null; x: number; y: number; d: number | null };
/** A full-throttle stretch of the fastest lap. NOT a DRS zone (2026 has none). */
export type CircuitStraight = { start_d: number; end_d: number; length: number };

/** Telemetry-derived circuit geometry blob (FastF1 fastest-lap outline + corners). */
export type CircuitGeometryBlob = {
  season: number;
  round: number;
  circuit_id: string;
  circuit_name: string | null;
  rotation: number;
  bounds: { min_x: number; max_x: number; min_y: number; max_y: number };
  /** [x, y, distance] points along the lap, oriented for display. */
  outline: [number, number, number][];
  corners: CircuitCorner[];
  marshal_sectors: CircuitMarshalSector[];
  straights: CircuitStraight[];
  source: string;
};

// Generated Database types don't include our hand-written RPCs, so call through an
// untyped cast — mirrors services/telemetryService.ts.
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

/** Geometry index row for a race (season, round), or null if not extracted yet. */
export async function getCircuitGeometry(
  season: number,
  round: number,
): Promise<CircuitGeometryIndexRow | null> {
  // CDN first (analysis/index_export.py); RPC only when the season file is missing.
  const indexed = await cdnJson<CircuitGeometryIndexRow[]>(`index/circuits/${season}.json`);
  const rows = indexed
    ? indexed.filter((r) => r.round === round)
    : await rpc<CircuitGeometryIndexRow[]>("get_circuit_geometry", {
        p_season: season,
        p_round: round,
      });
  const row = rows[0];
  return row ? { ...row, public_url: blobUrl("circuits", row.storage_path, row.public_url) } : null;
}

/** Geometry for a circuit by Ergast id (most recent season, or a pinned one). */
export async function getCircuitGeometryByCircuit(
  circuitId: string,
  season?: number,
): Promise<CircuitGeometryIndexRow | null> {
  // CDN first: the combined file spans every season; pick the pinned season or the most
  // recent geometry for the circuit. RPC only when the file is missing.
  const all = await cdnJson<CircuitGeometryIndexRow[]>("index/circuits/all.json");
  const rows = all
    ? all
        .filter((r) => r.circuit_id === circuitId && (season == null || r.season === season))
        .sort((a, b) => b.season - a.season)
    : await rpc<CircuitGeometryIndexRow[]>("get_circuit_geometry_by_circuit", {
        p_circuit_id: circuitId,
        p_season: season ?? null,
      });
  const row = rows[0];
  return row ? { ...row, public_url: blobUrl("circuits", row.storage_path, row.public_url) } : null;
}

/** Fetch a geometry blob from public Storage. */
export async function fetchCircuitGeometryBlob(url: string): Promise<CircuitGeometryBlob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`circuit geometry fetch failed: ${res.status}`);
  return res.json();
}
