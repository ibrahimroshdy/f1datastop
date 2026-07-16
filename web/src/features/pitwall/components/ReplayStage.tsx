import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Layers, Pause, Play, Radio, RotateCcw, ShieldAlert } from "lucide-react";
import {
  fetchCircuitGeometryBlob,
  getCircuitGeometry,
  type CircuitGeometryBlob,
} from "@/services/circuitGeometryService";
import type { RaceReplayBlob } from "@/services/raceReplayService";
import { cn } from "@/lib/utils";
import { useReplayPlayhead } from "../hooks/useReplayPlayhead";
import {
  SAFETY_STYLE,
  SECTOR_COLOR,
  TYRE_HSL,
  buildGeom,
  computeTiming,
  fmtClock,
  fmtGap,
  fmtLap,
  interpCars,
  type Snap,
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
}

export function ReplayStage({ year, round, blob, selected }: Props) {
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
}: {
  blob: RaceReplayBlob;
  geom?: CircuitGeometryBlob;
  sel: string | null;
  setSel: (v: string | null) => void;
  showSectors: boolean;
  setShowSectors: (v: boolean) => void;
  selected: string[];
}) {
  const { frame, setFrame, playing, setPlaying, speed, setSpeed, lastFrame } = useReplayPlayhead(blob.frames);
  const fi = Math.round(frame);
  const { snaps, bestHolder, leaderLap, t } = useMemo(() => computeTiming(blob, fi), [blob, fi]);
  const cars = useMemo(() => interpCars(blob, frame), [blob, frame]);
  const geomPaths = useMemo(() => buildGeom(geom, blob), [geom, blob]);

  const dur = blob.duration_s || 1;
  const active = (blob.safety ?? []).find((p) => t >= p.start_s && t <= p.end_s) ?? null;
  const isRace = blob.is_race !== false;
  const aidLabel = blob.season >= 2026 ? "OVR" : "DRS";
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

      {/* Scrubber */}
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

      {/* Safety banner */}
      {active && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold"
          style={{ backgroundColor: `color-mix(in srgb, ${SAFETY_STYLE[active.kind].color} 18%, transparent)`, color: SAFETY_STYLE[active.kind].color }}
        >
          <ShieldAlert className="h-3.5 w-3.5" /> {SAFETY_STYLE[active.kind].label}
        </div>
      )}

      {/* Stage: timing board | track | RC feed */}
      <div className="grid gap-3 lg:grid-cols-[minmax(210px,250px)_minmax(0,1fr)_minmax(190px,230px)]">
        {/* Timing board */}
        <TimingBoard snaps={snaps} bestHolder={bestHolder} isRace={isRace} sel={sel} setSel={setSel} selIds={selIds} aidLabel={aidLabel} />

        {/* Track */}
        <div
          className="relative overflow-hidden rounded-xl border border-border bg-card/30"
          style={active ? { boxShadow: `inset 0 0 0 2px color-mix(in srgb, ${SAFETY_STYLE[active.kind].color} 55%, transparent)` } : undefined}
        >
          <TrackSVG blob={blob} geom={geomPaths} cars={cars} showSectors={showSectors} sel={sel} setSel={setSel} selIds={selIds} />
        </div>

        {/* RC feed */}
        <div className="flex max-h-[420px] flex-col gap-2 overflow-hidden rounded-xl border border-border bg-card/30 p-2">
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

function SectorBars({ snap, bestHolder }: { snap: Snap; bestHolder: (string | null)[] }) {
  return (
    <div className="flex items-center gap-0.5">
      {snap.sec.map((s, k) => {
        let cls = "bg-muted-foreground/25";
        if (snap.id === bestHolder[k]) cls = "bg-fastest-lap";
        else if (s != null && s === snap.pb[k]) cls = "bg-gain";
        else if (s != null) cls = "bg-muted-foreground/50";
        return <span key={k} className={cn("h-1 w-2.5 rounded-sm", cls)} />;
      })}
    </div>
  );
}

function TimingBoard({
  snaps,
  bestHolder,
  isRace,
  sel,
  setSel,
  selIds,
  aidLabel,
}: {
  snaps: Snap[];
  bestHolder: (string | null)[];
  isRace: boolean;
  sel: string | null;
  setSel: (v: string | null) => void;
  selIds: Set<string>;
  aidLabel: string;
}) {
  return (
    <div className="flex max-h-[420px] flex-col overflow-hidden rounded-xl border border-border">
      <div className="flex items-center gap-1 border-b border-border bg-muted/30 px-2 py-1.5 text-2xs uppercase tracking-wide text-muted-foreground">
        <span className="w-4 text-right">P</span>
        <span className="w-12 pl-1.5">Driver</span>
        <span className="ml-auto w-14 text-right">Gap</span>
        <span className="w-[3.6rem] text-right">Last</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence initial={false}>
          {snaps.map((s) => {
            const isSel = s.id === sel;
            const isPicked = selIds.has(s.id);
            const gapText = s.pos === 1 ? (isRace ? "LEADER" : "—") : isRace && s.lapsDown >= 1 ? `+${s.lapsDown}L` : fmtGap(s.gap);
            return (
              <motion.button
                key={s.id}
                layout
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ layout: { type: "spring", stiffness: 650, damping: 46 }, opacity: { duration: 0.15 } }}
                onClick={() => setSel(isSel ? null : s.id)}
                className={cn(
                  "flex w-full items-center gap-1 border-b border-border/40 px-2 py-1 text-left tabular-nums transition-colors",
                  isSel ? "bg-primary/15" : isPicked ? "bg-primary/[0.05]" : "hover:bg-accent/50",
                  s.pit && "opacity-55",
                )}
                style={isPicked ? { boxShadow: `inset 2px 0 0 ${s.color}` } : undefined}
              >
                <span className="w-4 shrink-0 text-right text-xs font-bold text-muted-foreground">{s.pos ?? "—"}</span>
                <span className="ml-0.5 h-3.5 w-1 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="w-8 shrink-0 text-sm font-bold" style={{ color: s.color }}>
                  {s.code}
                </span>
                {s.tyre && (
                  <span className="inline-flex shrink-0 items-baseline gap-px text-[9px] font-bold" style={{ color: TYRE_HSL[s.tyre] ?? "hsl(var(--muted-foreground))" }}>
                    {s.tyre}
                    {s.tyl != null && <span className="text-[8px] text-muted-foreground">{s.tyl}</span>}
                  </span>
                )}
                {s.drs && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gain" title={aidLabel} />}
                {s.pit && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-position-gold" title="In pit" />}
                {s.isFL && <span className="shrink-0 text-[8px] leading-none text-fastest-lap">◆</span>}
                <span className="ml-auto flex w-14 shrink-0 flex-col items-end leading-tight">
                  <span className="text-2xs text-muted-foreground">{gapText}</span>
                  {s.pos !== 1 && s.int != null && <span className="text-[9px] text-muted-foreground/60">{fmtGap(s.int)}</span>}
                </span>
                <span className="flex w-[3.6rem] shrink-0 flex-col items-end gap-0.5">
                  <span className={cn("readout text-[11px]", s.isFLLap ? "text-fastest-lap" : "text-foreground/90")}>{fmtLap(s.lastTime)}</span>
                  <SectorBars snap={s} bestHolder={bestHolder} />
                </span>
              </motion.button>
            );
          })}
        </AnimatePresence>
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
