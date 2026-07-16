import { useQuery } from "@tanstack/react-query";
import { resolveLapTelemetry, type LapTelemetryState } from "@/services/telemetryRequestService";

const POLL_MS = 4000;

/**
 * Resolve deep telemetry for ONE driver+lap on the Pit Wall.
 * - Fastest / already-exported laps → resolves instantly to `done`.
 * - Any other lap → enqueues a Modal export (auth required) and polls until ready.
 * The UI reads `status` to show generating / sign-in / error states.
 */
export function useLapTelemetry(
  season: number | undefined,
  round: number | undefined,
  session: string,
  driver: string | undefined,
  lap: number | undefined,
  enabled = true,
) {
  const on = enabled && !!season && !!round && !!driver && lap != null;
  return useQuery<LapTelemetryState>({
    queryKey: ["pitwall", "lap-telemetry", season, round, session, driver, lap],
    enabled: on,
    queryFn: () => resolveLapTelemetry(season!, round!, session, driver!, lap!),
    refetchInterval: (query) => {
      const status = (query.state.data as LapTelemetryState | undefined)?.status;
      return status === "queued" || status === "processing" ? POLL_MS : false;
    },
    staleTime: 60_000,
  });
}
