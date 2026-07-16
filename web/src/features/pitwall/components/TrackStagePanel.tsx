import { useEffect, useMemo, useRef, useState } from "react";
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

interface Props {
  year: number;
  round: number | null;
  telemetry: DriverTelemetry[];
  drivers: PitWallDriver[];
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
  duration: number;
}

export function TrackStagePanel({ year, round, telemetry, drivers }: Props) {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const raf = useRef<number>();
  const last = useRef<number | null>(null);

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
        const time = dist.length && sp.length ? cumulativeTime(dist, sp) : [];
        return {
          code: d.code,
          color: colorOf[d.code] || "#9ca3af",
          xs,
          ys,
          dist,
          time,
          duration: time.length ? time[time.length - 1] : 0,
        };
      })
      .filter((l) => l.xs.length && l.time.length);
  }, [telemetry, colorOf]);

  const duration = useMemo(() => Math.max(0, ...lines.map((l) => l.duration)), [lines]);

  // Bounds from the telemetry x/y — so the track path, the corner markers (matched by
  // distance-along-lap) and the moving dots all share ONE coordinate space and align.
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

  // Playback loop (time-based → dots slow in corners, separate through the lap).
  useEffect(() => {
    if (!playing || duration <= 0) return;
    const loop = (ts: number) => {
      if (last.current == null) last.current = ts;
      const dt = (ts - last.current) / 1000;
      last.current = ts;
      setT((prev) => Math.min(duration, prev + dt * speed));
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      last.current = null;
    };
  }, [playing, speed, duration]);

  useEffect(() => {
    if (duration > 0 && t >= duration) setPlaying(false);
  }, [t, duration]);

  // Track path = the reference driver's racing line (telemetry x/y).
  const trackPath = useMemo(() => {
    if (!scale) return "";
    const l = lines[0];
    if (!l) return "";
    return l.xs.map((x, i) => `${i ? "L" : "M"}${scale.px(x).toFixed(1)},${scale.py(l.ys[i]).toFixed(1)}`).join("");
  }, [lines, scale]);

  // Corner numbers matched onto the racing line by distance-along-lap (geometry corner
  // `d` ↔ telemetry `distance`) — keeps them exactly on the track in telemetry space.
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
      return {
        key: `${c.n}${c.letter ?? ""}`,
        label: `${c.n}${c.letter ?? ""}`,
        x: scale.px(ref.xs[bi]),
        y: scale.py(ref.ys[bi]),
      };
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
    const x = l.xs[i - 1] + (l.xs[i] - l.xs[i - 1]) * f;
    const y = l.ys[i - 1] + (l.ys[i] - l.ys[i - 1]) * f;
    return { x: scale.px(x), y: scale.py(y) };
  };

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 420 }}>
        {scale && trackPath && (
          <path d={trackPath} fill="none" stroke="hsl(var(--border))" strokeWidth={9} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {scale && trackPath && (
          <path d={trackPath} fill="none" stroke="hsl(var(--muted-foreground))" strokeOpacity={0.25} strokeWidth={1} />
        )}
        {/* Corner numbers — placed on the racing line by distance match */}
        {cornerPts.map((c) => (
          <g key={c.key} transform={`translate(${c.x},${c.y})`}>
            <circle r={7} fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth={1} />
            <text textAnchor="middle" dy={3} fontSize={8} fill="hsl(var(--muted-foreground))" className="timing">
              {c.label}
            </text>
          </g>
        ))}
        {/* Driver dots */}
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

      {/* Transport */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (t >= duration) setT(0);
            setPlaying((p) => !p);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => {
            setT(0);
            setPlaying(false);
          }}
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
          onChange={(e) => {
            setT(Number(e.target.value));
            setPlaying(false);
          }}
          className="h-1 flex-1 accent-primary"
        />
        <span className="timing w-16 shrink-0 text-right text-2xs text-muted-foreground">
          {t.toFixed(1)} / {duration.toFixed(1)}s
        </span>
        <div className="flex overflow-hidden rounded-md border border-border">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              className={cn(
                "px-1.5 py-0.5 text-2xs font-semibold",
                speed === s ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
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
