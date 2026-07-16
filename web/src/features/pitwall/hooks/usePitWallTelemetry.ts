import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { resolveLapTelemetry, type LapTelemetryState } from "@/services/telemetryRequestService";
import type { TelemetryIndexRow } from "@/services/telemetryService";

export interface DriverTelemetry {
  code: string;
  /** Resolved target lap (clicked lap, else the driver's fastest). */
  lap: number | null;
  state: LapTelemetryState | undefined;
  isLoading: boolean;
}

const POLL_MS = 4000;

/**
 * Deep telemetry for several drivers at once. Default lap = each driver's fastest
 * (instant, pre-exported); a clicked lap resolves via the on-demand queue. Poll while
 * any request is generating.
 */
export function usePitWallTelemetry(
  year: number,
  round: number | null,
  session: string,
  drivers: string[],
  lap: number | null,
  index: TelemetryIndexRow[],
): DriverTelemetry[] {
  const fastestByCode = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of index) {
      if (r.lap_type === "fastest" && !m.has(r.driver_code)) m.set(r.driver_code, r.lap_number);
    }
    return m;
  }, [index]);

  const targets = drivers.map((code) => lap ?? fastestByCode.get(code) ?? null);

  const results = useQueries({
    queries: drivers.map((code, i) => {
      const target = targets[i];
      return {
        queryKey: ["pitwall", "lap-telemetry", year, round, session, code, target],
        enabled: !!round && target != null,
        queryFn: () => resolveLapTelemetry(year, round as number, session, code, target as number),
        refetchInterval: (query: { state: { data?: LapTelemetryState } }) => {
          const s = query.state.data?.status;
          return s === "queued" || s === "processing" ? POLL_MS : false;
        },
        staleTime: 60_000,
      };
    }),
  });

  return drivers.map((code, i) => ({
    code,
    lap: targets[i],
    state: results[i]?.data as LapTelemetryState | undefined,
    isLoading: results[i]?.isLoading ?? false,
  }));
}
