import React, { useMemo } from "react";
import { Car, TrendingUp, ArrowRight } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { driverHref } from "@/lib/links";
import { useDbOvertakes, useDbLaps, useDbRaceControl } from "@/hooks/useWarehouse";
import { useRaceResults } from "@/hooks/f1";
import { getTeamColorById } from "@/constants/f1Colors";
import { chartTheme } from "@/lib/chartTheme";
import { F1Skeleton, F1EmptyState, F1ChartContainer } from "@/components/f1";
import { deriveSafetyPeriods } from "@/lib/f1/safetyPeriods";
import { safetyBands } from "@/components/analytics/safetyBands";
import { SafetyLegend } from "@/components/analytics/SafetyCarBands";

interface OvertakesAnalysisProps {
  year: number;
  round: string;
  session?: string;
}

interface ErgastDriver {
  driverId: string;
  code: string;
  givenName?: string;
  familyName?: string;
}
interface ErgastConstructor {
  name: string;
  constructorId?: string;
}
interface ErgastResult {
  number: string;
  position: string;
  Driver: ErgastDriver;
  Constructor?: ErgastConstructor;
}

const OvertakesAnalysis: React.FC<OvertakesAnalysisProps> = ({ year, round }) => {
  const roundNum = parseInt(round, 10);
  const { data: overtakes, isLoading: isOtLoading } = useDbOvertakes(year, roundNum, "R");
  const { data: laps, isLoading: isLapsLoading } = useDbLaps(year, roundNum, "R");
  const { data: raceControl } = useDbRaceControl(year, roundNum, "R");
  const race = useRaceResults(year, round);

  // Safety-car / VSC / red-flag lap-range bands from race-control messages.
  const safety = useMemo(() => deriveSafetyPeriods(raceControl), [raceControl]);

  // driver_id -> { code, color }
  const driverMeta = useMemo(() => {
    const map: Record<string, { code: string; name: string; color: string }> = {};
    const results: ErgastResult[] = race.data?.data?.Results ?? [];
    results.forEach((r) => {
      const id = r.Driver?.driverId;
      if (!id) return;
      map[id] = {
        code: r.Driver?.code || id.slice(0, 3).toUpperCase(),
        name: r.Driver?.familyName || r.Driver?.code || id,
        color: getTeamColorById(r.Constructor?.constructorId || r.Constructor?.name || ""),
      };
    });
    return map;
  }, [race.data]);

  const code = (id: string | number) => {
    const sid = String(id);
    return driverMeta[sid]?.code || sid.slice(0, 3).toUpperCase();
  };
  /** A driver's surname, linked to their page. */
  const who = (id: string | number, className?: string) => {
    const sid = String(id);
    return (
      <Link to={driverHref(sid)} viewTransition className={cn("font-semibold text-heading hover:underline", className)}>
        {driverMeta[sid]?.name || code(sid)}
      </Link>
    );
  };
  const color = (id: string) => driverMeta[id]?.color || "hsl(var(--muted-foreground))";

  const isLoading = isOtLoading || isLapsLoading || race.isLoading;

  // Per-driver overtake counts (made vs received).
  const stats = useMemo(() => {
    const made: Record<string, number> = {};
    const recv: Record<string, number> = {};
    (overtakes ?? []).forEach((o) => {
      made[o.overtaking_driver_id] = (made[o.overtaking_driver_id] || 0) + 1;
      recv[o.overtaken_driver_id] = (recv[o.overtaken_driver_id] || 0) + 1;
    });
    const rows = Object.keys(made)
      .map((id) => ({ id, made: made[id] || 0, recv: recv[id] || 0 }))
      .sort((a, b) => b.made - a.made);
    return rows;
  }, [overtakes]);

  // Position progression: one row per lap, one series per driver.
  const positionChart = useMemo(() => {
    const byLap = new Map<number, Record<string, number>>();
    const driverIds = new Set<string>();
    (laps ?? []).forEach((l) => {
      if (l.position == null) return;
      driverIds.add(l.driver_id);
      const row = byLap.get(l.lap_number) ?? { lap: l.lap_number };
      row[l.driver_id] = l.position;
      byLap.set(l.lap_number, row);
    });
    const rows = Array.from(byLap.values()).sort((a, b) => a.lap - b.lap);
    const series = Array.from(driverIds);
    const maxPos = Math.max(1, ...rows.flatMap((r: Record<string, number>) => series.map((s) => r[s] ?? 0)));
    return { rows, series, maxPos };
  }, [laps]);

  const totalOvertakes = overtakes?.length ?? 0;

  /**
   * Per-lap overtake counts, for the density strip. A flat feed answers "who passed whom"
   * but hides the shape of the race — where the action clustered, and which laps were
   * processions. Zero-fill so quiet laps read as gaps rather than being collapsed away.
   */
  const lapDensity = useMemo(() => {
    if (!overtakes?.length) return { bars: [] as { lap: number; n: number }[], peak: 0 };
    const byLap = new Map<number, number>();
    let maxLap = 0;
    for (const o of overtakes) {
      byLap.set(o.lap_number, (byLap.get(o.lap_number) ?? 0) + 1);
      if (o.lap_number > maxLap) maxLap = o.lap_number;
    }
    const bars: { lap: number; n: number }[] = [];
    for (let l = 1; l <= maxLap; l++) bars.push({ lap: l, n: byLap.get(l) ?? 0 });
    return { bars, peak: Math.max(...bars.map((b) => b.n), 0) };
  }, [overtakes]);

  const busiestLap = useMemo(
    () => lapDensity.bars.reduce<{ lap: number; n: number } | null>(
      (best, b) => (b.n > (best?.n ?? 0) ? b : best),
      null,
    ),
    [lapDensity],
  );

  /** Net position swing per driver — passes made minus passes conceded. */
  const netMovers = useMemo(
    () =>
      [...stats]
        .map((s) => ({ ...s, net: s.made - s.recv }))
        .sort((a, b) => b.net - a.net || b.made - a.made)
        .slice(0, 8),
    [stats],
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <F1Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
        <F1Skeleton className="h-[300px] w-full rounded-lg" />
      </div>
    );
  }

  if (totalOvertakes === 0 && positionChart.rows.length === 0) {
    return (
      <F1EmptyState
        type="no-data"
        size="sm"
        showDecoration={false}
        title="No overtake data for this session"
        description="Overtakes are computed from FastF1 lap positions. This session hasn't been ingested yet, or has no racing laps."
        className="py-8"
      />
    );
  }

  const topMover = stats[0];

  // Position-chart tooltip (P1 first)
  type TipItem = {
    dataKey: string | number;
    value: number;
    color?: string;
    stroke?: string;
  };
  const PosTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: TipItem[];
    label?: string | number;
  }) => {
    if (!active || !payload?.length) return null;
    const rows = payload
      .filter((p) => p.value != null)
      .sort((a, b) => a.value - b.value)
      .slice(0, 12);
    return (
      <div className="rounded-md border border-border bg-popover/95 px-2 py-1.5 text-xs shadow-premium-sm">
        <div className="mb-1 font-mono tabular-nums text-muted-foreground">LAP {label}</div>
        {rows.map((p) => (
          <div key={p.dataKey} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span className="w-9 font-bold">{code(p.dataKey)}</span>
            <span className="font-mono tabular-nums">P{p.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Overtakes</span>
            <Car className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="font-mono text-2xl font-bold tabular-nums">{totalOvertakes}</span>
        </div>
        {topMover && (
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Most passes</span>
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="block text-lg">
              {who(topMover.id)}
              <span className="block text-sm text-muted-foreground">
                {topMover.made} pass{topMover.made === 1 ? "" : "es"}
              </span>
            </span>
          </div>
        )}
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Race laps</span>
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="font-mono text-2xl font-bold tabular-nums">{positionChart.rows.length}</span>
        </div>
      </div>

      {/* Position progression */}
      <div>
        <div className="mb-1 flex items-center gap-2 px-1">
          <TrendingUp className="h-3 w-3 text-primary" />
          <span className="text-xs font-medium text-muted-foreground">
            Position by lap
          </span>
        </div>
        <F1ChartContainer
          minHeight={340}
          isEmpty={positionChart.rows.length === 0}
          emptyTitle="No Position Data"
          emptyDescription="Position-by-lap data is not available for this session yet."
        >
          <ResponsiveContainer width="100%" height={340}>
          <LineChart data={positionChart.rows} margin={{ left: 8, right: 12, top: 8, bottom: 20 }}>
            <CartesianGrid vertical={false} stroke={chartTheme.grid} strokeDasharray="3 3" />
            {safetyBands(safety)}
            <XAxis
              dataKey="lap"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickLine={false}
              tick={chartTheme.tick}
              stroke={chartTheme.axis}
              label={{ value: "Lap", position: "insideBottom", offset: -8, fontSize: 12, fill: chartTheme.tick.fill }}
            />
            <YAxis
              reversed
              domain={[1, positionChart.maxPos]}
              allowDecimals={false}
              width={28}
              tickLine={false}
              tick={chartTheme.tick}
              stroke={chartTheme.axis}
            />
            <Tooltip content={<PosTooltip />} cursor={chartTheme.cursor} />
            {positionChart.series.map((id) => (
              <Line
                key={id}
                type="monotone"
                dataKey={id}
                stroke={color(id)}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        </F1ChartContainer>
        <SafetyLegend periods={safety} className="mt-2 justify-center" />
      </div>

      {/* Overtakes — density across the race, who gained, then the feed */}
      {totalOvertakes > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card/40">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Car className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">
              Overtakes
            </span>
            <span className="readout text-sm text-foreground">{totalOvertakes}</span>
            {busiestLap && busiestLap.n > 1 && (
              <span className="ml-auto text-xs text-muted-foreground">
                Busiest: lap <span className="timing text-foreground/80">{busiestLap.lap}</span>, {busiestLap.n} passes
              </span>
            )}
          </div>

          {/* Density strip — one bar per lap, height = passes that lap */}
          {lapDensity.bars.length > 1 && (
            <div className="border-b border-border px-3 py-2.5">
              <div className="flex h-12 items-end gap-px" role="img"
                   aria-label={`Overtakes per lap. Busiest lap ${busiestLap?.lap} with ${busiestLap?.n}.`}>
                {lapDensity.bars.map((b) => (
                  <span
                    key={b.lap}
                    title={`Lap ${b.lap} — ${b.n} overtake${b.n === 1 ? "" : "s"}`}
                    className={cn(
                      "min-w-px flex-1 rounded-t-sm transition-colors",
                      b.n === 0 ? "bg-muted/50" : "bg-primary/70 hover:bg-primary",
                    )}
                    style={{
                      height: b.n === 0 ? 2 : `${Math.max(12, (b.n / lapDensity.peak) * 100)}%`,
                    }}
                  />
                ))}
              </div>
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>Lap 1</span>
                <span>Lap {lapDensity.bars.length}</span>
              </div>
            </div>
          )}

          {/* Who gained: passes made and conceded, in words */}
          {netMovers.length > 0 && (
            <ul className="divide-y divide-border/50 border-b border-border">
              {netMovers.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-x-2 px-3 py-1.5 text-sm">
                  <span className="h-3 w-1 shrink-0 rounded-full" style={{ backgroundColor: color(m.id) }} />
                  {who(m.id)}
                  <span className="ml-auto text-muted-foreground">
                    made {m.made}, conceded {m.recv}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* Feed */}
          <div className="max-h-[280px] overflow-auto">
            {(overtakes ?? []).map((o, i) => (
              <div
                key={i}
                className="flex items-center gap-2 border-b border-border/50 px-3 py-1.5 text-sm last:border-0"
              >
                <span className="timing w-14 shrink-0 text-xs text-muted-foreground">Lap {o.lap_number}</span>
                {who(o.overtaking_driver_id)}
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gain" aria-label="passed" />
                {who(o.overtaken_driver_id, "font-medium text-ink-2")}
                {o.position != null && (
                  <span className="timing ml-auto text-xs text-muted-foreground">P{o.position}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OvertakesAnalysis;
