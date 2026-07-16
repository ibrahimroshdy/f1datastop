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
  const { fastestByCode, available } = useMemo(() => {
    const fastestByCode = new Map<string, number>();
    const available = new Set<string>();
    for (const r of index) {
      available.add(`${r.driver_code}:${r.lap_number}`);
      if (r.lap_type === "fastest" && !fastestByCode.has(r.driver_code)) {
        fastestByCode.set(r.driver_code, r.lap_number);
      }
    }
    return { fastestByCode, available };
  }, [index]);

  // A specific lap only loads if it's already exported for that driver; otherwise fall
  // back to the driver's fastest lap so the chart always renders (never freezes on an
  // ungenerated lap). True any-lap needs the Modal export queue (auth-gated).
  const targets = drivers.map((code) =>
    lap != null && available.has(`${code}:${lap}`) ? lap : fastestByCode.get(code) ?? null,
  );

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
