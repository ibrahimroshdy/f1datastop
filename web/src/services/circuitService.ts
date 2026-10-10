import { supabase } from "@/integrations/supabase/client";

export type CircuitDetail = {
  circuit_id: string;
  name: string;
  locality: string;
  country: string;
  lat: number | null;
  lng: number | null;
  url: string | null;
  record_driver_id: string | null;
  record_driver_name: string | null;
  record_driver_code: string | null;
  record_time: string | null;
  record_season: number | null;
  record_round: number | null;
  races_in_db: number | null;
  first_season: number | null;
  last_season: number | null;
};

// Generated Database types omit our hand-written RPCs — call through an untyped
// cast (mirrors services/f1Warehouse.ts + telemetryService.ts).
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

export async function getCircuitDetail(circuitId: string): Promise<CircuitDetail | null> {
  const rows = await rpc<CircuitDetail[]>("get_circuit_detail", { p_circuit_id: circuitId });
  return rows?.[0] ?? null;
}
