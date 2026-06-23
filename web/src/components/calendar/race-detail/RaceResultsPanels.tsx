import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
            <span className="text-right">{r.Q1 || "-"}</span>
            <span className="text-right">{r.Q2 || "-"}</span>
            <span className="text-right">{r.Q3 || "-"}</span>
          </div>
          <span className="text-muted-foreground" style={{ color: getTeamColor(r.Constructor.constructorId) }}>
            {r.Constructor.name}
          </span>
        </>
      )}
      mobileHeaderExtra={
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-[10px] font-medium text-muted-foreground">
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
          <span style={{ color: getTeamColor(r.Constructor.constructorId) }}>{r.Constructor.name}</span>
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
          <span style={{ color: getTeamColor(r.Constructor.constructorId) }}>{r.Constructor.name}</span>
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
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}

function EmptyResults({ message }: { message: string }) {
  return (
    <div className="py-8 text-center">
      <p className="text-muted-foreground text-xs md:text-sm">{message}</p>
    </div>
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
        <div className="flex items-center justify-between mb-1 border-b pb-1 pt-1 bg-muted/20">
          <div className="flex space-x-2 items-center">
            <span className="text-[10px] font-medium text-muted-foreground w-5">Pos</span>
            <span className="text-[10px] font-medium text-muted-foreground">Driver</span>
          </div>
          <div className="flex flex-col items-end">{mobileHeaderExtra}</div>
        </div>
        {results.map((result) => (
          <div key={result.position} className="flex items-center justify-between border-b py-1.5">
            <div className="flex space-x-2 items-center">
              <span className="text-xs font-medium w-5">{result.position}</span>
              <RaceDriverCell driver={result.Driver} constructorId={result.Constructor.constructorId} />
            </div>
            <div className="flex flex-col items-end text-[10px]">{mobileExtra(result)}</div>
          </div>
        ))}
      </div>

      <div className="hidden sm:block">
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-xs md:text-sm py-2">Pos</TableHead>
              <TableHead className="text-xs md:text-sm py-2">Driver</TableHead>
              <TableHead className="text-xs md:text-sm py-2">Team</TableHead>
              {desktopColumns.map((col) => (
                <TableHead
                  key={col.header}
                  className={`text-xs md:text-sm py-2 ${col.align === "right" ? "text-right" : ""}`}
                >
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((result) => (
              <TableRow key={result.position}>
                <TableCell className="font-medium text-xs md:text-sm py-1 md:py-2">{result.position}</TableCell>
                <TableCell className="text-xs md:text-sm py-1 md:py-2">
                  <RaceDriverNameCell driver={result.Driver} constructorId={result.Constructor.constructorId} />
                </TableCell>
                <TableCell
                  className="text-xs md:text-sm py-1 md:py-2"
                  style={{ color: getTeamColor(result.Constructor.constructorId) }}
                >
                  {result.Constructor.name}
                </TableCell>
                {desktopColumns.map((col) => (
                  <TableCell
                    key={col.header}
                    className={`text-xs md:text-sm py-1 md:py-2 ${col.align === "right" ? "text-right" : ""} ${col.italic ? "italic" : ""}`}
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
