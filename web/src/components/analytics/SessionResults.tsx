import React, { useMemo } from 'react';
import { Zap } from 'lucide-react';
import { useRaceResults, useRaceQualifying, useSprintResults } from "@/hooks/f1";
import { formatTime } from "@/utils/lapTimeUtils";
import { DriverIdentity } from "@/components/f1/DriverIdentity";
import {
  F1Badge,
  F1Skeleton,
  F1EmptyState,
  F1ErrorState,
  TeamName,
} from "@/components/f1";
import { teamHref } from "@/lib/links";
import { cn } from "@/lib/utils";

interface SessionResultsProps {
  year: number;
  round: string;
  /** Canonical session code (R/Q/S/SQ/FP1-3). */
  session?: string;
}

interface ProcessedResult {
  id: number;
  position: number;
  driver_id: string;
  given_name: string;
  family_name: string;
  nationality?: string;
  driver_acronym: string;
  constructor_id: string;
  constructor_name: string;
  best_lap_time: number | null;
  gap_to_leader: number;
  total_laps: number;
  /** Race time for the winner, the gap for the rest, or the status ("DNF", "+1 Lap"). */
  result_text: string | null;
  points: string | null;
}

interface ErgastDriver {
  driverId: string;
  code: string;
  givenName?: string;
  familyName?: string;
  nationality?: string;
}
interface ErgastConstructor {
  name: string;
  constructorId?: string;
}
interface ErgastResult {
  number: string;
  position: string;
  laps: string;
  points?: string;
  status?: string;
  Time?: { time?: string };
  Driver: ErgastDriver;
  Constructor?: ErgastConstructor;
  Q1?: string;
  Q2?: string;
  Q3?: string;
  FastestLap?: { Time: { time: string } };
}
interface ErgastRace {
  Results: ErgastResult[];
  SprintResults?: ErgastResult[];
  QualifyingResults?: ErgastResult[];
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
    const raceObj: ErgastRace = active.data?.data ?? {};
    const list = isQuali
      ? raceObj.QualifyingResults ?? []
      : isSprint
        ? raceObj.SprintResults ?? []
        : raceObj.Results ?? [];
    const rows: ProcessedResult[] = list.map((r, i) => {
      const best = isQuali
        ? parseLap(r.Q3 || r.Q2 || r.Q1)
        : parseLap(r.FastestLap?.Time?.time);
      return {
        id: parseInt(r.number, 10) || i + 1,
        position: parseInt(r.position, 10) || i + 1,
        driver_id: r.Driver?.driverId ?? "",
        given_name: r.Driver?.givenName ?? "",
        family_name: r.Driver?.familyName ?? r.Driver?.code ?? "",
        nationality: r.Driver?.nationality,
        driver_acronym: r.Driver?.code || `${r.Driver?.givenName?.[0] ?? ""}${r.Driver?.familyName?.[0] ?? ""}`,
        constructor_id: r.Constructor?.constructorId || "",
        constructor_name: r.Constructor?.name || "Unknown",
        best_lap_time: best,
        gap_to_leader: 0,
        total_laps: parseInt(r.laps, 10) || 0,
        result_text: isQuali ? null : r.Time?.time ?? r.status ?? null,
        points: isQuali ? null : r.points ?? null,
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
        <span className="text-xs font-semibold text-muted-foreground">
          Classification
        </span>
        {fastestLap?.best_lap_time != null && (
          <F1Badge variant="time" className="gap-1.5">
            <Zap className="h-3 w-3 text-[hsl(var(--fastest-lap))]" />
            Fastest lap, {fastestLap.family_name}, {formatTime(fastestLap.best_lap_time)}
          </F1Badge>
        )}
      </div>

      {/* Phones: one row per driver, names wrap, nothing scrolls sideways */}
      <ol className="flex flex-col divide-y divide-border md:hidden">
        {processedResults.map((result) => {
          const isFastest = fastestLap?.id === result.id;
          return (
            <li key={result.id} className="flex items-center gap-3 py-2.5">
              <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-figure">{result.position}</span>
              <DriverIdentity
                className="flex-1"
                driverId={result.driver_id}
                givenName={result.given_name}
                familyName={result.family_name}
                nationality={result.nationality}
                constructorId={result.constructor_id}
                teamName={result.constructor_name}
                extra={isFastest ? <span className="text-[hsl(var(--fastest-lap))]">fastest lap</span> : null}
              />
              <span className="shrink-0 text-right">
                <span className="timing block text-sm">
                  {isQuali
                    ? result.best_lap_time ? formatTime(result.best_lap_time) : "No time"
                    : result.result_text ?? "No time"}
                </span>
                {result.points && result.points !== "0" ? (
                  <span className="block text-xs text-muted-foreground">{result.points} pts</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Wider screens: the full classification table */}
      <div className="hidden md:block">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-xs font-semibold text-muted-foreground">
              <th className="border-b border-border py-2 pr-3 text-left font-semibold">Pos</th>
              <th className="border-b border-border py-2 pr-3 text-left font-semibold">Driver</th>
              <th className="border-b border-border py-2 pr-3 text-left font-semibold">Team</th>
              <th className="border-b border-border py-2 pr-3 text-right font-semibold">Laps</th>
              <th className="border-b border-border py-2 pr-3 text-right font-semibold">{isQuali ? "Best" : "Time"}</th>
              <th className="border-b border-border py-2 pr-3 text-right font-semibold">{isQuali ? "Gap" : "Fastest"}</th>
              {!isQuali && <th className="border-b border-border py-2 text-right font-semibold">Pts</th>}
            </tr>
          </thead>
          <tbody>
            {processedResults.map((result) => {
              const isFastest = fastestLap?.id === result.id;
              return (
                <tr key={result.id}>
                  <td className="border-b border-border py-2 pr-3 align-middle font-bold tabular-nums text-figure">{result.position}</td>
                  <td className="border-b border-border py-2 pr-3 align-middle">
                    <DriverIdentity
                      size={32}
                      driverId={result.driver_id}
                      givenName={result.given_name}
                      familyName={result.family_name}
                      nationality={result.nationality}
                      constructorId={result.constructor_id}
                    />
                  </td>
                  <td className="border-b border-border py-2 pr-3 align-middle">
                    {result.constructor_id ? (
                      <TeamName constructorId={result.constructor_id} name={result.constructor_name} to={teamHref(result.constructor_id)} size={16} />
                    ) : (
                      result.constructor_name
                    )}
                  </td>
                  <td className="timing border-b border-border py-2 pr-3 text-right align-middle">{result.total_laps || "No laps"}</td>
                  <td className="timing border-b border-border py-2 pr-3 text-right align-middle">
                    {isQuali
                      ? result.best_lap_time ? formatTime(result.best_lap_time) : "No time"
                      : result.result_text ?? "No time"}
                  </td>
                  <td
                    className={cn(
                      "timing border-b border-border py-2 pr-3 text-right align-middle",
                      isFastest ? "font-semibold text-[hsl(var(--fastest-lap))]" : "text-muted-foreground",
                    )}
                  >
                    {isQuali
                      ? result.gap_to_leader > 0 ? `+${result.gap_to_leader.toFixed(3)}` : isFastest ? "Pole" : ""
                      : isFastest && result.best_lap_time ? formatTime(result.best_lap_time) : ""}
                  </td>
                  {!isQuali && (
                    <td className="timing border-b border-border py-2 text-right align-middle font-semibold text-figure">
                      {result.points ?? ""}
                    </td>
                  )}
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
