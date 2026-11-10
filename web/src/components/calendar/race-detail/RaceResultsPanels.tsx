import type { ReactNode } from "react";
import { F1EmptyState, F1Skeleton } from "@/components/f1";
import { DriverIdentity } from "@/components/f1/DriverIdentity";
import { cn } from "@/lib/utils";
import { formatRaceTime, lapSeconds } from "./raceDetailUtils";
import { RaceInfographicEmbed } from "./RaceSchedulePanel";
import type { ErgastResult } from "./types";

/**
 * The quick look's result lists: every driver as DriverIdentity (face, linked name, flag, team
 * emblem), times in mono, the fastest in purple. Ergast carries no tyres, so none are shown.
 */
export function RaceResultsPanel({
  isLoading,
  results,
  season,
  round,
  isGlass,
}: {
  isLoading: boolean;
  results?: ErgastResult[];
  season: number;
  round: string;
  isGlass: boolean;
}) {
  if (isLoading) return <ResultsSkeleton />;
  if (!results?.length) return <EmptyResults message="No results for this race yet." />;
  return (
    <div className="space-y-3">
      <ResultList results={results} end={(r) => <TimeAndPoints r={r} />} />
      <RaceInfographicEmbed season={season} round={round} isGlass={isGlass} />
    </div>
  );
}

export function RaceSprintPanel({ isLoading, results }: { isLoading: boolean; results?: ErgastResult[] }) {
  if (isLoading) return <ResultsSkeleton />;
  if (!results?.length) return <EmptyResults message="No sprint results for this race yet." />;
  return <ResultList results={results} end={(r) => <TimeAndPoints r={r} />} />;
}

export function RaceSprintQualifyingPanel({
  isLoading,
  results,
}: {
  isLoading: boolean;
  results?: ErgastResult[];
}) {
  if (isLoading) return <ResultsSkeleton />;
  if (!results?.length) return <EmptyResults message="No sprint qualifying results for this race yet." />;
  return (
    <div className="space-y-2">
      <p className="text-[13px] text-muted-foreground">The sprint grid, from sprint qualifying.</p>
      <ResultList results={results} end={() => null} />
    </div>
  );
}

const SEGMENTS = ["Q1", "Q2", "Q3"] as const;

export function RaceQualifyingPanel({ isLoading, results }: { isLoading: boolean; results?: ErgastResult[] }) {
  if (isLoading) return <ResultsSkeleton />;
  if (!results?.length) return <EmptyResults message="No qualifying results for this race yet." />;

  // The fastest time of each segment shows in purple.
  const best = Object.fromEntries(
    SEGMENTS.map((q) => [q, Math.min(...results.map((r) => lapSeconds(r[q]) ?? Infinity))]),
  ) as Record<(typeof SEGMENTS)[number], number>;

  return (
    <ResultList
      results={results}
      header={
        <div className="hidden grid-cols-3 gap-3 text-right text-[13px] text-muted-foreground sm:grid sm:w-72">
          {SEGMENTS.map((q) => (
            <span key={q}>{q}</span>
          ))}
        </div>
      }
      end={(r) => {
        const last = [...SEGMENTS].reverse().find((q) => r[q]);
        return (
          <>
            <span className="flex flex-col items-end font-mono text-sm tabular-nums sm:hidden">
              <span className={cn(last && lapSeconds(r[last]) === best[last] && "text-fastest-lap")}>
                {last ? r[last] : "No time"}
              </span>
              {last ? <span className="font-sans text-[13px] text-muted-foreground">in {last}</span> : null}
            </span>
            <span className="hidden grid-cols-3 gap-3 text-right font-mono text-sm tabular-nums sm:grid sm:w-72">
              {SEGMENTS.map((q) => (
                <span
                  key={q}
                  className={cn(
                    !r[q] && "text-muted-foreground",
                    r[q] && lapSeconds(r[q]) === best[q] && "text-fastest-lap",
                  )}
                >
                  {r[q] || "None"}
                </span>
              ))}
            </span>
          </>
        );
      }}
    />
  );
}

function TimeAndPoints({ r }: { r: ErgastResult }) {
  const fastest = r.FastestLap?.rank === "1";
  return (
    <span className="flex flex-col items-end gap-0.5 text-right">
      <span className="font-mono text-sm tabular-nums">{formatRaceTime(r)}</span>
      <span className="text-[13px] text-muted-foreground">
        {fastest ? (
          <span className="mr-2 font-mono tabular-nums text-fastest-lap">{r.FastestLap?.Time?.time}</span>
        ) : null}
        {Number(r.points ?? 0) === 1 ? "1 point" : `${r.points ?? 0} points`}
      </span>
    </span>
  );
}

function ResultList({
  results,
  end,
  header,
}: {
  results: ErgastResult[];
  end: (r: ErgastResult) => ReactNode;
  header?: ReactNode;
}) {
  return (
    <div>
      {header ? <div className="flex justify-end border-b border-border pb-2">{header}</div> : null}
      <ol className="m-0 list-none divide-y divide-border p-0">
        {results.map((r) => (
          <li key={`${r.position}-${r.Driver.driverId}`} className="flex items-center gap-3 py-2.5">
            <span className="w-6 shrink-0 text-right font-mono text-sm font-semibold tabular-nums text-ink-2">
              {r.position}
            </span>
            <DriverIdentity
              driverId={r.Driver.driverId}
              givenName={r.Driver.givenName}
              familyName={r.Driver.familyName}
              nationality={r.Driver.nationality}
              constructorId={r.Constructor.constructorId}
              teamName={r.Constructor.name}
              size={32}
              className="flex-1"
            />
            <span className="shrink-0">{end(r)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="space-y-2">
      <F1Skeleton className="h-10 w-full" />
      <F1Skeleton className="h-10 w-full" />
      <F1Skeleton className="h-10 w-full" />
    </div>
  );
}

function EmptyResults({ message }: { message: string }) {
  return <F1EmptyState type="no-results" description={message} size="sm" showDecoration={false} className="py-8" />;
}
