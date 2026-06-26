import React, { useMemo } from 'react';
import { Zap } from 'lucide-react';
import { useLapData, useDrivers, useOpenF1SessionFromErgast, usePositionData } from "@/hooks/useOpenF1Data";
import { formatTime } from "@/utils/lapTimeUtils";
import { getTeamColorById } from '@/constants/f1Colors';
import {
  PositionBadge,
  F1Badge,
  F1Skeleton,
  F1EmptyState,
  F1ErrorState,
} from "@/components/f1";

interface SessionResultsProps {
  year: number;
  round: string;
  sessionType?: string;
  sessionKey?: number;
  sessionName?: string;
}

interface ProcessedResult {
  id: number;
  position: number;
  driver_number: number;
  driver_name: string;
  driver_acronym: string;
  constructor_name: string;
  best_lap_time: number | null;
  gap_to_leader: number;
  total_laps: number;
  team_color: string;
}

const SessionResults: React.FC<SessionResultsProps> = ({
  year,
  round,
  sessionType = "Race",
  sessionKey: externalSessionKey
}) => {
  const {
    data: sessionData,
    isLoading: isSessionLoading
  } = useOpenF1SessionFromErgast(
    externalSessionKey ? 0 : year,
    externalSessionKey ? "" : round,
    externalSessionKey ? "" : sessionType
  );

  const effectiveSessionKey = externalSessionKey || sessionData?.data?.session_key || 0;

  const {
    data: driversData,
    isLoading: isDriversLoading
  } = useDrivers(effectiveSessionKey);

  const {
    data: lapData,
    isLoading: isLapDataLoading,
    error: lapDataError
  } = useLapData(effectiveSessionKey);

  const {
    data: positionData,
    isLoading: isPositionDataLoading,
    error: positionDataError
  } = usePositionData(effectiveSessionKey);

  const processedResults = useMemo<ProcessedResult[]>(() => {
    if (!positionData?.data || !driversData?.data || !lapData?.data) return [];

    const driverResults: { [key: number]: ProcessedResult } = {};

    driversData.data.forEach((driver: any) => {
      driverResults[driver.driver_number] = {
        id: driver.driver_number,
        position: 0,
        driver_number: driver.driver_number,
        driver_name: `${driver.first_name} ${driver.last_name}`,
        driver_acronym: driver.name_acronym || `${driver.first_name?.charAt(0)}${driver.last_name?.charAt(0)}`,
        constructor_name: driver.team_name || 'Unknown',
        best_lap_time: null,
        gap_to_leader: 0,
        total_laps: 0,
        team_color: getTeamColorById(driver.team_name)
      };
    });

    lapData.data.forEach((lap: any) => {
      const driverNumber = lap.driver_number;
      if (!driverResults[driverNumber]) return;

      const result = driverResults[driverNumber];
      result.total_laps++;

      if (lap.lap_duration && (result.best_lap_time === null || lap.lap_duration < result.best_lap_time)) {
        result.best_lap_time = lap.lap_duration;
      }
    });

    const finalPositions: { [key: number]: { position: number; date: string } } = {};

    positionData.data.forEach((position: any) => {
      const driverNumber = position.driver_number;
      const positionValue = position.position;

      if (!finalPositions[driverNumber] || position.date > finalPositions[driverNumber].date) {
        finalPositions[driverNumber] = {
          position: positionValue,
          date: position.date
        };
      }
    });

    Object.keys(driverResults).forEach(driverNumberStr => {
      const driverNumber = parseInt(driverNumberStr);
      const finalPos = finalPositions[driverNumber];
      if (finalPos) {
        driverResults[driverNumber].position = finalPos.position;
      }
    });

    const resultsArray = Object.values(driverResults)
      .filter(result => result.position > 0)
      .sort((a, b) => a.position - b.position);

    const fastestTime = resultsArray[0]?.best_lap_time || 0;
    resultsArray.forEach((result) => {
      if (result.best_lap_time && fastestTime) {
        result.gap_to_leader = result.best_lap_time - fastestTime;
      }
    });

    return resultsArray;
  }, [positionData, lapData, driversData]);

  const isLoading = isSessionLoading || isDriversLoading || isLapDataLoading || isPositionDataLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border py-2">
            <F1Skeleton className="h-5 w-7 shrink-0" />
            <F1Skeleton className="h-4 flex-1" />
            <F1Skeleton className="h-4 w-16 shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  if (lapDataError || positionDataError || !effectiveSessionKey) {
    return (
      <F1ErrorState
        type={lapDataError || positionDataError ? "server" : "not-found"}
        variant="inline"
        size="sm"
        className="my-2"
        title="Results unavailable"
        message={
          lapDataError || positionDataError
            ? "Failed to load session results"
            : "No session data available"
        }
      />
    );
  }

  if (processedResults.length === 0) {
    return <F1EmptyState type="no-results" size="sm" showDecoration={false} />;
  }

  // Fastest lap across the session
  const fastestLap = processedResults.reduce<ProcessedResult | null>((best, r) => {
    if (r.best_lap_time == null) return best;
    if (!best || (best.best_lap_time ?? Infinity) > r.best_lap_time) return r;
    return best;
  }, null);

  return (
    <div className="flex flex-col gap-3">
      {/* Eyebrow + fastest lap */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Classification
        </span>
        {fastestLap?.best_lap_time != null && (
          <F1Badge variant="time" className="gap-1.5">
            <Zap className="h-3 w-3 text-primary" />
            <span className="text-primary">{fastestLap.driver_acronym}</span>
            <span className="opacity-50">•</span>
            {formatTime(fastestLap.best_lap_time)}
          </F1Badge>
        )}
      </div>

      {/* ── Mobile: compact cards (no horizontal scroll, names wrap) ── */}
      <div className="flex flex-col gap-1.5 md:hidden">
        {processedResults.map((result) => {
          const isFastest = fastestLap?.id === result.id;
          return (
            <div
              key={result.id}
              className="flex items-center gap-2.5 rounded-lg border border-border bg-card/40 p-2"
            >
              {result.position <= 3 ? (
                <PositionBadge position={result.position} showIcon={false} className="shrink-0" />
              ) : (
                <span className="w-7 shrink-0 text-center text-sm font-bold tabular-nums text-muted-foreground">
                  {result.position}
                </span>
              )}
              <div
                className="min-w-0 flex-1 border-l-2 pl-2.5"
                style={{ borderColor: result.team_color }}
              >
                <div className="flex items-center gap-1.5 font-bold leading-tight">
                  <span className="font-mono">{result.driver_acronym}</span>
                  {isFastest && <Zap className="h-3 w-3 shrink-0 text-primary" />}
                </div>
                <div className="mt-0.5 break-words text-xs text-muted-foreground">
                  {result.constructor_name}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="timing text-sm leading-none">
                  {result.best_lap_time ? formatTime(result.best_lap_time) : '--'}
                </div>
                {result.gap_to_leader > 0 && (
                  <div className="timing mt-0.5 text-xs text-muted-foreground">
                    +{result.gap_to_leader.toFixed(3)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Desktop: dense timing-screen table ── */}
      <div className="hidden md:block">
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <th className="border-b border-border py-2 pr-3 text-left font-semibold">Pos</th>
              <th className="border-b border-border py-2 pr-3 text-left font-semibold">Driver</th>
              <th className="border-b border-border py-2 pr-3 text-left font-semibold">Team</th>
              <th className="border-b border-border py-2 pr-3 text-right font-semibold">Best Lap</th>
              <th className="border-b border-border py-2 text-right font-semibold">Gap</th>
            </tr>
          </thead>
          <tbody>
            {processedResults.map((result) => {
              const isFastest = fastestLap?.id === result.id;
              return (
                <tr key={result.id} className="group">
                  <td className="border-b border-border py-1.5 pr-3 align-middle">
                    {result.position <= 3 ? (
                      <PositionBadge position={result.position} showIcon={false} />
                    ) : (
                      <span className="inline-block w-7 text-center text-sm font-bold tabular-nums text-muted-foreground">
                        {result.position}
                      </span>
                    )}
                  </td>
                  <td className="border-b border-border py-1.5 pr-3 align-middle">
                    <div
                      className="flex items-center gap-2 border-l-2 pl-2.5"
                      style={{ borderColor: result.team_color }}
                    >
                      <span className="font-mono text-sm font-bold">{result.driver_acronym}</span>
                      {isFastest && <Zap className="h-3 w-3 shrink-0 text-primary" />}
                    </div>
                  </td>
                  <td className="border-b border-border py-1.5 pr-3 align-middle">
                    <span className="break-words text-sm text-muted-foreground">
                      {result.constructor_name}
                    </span>
                  </td>
                  <td className="border-b border-border py-1.5 pr-3 text-right align-middle">
                    <span className="timing text-sm">
                      {result.best_lap_time ? formatTime(result.best_lap_time) : '--'}
                    </span>
                  </td>
                  <td className="border-b border-border py-1.5 text-right align-middle">
                    <span className="timing text-sm text-muted-foreground">
                      {result.gap_to_leader > 0 ? `+${result.gap_to_leader.toFixed(3)}` : '--'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SessionResults;
