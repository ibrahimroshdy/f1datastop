import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  YAxis,
} from "recharts";
import { Loader2, Lock } from "lucide-react";
import { chartTheme } from "@/lib/chartTheme";
import { cn } from "@/lib/utils";
import type { TelemetryBlob } from "@/services/telemetryService";
import type { DriverTelemetry } from "../hooks/usePitWallTelemetry";
import type { PitWallDriver } from "../hooks/usePitWallData";

interface Props {
  telemetry: DriverTelemetry[];
  drivers: PitWallDriver[];
  refCode: string | null;
  mode: "focus" | "overlay";
}

interface Ready {
  code: string;
  color: string;
  blob: TelemetryBlob;
}

const CHANNELS: { key: string; label: string; unit?: string; domain?: [number, number] }[] = [
  { key: "speed", label: "Speed", unit: "km/h" },
  { key: "throttle", label: "Throttle", unit: "%", domain: [0, 100] },
  { key: "brake", label: "Brake", domain: [0, 1] },
  { key: "gear", label: "Gear", domain: [0, 8] },
  { key: "rpm", label: "RPM" },
  { key: "drs", label: "DRS", domain: [0, 14] },
];

/** Integrate lap time from speed (km/h) over distance (m) — for the delta trace. */
function cumulativeTime(dist: number[], speed: number[]): number[] {
  const t = [0];
  for (let i = 1; i < dist.length; i++) {
    const dd = dist[i] - dist[i - 1];
    const v = (speed[i] + speed[i - 1]) / 2 / 3.6;
    t.push(t[i - 1] + (v > 0 ? dd / v : 0));
  }
  return t;
}

export function TelemetryPanel({ telemetry, drivers, refCode, mode }: Props) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const colorOf = useMemo(() => {
    const m: Record<string, string> = {};
    for (const d of drivers) m[d.code] = d.team_color || "#9ca3af";
    return m;
  }, [drivers]);

  const ready: Ready[] = telemetry
    .filter((t) => t.state?.status === "done")
    .map((t) => ({
      code: t.code,
      color: colorOf[t.code] || "#9ca3af",
      blob: (t.state as { status: "done"; blob: TelemetryBlob }).blob,
    }));

  const pending = telemetry.filter((t) => t.state && t.state.status !== "done");

  const { rows, present, hasDelta } = useMemo(() => {
    if (!ready.length) return { rows: [] as Record<string, number | null>[], present: [] as string[], hasDelta: false };
    const base = ready[0].blob.channels.distance ?? [];
    const n = base.length;
    // Reference driver for delta (falls back to the first ready driver).
    const refBlob = ready.find((r) => r.code === refCode)?.blob ?? ready[0].blob;
    const refT =
      refBlob.channels.distance && refBlob.channels.speed
        ? cumulativeTime(refBlob.channels.distance, refBlob.channels.speed)
        : null;
    // Precompute each driver's cumulative-time trace ONCE (not per sample).
    const timeByCode: Record<string, number[] | null> = {};
    for (const r of ready) {
      const dd = r.blob.channels.distance;
      const sp = r.blob.channels.speed;
      timeByCode[r.code] = dd && sp ? cumulativeTime(dd, sp) : null;
    }

    const rows: Record<string, number | null>[] = [];
    for (let i = 0; i < n; i++) {
      const row: Record<string, number | null> = { i, d: base[i] };
      for (const r of ready) {
        for (const ch of CHANNELS) {
          const arr = r.blob.channels[ch.key];
          row[`${r.code}_${ch.key}`] = arr && i < arr.length ? arr[i] : null;
        }
        if (refT) {
          const t = timeByCode[r.code];
          row[`${r.code}_delta`] = t && i < t.length && i < refT.length ? t[i] - refT[i] : null;
        }
      }
      rows.push(row);
    }
    const present = CHANNELS.filter((ch) => {
      // DRS is emitted even in the no-DRS era (2026) but never opens — only show it
      // when the car actually deploys it (FastF1 open codes are 10/12/14). Data-driven
      // era-awareness, no season hardcoding.
      if (ch.key === "drs") return ready.some((r) => (r.blob.channels.drs ?? []).some((v) => v >= 10));
      return ready.some((r) => (r.blob.channels[ch.key]?.length ?? 0) > 0);
    }).map((c) => c.key);
    const hasDelta = mode === "overlay" && ready.length >= 2 && !!refT;
    return { rows, present, hasDelta };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(ready.map((r) => `${r.code}:${r.blob.lap_number}`)), refCode, mode]);

  if (!ready.length && !pending.length) {
    return (
      <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
        Select drivers to load telemetry.
      </div>
    );
  }

  const activeDist = activeIdx != null && rows[activeIdx] ? (rows[activeIdx].d as number) : null;

  return (
    <div className="space-y-2">
      {/* Per-driver status */}
      <div className="flex flex-wrap gap-2">
        {telemetry.map((t) => (
          <StatusChip key={t.code} t={t} color={colorOf[t.code] || "#9ca3af"} />
        ))}
      </div>

      {ready.length > 0 && (
        <div
          className="space-y-1"
          onMouseLeave={() => setActiveIdx(null)}
        >
          {hasDelta && (
            <Trace
              rows={rows}
              ready={ready}
              suffix="delta"
              label="Δ vs ref (s)"
              height={64}
              zeroLine
              activeIdx={activeIdx}
              onHover={setActiveIdx}
            />
          )}
          {CHANNELS.filter((c) => present.includes(c.key)).map((ch, idx) => (
            <Trace
              key={ch.key}
              rows={rows}
              ready={ready}
              suffix={ch.key}
              label={ch.unit ? `${ch.label} (${ch.unit})` : ch.label}
              height={idx === 0 ? 120 : 64}
              domain={ch.domain}
              activeIdx={activeIdx}
              onHover={setActiveIdx}
            />
          ))}
          {activeDist != null && (
            <div className="text-right text-2xs text-muted-foreground">
              {Math.round(activeDist)} m
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusChip({ t, color }: { t: DriverTelemetry; color: string }) {
  const s = t.state?.status;
  const base = "flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-2xs font-semibold";
  if (s === "done") {
    return (
      <span className={cn(base, "border-transparent text-foreground")} style={{ backgroundColor: `${color}22` }}>
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        {t.code} · L{t.lap}
      </span>
    );
  }
  if (s === "unauthenticated") {
    return (
      <span className={cn(base, "border-border text-muted-foreground")}>
        <Lock className="h-3 w-3" /> {t.code} · sign in for lap {t.lap}
      </span>
    );
  }
  if (s === "error") {
    return <span className={cn(base, "border-destructive/40 text-destructive")}>{t.code} · unavailable</span>;
  }
  // queued / processing / loading
  return (
    <span className={cn(base, "border-border text-muted-foreground")}>
      <Loader2 className="h-3 w-3 animate-spin" /> {t.code} · generating L{t.lap}…
    </span>
  );
}

interface TraceProps {
  rows: Record<string, number | null>[];
  ready: Ready[];
  suffix: string;
  label: string;
  height: number;
  domain?: [number, number];
  zeroLine?: boolean;
  activeIdx: number | null;
  onHover: (i: number | null) => void;
}

function Trace({ rows, ready, suffix, label, height, domain, zeroLine, activeIdx, onHover }: TraceProps) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-1 top-0.5 z-10 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={rows}
          margin={{ top: 10, right: 6, left: 2, bottom: 0 }}
          onMouseMove={(e: { activeTooltipIndex?: number }) => {
            if (e?.activeTooltipIndex != null) onHover(e.activeTooltipIndex);
          }}
        >
          <CartesianGrid stroke={chartTheme.grid} vertical={false} strokeDasharray="2 4" />
          <YAxis
            hide={false}
            width={34}
            domain={domain ?? ["auto", "auto"]}
            stroke={chartTheme.axis}
            tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
          />
          {zeroLine && <ReferenceLine y={0} stroke={chartTheme.axis} strokeDasharray="2 2" />}
          {activeIdx != null && rows[activeIdx] && (
            <ReferenceLine x={activeIdx} stroke={chartTheme.primary} strokeOpacity={0.5} />
          )}
          {ready.map((r) => (
            <Line
              key={r.code}
              dataKey={`${r.code}_${suffix}`}
              stroke={r.color}
              strokeWidth={1.4}
              dot={false}
              isAnimationActive={false}
              connectNulls
              type={suffix === "gear" || suffix === "drs" || suffix === "brake" ? "stepAfter" : "monotone"}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
