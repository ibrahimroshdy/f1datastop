import type { ReactNode } from "react";
import { F1EmptyState, F1Skeleton } from "@/components/f1";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRaceTime, getTeamColor } from "./raceDetailUtils";
import { RaceDriverCell, RaceDriverNameCell } from "./RaceDriverCell";
import { RaceInfographicEmbed } from "./RaceSchedulePanel";

type ErgastResult = {
  position: string;
  points?: string;
  grid?: string;
  Q1?: string;
  Q2?: string;
  Q3?: string;
  status?: string;
  Time?: { time?: string };
  FastestLap?: { Time?: { time?: string } };
  Driver: { code?: string; givenName?: string; familyName?: string };
  Constructor: { constructorId: string; name: string };
};

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
  if (!results?.length) {
    return (
      <EmptyResults message="No results available for this race yet." />
    );
  }

  return (
    <div className="space-y-3">
      <RaceInfographicEmbed season={season} round={round} isGlass={isGlass} />
      <RaceResultsTable
        results={results}
        mobileExtra={(r) => (
          <>
            <span className="text-[10px]">{formatRaceTime(r)}</span>
            <span className="text-xs">{r.points}pts</span>
          </>
        )}
        desktopColumns={[
          { header: "Time/Status", render: (r) => formatRaceTime(r), align: "right" },
          { header: "Points", render: (r) => r.points, align: "right" },
        ]}
      />
    </div>
  );
}

export function RaceQualifyingPanel({
  isLoading,
  results,
}: {
  isLoading: boolean;
  results?: ErgastResult[];
}) {
  if (isLoading) return <ResultsSkeleton />;
  if (!results?.length) {
    return (
      <EmptyResults message="No qualifying results available for this race yet." />
    );
  }

  return (
    <RaceResultsTable
      results={results}
      mobileExtra={(r) => (
        <>
          <div className="timing grid grid-cols-2 gap-1 tabular-nums sm:grid-cols-3">
            <span className="text-right">{r.Q1 || "-"}</span>
            <span className="text-right">{r.Q2 || "-"}</span>
            <span className="text-right">{r.Q3 || "-"}</span>
          </div>
          <span style={{ color: getTeamColor(r.Constructor.constructorId) }}>
            {r.Constructor.name}
          </span>
        </>
      )}
      mobileHeaderExtra={
        <div className="instrument-label grid grid-cols-2 gap-1 sm:grid-cols-3">
          <span className="text-right">Q1</span>
          <span className="text-right">Q2</span>
          <span className="text-right">Q3</span>
        </div>
      }
      desktopColumns={[
        { header: "Q1", render: (r) => r.Q1 || "-", align: "right" },
        { header: "Q2", render: (r) => r.Q2 || "-", align: "right" },
        { header: "Q3", render: (r) => r.Q3 || "-", align: "right" },
      ]}
    />
  );
}

export function RaceSprintQualifyingPanel({
  isLoading,
  results,
}: {
  isLoading: boolean;
  results?: Array<ErgastResult & { gridPosition?: string }>;
}) {
  if (isLoading) return <ResultsSkeleton />;
  if (!results?.length) {
    return (
      <EmptyResults message="No sprint qualifying results available for this race yet." />
    );
  }

  return (
    <RaceResultsTable
      results={results}
      mobileExtra={(r) => (
        <>
          <span className="font-sans tracking-normal" style={{ color: getTeamColor(r.Constructor.constructorId) }}>{r.Constructor.name}</span>
          <span className="text-xs">Grid: {(r as ErgastResult & { gridPosition?: string }).gridPosition}</span>
        </>
      )}
      desktopColumns={[
        { header: "Grid Position", render: (r) => (r as ErgastResult & { gridPosition?: string }).gridPosition, align: "right" },
      ]}
    />
  );
}

export function RaceSprintPanel({
  isLoading,
  results,
}: {
  isLoading: boolean;
  results?: ErgastResult[];
}) {
  if (isLoading) return <ResultsSkeleton />;
  if (!results?.length) {
    return <EmptyResults message="No sprint results available for this race yet." />;
  }

  return (
    <RaceResultsTable
      results={results}
      mobileExtra={(r) => (
        <>
          <span className="font-sans tracking-normal" style={{ color: getTeamColor(r.Constructor.constructorId) }}>{r.Constructor.name}</span>
          <span className="text-[10px]">{formatRaceTime(r)}</span>
          <span className="text-[10px] text-muted-foreground">Grid: {r.grid || "-"}</span>
          {r.FastestLap?.Time?.time && (
            <span className="text-[10px] italic">{r.FastestLap.Time.time}</span>
          )}
          <span className="text-xs">{r.points}pts</span>
        </>
      )}
      desktopColumns={[
        { header: "Time/Status", render: (r) => formatRaceTime(r), align: "right" },
        { header: "Grid", render: (r) => r.grid || "-", align: "right" },
        { header: "Best Lap", render: (r) => r.FastestLap?.Time?.time || "-", align: "right", italic: true },
        { header: "Points", render: (r) => r.points, align: "right" },
      ]}
    />
  );
}

function ResultsSkeleton() {
  return (
    <div className="space-y-2">
      <F1Skeleton className="h-8 w-full" />
      <F1Skeleton className="h-8 w-full" />
      <F1Skeleton className="h-8 w-full" />
    </div>
  );
}

function EmptyResults({ message }: { message: string }) {
  return (
    <F1EmptyState
      type="no-results"
      description={message}
      size="sm"
      showDecoration={false}
      className="py-8"
    />
  );
}

function RaceResultsTable({
  results,
  mobileExtra,
  mobileHeaderExtra,
  desktopColumns,
}: {
  results: ErgastResult[];
  mobileExtra: (result: ErgastResult) => ReactNode;
  mobileHeaderExtra?: ReactNode;
  desktopColumns: Array<{
    header: string;
    render: (result: ErgastResult) => ReactNode;
    align?: "left" | "right";
    italic?: boolean;
  }>;
}) {
  return (
    <div className="space-y-1">
      <div className="sm:hidden">
        <div className="mb-1 flex items-center justify-between border-b bg-muted/20 pb-1 pt-1">
          <div className="flex items-center space-x-2">
            <span className="instrument-label w-5">Pos</span>
            <span className="instrument-label">Driver</span>
          </div>
          <div className="flex flex-col items-end">{mobileHeaderExtra}</div>
        </div>
        {results.map((result) => (
          <div key={result.position} className="flex items-center justify-between border-b py-1.5">
            <div className="flex items-center space-x-2">
              <span className="timing w-5 text-xs font-medium tabular-nums">{result.position}</span>
              <RaceDriverCell driver={result.Driver} constructorId={result.Constructor.constructorId} />
            </div>
            <div className="timing flex flex-col items-end text-[10px]">{mobileExtra(result)}</div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto sm:block">
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="instrument-label w-10 whitespace-nowrap py-2">Pos</TableHead>
              <TableHead className="instrument-label whitespace-nowrap py-2">Driver</TableHead>
              <TableHead className="instrument-label whitespace-nowrap py-2">Team</TableHead>
              {desktopColumns.map((col) => (
                <TableHead
                  key={col.header}
                  className={`instrument-label whitespace-nowrap py-2 ${col.align === "right" ? "text-right" : ""}`}
                >
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((result) => (
              <TableRow key={result.position}>
                <TableCell className="timing whitespace-nowrap py-1 text-xs font-medium tabular-nums md:py-2 md:text-sm">
                  {result.position}
                </TableCell>
                <TableCell className="whitespace-nowrap py-1 text-xs md:py-2 md:text-sm">
                  <RaceDriverNameCell driver={result.Driver} constructorId={result.Constructor.constructorId} />
                </TableCell>
                <TableCell
                  className="whitespace-nowrap py-1 text-xs md:py-2 md:text-sm"
                  style={{ color: getTeamColor(result.Constructor.constructorId) }}
                >
                  {result.Constructor.name}
                </TableCell>
                {desktopColumns.map((col) => (
                  <TableCell
                    key={col.header}
                    className={`timing whitespace-nowrap py-1 text-xs tabular-nums md:py-2 md:text-sm ${col.align === "right" ? "text-right" : ""} ${col.italic ? "italic" : ""}`}
                  >
                    {col.render(result)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
