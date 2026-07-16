import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pause, Play, RotateCcw } from "lucide-react";
import {
  fetchCircuitGeometryBlob,
  getCircuitGeometry,
  type CircuitGeometryBlob,
} from "@/services/circuitGeometryService";
import { cn } from "@/lib/utils";
import type { TelemetryBlob } from "@/services/telemetryService";
import type { DriverTelemetry } from "../hooks/usePitWallTelemetry";
import type { PitWallDriver } from "../hooks/usePitWallData";
import type { LapPlayhead } from "../hooks/useLapPlayhead";

interface Props {
  year: number;
  round: number | null;
  telemetry: DriverTelemetry[];
  drivers: PitWallDriver[];
  playhead: LapPlayhead;
}

const W = 620;
const H = 420;
const PAD = 26;
const SPEEDS = [0.5, 1, 2, 4];

function cumulativeTime(dist: number[], speed: number[]): number[] {
  const t = [0];
  for (let i = 1; i < dist.length; i++) {
    const dd = dist[i] - dist[i - 1];
    const v = (speed[i] + speed[i - 1]) / 2 / 3.6;
    t.push(t[i - 1] + (v > 0 ? dd / v : 0));
  }
  return t;
}

interface DriverLine {
  code: string;
  color: string;
  xs: number[];
  ys: number[];
  dist: number[];
  time: number[];
  speed: number[];
  gear: number[];
  duration: number;
}

/** Nearest sample index to a playhead time. */
function idxAtTime(time: number[], t: number): number {
  if (!time.length) return 0;
  if (t <= time[0]) return 0;
  const last = time.length - 1;
  if (t >= time[last]) return last;
  let i = 1;
  while (i < last && time[i] < t) i++;
  return time[i] - t < t - time[i - 1] ? i : i - 1;
}

export function TrackStagePanel({ year, round, telemetry, drivers, playhead }: Props) {
  const t = playhead.t;

  const colorOf = useMemo(() => {
    const m: Record<string, string> = {};
    for (const d of drivers) m[d.code] = d.team_color || "#9ca3af";
    return m;
  }, [drivers]);

  const geometry = useQuery({
    queryKey: ["circuit-geometry", "index", year, round],
    queryFn: () => getCircuitGeometry(year, round as number),
    enabled: !!round,
    staleTime: 24 * 60 * 60 * 1000,
  });
  const geomUrl = geometry.data?.public_url;
  const geomBlob = useQuery({
    queryKey: ["circuit-geometry", "blob", geomUrl],
    queryFn: () => fetchCircuitGeometryBlob(geomUrl as string),
    enabled: !!geomUrl,
    staleTime: 24 * 60 * 60 * 1000,
  });
  const geom: CircuitGeometryBlob | undefined = geomBlob.data;

  const lines: DriverLine[] = useMemo(() => {
    return telemetry
      .filter((d) => d.state?.status === "done")
      .map((d) => {
        const blob = (d.state as { status: "done"; blob: TelemetryBlob }).blob;
        const xs = blob.channels.x ?? [];
        const ys = blob.channels.y ?? [];
        const dist = blob.channels.distance ?? [];
        const sp = blob.channels.speed ?? [];
        const gear = blob.channels.gear ?? [];
        const time = dist.length && sp.length ? cumulativeTime(dist, sp) : [];
        return {
          code: d.code,
          color: colorOf[d.code] || "#9ca3af",
          xs,
          ys,
          dist,
          speed: sp,
          gear,
          time,
          duration: time.length ? time[time.length - 1] : 0,
        };
      })
      .filter((l) => l.xs.length && l.time.length);
  }, [telemetry, colorOf]);

  const duration = useMemo(() => Math.max(0, ...lines.map((l) => l.duration)), [lines]);
  useEffect(() => {
    playhead.setDuration(duration);
  }, [duration, playhead]);

  const bounds = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const l of lines) {
      for (let i = 0; i < l.xs.length; i++) {
        minX = Math.min(minX, l.xs[i]);
        maxX = Math.max(maxX, l.xs[i]);
        minY = Math.min(minY, l.ys[i]);
        maxY = Math.max(maxY, l.ys[i]);
      }
    }
    return { minX, maxX, minY, maxY };
  }, [lines]);

  const scale = useMemo(() => {
    const { minX, maxX, minY, maxY } = bounds;
    if (!isFinite(minX) || maxX <= minX || maxY <= minY) return null;
    const s = Math.min((W - 2 * PAD) / (maxX - minX), (H - 2 * PAD) / (maxY - minY));
    const px = (x: number) => PAD + (x - minX) * s + (W - 2 * PAD - (maxX - minX) * s) / 2;
    const py = (y: number) => H - (PAD + (y - minY) * s + (H - 2 * PAD - (maxY - minY) * s) / 2);
    return { px, py };
  }, [bounds]);

  const trackPath = useMemo(() => {
    if (!scale) return "";
    const l = lines[0];
    if (!l) return "";
    return l.xs.map((x, i) => `${i ? "L" : "M"}${scale.px(x).toFixed(1)},${scale.py(l.ys[i]).toFixed(1)}`).join("");
  }, [lines, scale]);

  const cornerPts = useMemo(() => {
    const ref = lines[0];
    if (!scale || !ref || !geom?.corners?.length) return [];
    return geom.corners
      .filter((c) => c.d != null)
      .map((c) => {
        const cd = c.d as number;
        let bi = 0;
        let bd = Infinity;
        for (let i = 0; i < ref.dist.length; i++) {
          const dd = Math.abs(ref.dist[i] - cd);
          if (dd < bd) {
            bd = dd;
            bi = i;
          }
        }
        return { key: `${c.n}${c.letter ?? ""}`, label: `${c.n}${c.letter ?? ""}`, x: scale.px(ref.xs[bi]), y: scale.py(ref.ys[bi]) };
      });
  }, [geom, lines, scale]);

  if (!lines.length) {
    return (
      <div className="flex h-56 items-center justify-center text-xs text-muted-foreground">
        {telemetry.length ? "Loading track positions…" : "Select drivers to see the track."}
      </div>
    );
  }

  const dotAt = (l: DriverLine) => {
    if (!scale) return null;
    const time = l.time;
    if (t <= time[0]) return { x: scale.px(l.xs[0]), y: scale.py(l.ys[0]) };
    const lastI = time.length - 1;
    if (t >= time[lastI]) return { x: scale.px(l.xs[lastI]), y: scale.py(l.ys[lastI]) };
    let i = 1;
    while (i < lastI && time[i] < t) i++;
    const f = (t - time[i - 1]) / (time[i] - time[i - 1] || 1);
    return {
      x: scale.px(l.xs[i - 1] + (l.xs[i] - l.xs[i - 1]) * f),
      y: scale.py(l.ys[i - 1] + (l.ys[i] - l.ys[i - 1]) * f),
    };
  };

  const refLine = lines[0];
  const maxDist = refLine.dist[refLine.dist.length - 1] || 1;
  const sectorAt = (l: DriverLine) => {
    const d = l.dist[idxAtTime(l.time, t)] ?? 0;
    return d < maxDist / 3 ? 1 : d < (2 * maxDist) / 3 ? 2 : 3;
  };

  const atEnd = t >= duration - 0.01;

  return (
    <div className="space-y-2">
      {/* Live HUD — updates as the dot moves */}
      <div className="flex flex-wrap items-center gap-2">
        {lines.map((l) => {
          const i = idxAtTime(l.time, t);
          return (
            <div
              key={l.code}
              className="flex items-center gap-2 rounded-lg border px-2.5 py-1"
              style={{ borderColor: `${l.color}66`, backgroundColor: `${l.color}14` }}
            >
              <span className="timing text-xs font-bold" style={{ color: l.color }}>{l.code}</span>
              <span className="readout text-sm">{Math.round(l.speed[i] ?? 0)}<span className="text-[9px] text-muted-foreground"> km/h</span></span>
              <span className="text-2xs text-muted-foreground">G{l.gear[i] ?? "—"}</span>
              <span className="text-2xs text-muted-foreground">S{sectorAt(l)}</span>
            </div>
          );
        })}
        <span className="timing ml-auto text-2xs text-muted-foreground">{t.toFixed(1)} / {duration.toFixed(1)}s</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 420 }}>
        {scale && trackPath && (
          <path d={trackPath} fill="none" stroke="hsl(var(--border))" strokeWidth={9} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {scale && trackPath && (
          <path d={trackPath} fill="none" stroke="hsl(var(--muted-foreground))" strokeOpacity={0.25} strokeWidth={1} />
        )}
        {cornerPts.map((c) => (
          <g key={c.key} transform={`translate(${c.x},${c.y})`}>
            <circle r={7} fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth={1} />
            <text textAnchor="middle" dy={3} fontSize={8} fill="hsl(var(--muted-foreground))" className="timing">
              {c.label}
            </text>
          </g>
        ))}
        {lines.map((l) => {
          const p = dotAt(l);
          if (!p) return null;
          return (
            <g key={l.code}>
              <circle cx={p.x} cy={p.y} r={7} fill={l.color} stroke="#fff" strokeWidth={1.5} />
              <text x={p.x} y={p.y - 11} textAnchor="middle" fontSize={9} fontWeight={700} fill={l.color} className="timing">
                {l.code}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Transport (shared playhead — drives the telemetry crosshair too) */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => (atEnd ? playhead.restart() : playhead.toggle())}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground"
          aria-label={playhead.playing ? "Pause" : "Play"}
        >
          {playhead.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => playhead.setT(0)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground"
          aria-label="Restart"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(0.1, duration)}
          step={0.05}
          value={t}
          onChange={(e) => playhead.setT(Number(e.target.value))}
          className="h-1 flex-1 accent-primary"
        />
        <div className="flex overflow-hidden rounded-md border border-border">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => playhead.setSpeed(s)}
              className={cn(
                "px-1.5 py-0.5 text-2xs font-semibold",
                playhead.speed === s ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
