import { useQueries, useQuery } from "@tanstack/react-query";
import {
  fetchTelemetryBlob,
  getTelemetryIndex,
  type TelemetryBlob,
  type TelemetryIndexRow,
} from "@/services/telemetryService";

/** Discover which driver laps have telemetry for a session. */
export function useTelemetryIndex(year?: number, round?: number, session = "R") {
  return useQuery({
    queryKey: ["telemetryIndex", year, round, session],
    queryFn: () => getTelemetryIndex(year as number, round as number, session),
    enabled: !!year && !!round,
    staleTime: 60 * 60 * 1000,
  });
}

/** Fetch the telemetry blobs for the selected driver codes (parallel, cached). */
export function useTelemetryLaps(
  rows: TelemetryIndexRow[] | undefined,
  codes: string[],
) {
  const selected = (rows ?? []).filter((r) => codes.includes(r.driver_code));
  const queries = useQueries({
    queries: selected.map((r) => ({
      queryKey: ["telemetryBlob", r.public_url],
      queryFn: () => fetchTelemetryBlob(r.public_url),
      staleTime: 24 * 60 * 60 * 1000,
    })),
  });
  const laps = queries
    .map((q) => q.data)
    .filter((d): d is TelemetryBlob => Boolean(d));
  const isLoading = queries.some((q) => q.isLoading);
  return { laps, isLoading };
}
