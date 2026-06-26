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
import {
  F1Card,
  F1CardContent,
  F1CardHeader,
  F1CardTitle,
  F1ChartContainer,
  F1EmptyState,
} from "@/components/f1";
import { useThemeVariant } from "@/hooks/useThemeVariant";
import { cn } from "@/lib/utils";

interface RaceOverviewProps {
  year: number;
  round: string;
}

const teamColor = (team: string) => TEAM_COLORS[team] || TEAM_COLORS.default;

const eyebrow =
  "text-xs font-semibold uppercase tracking-widest text-muted-foreground";

function StatTile({
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
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 p-3">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </div>
      <div
        className="font-heading text-lg font-bold leading-tight tabular-nums tracking-tight"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
      {sub ? (
        <div className="text-xs text-muted-foreground">{sub}</div>
      ) : null}
    </div>
  );
}

function DriverChip({ code, team }: { code: string; team: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono font-bold tabular-nums">
      <span
        className="h-3 w-1 rounded-full"
        style={{ backgroundColor: teamColor(team) }}
      />
      {code}
    </span>
  );
}

export default function RaceOverview({ year, round }: RaceOverviewProps) {
  const { data: resultsData, isLoading: resultsLoading } = useRaceResults(year, round);
  const { data: qualiData, isLoading: qualiLoading } = useRaceQualifying(year, round);
  const { cardVariant, glassVariant } = useThemeVariant();

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
    <div className="flex flex-col gap-6 px-4 pb-4">
      {/* Key takeaways */}
      <section className="flex flex-col gap-2">
        <h3 className={eyebrow}>Race Summary</h3>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile
            icon={<Trophy className="h-3 w-3" />}
            label="Winner"
            value={summary.winner ? summary.winner.code : "—"}
            sub={summary.winner ? <DriverChip code="" team={summary.winner.team} /> : undefined}
            accent={summary.winner ? teamColor(summary.winner.team) : undefined}
          />
          <StatTile
            icon={<Flag className="h-3 w-3" />}
            label="Pole"
            value={summary.pole ? summary.pole.code : "—"}
            sub={summary.poleToWin ? "Converted to win" : "Lost the lead"}
            accent={summary.poleToWin ? "hsl(var(--status-completed))" : undefined}
          />
          <StatTile
            icon={<Timer className="h-3 w-3" />}
            label="Win margin"
            value={summary.winMargin ?? "—"}
            sub="gap to P2"
          />
          <StatTile
            icon={<Gauge className="h-3 w-3" />}
            label="Fastest lap"
            value={summary.fastestLap ? summary.fastestLap.code : "—"}
            sub={summary.fastestLap?.time}
            accent={summary.fastestLap ? teamColor(summary.fastestLap.team) : undefined}
          />
          <StatTile
            icon={<TrendingUp className="h-3 w-3" />}
            label="Biggest mover"
            value={summary.biggestGainer ? `+${summary.biggestGainer.delta}` : "—"}
            sub={summary.biggestGainer?.code}
            accent="hsl(var(--status-completed))"
          />
          <StatTile
            icon={<OctagonX className="h-3 w-3" />}
            label="DNFs"
            value={summary.dnfCount}
            sub={`${summary.finishers}/${summary.totalDrivers} classified`}
            accent={summary.dnfCount > 0 ? "hsl(var(--destructive))" : undefined}
          />
        </div>
      </section>

      {/* Qualifying to race delta */}
      <section className="grid gap-4 lg:grid-cols-2">
        <F1Card variant={cardVariant} glassVariant={glassVariant} size="sm">
          <F1CardHeader>
            <F1CardTitle icon={<TrendingUp className="h-3.5 w-3.5" />}>
              Gained most places
            </F1CardTitle>
          </F1CardHeader>
          <F1CardContent className="flex flex-col gap-1">
            {gainers.length ? (
              gainers.map((d) => (
                <div key={d.driverId} className="flex items-center justify-between text-sm">
                  <DriverChip code={d.code} team={d.team} />
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    P{d.grid} <ArrowRight className="inline h-3 w-3" /> P{d.finish}
                  </span>
                  <span className="font-mono font-bold tabular-nums text-status-completed">
                    +{d.delta}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No net gainers.</p>
            )}
          </F1CardContent>
        </F1Card>
        <F1Card variant={cardVariant} glassVariant={glassVariant} size="sm">
          <F1CardHeader>
            <F1CardTitle icon={<TrendingDown className="h-3.5 w-3.5" />}>
              Lost most places
            </F1CardTitle>
          </F1CardHeader>
          <F1CardContent className="flex flex-col gap-1">
            {losers.length ? (
              losers.map((d) => (
                <div key={d.driverId} className="flex items-center justify-between text-sm">
                  <DriverChip code={d.code} team={d.team} />
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    P{d.grid} <ArrowRight className="inline h-3 w-3" /> P{d.finish}
                  </span>
                  <span className="font-mono font-bold tabular-nums text-destructive">
                    {d.delta}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No net losers.</p>
            )}
          </F1CardContent>
        </F1Card>
      </section>

      {/* Teammate head-to-head */}
      {h2h.length ? (
        <section className="flex flex-col gap-2">
          <h3 className={eyebrow}>Teammate Head-to-Head</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {h2h.map((row) => (
              <div
                key={row.team}
                className="flex flex-col gap-1.5 rounded-lg border border-border border-l-2 bg-muted/40 p-2.5"
                style={{ borderLeftColor: teamColor(row.team) }}
              >
                <div className="flex items-center justify-between text-sm font-bold">
                  <span className="font-mono">{row.driverACode}</span>
                  <span className="text-xs font-normal text-muted-foreground">vs</span>
                  <span className="font-mono">{row.driverBCode}</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs">
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
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="flex items-center justify-between font-mono tabular-nums">
        <span className={cn(winner === a && "font-bold text-primary")}>{aVal}</span>
        <span className={cn(winner === b && "font-bold text-primary")}>{bVal}</span>
      </div>
    </>
  );
}
