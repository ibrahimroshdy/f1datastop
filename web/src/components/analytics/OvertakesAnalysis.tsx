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
import { cn } from "@/lib/utils";
import { useDbOvertakes, useDbLaps, useDbRaceControl } from "@/hooks/useWarehouse";
import { useRaceResults } from "@/hooks/f1";
import { getTeamColorById } from "@/constants/f1Colors";
import { chartTheme } from "@/lib/chartTheme";
import { F1Skeleton, F1EmptyState, F1ChartContainer } from "@/components/f1";
import { deriveSafetyPeriods } from "@/lib/f1/safetyPeriods";
import { safetyBands, SafetyLegend } from "@/components/analytics/SafetyCarBands";

interface OvertakesAnalysisProps {
  year: number;
  round: string;
  session?: string;
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
    const map: Record<string, { code: string; color: string }> = {};
    const results: any[] = (race.data as any)?.data?.Results ?? [];
    results.forEach((r) => {
      const id = r.Driver?.driverId;
      if (!id) return;
      map[id] = {
        code: r.Driver?.code || id.slice(0, 3).toUpperCase(),
        color: getTeamColorById(r.Constructor?.constructorId || r.Constructor?.name || ""),
      };
    });
    return map;
  }, [race.data]);

  const code = (id: string) => driverMeta[id]?.code || id.slice(0, 3).toUpperCase();
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
    const rows = Array.from(byLap.values()).sort((a: any, b: any) => a.lap - b.lap);
    const series = Array.from(driverIds);
    const maxPos = Math.max(1, ...rows.flatMap((r: any) => series.map((s) => r[s] ?? 0)));
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
  const maxBar = Math.max(1, ...netMovers.map((m) => Math.max(m.made, m.recv)));

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
  const PosTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const rows = payload
      .filter((p: any) => p.value != null)
      .sort((a: any, b: any) => a.value - b.value)
      .slice(0, 12);
    return (
      <div className="rounded-md border border-border bg-popover/95 px-2 py-1.5 text-xs shadow-premium-sm">
        <div className="mb-1 font-mono tabular-nums text-muted-foreground">LAP {label}</div>
        {rows.map((p: any) => (
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
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Overtakes</span>
            <Car className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="font-mono text-2xl font-bold tabular-nums">{totalOvertakes}</span>
        </div>
        {topMover && (
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Most passes</span>
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="font-mono text-2xl font-bold tabular-nums">
              {code(topMover.id)} <span className="text-base text-muted-foreground">·{topMover.made}</span>
            </span>
          </div>
        )}
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Race laps</span>
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="font-mono text-2xl font-bold tabular-nums">{positionChart.rows.length}</span>
        </div>
      </div>

      {/* Position progression */}
      <div>
        <div className="mb-1 flex items-center gap-2 px-1">
          <TrendingUp className="h-3 w-3 text-primary" />
          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
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
              label={{ value: "Lap", position: "insideBottom", offset: -8, fontSize: 11, fill: chartTheme.tick.fill }}
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
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Overtakes
            </span>
            <span className="readout text-sm text-foreground">{totalOvertakes}</span>
            {busiestLap && busiestLap.n > 1 && (
              <span className="ml-auto text-2xs text-muted-foreground">
                busiest — <span className="timing text-foreground/80">L{busiestLap.lap}</span> ({busiestLap.n})
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
              <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
                <span>L1</span>
                <span>L{lapDensity.bars.length}</span>
              </div>
            </div>
          )}

          {/* Who gained — passes made vs conceded, as opposing bars */}
          {netMovers.length > 0 && (
            <div className="space-y-1 border-b border-border px-3 py-2.5">
              <div className="mb-1.5 flex items-center justify-between text-[9px] uppercase tracking-widest text-muted-foreground">
                <span>Passes made</span>
                <span>Conceded</span>
              </div>
              {netMovers.map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  <span className="w-9 shrink-0 text-xs font-bold" style={{ color: color(m.id) }}>
                    {code(m.id)}
                  </span>
                  {/* made — grows leftwards from centre so gains and losses read as a tug-of-war */}
                  <span className="flex flex-1 justify-end">
                    <span
                      className="h-2.5 rounded-l-sm bg-gain/80"
                      style={{ width: `${(m.made / maxBar) * 100}%` }}
                      title={`${code(m.id)} made ${m.made} pass${m.made === 1 ? "" : "es"}`}
                    />
                  </span>
                  <span className="timing w-6 shrink-0 text-center text-[10px] text-muted-foreground">
                    {m.made}
                  </span>
                  <span className="flex flex-1 justify-start">
                    <span
                      className="h-2.5 rounded-r-sm bg-loss/70"
                      style={{ width: `${(m.recv / maxBar) * 100}%` }}
                      title={`${code(m.id)} was passed ${m.recv} time${m.recv === 1 ? "" : "s"}`}
                    />
                  </span>
                  <span className="timing w-6 shrink-0 text-center text-[10px] text-muted-foreground">
                    {m.recv}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Feed */}
          <div className="max-h-[280px] overflow-auto">
            {(overtakes ?? []).map((o, i) => (
              <div
                key={i}
                className="flex items-center gap-2 border-b border-border/50 px-3 py-1.5 text-sm last:border-0"
              >
                <span className="timing w-9 shrink-0 text-xs text-muted-foreground">L{o.lap_number}</span>
                <span
                  className="rounded px-1.5 py-0.5 text-xs font-bold"
                  style={{
                    color: color(o.overtaking_driver_id),
                    backgroundColor: `${color(o.overtaking_driver_id)}1f`,
                  }}
                >
                  {code(o.overtaking_driver_id)}
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gain" />
                <span className="text-xs font-bold" style={{ color: color(o.overtaken_driver_id) }}>
                  {code(o.overtaken_driver_id)}
                </span>
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
