import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  F1Card,
  F1CardContent,
  F1CardDescription,
  F1CardHeader,
  F1CardTitle,
  F1ChartContainer,
  F1EmptyState,
} from "@/components/f1";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { chartTheme } from "@/lib/chartTheme";
import { cn } from "@/lib/utils";
import {
  useTelemetryIndex,
  useTelemetryLaps,
} from "@/hooks/useFastF1Telemetry";
import { useIsMobile } from "@/hooks/use-mobile";

type Metric = "speed" | "throttle" | "brake" | "gear" | "rpm" | "drs" | "delta";

const METRICS: { key: Metric; label: string; unit: string; step?: boolean }[] = [
  { key: "speed", label: "Speed", unit: "km/h" },
  { key: "delta", label: "Time Delta", unit: "s" },
  { key: "throttle", label: "Throttle", unit: "%" },
  { key: "brake", label: "Brake", unit: "", step: true },
  { key: "gear", label: "Gear", unit: "", step: true },
  { key: "rpm", label: "RPM", unit: "" },
  { key: "drs", label: "DRS", unit: "", step: true },
];

/** Cumulative lap time (s) at each distance sample, from speed (km/h) + distance (m). */
const cumulativeTime = (distance: number[], speed: number[]): number[] => {
  const t: number[] = [0];
  for (let i = 1; i < distance.length; i++) {
    const dd = distance[i] - distance[i - 1];
    const v = (speed[i] ?? 0) / 3.6; // m/s
    t[i] = t[i - 1] + (v > 1 ? dd / v : 0);
  }
  return t;
};

const MAX_DRIVERS = 3;

interface Props {
  year: number;
  round: number | string;
  session?: string;
}

/** Interactive car telemetry (speed/throttle/brake/gear/rpm/DRS) by distance,
 *  served from our Supabase warehouse. */
const FastF1TelemetryChart = ({ year, round, session = "R" }: Props) => {
  const { data: index, isLoading: indexLoading } = useTelemetryIndex(year, Number(round), session);
  const isMobile = useIsMobile();
  const [metric, setMetric] = useState<Metric>("speed");
  const [codes, setCodes] = useState<string[]>([]);

  // default to the two fastest (by top speed) once the index loads
  useEffect(() => {
    if (index && index.length && codes.length === 0) {
      setCodes(index.slice(0, 2).map((r) => r.driver_code));
    }
  }, [index, codes.length]);

  const { laps, isLoading: lapsLoading } = useTelemetryLaps(index, codes);
  const metricMeta = METRICS.find((m) => m.key === metric)!;
  const isDelta = metric === "delta";

  // For delta mode: the two drivers being compared (positive delta ⇒ `a` ahead).
  const pair = useMemo(
    () => (isDelta && laps.length >= 2 ? { a: laps[0].driver, b: laps[1].driver } : null),
    [isDelta, laps],
  );

  const chartData = useMemo(() => {
    if (!laps.length) return [];
    const base = laps[0].channels.distance ?? [];
    if (isDelta) {
      if (laps.length < 2) return [];
      const tA = cumulativeTime(base, laps[0].channels.speed ?? []);
      const tB = cumulativeTime(base, laps[1].channels.speed ?? []);
      return base.map((d, i) => ({ distance: Math.round(d), delta: +(tB[i] - tA[i]).toFixed(3) }));
    }
    return base.map((d, i) => {
      const row: Record<string, number | null> = { distance: Math.round(d) };
      for (const lap of laps) {
        row[lap.driver] = lap.channels[metric]?.[i] ?? null;
      }
      return row;
    });
  }, [laps, metric, isDelta]);

  const toggleDriver = (code: string) => {
    setCodes((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code);
      if (prev.length >= MAX_DRIVERS) return [...prev.slice(1), code];
      return [...prev, code];
    });
  };

  const colorFor = (code: string) =>
    laps.find((l) => l.driver === code)?.team_color || TEAM_COLORS.default;

  if (!indexLoading && (!index || index.length === 0)) {
    return (
      <F1EmptyState
        type="no-chart-data"
        size="sm"
        showDecoration={false}
        title="No Telemetry Data"
        description="No telemetry available for this session yet."
        className="h-[300px]"
      />
    );
  }

  const chartIsEmpty = laps.length === 0 || (isDelta && laps.length < 2);
  const chartEmptyTitle = laps.length === 0 ? "No Telemetry Data" : "Pick a Second Driver";
  const chartEmptyDescription =
    laps.length === 0
      ? "Select a driver to view telemetry."
      : "Pick a second driver to see the cumulative time gap between them.";

  return (
    <F1Card variant="default" className="border-0 bg-transparent p-0 shadow-none">
      <F1CardHeader className="px-0 pt-0">
        <div>
          <F1CardTitle className="text-base">Telemetry · fastest laps</F1CardTitle>
          <F1CardDescription className="text-xs">
            {isDelta
              ? pair
                ? `Cumulative time gap by distance — + = ${pair.a} ahead of ${pair.b}`
                : "Cumulative time gap — pick two drivers"
              : `${metricMeta.label} by track distance — pick up to ${MAX_DRIVERS} drivers to compare`}
          </F1CardDescription>
        </div>

        {/* metric picker — segmented buttons: one tap, all options visible,
            touch-friendly. Same grammar as the driver toggles below. */}
        <div className="mt-3 flex flex-wrap gap-1" role="group" aria-label="Telemetry metric">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              aria-pressed={metric === m.key}
              className={cn(
                "min-h-9 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                metric === m.key
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* driver toggles — same grammar as the shared DriverSelector */}
        <div className="mt-3 grid grid-cols-4 gap-1 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
          {(index ?? []).map((r) => {
            const active = codes.includes(r.driver_code);
            const teamColor = active ? colorFor(r.driver_code) : null;
            return (
              <button
                key={r.driver_code}
                onClick={() => toggleDriver(r.driver_code)}
                className={cn(
                  "flex items-center justify-between min-h-9 gap-1 rounded px-1.5 py-1 text-xs font-medium transition-all",
                  active
                    ? "bg-accent text-accent-foreground shadow-xs"
                    : "bg-transparent text-muted-foreground hover:bg-muted/50",
                )}
                style={{
                  opacity: active ? 1 : 0.6,
                  borderLeft: `2px solid ${teamColor ?? "hsl(var(--border))"}`,
                }}
              >
                <span className="flex items-center gap-1 truncate">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: teamColor ?? "hsl(var(--muted-foreground))" }}
                  />
                  <span className="font-bold">{r.driver_code}</span>
                </span>
                {r.top_speed ? (
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {Math.round(r.top_speed)}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </F1CardHeader>

      <F1CardContent className="px-0 pb-0">
        <div className="h-[360px] w-full">
          <F1ChartContainer
            minHeight={360}
            className="h-[360px]"
            isLoading={indexLoading || lapsLoading}
            useSkeleton
            isEmpty={!indexLoading && !lapsLoading && chartIsEmpty}
            emptyTitle={chartEmptyTitle}
            emptyDescription={chartEmptyDescription}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="distance"
                  stroke={chartTheme.axis}
                  tick={chartTheme.tick}
                  tickFormatter={(v) => `${v}m`}
                  label={{ value: "Distance", position: "insideBottomRight", offset: -2, fontSize: 11, fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}
                />
                <YAxis
                  stroke={chartTheme.axis}
                  tick={chartTheme.tick}
                  width={44}
                  label={{ value: metricMeta.unit, angle: -90, position: "insideLeft", fontSize: 11, fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}
                />
                <Tooltip
                  contentStyle={chartTheme.tooltipContentStyle}
                  labelStyle={chartTheme.tooltipLabelStyle}
                  cursor={chartTheme.cursor}
                  labelFormatter={(v) => `${v} m`}
                />
                {!isDelta && <Legend wrapperStyle={{ fontSize: 12 }} />}
                {isDelta ? (
                  <>
                    <ReferenceLine y={0} stroke={chartTheme.grid} strokeDasharray="4 3" />
                    <Line
                      type="monotone"
                      dataKey="delta"
                      name="Δ (s)"
                      stroke="hsl(var(--foreground))"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 3 }}
                      connectNulls
                    />
                  </>
                ) : (
                  laps.map((lap) => (
                    <Line
                      key={lap.driver}
                      type={metricMeta.step ? "stepAfter" : "monotone"}
                      dataKey={lap.driver}
                      name={isMobile ? lap.driver : `${lap.driver}${lap.lap_time ? ` · ${lap.lap_time}` : ""}`}
                      stroke={lap.team_color || TEAM_COLORS.default}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 3 }}
                      connectNulls
                    />
                  ))
                )}
              </LineChart>
            </ResponsiveContainer>
          </F1ChartContainer>
        </div>

        {/* per-driver metric chips */}
        {laps.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {laps.map((lap) => (
              <div
                key={lap.driver}
                className="rounded-lg border border-border/60 px-3 py-2"
                style={{ borderLeftColor: lap.team_color || TEAM_COLORS.default, borderLeftWidth: 3 }}
              >
                <div className="text-sm font-semibold">{lap.driver}</div>
                <div className="mt-0.5 font-mono text-xs leading-tight text-muted-foreground tabular-nums">
                  top {lap.metrics.top_speed ?? "–"} km/h · {lap.metrics.full_throttle_pct ?? "–"}% WOT
                  {" · "}
                  {lap.metrics.brake_zones ?? "–"} brake zones
                </div>
              </div>
            ))}
          </div>
        )}
      </F1CardContent>
    </F1Card>
  );
};

export default FastF1TelemetryChart;
