import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2, Lock, RotateCcw, ZoomIn } from "lucide-react";
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
  /** 0–1 position of the reference car on its lap — drives the crosshair. */
  crosshairFrac: number;
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

export function TelemetryPanel({ telemetry, drivers, refCode, mode, crosshairFrac }: Props) {
  const colorOf = useMemo(() => {
    const m: Record<string, string> = {};
    for (const d of drivers) m[d.code] = d.team_color || "#9ca3af";
    return m;
  }, [drivers]);

  // Shared drag-to-zoom across every trace (by sample index).
  const [zoom, setZoom] = useState<[number, number] | null>(null);
  const [dragL, setDragL] = useState<number | null>(null);
  const [dragR, setDragR] = useState<number | null>(null);

  const ready: Ready[] = telemetry
    .filter((t) => t.state?.status === "done")
    .map((t) => ({
      code: t.code,
      color: colorOf[t.code] || "#9ca3af",
      blob: (t.state as { status: "done"; blob: TelemetryBlob }).blob,
    }));

  const pending = telemetry.filter((t) => t.state && t.state.status !== "done");
  const lapTimeByCode: Record<string, string | null> = {};
  for (const r of ready) lapTimeByCode[r.code] = r.blob.lap_time;
  // Teammates share a colour — dash the 2nd (and 3rd) car of a colour so they're
  // distinguishable. First = solid, second = "5 4", third = "2 3".
  const dashByCode: Record<string, string | undefined> = {};
  const seenColor = new Map<string, number>();
  for (const r of ready) {
    const i = seenColor.get(r.color) ?? 0;
    seenColor.set(r.color, i + 1);
    dashByCode[r.code] = i === 0 ? undefined : i === 1 ? "5 4" : "2 3";
  }

  const { rows, present, hasDelta, refTime } = useMemo(() => {
    if (!ready.length)
      return { rows: [] as Record<string, number | null>[], present: [] as string[], hasDelta: false, refTime: [] as number[] };
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
    return { rows, present, hasDelta, refTime: refT ?? [] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(ready.map((r) => `${r.code}:${r.blob.lap_number}`)), refCode, mode]);

  if (!ready.length && !pending.length) {
    return (
      <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
        Select drivers to load telemetry.
      </div>
    );
  }

  // Crosshair index = where the reference car sits on its current lap (frac from the
  // single race-replay playhead), mapped through the ref lap's cumulative-time trace.
  let cursorIdx: number | null = null;
  if (refTime.length) {
    const target = crosshairFrac * (refTime[refTime.length - 1] ?? 0);
    let bi = 0;
    let bd = Infinity;
    for (let i = 0; i < refTime.length; i++) {
      const d = Math.abs(refTime[i] - target);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    cursorIdx = bi;
  }
  const activeDist = cursorIdx != null && rows[cursorIdx] ? (rows[cursorIdx].d as number) : null;

  const onUp = () => {
    if (dragL != null && dragR != null && dragL !== dragR) setZoom([Math.min(dragL, dragR), Math.max(dragL, dragR)]);
    setDragL(null);
    setDragR(null);
  };
  const dragBand: [number, number] | null =
    dragL != null && dragR != null ? [Math.min(dragL, dragR), Math.max(dragL, dragR)] : null;

  return (
    <div className="space-y-2">
      {/* Per-driver status */}
      <div className="flex flex-wrap gap-2">
        {telemetry.map((t) => (
          <StatusChip key={t.code} t={t} color={colorOf[t.code] || "#9ca3af"} time={lapTimeByCode[t.code]} dash={dashByCode[t.code]} />
        ))}
      </div>

      {ready.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-2xs text-muted-foreground">
              <ZoomIn className="h-3 w-3" /> Drag to zoom
            </span>
            {zoom && (
              <button
                type="button"
                onClick={() => setZoom(null)}
                className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-2xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
            )}
          </div>
          {/* Live readout at the crosshair — the "watch the track" values */}
          {cursorIdx != null && (
            <div className="flex flex-wrap gap-1.5">
              {ready.map((r) => (
                <span
                  key={r.code}
                  className="flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-2xs"
                  style={{ borderColor: `${r.color}55`, backgroundColor: `${r.color}14` }}
                >
                  <span className="timing font-bold" style={{ color: r.color }}>{r.code}</span>
                  <span className="readout">
                    {Math.round(r.blob.channels.speed?.[cursorIdx] ?? 0)}
                    <span className="text-[9px] text-muted-foreground"> km/h</span>
                  </span>
                  <span className="text-muted-foreground">G{r.blob.channels.gear?.[cursorIdx] ?? "—"}</span>
                </span>
              ))}
            </div>
          )}
          {hasDelta && (
            <Trace
              rows={rows}
              ready={ready}
              dashByCode={dashByCode}
              suffix="delta"
              label="Δ vs ref (s)"
              height={64}
              zeroLine
              activeIdx={cursorIdx}
              domainX={zoom}
              dragBand={dragBand}
              dragging={dragL != null}
              onDown={setDragL}
              onMove={setDragR}
              onUp={onUp}
            />
          )}
          {CHANNELS.filter((c) => present.includes(c.key)).map((ch, idx) => (
            <Trace
              key={ch.key}
              rows={rows}
              ready={ready}
              dashByCode={dashByCode}
              suffix={ch.key}
              label={ch.unit ? `${ch.label} (${ch.unit})` : ch.label}
              height={idx === 0 ? 120 : 64}
              domain={ch.domain}
              activeIdx={cursorIdx}
              domainX={zoom}
              dragBand={dragBand}
              dragging={dragL != null}
              onDown={setDragL}
              onMove={setDragR}
              onUp={onUp}
            />
          ))}
          {activeDist != null && (
            <div className="text-right text-2xs text-muted-foreground">{Math.round(activeDist)} m</div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusChip({ t, color, time, dash }: { t: DriverTelemetry; color: string; time?: string | null; dash?: string }) {
  const s = t.state?.status;
  const base = "flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-2xs font-semibold";
  if (s === "done") {
    return (
      <span className={cn(base, "border-transparent text-foreground")} style={{ backgroundColor: `${color}22` }}>
        {/* swatch matches the trace: solid line, or dashed for a teammate */}
        <span
          className="h-[3px] w-3.5 shrink-0 rounded-full"
          style={dash ? { backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 3px, transparent 3px 6px)` } : { backgroundColor: color }}
        />
        {t.code} · L{t.lap}
        {time && <span className="readout font-normal text-muted-foreground">{time.replace(/^0:/, "")}</span>}
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
  dashByCode: Record<string, string | undefined>;
  suffix: string;
  label: string;
  height: number;
  domain?: [number, number];
  zeroLine?: boolean;
  activeIdx: number | null;
  domainX: [number, number] | null;
  dragBand: [number, number] | null;
  dragging: boolean;
  onDown: (i: number) => void;
  onMove: (i: number) => void;
  onUp: () => void;
}

function Trace({
  rows,
  ready,
  dashByCode,
  suffix,
  label,
  height,
  domain,
  zeroLine,
  activeIdx,
  domainX,
  dragBand,
  dragging,
  onDown,
  onMove,
  onUp,
}: TraceProps) {
  return (
    <div>
      <div className="px-1 pb-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={rows}
          margin={{ top: 4, right: 6, left: 2, bottom: 0 }}
          onMouseDown={(e: { activeLabel?: string | number }) => {
            if (e?.activeLabel != null) onDown(Number(e.activeLabel));
          }}
          onMouseMove={(e: { activeLabel?: string | number }) => {
            if (dragging && e?.activeLabel != null) onMove(Number(e.activeLabel));
          }}
          onMouseUp={onUp}
        >
          <CartesianGrid stroke={chartTheme.grid} vertical={false} strokeDasharray="2 4" />
          <XAxis dataKey="i" type="number" domain={domainX ?? ["dataMin", "dataMax"]} allowDataOverflow hide />
          <YAxis
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
              strokeDasharray={dashByCode[r.code]}
              dot={false}
              isAnimationActive={false}
              connectNulls
              type={suffix === "gear" || suffix === "drs" || suffix === "brake" ? "stepAfter" : "monotone"}
            />
          ))}
          {dragBand && (
            <ReferenceArea x1={dragBand[0]} x2={dragBand[1]} strokeOpacity={0.2} fill={chartTheme.primary} fillOpacity={0.08} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
