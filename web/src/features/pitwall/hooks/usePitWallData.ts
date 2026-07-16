import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchRaceReplayBlob,
  getRaceReplay,
  type RaceReplayBlob,
} from "@/services/raceReplayService";
import { getTelemetryIndex, type TelemetryIndexRow } from "@/services/telemetryService";

export interface PitWallDriver {
  code: string;
  driver_id: string | null;
  number: number | null;
  team_color: string | null;
}

/**
 * Core Pit Wall data for a season/round/session: the whole-session replay blob
 * (positions/gaps/sectors/tyre/safety/overtakes for ALL laps) plus the telemetry
 * index (which laps have deep telemetry). Driver roster is derived from whichever
 * source is present. Replay blob cache is shared with Race Control.
 */
export function usePitWallData(
  year: number,
  round: number | null,
  session: string,
) {
  const enabled = !!round;

  const index = useQuery({
    queryKey: ["race-replay", "index", year, round, session],
    queryFn: () => getRaceReplay(year, round as number, session),
    enabled,
    staleTime: 60 * 60 * 1000,
  });

  const publicUrl = index.data?.public_url;
  const replay = useQuery({
    queryKey: ["race-replay", "blob", publicUrl],
    queryFn: () => fetchRaceReplayBlob(publicUrl as string),
    enabled: !!publicUrl,
    staleTime: 60 * 60 * 1000,
  });

  const telemetryIndex = useQuery({
    queryKey: ["telemetryIndex", year, round, session],
    queryFn: () => getTelemetryIndex(year, round as number, session),
    enabled,
    staleTime: 60 * 60 * 1000,
  });

  const blob: RaceReplayBlob | undefined = replay.data;

  const drivers: PitWallDriver[] = useMemo(() => {
    if (blob?.drivers?.length) {
      return blob.drivers
        .map((d) => ({
          code: d.code ?? "",
          driver_id: d.driver_id ?? null,
          number: d.number ?? null,
          team_color: d.team_color ?? null,
        }))
        .filter((d) => d.code);
    }
    // Fallback: derive roster from the telemetry index when no replay exists.
    const rows = (telemetryIndex.data ?? []) as TelemetryIndexRow[];
    const seen = new Map<string, PitWallDriver>();
    for (const r of rows) {
      if (!seen.has(r.driver_code)) {
        seen.set(r.driver_code, {
          code: r.driver_code,
          driver_id: r.driver_id,
          number: null,
          team_color: null,
        });
      }
    }
    return [...seen.values()];
  }, [blob, telemetryIndex.data]);

  return {
    blob,
    drivers,
    telemetryIndex: (telemetryIndex.data ?? []) as TelemetryIndexRow[],
    hasReplay: !!index.data,
    isLoading: enabled && (index.isLoading || replay.isLoading),
    isError: index.isError || replay.isError,
  };
}
