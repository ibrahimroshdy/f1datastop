import { useQuery } from "@tanstack/react-query";
import * as f1Service from "@/services/f1Service";
import { f1Keys } from "@/lib/f1/queryKeys";
import { defaultRetryConfig } from "./retryConfig";

export const useDriverInfo = (year?: number) => {
  return useQuery({
    queryKey: f1Keys.driverInfo(year),
    queryFn: () => f1Service.getDriverInfo(year),
    staleTime: 1000 * 30, // 30 seconds
    ...defaultRetryConfig,
  });
};

// Driver results by season (points per race). `enabled` lets callers disable the
// per-driver fetch when the data is supplied from the batched season query below.
export const useDriverResultsBySeason = (year: number, driverId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: f1Keys.driverResultsBySeason(year, driverId),
    queryFn: () => f1Service.getDriverResultsBySeason(year, driverId),
    staleTime: 1000 * 60 * 60, // 1h — season results change slowly; fewer Jolpica bursts when scrolling drivers
    enabled: enabled && !!year && !!driverId,
    ...defaultRetryConfig,
  });
};

// All drivers' season results in ONE request, grouped by driverId.
// Use on the Drivers grid to avoid the per-card N+1 (was ~1 request per driver).
export const useAllDriverResultsBySeason = (year: number) => {
  return useQuery({
    queryKey: f1Keys.allDriverResultsBySeason(year),
    queryFn: () => f1Service.getAllDriverResultsBySeason(year),
    staleTime: 1000 * 60 * 60, // 1h
    enabled: !!year,
    ...defaultRetryConfig,
  });
};
