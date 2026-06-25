import { useQuery } from "@tanstack/react-query";
import { getCircuitDetail } from "@/services/circuitService";

export function useCircuitDetail(circuitId?: string) {
  return useQuery({
    queryKey: ["circuitDetail", circuitId],
    queryFn: () => getCircuitDetail(circuitId as string),
    enabled: !!circuitId,
    staleTime: 24 * 60 * 60 * 1000,
  });
}
