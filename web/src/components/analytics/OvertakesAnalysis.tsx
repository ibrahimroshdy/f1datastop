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
import { useDbOvertakes, useDbLaps } from "@/hooks/useWarehouse";
import { useRaceResults } from "@/hooks/f1";
import { getTeamColorById } from "@/constants/f1Colors";
import { chartTheme } from "@/lib/chartTheme";
import { F1Skeleton, F1EmptyState } from "@/components/f1";

interface OvertakesAnalysisProps {
  year: number;
  round: string;
  session?: string;
}

const OvertakesAnalysis: React.FC<OvertakesAnalysisProps> = ({ year, round }) => {
  const roundNum = parseInt(round, 10);
  const { data: overtakes, isLoading: isOtLoading } = useDbOvertakes(year, roundNum, "R");
  const { data: laps, isLoading: isLapsLoading } = useDbLaps(year, roundNum, "R");
  const race = useRaceResults(year, round);

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
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={positionChart.rows} margin={{ left: 8, right: 12, top: 8, bottom: 20 }}>
            <CartesianGrid vertical={false} stroke={chartTheme.grid} strokeDasharray="3 3" />
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
      </div>

      {/* Overtake feed */}
      {totalOvertakes > 0 && (
        <div>
          <div className="mb-1 flex items-center gap-2 px-1">
            <Car className="h-3 w-3 text-primary" />
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Overtakes ({totalOvertakes})
            </span>
          </div>
          <div className="max-h-[320px] overflow-auto rounded-md border border-border">
            {(overtakes ?? []).map((o, i) => (
              <div
                key={i}
                className="flex items-center gap-2 border-b border-border/60 px-3 py-1.5 text-sm last:border-0"
              >
                <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">L{o.lap_number}</span>
                <span className="w-9 font-bold" style={{ color: color(o.overtaking_driver_id) }}>
                  {code(o.overtaking_driver_id)}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="w-9 font-bold" style={{ color: color(o.overtaken_driver_id) }}>
                  {code(o.overtaken_driver_id)}
                </span>
                {o.position != null && (
                  <span className="ml-auto font-mono text-xs text-muted-foreground">P{o.position}</span>
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
