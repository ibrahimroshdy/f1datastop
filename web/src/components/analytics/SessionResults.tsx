import React, { useMemo } from 'react';
import { Zap } from 'lucide-react';
import { useRaceResults, useRaceQualifying, useSprintResults } from "@/hooks/f1";
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
  /** Canonical session code (R/Q/S/SQ/FP1-3). */
  session?: string;
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

/** Parse an "m:ss.mmm" (or "ss.mmm") lap-time string to seconds. */
function parseLap(t?: string | null): number | null {
  if (!t) return null;
  const m = String(t).match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  return (m[1] ? parseInt(m[1], 10) * 60 : 0) + parseFloat(m[2]);
}

const SessionResults: React.FC<SessionResultsProps> = ({
  year,
  round,
  session = "R",
}) => {
  const race = useRaceResults(year, round);
  const quali = useRaceQualifying(year, round);
  const sprint = useSprintResults(year, round);

  const isQuali = session === "Q" || session === "SQ";
  const isSprint = session === "S";
  const active = isQuali ? quali : isSprint ? sprint : race;

  const processedResults = useMemo<ProcessedResult[]>(() => {
    const raceObj: any = (active.data as any)?.data ?? {};
    const list: any[] = isQuali
      ? raceObj.QualifyingResults ?? []
      : isSprint
        ? raceObj.SprintResults ?? []
        : raceObj.Results ?? [];
    const rows: ProcessedResult[] = list.map((r: any, i: number) => {
      const best = isQuali
        ? parseLap(r.Q3 || r.Q2 || r.Q1)
        : parseLap(r.FastestLap?.Time?.time);
      const cid = r.Constructor?.constructorId || r.Constructor?.name || "";
      return {
        id: parseInt(r.number, 10) || i + 1,
        position: parseInt(r.position, 10) || i + 1,
        driver_number: parseInt(r.number, 10) || 0,
        driver_name: `${r.Driver?.givenName ?? ""} ${r.Driver?.familyName ?? ""}`.trim(),
        driver_acronym: r.Driver?.code || `${r.Driver?.givenName?.[0] ?? ""}${r.Driver?.familyName?.[0] ?? ""}`,
        constructor_name: r.Constructor?.name || "Unknown",
        best_lap_time: best,
        gap_to_leader: 0,
        total_laps: parseInt(r.laps, 10) || 0,
        team_color: getTeamColorById(cid),
      };
    });
    rows.sort((a, b) => a.position - b.position);
    const fastest = rows.reduce<number | null>(
      (m, r) => (r.best_lap_time != null && (m == null || r.best_lap_time < m) ? r.best_lap_time : m),
      null,
    );
    if (fastest != null) {
      rows.forEach((r) => {
        if (r.best_lap_time != null) r.gap_to_leader = r.best_lap_time - fastest;
      });
    }
    return rows;
  }, [active.data, isQuali, isSprint]);

  const isLoading = active.isLoading;
  const lapDataError = active.error;
  const positionDataError = null;
  const effectiveSessionKey = 1;

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
        <span className="instrument-label">
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
            <tr className="instrument-label">
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
