import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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
  F1Skeleton,
} from "@/components/f1";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { chartTheme } from "@/lib/chartTheme";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  useTelemetryIndex,
  useTelemetryLaps,
} from "@/hooks/useFastF1Telemetry";

type Metric = "speed" | "throttle" | "brake" | "gear" | "rpm" | "drs";

const METRICS: { key: Metric; label: string; unit: string; step?: boolean }[] = [
  { key: "speed", label: "Speed", unit: "km/h" },
  { key: "throttle", label: "Throttle", unit: "%" },
  { key: "brake", label: "Brake", unit: "", step: true },
  { key: "gear", label: "Gear", unit: "", step: true },
  { key: "rpm", label: "RPM", unit: "" },
  { key: "drs", label: "DRS", unit: "", step: true },
];

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

  const chartData = useMemo(() => {
    if (!laps.length) return [];
    const base = laps[0].channels.distance ?? [];
    return base.map((d, i) => {
      const row: Record<string, number | null> = { distance: Math.round(d) };
      for (const lap of laps) {
        row[lap.driver] = lap.channels[metric]?.[i] ?? null;
      }
      return row;
    });
  }, [laps, metric]);

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
      <div className="flex h-[300px] items-center justify-center text-center text-sm text-muted-foreground">
        No telemetry available for this session yet.
      </div>
    );
  }

  return (
    <F1Card variant="default" className="border-0 bg-transparent p-0 shadow-none">
      <F1CardHeader className="px-0 pt-0">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <F1CardTitle className="text-base">Telemetry · fastest laps</F1CardTitle>
            <F1CardDescription className="text-xs">
              {metricMeta.label} by track distance — pick up to {MAX_DRIVERS} drivers to compare
            </F1CardDescription>
          </div>
          <Select value={metric} onValueChange={(v) => setMetric(v as Metric)}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METRICS.map((m) => (
                <SelectItem key={m.key} value={m.key}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                  "flex items-center justify-between gap-1 rounded px-1.5 py-1 text-xs font-medium transition-all",
                  active
                    ? "bg-accent text-accent-foreground shadow-sm"
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
          {indexLoading || lapsLoading ? (
            <F1Skeleton className="h-full w-full" />
          ) : !laps.length ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Select a driver to view telemetry.
            </div>
          ) : (
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
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {laps.map((lap) => (
                  <Line
                    key={lap.driver}
                    type={metricMeta.step ? "stepAfter" : "monotone"}
                    dataKey={lap.driver}
                    name={`${lap.driver}${lap.lap_time ? ` · ${lap.lap_time}` : ""}`}
                    stroke={lap.team_color || TEAM_COLORS.default}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
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
