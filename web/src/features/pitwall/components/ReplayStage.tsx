import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layers, Pause, Play, Radio, RotateCcw, ShieldAlert } from "lucide-react";
import {
  fetchCircuitGeometryBlob,
  getCircuitGeometry,
  type CircuitGeometryBlob,
} from "@/services/circuitGeometryService";
import type { RaceReplayBlob } from "@/services/raceReplayService";
import { colorWithAlpha } from "@/constants/f1Colors";
import { cn } from "@/lib/utils";
import type { ReplayPlayhead } from "../hooks/useReplayPlayhead";
import {
  SAFETY_STYLE,
  SECTOR_COLOR,
  buildGeom,
  computeTiming,
  fmtClock,
  interpCars,
} from "../replayEngine";

const SPEEDS = [1, 2, 4, 8];
const RC_KIND_COLOR: Record<string, string> = {
  sc: "hsl(45 96% 50%)",
  vsc: "hsl(45 96% 50%)",
  yellow: "hsl(45 96% 50%)",
  red: "hsl(var(--destructive))",
  green: "hsl(140 68% 46%)",
  drs: "hsl(210 90% 56%)",
  info: "hsl(var(--muted-foreground))",
};

interface Props {
  year: number;
  round: number | null;
  blob?: RaceReplayBlob;
  selected: string[];
  playhead: ReplayPlayhead;
}

export function ReplayStage({ year, round, blob, selected, playhead }: Props) {
  const [sel, setSel] = useState<string | null>(null);
  const [showSectors, setShowSectors] = useState(true);

  const geomIndex = useQuery({
    queryKey: ["circuit-geometry", "index", year, round],
    queryFn: () => getCircuitGeometry(year, round as number),
    enabled: !!round,
    staleTime: 24 * 60 * 60 * 1000,
  });
  const geomBlob = useQuery({
    queryKey: ["circuit-geometry", "blob", geomIndex.data?.public_url],
    queryFn: () => fetchCircuitGeometryBlob(geomIndex.data!.public_url),
    enabled: !!geomIndex.data?.public_url,
    staleTime: 24 * 60 * 60 * 1000,
  });

  if (!blob) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
        <Radio className="h-6 w-6 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">Race replay not available for this session yet.</p>
      </div>
    );
  }
  return (
    <ReplayBody
      blob={blob}
      geom={geomBlob.data}
      sel={sel}
      setSel={setSel}
      showSectors={showSectors}
      setShowSectors={setShowSectors}
      selected={selected}
      playhead={playhead}
    />
  );
}

function ReplayBody({
  blob,
  geom,
  sel,
  setSel,
  showSectors,
  setShowSectors,
  selected,
  playhead,
}: {
  blob: RaceReplayBlob;
  geom?: CircuitGeometryBlob;
  sel: string | null;
  setSel: (v: string | null) => void;
  showSectors: boolean;
  setShowSectors: (v: boolean) => void;
  selected: string[];
  playhead: ReplayPlayhead;
}) {
  const { frame, setFrame, playing, setPlaying, speed, setSpeed, lastFrame } = playhead;
  const fi = Math.round(frame);
  const { leaderLap, t } = useMemo(() => computeTiming(blob, fi), [blob, fi]);
  const cars = useMemo(() => interpCars(blob, frame), [blob, frame]);

  // Live speed on the track for every car — derived from Δposition/Δtime.
  const geomPaths = useMemo(() => buildGeom(geom, blob), [geom, blob]);

  const dur = blob.duration_s || 1;
  const safety = blob.safety ?? [];
  const overtakes = blob.overtakes ?? [];
  const active = safety.find((p) => t >= p.start_s && t <= p.end_s) ?? null;
  const sToFrame = (s: number) => {
    for (let i = 0; i < blob.times.length; i++) if (blob.times[i] >= s) return i;
    return blob.times.length - 1;
  };
  const isRace = blob.is_race !== false;
  const atEnd = frame >= lastFrame;

  const selCodes = useMemo(() => new Set(selected), [selected]);
  const idByCode = useMemo(() => {
    const m = new Map<string, string>();
    blob.drivers.forEach((d) => d.code && m.set(d.code, d.driver_id));
    return m;
  }, [blob.drivers]);
  const selIds = useMemo(() => new Set([...selCodes].map((c) => idByCode.get(c)).filter(Boolean) as string[]), [selCodes, idByCode]);

  const feedMsgs = useMemo(() => [...(blob.rc ?? [])].filter((m) => m.t <= t).slice(-8).reverse(), [blob.rc, t]);
  const recentPass = useMemo(() => [...(blob.overtakes ?? [])].filter((o) => o.t <= t && o.t > t - 20), [blob.overtakes, t]);
  const codeOf = useMemo(() => {
    const m = new Map<string, string>();
    blob.drivers.forEach((d) => m.set(d.driver_id, d.code ?? d.driver_id.slice(0, 3).toUpperCase()));
    return (id: string | null) => (id ? m.get(id) ?? id.slice(0, 3).toUpperCase() : "—");
  }, [blob.drivers]);

  return (
    <div className="space-y-2">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        <button
          type="button"
          onClick={() => (atEnd ? (setFrame(0), setPlaying(true)) : setPlaying(!playing))}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-px" />}
        </button>
        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            setFrame(0);
          }}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border hover:bg-accent"
          aria-label="Restart"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        {isRace ? (
          <div className="instrument-label ml-1 flex items-baseline gap-1 text-muted-foreground">
            Lap <span className="readout text-lg text-primary">{leaderLap || "—"}</span>
            <span className="text-muted-foreground/60">/ {blob.total_laps ?? "—"}</span>
          </div>
        ) : (
          <span className="instrument-label ml-1 text-muted-foreground">Best-lap order</span>
        )}
        <span className="timing ml-1 text-xs text-muted-foreground">
          {fmtClock(t)} / {fmtClock(dur)}
        </span>
        <button
          type="button"
          onClick={() => setShowSectors(!showSectors)}
          className={cn(
            "ml-auto inline-flex items-center gap-1 rounded-md border px-2 py-1 text-2xs font-semibold",
            showSectors ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground",
          )}
        >
          <Layers className="h-3 w-3" /> Sectors
        </button>
        <div className="flex overflow-hidden rounded-md border border-border">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              className={cn(
                "px-2 py-1 text-2xs font-semibold",
                speed === s ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Play bar — safety periods (SC solid · VSC hatched · red), overtake ticks. */}
      <div className="space-y-1">
        {(safety.length > 0 || overtakes.length > 0) && (
          <div className="relative h-2.5 w-full overflow-hidden rounded-sm bg-muted/40">
            {safety.map((p, i) => {
              const a = sToFrame(p.start_s);
              const b = sToFrame(p.end_s);
              const left = (a / (lastFrame || 1)) * 100;
              const width = Math.max(1.2, ((b - a) / (lastFrame || 1)) * 100);
              const c = SAFETY_STYLE[p.kind].color;
              const style =
                p.kind === "RED"
                  ? { backgroundColor: c }
                  : p.kind === "VSC"
                    ? {
                        backgroundColor: colorWithAlpha(c, 0.28),
                        backgroundImage: `repeating-linear-gradient(45deg, ${c} 0, ${c} 2.5px, transparent 2.5px, transparent 6px)`,
                      }
                    : { backgroundColor: c };
              return (
                <button
                  key={`s${i}`}
                  type="button"
                  onClick={() => {
                    setPlaying(false);
                    setFrame(a);
                  }}
                  title={`${SAFETY_STYLE[p.kind].label} — jump here`}
                  aria-label={`Jump to ${SAFETY_STYLE[p.kind].label}`}
                  className="absolute top-0 h-2.5 opacity-90 transition-opacity hover:opacity-100"
                  style={{ left: `${left}%`, width: `${width}%`, ...style }}
                />
              );
            })}
            {overtakes.map((o, i) => {
              const left = (sToFrame(o.t) / (lastFrame || 1)) * 100;
              return (
                <span
                  key={`o${i}`}
                  className="pointer-events-none absolute bottom-0 h-1.5 w-px bg-gain"
                  style={{ left: `${left}%` }}
                />
              );
            })}
          </div>
        )}
        <input
          type="range"
          min={0}
          max={lastFrame}
          step={0.5}
          value={frame}
          onChange={(e) => {
            setPlaying(false);
            setFrame(Number(e.target.value));
          }}
          className="h-1 w-full accent-primary"
        />
        {(safety.length > 0 || overtakes.length > 0) && (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[9px] text-muted-foreground">
            {safety.some((p) => p.kind === "SC") && (
              <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm" style={{ backgroundColor: SAFETY_STYLE.SC.color }} /> SC</span>
            )}
            {safety.some((p) => p.kind === "VSC") && (
              <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm" style={{ backgroundColor: colorWithAlpha(SAFETY_STYLE.VSC.color, 0.28), backgroundImage: `repeating-linear-gradient(45deg, ${SAFETY_STYLE.VSC.color} 0, ${SAFETY_STYLE.VSC.color} 2px, transparent 2px, transparent 4px)` }} /> VSC</span>
            )}
            {safety.some((p) => p.kind === "RED") && (
              <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm" style={{ backgroundColor: SAFETY_STYLE.RED.color }} /> Red flag</span>
            )}
            {overtakes.length > 0 && (
              <span className="flex items-center gap-1"><span className="h-2 w-px bg-gain" /> Overtake</span>
            )}
          </div>
        )}
      </div>

      {/* Safety banner */}
      {active && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold"
          style={{ backgroundColor: `color-mix(in srgb, ${SAFETY_STYLE[active.kind].color} 18%, transparent)`, color: SAFETY_STYLE[active.kind].color }}
        >
          <ShieldAlert className="h-3.5 w-3.5" /> {SAFETY_STYLE[active.kind].label}
        </div>
      )}

      {/* Stage: small track | RC feed */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(180px,220px)]">
        {/* Track — kept small so the charts below stay in view */}
        <div
          className="relative mx-auto max-h-[300px] w-full max-w-[440px] overflow-hidden rounded-xl border border-border bg-card/30"
          style={active ? { boxShadow: `inset 0 0 0 2px color-mix(in srgb, ${SAFETY_STYLE[active.kind].color} 55%, transparent)` } : undefined}
        >
          <TrackSVG blob={blob} geom={geomPaths} cars={cars} showSectors={showSectors} sel={sel} setSel={setSel} selIds={selIds} />
        </div>

        {/* RC feed */}
        <div className="flex max-h-[300px] flex-col gap-2 overflow-hidden rounded-xl border border-border bg-card/30 p-2">
          <div className="instrument-label flex items-center gap-1.5 text-primary">
            <Radio className="h-3 w-3" /> Race Control
          </div>
          <div className="flex-1 space-y-1.5 overflow-y-auto">
            {recentPass.map((o, i) => (
              <div key={`ov${i}`} className="flex items-center gap-1 rounded bg-gain/10 px-1.5 py-1 text-2xs">
                <span className="font-bold text-gain">{codeOf(o.by)}</span>
                <span className="text-muted-foreground">▸ overtakes ▸</span>
                <span className="font-bold">{codeOf(o.on)}</span>
              </div>
            ))}
            {feedMsgs.length === 0 && recentPass.length === 0 && (
              <p className="text-2xs text-muted-foreground">No messages yet.</p>
            )}
            {feedMsgs.map((m, i) => (
              <div key={`rc${i}`} className="flex items-start gap-1.5 text-2xs">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: RC_KIND_COLOR[m.kind] ?? RC_KIND_COLOR.info }} />
                <span className="text-muted-foreground">
                  <span className="timing text-muted-foreground/60">{fmtClock(m.t)}</span> {m.msg}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TrackSVG({
  blob,
  geom,
  cars,
  showSectors,
  sel,
  setSel,
  selIds,
}: {
  blob: RaceReplayBlob;
  geom: ReturnType<typeof buildGeom>;
  cars: ReturnType<typeof interpCars>;
  showSectors: boolean;
  sel: string | null;
  setSel: (v: string | null) => void;
  selIds: Set<string>;
}) {
  const { min_x, max_x, min_y, max_y } = blob.bounds;
  const w = max_x - min_x || 1;
  const h = max_y - min_y || 1;
  const size = Math.max(w, h);
  const pad = size * 0.06;
  const r = size / 74;
  const fs = size / 52;
  const dim = sel != null || selIds.size > 0;
  const isUp = (id: string) => id === sel || selIds.has(id);
  const ordered = [...cars.filter((c) => !isUp(c.id)), ...cars.filter((c) => isUp(c.id))];

  return (
    <svg viewBox={`${min_x - pad} ${min_y - pad} ${w + 2 * pad} ${h + 2 * pad}`} className="h-full w-full" fill="none" role="img" aria-label="Race replay track">
      {geom.outlinePath && !showSectors && (
        <path d={geom.outlinePath} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.3} strokeWidth={size / 150} strokeLinecap="round" strokeLinejoin="round" />
      )}
      {showSectors && geom.sectorPaths && (
        <>
          <path d={geom.outlinePath ?? ""} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.14} strokeWidth={size / 130} strokeLinecap="round" />
          {geom.sectorPaths.map((d, i) => (
            <path key={i} d={d} stroke={SECTOR_COLOR[i]} strokeOpacity={0.85} strokeWidth={size / 125} strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </>
      )}
      {geom.startFinish && (
        <line
          x1={geom.startFinish.ax}
          y1={geom.startFinish.ay}
          x2={geom.startFinish.bx}
          y2={geom.startFinish.by}
          stroke="hsl(var(--foreground))"
          strokeWidth={size / 60}
          strokeDasharray={`${size / 90} ${size / 90}`}
        />
      )}
      {ordered.map((c) => {
        const up = isUp(c.id);
        const rr = up ? r * 1.6 : r;
        const lblFs = fs * (up ? 1.25 : 0.8);
        return (
          <g key={c.id} onClick={() => setSel(c.id === sel ? null : c.id)} opacity={dim && !up ? 0.28 : 1} style={{ cursor: "pointer", transition: "opacity 0.2s" }}>
            <circle cx={c.x} cy={c.y} r={r * 2.6} fill="transparent" />
            {up && <circle cx={c.x} cy={c.y} r={rr * 1.7} fill="none" stroke={c.color} strokeOpacity={0.5} strokeWidth={r * 0.35} />}
            <circle cx={c.x} cy={c.y} r={rr} fill={c.color} stroke="hsl(var(--background))" strokeWidth={rr * 0.3} />
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
  );
}
