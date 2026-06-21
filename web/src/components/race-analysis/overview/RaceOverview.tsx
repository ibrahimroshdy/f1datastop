import { useMemo } from "react";
import {
  Trophy,
  Flag,
  Timer,
  TrendingUp,
  TrendingDown,
  OctagonX,
  Gauge,
  ArrowRight,
} from "lucide-react";
import { useRaceResults, useRaceQualifying } from "@/hooks/useF1Data";
import {
  computeRaceSummary,
  computeQualiRaceDelta,
  computeTeammateH2H,
} from "@/lib/f1/raceInsights";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { F1ChartContainer } from "@/components/f1";
import { cn } from "@/lib/utils";

interface RaceOverviewProps {
  year: number;
  round: string;
}

const teamColor = (team: string) => TEAM_COLORS[team] || "#6b7280";

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="stat-numeral text-lg font-bold leading-tight" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {sub ? <div className="text-[11px] text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

function DriverChip({ code, team }: { code: string; team: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-bold">
      <span className="h-3 w-1 rounded-full" style={{ backgroundColor: teamColor(team) }} />
      {code}
    </span>
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
      <div className="flex min-h-[300px] flex-col items-center justify-center p-6 text-center">
        <Flag className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="font-medium">No race results yet</p>
        <p className="text-sm text-muted-foreground">Results appear once this round has run.</p>
      </div>
    );
  }

  const gainers = deltas.filter((d) => !d.isDNF && d.delta > 0).slice(0, 5);
  const losers = deltas.filter((d) => !d.isDNF && d.delta < 0).slice(-5).reverse();

  return (
    <div className="space-y-5 px-4 pb-4">
      {/* Key takeaways */}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Race Summary
        </h3>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard
            icon={<Trophy className="h-3 w-3" />}
            label="Winner"
            value={summary.winner ? summary.winner.code : "—"}
            sub={summary.winner ? <DriverChip code="" team={summary.winner.team} /> : undefined}
            accent={summary.winner ? teamColor(summary.winner.team) : undefined}
          />
          <StatCard
            icon={<Flag className="h-3 w-3" />}
            label="Pole"
            value={summary.pole ? summary.pole.code : "—"}
            sub={summary.poleToWin ? "Converted to win" : "Lost the lead"}
            accent={summary.poleToWin ? "#16a34a" : undefined}
          />
          <StatCard
            icon={<Timer className="h-3 w-3" />}
            label="Win margin"
            value={summary.winMargin ?? "—"}
            sub="gap to P2"
          />
          <StatCard
            icon={<Gauge className="h-3 w-3" />}
            label="Fastest lap"
            value={summary.fastestLap ? summary.fastestLap.code : "—"}
            sub={summary.fastestLap?.time}
            accent={summary.fastestLap ? teamColor(summary.fastestLap.team) : undefined}
          />
          <StatCard
            icon={<TrendingUp className="h-3 w-3" />}
            label="Biggest mover"
            value={summary.biggestGainer ? `+${summary.biggestGainer.delta}` : "—"}
            sub={summary.biggestGainer?.code}
            accent="#16a34a"
          />
          <StatCard
            icon={<OctagonX className="h-3 w-3" />}
            label="DNFs"
            value={summary.dnfCount}
            sub={`${summary.finishers}/${summary.totalDrivers} classified`}
            accent={summary.dnfCount > 0 ? "#dc2626" : undefined}
          />
        </div>
      </section>

      {/* Qualifying → Race delta */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border p-3">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-green-600" /> Gained most places
          </h3>
          <div className="space-y-1">
            {gainers.length ? (
              gainers.map((d) => (
                <div key={d.driverId} className="flex items-center justify-between text-sm">
                  <DriverChip code={d.code} team={d.team} />
                  <span className="font-mono text-xs text-muted-foreground">
                    P{d.grid} <ArrowRight className="inline h-3 w-3" /> P{d.finish}
                  </span>
                  <span className="font-mono font-bold text-green-600">+{d.delta}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No net gainers.</p>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-border p-3">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <TrendingDown className="h-3.5 w-3.5 text-red-600" /> Lost most places
          </h3>
          <div className="space-y-1">
            {losers.length ? (
              losers.map((d) => (
                <div key={d.driverId} className="flex items-center justify-between text-sm">
                  <DriverChip code={d.code} team={d.team} />
                  <span className="font-mono text-xs text-muted-foreground">
                    P{d.grid} <ArrowRight className="inline h-3 w-3" /> P{d.finish}
                  </span>
                  <span className="font-mono font-bold text-red-600">{d.delta}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No net losers.</p>
            )}
          </div>
        </div>
      </section>

      {/* Teammate head-to-head */}
      {h2h.length ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Teammate Head-to-Head
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {h2h.map((row) => (
              <div
                key={row.team}
                className="rounded-lg border-l-2 bg-muted/20 p-2.5"
                style={{ borderLeftColor: teamColor(row.team) }}
              >
                <div className="mb-1.5 flex items-center justify-between text-sm font-bold">
                  <span>{row.driverACode}</span>
                  <span className="text-[10px] font-normal text-muted-foreground">vs</span>
                  <span>{row.driverBCode}</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[11px]">
                  <H2HLine
                    label="Quali"
                    a={row.driverACode}
                    b={row.driverBCode}
                    winner={row.qualiWinner}
                    aVal={`P${row.gridA}`}
                    bVal={`P${row.gridB}`}
                  />
                  <H2HLine
                    label="Race"
                    a={row.driverACode}
                    b={row.driverBCode}
                    winner={row.raceWinner}
                    aVal={row.dnfA ? "DNF" : `P${row.finishA}`}
                    bVal={row.dnfB ? "DNF" : `P${row.finishB}`}
                  />
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
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex items-center justify-between font-mono">
        <span className={cn(winner === a && "font-bold text-primary")}>{aVal}</span>
        <span className={cn(winner === b && "font-bold text-primary")}>{bVal}</span>
      </div>
    </>
  );
}
