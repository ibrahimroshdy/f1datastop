import { useMemo } from "react";
import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { useRaceResults, useRaceQualifying } from "@/hooks/useF1Data";
import {
  computeRaceSummary,
  computeQualiRaceDelta,
  computeTeammateH2H,
} from "@/lib/f1/raceInsights";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { F1ChartContainer, F1EmptyState } from "@/components/f1";
import { cn } from "@/lib/utils";

interface RaceOverviewProps {
  year: number;
  round: string;
}

const teamColor = (team: string) => TEAM_COLORS[team] || TEAM_COLORS.default;
const eyebrow = "instrument-label text-[11px]";

/** One cell of the race-summary instrument cluster — micro label + big readout. */
function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="px-3 py-2.5">
      <p className="instrument-label text-[10px]">{label}</p>
      <p
        className="readout mt-1.5 text-lg leading-none text-foreground"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </p>
      {sub != null && <p className="mt-1 truncate text-2xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function DriverBar({ code, team }: { code: string; team: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono font-bold tabular-nums">
      <span className="h-3.5 w-1 rounded-full" style={{ backgroundColor: teamColor(team) }} />
      {code}
    </span>
  );
}

/** A compact gainers/losers list — hairline rows, no chunky card. */
function MoverList({
  title,
  icon,
  rows,
  positive,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  rows: { driverId: string; code: string; team: string; grid: number; finish: number; delta: number }[];
  positive: boolean;
  empty: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card/40">
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
        {icon}
        <h3 className="instrument-label text-[11px]">{title}</h3>
      </div>
      <div className="divide-y divide-border/50">
        {rows.length ? (
          rows.map((d) => (
            <div key={d.driverId} className="flex items-center gap-2 px-3 py-1.5 text-sm">
              <DriverBar code={d.code} team={d.team} />
              <span className="ml-auto font-mono text-2xs tabular-nums text-muted-foreground">
                P{d.grid} <ArrowRight className="inline h-2.5 w-2.5" /> P{d.finish}
              </span>
              <span className={cn("w-9 text-right font-mono text-sm font-bold tabular-nums", positive ? "text-gain" : "text-loss")}>
                {positive ? `+${d.delta}` : d.delta}
              </span>
            </div>
          ))
        ) : (
          <p className="px-3 py-2 text-xs text-muted-foreground">{empty}</p>
        )}
      </div>
    </div>
  );
}

export default function RaceOverview({ year, round }: RaceOverviewProps) {
  const { data: resultsData, isLoading: resultsLoading } = useRaceResults(year, round);
  const { data: qualiData, isLoading: qualiLoading } = useRaceQualifying(year, round);

  const results = resultsData?.data?.Results;
  const qualifying = qualiData?.data?.QualifyingResults;

  const summary = useMemo(() => computeRaceSummary(results, qualifying), [results, qualifying]);
  const deltas = useMemo(() => computeQualiRaceDelta(results), [results]);
  const h2h = useMemo(() => computeTeammateH2H(results, qualifying), [results, qualifying]);

  const isLoading = resultsLoading || qualiLoading;

  if (isLoading) {
    return <F1ChartContainer isLoading minHeight={400} loadingMessage="Building race summary..." />;
  }
  if (!results?.length) {
    return (
      <F1EmptyState
        type="no-data"
        title="No race results yet"
        description="Results appear once this round has run."
        className="min-h-[300px]"
      />
    );
  }

  const gainers = deltas.filter((d) => !d.isDNF && d.delta > 0).slice(0, 5);
  const losers = deltas.filter((d) => !d.isDNF && d.delta < 0).slice(-5).reverse();

  return (
    <div className="flex flex-col gap-5 px-4 pb-4">
      {/* Race summary — one hairline-divided instrument cluster */}
      <section className="flex flex-col gap-2">
        <h3 className={eyebrow}>Race Summary</h3>
        <div className="grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-xl border border-border bg-card/40 sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-6">
          <Stat
            label="Winner"
            value={summary.winner ? summary.winner.code : "—"}
            accent={summary.winner ? teamColor(summary.winner.team) : undefined}
          />
          <Stat
            label="Pole"
            value={summary.pole ? summary.pole.code : "—"}
            sub={summary.poleToWin ? "Converted" : "Lost lead"}
            accent={summary.poleToWin ? "hsl(var(--gain))" : undefined}
          />
          <Stat label="Win Margin" value={summary.winMargin ?? "—"} sub="gap to P2" />
          <Stat
            label="Fastest Lap"
            value={summary.fastestLap ? summary.fastestLap.code : "—"}
            sub={summary.fastestLap?.time}
            accent={summary.fastestLap ? "hsl(var(--fastest-lap))" : undefined}
          />
          <Stat
            label="Biggest Mover"
            value={summary.biggestGainer ? `+${summary.biggestGainer.delta}` : "—"}
            sub={summary.biggestGainer?.code}
            accent="hsl(var(--gain))"
          />
          <Stat
            label="DNFs"
            value={summary.dnfCount}
            sub={`${summary.finishers}/${summary.totalDrivers} classified`}
            accent={summary.dnfCount > 0 ? "hsl(var(--destructive))" : undefined}
          />
        </div>
      </section>

      {/* Movers */}
      <section className="grid gap-3 lg:grid-cols-2">
        <MoverList
          title="Gained most places"
          icon={<TrendingUp className="h-3.5 w-3.5 text-gain" />}
          rows={gainers}
          positive
          empty="No net gainers."
        />
        <MoverList
          title="Lost most places"
          icon={<TrendingDown className="h-3.5 w-3.5 text-loss" />}
          rows={losers}
          positive={false}
          empty="No net losers."
        />
      </section>

      {/* Teammate head-to-head */}
      {h2h.length ? (
        <section className="flex flex-col gap-2">
          <h3 className={eyebrow}>Teammate Head-to-Head</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {h2h.map((row) => (
              <div key={row.team} className="overflow-hidden rounded-lg border border-border bg-card/40">
                <div className="flex items-center gap-2 border-b border-border px-2.5 py-1.5">
                  <span className="h-3.5 w-1 shrink-0 rounded-full" style={{ backgroundColor: teamColor(row.team) }} />
                  <span className="font-mono text-sm font-bold">{row.driverACode}</span>
                  <span className="text-2xs text-muted-foreground">vs</span>
                  <span className="font-mono text-sm font-bold">{row.driverBCode}</span>
                </div>
                <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-x-2 px-2.5 py-1.5 text-xs">
                  <H2HLine label="Quali" a={row.driverACode} b={row.driverBCode} winner={row.qualiWinner} aVal={`P${row.gridA}`} bVal={`P${row.gridB}`} />
                  <H2HLine label="Race" a={row.driverACode} b={row.driverBCode} winner={row.raceWinner} aVal={row.dnfA ? "DNF" : `P${row.finishA}`} bVal={row.dnfB ? "DNF" : `P${row.finishB}`} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function H2HLine({
  label,
  a,
  b,
  winner,
  aVal,
  bVal,
}: {
  label: string;
  a: string;
  b: string;
  winner: string | null;
  aVal: string;
  bVal: string;
}) {
  return (
    <>
      <div className="instrument-label text-[9px]">{label}</div>
      <div className={cn("text-center font-mono tabular-nums", winner === a ? "font-bold text-primary" : "text-muted-foreground")}>{aVal}</div>
      <div className={cn("text-center font-mono tabular-nums", winner === b ? "font-bold text-primary" : "text-muted-foreground")}>{bVal}</div>
    </>
  );
}
