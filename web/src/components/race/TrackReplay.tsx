import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play, Pause, RotateCcw, Map as MapIcon, ShieldAlert, Flag } from "lucide-react";
import { F1Card, F1CardContent, F1CardHeader, F1CardTitle, F1Skeleton } from "@/components/f1";
import { cn } from "@/lib/utils";
import {
  getRaceReplay,
  fetchRaceReplayBlob,
  type RaceReplayBlob,
  type ReplaySafetyPeriod,
} from "@/services/raceReplayService";
import { getCircuitGeometry, fetchCircuitGeometryBlob } from "@/services/circuitGeometryService";

interface Props {
  year: number;
  round: string;
  session?: string;
}

const SPEEDS = [1, 2, 4, 8] as const;
// Frames advanced per wall-second at 1×. Frames sit ~1.5s apart, so 12 fps replays
// a full ~90-min race in ~5 min at 1× (2× ≈ 2.5 min, 8× ≈ 40 s).
const PLAY_FRAMES_PER_SEC = 12;

/** Track/scrubber colour per safety kind. Gold = SC/VSC, destructive = red flag —
 *  matches the deep-dive chart overlays. */
const SAFETY_STYLE: Record<ReplaySafetyPeriod["kind"], { label: string; color: string }> = {
  SC: { label: "Safety Car", color: "hsl(45 96% 50%)" },
  VSC: { label: "Virtual SC", color: "hsl(45 96% 50%)" },
  RED: { label: "Red Flag", color: "hsl(var(--destructive))" },
};

const fmtClock = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

type StartFinish = { ax: number; ay: number; bx: number; by: number; lx: number; ly: number };

function ReplaySVG({
  blob,
  outlinePath,
  startFinish,
}: {
  blob: RaceReplayBlob;
  outlinePath: string | null;
  startFinish: StartFinish | null;
}) {
  const { min_x, max_x, min_y, max_y } = blob.bounds;
  const w = max_x - min_x || 1;
  const h = max_y - min_y || 1;
  const size = Math.max(w, h);
  const pad = size * 0.06;
  const flipY = (y: number) => min_y + max_y - y;
  const r = size / 72;
  const fs = size / 52;

  const [frame, setFrame] = useState(0); // float playhead 0..frames-1
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const raf = useRef<number>();
  const last = useRef<number>(0);
  const lastFrame = blob.frames - 1;

  useEffect(() => {
    if (!playing) return;
    const step = (ts: number) => {
      if (!last.current) last.current = ts;
      const dt = (ts - last.current) / 1000;
      last.current = ts;
      setFrame((f) => {
        const next = f + PLAY_FRAMES_PER_SEC * speed * dt;
        if (next >= lastFrame) {
          setPlaying(false);
          return lastFrame;
        }
        return next;
      });
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      last.current = 0;
    };
  }, [playing, speed, lastFrame]);

  // Interpolated car positions at the current (float) frame.
  const cars = useMemo(() => {
    const i = Math.floor(frame);
    const frac = frame - i;
    const j = Math.min(i + 1, lastFrame);
    const out: { id: string; code: string; color: string; x: number; y: number }[] = [];
    for (const d of blob.drivers) {
      const a = d.xy[i];
      const b = d.xy[j];
      let x: number | null = null;
      let y: number | null = null;
      if (a && b) {
        x = a[0] + (b[0] - a[0]) * frac;
        y = a[1] + (b[1] - a[1]) * frac;
      } else if (a) {
        [x, y] = a;
      } else if (b) {
        [x, y] = b;
      }
      if (x == null || y == null) continue;
      out.push({
        id: d.driver_id,
        code: d.code ?? d.driver_id.slice(0, 3).toUpperCase(),
        color: d.team_color ?? "hsl(var(--muted-foreground))",
        x,
        y: flipY(y),
      });
    }
    return out;
  }, [blob.drivers, frame, lastFrame]); // eslint-disable-line react-hooks/exhaustive-deps

  const elapsed = blob.times[Math.round(frame)] ?? 0;
  const atEnd = frame >= lastFrame;
  const dur = blob.duration_s || 1;
  const safety = blob.safety ?? [];
  const active = useMemo(
    () => safety.find((p) => elapsed >= p.start_s && elapsed <= p.end_s) ?? null,
    [blob.safety, elapsed], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const kinds = Array.from(new Set(safety.map((p) => p.kind)));

  // Follow-one-driver: default is a clean dot cloud; selecting (tap dot / chip)
  // or hovering a car shows just that label and dims the rest — kills the 20-label
  // collision that made clusters unreadable on mobile.
  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const dim = sel != null;
  // Render the selected car last so it sits on top of the others.
  const orderedCars = useMemo(
    () => (sel ? [...cars.filter((c) => c.id !== sel), ...cars.filter((c) => c.id === sel)] : cars),
    [cars, sel],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        <button
          type="button"
          onClick={() => (atEnd ? (setFrame(0), setPlaying(true)) : setPlaying((p) => !p))}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-px" />}
        </button>
        <button
          type="button"
          onClick={() => { setPlaying(false); setFrame(0); }}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border hover:bg-accent"
          aria-label="Restart"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <span className="readout ml-1 text-sm text-primary">{fmtClock(elapsed)}</span>
        <span className="text-xs text-muted-foreground/60">/ {fmtClock(blob.duration_s)}</span>
        {active && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide animate-pulse"
            style={{
              color: SAFETY_STYLE[active.kind].color,
              backgroundColor: `color-mix(in srgb, ${SAFETY_STYLE[active.kind].color} 16%, transparent)`,
            }}
          >
            {active.kind === "RED" ? <Flag className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
            {active.kind}
          </span>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              className={cn(
                "min-h-8 rounded px-2 py-1 text-xs font-medium tabular-nums transition-colors",
                speed === s ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent",
              )}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="relative">
          {/* Safety windows shaded under the scrubber (position by time). */}
          <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full">
            {safety.map((p, i) => (
              <span
                key={i}
                className="absolute top-0 h-full"
                style={{
                  left: `${(p.start_s / dur) * 100}%`,
                  width: `${(Math.max(p.end_s - p.start_s, dur * 0.004) / dur) * 100}%`,
                  backgroundColor: `color-mix(in srgb, ${SAFETY_STYLE[p.kind].color} 55%, transparent)`,
                }}
              />
            ))}
          </div>
          <input
            type="range"
            min={0}
            max={lastFrame}
            step={0.5}
            value={frame}
            onChange={(e) => { setPlaying(false); setFrame(Number(e.target.value)); }}
            className="relative h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted/70 accent-primary"
            aria-label="Race time scrubber"
          />
        </div>
        {kinds.length > 0 && (
          <div className="flex items-center gap-3 text-2xs text-muted-foreground">
            {kinds.map((k) => (
              <span key={k} className="inline-flex items-center gap-1">
                <span className="h-2 w-2.5 rounded-sm" style={{ backgroundColor: SAFETY_STYLE[k].color }} />
                {SAFETY_STYLE[k].label}
              </span>
            ))}
          </div>
        )}
      </div>

      <div
        className="aspect-[4/3] w-full rounded-lg transition-shadow duration-300"
        style={active ? { boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${SAFETY_STYLE[active.kind].color} 55%, transparent)` } : undefined}
      >
        <svg
          viewBox={`${min_x - pad} ${min_y - pad} ${w + 2 * pad} ${h + 2 * pad}`}
          className="h-full w-full"
          fill="none"
          role="img"
          aria-label={`${blob.circuit_name ?? blob.circuit_id} race replay`}
        >
          {outlinePath && (
            <path
              d={outlinePath}
              stroke={active ? SAFETY_STYLE[active.kind].color : "hsl(var(--muted-foreground))"}
              strokeOpacity={active ? 0.9 : 0.3}
              strokeWidth={active ? size / 110 : size / 150}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transition: "stroke 0.3s, stroke-opacity 0.3s, stroke-width 0.3s" }}
            />
          )}
          {startFinish && (
            <g>
              {/* checkered start/finish line: white dashes stacked over a dark base */}
              <line
                x1={startFinish.ax} y1={startFinish.ay} x2={startFinish.bx} y2={startFinish.by}
                stroke="hsl(var(--background))" strokeWidth={size / 55} strokeLinecap="butt"
              />
              <line
                x1={startFinish.ax} y1={startFinish.ay} x2={startFinish.bx} y2={startFinish.by}
                stroke="hsl(var(--foreground))" strokeWidth={size / 55}
                strokeDasharray={`${size / 90} ${size / 90}`} strokeLinecap="butt"
              />
              <text
                x={startFinish.lx} y={startFinish.ly - size * 0.028}
                fontSize={fs * 0.95} textAnchor="middle"
                className="fill-muted-foreground font-mono"
              >
                S/F
              </text>
            </g>
          )}
          {orderedCars.map((c) => {
            const isSel = c.id === sel;
            const isHover = c.id === hover;
            const rr = isSel ? r * 1.5 : r;
            // Codes stay on always (persistent tracking); the followed/hovered
            // car gets a larger label, everyone else a small one with a dark halo.
            const lblFs = fs * (isSel ? 1.2 : isHover ? 1.05 : 0.82);
            return (
              <g
                key={c.id}
                onClick={() => setSel((s) => (s === c.id ? null : c.id))}
                onMouseEnter={() => setHover(c.id)}
                onMouseLeave={() => setHover((hv) => (hv === c.id ? null : hv))}
                opacity={dim && !isSel ? 0.32 : 1}
                style={{ cursor: "pointer", transition: "opacity 0.2s" }}
              >
                {/* enlarged transparent hit target for touch */}
                <circle cx={c.x} cy={c.y} r={r * 2.6} fill="transparent" />
                {isSel && (
                  <circle cx={c.x} cy={c.y} r={rr * 1.7} fill="none" stroke={c.color} strokeOpacity={0.45} strokeWidth={r * 0.35} />
                )}
                <circle cx={c.x} cy={c.y} r={rr} fill={c.color} stroke="hsl(var(--background))" strokeWidth={rr * 0.28} />
                <text
                  x={c.x}
                  y={c.y - rr * 1.7}
                  fontSize={lblFs}
                  textAnchor="middle"
                  className="fill-foreground font-mono"
                  style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: lblFs * 0.32, strokeLinejoin: "round" }}
                >
                  {c.code}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Driver legend — tap a chip (or a dot) to follow that car. */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {blob.drivers.map((d) => {
          const id = d.driver_id;
          const code = d.code ?? id.slice(0, 3).toUpperCase();
          const isSel = id === sel;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSel((s) => (s === id ? null : id))}
              onMouseEnter={() => setHover(id)}
              onMouseLeave={() => setHover((hv) => (hv === id ? null : hv))}
              className={cn(
                "inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-2xs font-medium tabular-nums transition-colors",
                isSel
                  ? "border-primary/60 bg-primary/10 text-foreground"
                  : "border-border/50 text-muted-foreground hover:bg-accent",
              )}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.team_color ?? "hsl(var(--muted-foreground))" }} />
              {code}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** GPS car-dot race replay — animates every driver along the real racing line and
 *  scrubs the whole race by time (from FastF1 historical position, not live). */
export default function TrackReplay({ year, round }: Props) {
  const roundNum = parseInt(round, 10);
  const index = useQuery({
    queryKey: ["race-replay", "index", year, roundNum],
    queryFn: () => getRaceReplay(year, roundNum),
  });
  const blob = useQuery({
    queryKey: ["race-replay", "blob", index.data?.public_url],
    queryFn: () => fetchRaceReplayBlob(index.data!.public_url),
    enabled: !!index.data?.public_url,
  });
  // Circuit outline (same rotation frame) — optional backdrop for the dots.
  const geomIndex = useQuery({
    queryKey: ["circuit-geometry", "index", year, roundNum],
    queryFn: () => getCircuitGeometry(year, roundNum),
  });
  const geomBlob = useQuery({
    queryKey: ["circuit-geometry", "blob", geomIndex.data?.public_url],
    queryFn: () => fetchCircuitGeometryBlob(geomIndex.data!.public_url),
    enabled: !!geomIndex.data?.public_url,
  });

  const outlinePath = useMemo(() => {
    const g = geomBlob.data;
    const b = blob.data;
    if (!g || !b) return null;
    const flipY = (y: number) => b.bounds.min_y + b.bounds.max_y - y;
    return g.outline.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${flipY(p[1])}`).join(" ");
  }, [geomBlob.data, blob.data]);

  // Start/finish line — outline[0] is the lap-telemetry origin (the S/F line); the
  // marker is a short segment perpendicular to the track direction there.
  const startFinish = useMemo<StartFinish | null>(() => {
    const g = geomBlob.data;
    const b = blob.data;
    if (!g || !b || g.outline.length < 2) return null;
    const flipY = (y: number) => b.bounds.min_y + b.bounds.max_y - y;
    const [x0, y0] = g.outline[0];
    const [x1, y1] = g.outline[1];
    let dx = x1 - x0;
    let dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const span = Math.max(b.bounds.max_x - b.bounds.min_x, b.bounds.max_y - b.bounds.min_y);
    const half = span * 0.024;
    const px = -dy * half;
    const py = dx * half;
    return {
      ax: x0 + px, ay: flipY(y0 + py),
      bx: x0 - px, by: flipY(y0 - py),
      lx: x0, ly: flipY(y0),
    };
  }, [geomBlob.data, blob.data]);

  if (index.isLoading) return <F1Skeleton variant="card" className="h-[520px]" />;
  if (!index.data) {
    return (
      <F1Card>
        <F1CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <MapIcon className="h-6 w-6 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Track replay not available yet.</p>
          <p className="text-2xs text-muted-foreground">Generated from FastF1 position data once the race is exported.</p>
        </F1CardContent>
      </F1Card>
    );
  }

  return (
    <F1Card>
      <F1CardHeader className="flex-row items-center gap-2 pb-2">
        <MapIcon className="h-4 w-4 text-primary" />
        <F1CardTitle className="text-base">Track Replay</F1CardTitle>
        <span className="instrument-label ml-auto text-muted-foreground">
          {index.data.driver_count ?? "—"} cars
        </span>
      </F1CardHeader>
      <F1CardContent>
        {blob.isLoading ? (
          <F1Skeleton variant="card" className="h-[440px]" />
        ) : blob.data ? (
          <ReplaySVG blob={blob.data} outlinePath={outlinePath} startFinish={startFinish} />
        ) : (
          <div className="flex h-[440px] items-center justify-center text-sm text-muted-foreground">
            Failed to load replay.
          </div>
        )}
      </F1CardContent>
    </F1Card>
  );
}
