import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Edition {
  season: number;
  round: number;
  race_name?: string;
  winner?: string;
  winner_name?: string;
  winner_id?: string;
  winner_team?: string;
  winner_team_id?: string;
  pole?: string;
}

/** Every edition at a circuit with its winner and pole (warehouse, get_circuit_history_by_circuit). */
export function useCircuitHistory(circuitId?: string) {
  return useQuery({
    queryKey: ["circuitHistory", circuitId],
    enabled: !!circuitId,
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (
        supabase.rpc as unknown as (fn: string, args: object) => Promise<{ data: Edition[] | null; error: unknown }>
      )("get_circuit_history_by_circuit", { p_circuit_id: circuitId });
      if (error) return [] as Edition[];
      return (data ?? []) as Edition[];
    },
  });
}
