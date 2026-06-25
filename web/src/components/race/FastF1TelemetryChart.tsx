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
import { Loader2 } from "lucide-react";
import {
  F1Card,
  F1CardContent,
  F1CardDescription,
  F1CardHeader,
  F1CardTitle,
} from "@/components/f1";
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
    laps.find((l) => l.driver === code)?.team_color || "#E10600";

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

        {/* driver toggles, sorted by top speed (from the index) */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(index ?? []).map((r) => {
            const active = codes.includes(r.driver_code);
            return (
              <button
                key={r.driver_code}
                onClick={() => toggleDriver(r.driver_code)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
                  active
                    ? "border-transparent text-white"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
                style={active ? { backgroundColor: colorFor(r.driver_code) } : undefined}
              >
                {r.driver_code}
                {r.top_speed ? (
                  <span className="ml-1 opacity-70">{Math.round(r.top_speed)}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </F1CardHeader>

      <F1CardContent className="px-0 pb-0">
        <div className="h-[360px] w-full">
          {indexLoading || lapsLoading ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Loading telemetry…
            </div>
          ) : !laps.length ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Select a driver to view telemetry.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis
                  dataKey="distance"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${v}m`}
                  label={{ value: "Distance", position: "insideBottomRight", offset: -2, fontSize: 11 }}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  width={44}
                  label={{ value: metricMeta.unit, angle: -90, position: "insideLeft", fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#15151e", borderColor: "#2a2a35", color: "#f3f4f6", fontSize: 12 }}
                  labelFormatter={(v) => `${v} m`}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {laps.map((lap) => (
                  <Line
                    key={lap.driver}
                    type={metricMeta.step ? "stepAfter" : "monotone"}
                    dataKey={lap.driver}
                    name={`${lap.driver}${lap.lap_time ? ` · ${lap.lap_time}` : ""}`}
                    stroke={lap.team_color || "#E10600"}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
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
                style={{ borderLeftColor: lap.team_color || "#E10600", borderLeftWidth: 3 }}
              >
                <div className="text-sm font-semibold">{lap.driver}</div>
                <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
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
