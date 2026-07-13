import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Play, Pause, RotateCcw, Flag, ShieldAlert, Radio, Layers } from "lucide-react";
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
const PLAY_FPS = 12; // frames advanced per wall-second at 1× (~18× real-time)

const SAFETY_STYLE: Record<ReplaySafetyPeriod["kind"], { label: string; color: string }> = {
  SC: { label: "Safety Car", color: "hsl(45 96% 50%)" },
  VSC: { label: "Virtual SC", color: "hsl(45 96% 50%)" },
  RED: { label: "Red Flag", color: "hsl(var(--destructive))" },
};

const SECTOR_COLOR = ["hsl(330 85% 60%)", "hsl(210 90% 58%)", "hsl(150 70% 48%)"]; // S1/S2/S3

const SESSION_NAME: Record<string, string> = {
  R: "Race", Q: "Qualifying", S: "Sprint",
  SQ: "Sprint Quali", FP1: "Practice 1", FP2: "Practice 2", FP3: "Practice 3",
};

// Sessions we generate replays for (race/quali/sprint). Practice is not replayed.
const SUPPORTED_SESSIONS = new Set(["R", "Q", "S"]);

const TYRE_COLOR: Record<string, string> = {
  S: "hsl(0 85% 55%)",
  M: "hsl(45 95% 55%)",
  H: "hsl(0 0% 92%)",
  I: "hsl(140 68% 46%)",
  W: "hsl(210 90% 56%)",
};

const RC_KIND_COLOR: Record<string, string> = {
  sc: "hsl(45 96% 50%)",
  vsc: "hsl(45 96% 50%)",
  yellow: "hsl(45 96% 50%)",
  red: "hsl(var(--destructive))",
  green: "hsl(140 68% 46%)",
  drs: "hsl(210 90% 56%)",
  info: "hsl(var(--muted-foreground))",
};

const fmtClock = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};
const fmtLap = (s: number | null) => {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toFixed(3).padStart(6, "0")}`;
};
const fmtGap = (s: number | null) => (s == null ? "—" : s < 0.05 ? "—" : `+${s.toFixed(1)}`);
const fmtSec = (ms: number | null | undefined) => (ms == null ? "—" : (ms / 1000).toFixed(3)); // sector time (ms → s.mmm)

// ── Playhead ─────────────────────────────────────────────────────────────────
function usePlayhead(frames: number) {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const raf = useRef<number>();
  const last = useRef<number>(0);
  const lastFrame = frames - 1;

  useEffect(() => {
    if (!playing) return;
    const step = (ts: number) => {
      if (!last.current) last.current = ts;
      const dt = (ts - last.current) / 1000;
      last.current = ts;
      setFrame((f) => {
        const next = f + PLAY_FPS * speed * dt;
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

  return { frame, setFrame, playing, setPlaying, speed, setSpeed, lastFrame };
}

// ── Timing snapshot at the current frame ──────────────────────────────────────
type Snap = {
  id: string;
  code: string;
  color: string;
  pos: number | null;
  gap: number | null;
  int: number | null;
  /** Last time set for each sector (ms) — per-sector last crossing, F1 style. */
  sec: (number | null)[];
  /** Last fully-completed lap time (s). */
  lastTime: number | null;
  pb: [number, number, number];
  curLapN: number | null;
  tyre: string | null;
  tyl: number | null;
  lapsDown: number;
  isFL: boolean; // holds the race fastest lap
  isFLLap: boolean; // the displayed last lap IS the race fastest (purple moment)
  pit: boolean;
  drs: boolean;
};

function useTiming(blob: RaceReplayBlob, fi: number) {
  return useMemo(() => {
    const t = blob.times[fi] ?? 0;
    const bestSession: [number, number, number] = [Infinity, Infinity, Infinity];
    const bestHolder: (string | null)[] = [null, null, null]; // who holds each sector best (purple)
    let flTime = Infinity;
    let flId: string | null = null;
    const snaps: Snap[] = [];
    for (const d of blob.drivers) {
      const laps = d.laps ?? [];
      const pb: [number, number, number] = [Infinity, Infinity, Infinity];
      let live: (typeof laps)[number] | null = null; // lap the driver is currently on
      let lastC: (typeof laps)[number] | null = null; // last fully-completed lap
      // Per-sector last crossing (F1 timing: each sector bar = your latest time for
      // THAT sector, from whichever lap you last completed it — not the whole lap).
      const sec: (number | null)[] = [null, null, null];
      const secT = [-1, -1, -1];
      for (const l of laps) {
        const sv = [l.s1, l.s2, l.s3];
        const st = [l.s1t, l.s2t, l.s3t];
        for (let k = 0; k < 3; k++) {
          const stt = st[k];
          if (sv[k] != null && stt != null && stt <= t) {
            if (sv[k]! < pb[k]) pb[k] = sv[k]!;
            if (sv[k]! < bestSession[k]) {
              bestSession[k] = sv[k]!;
              bestHolder[k] = d.driver_id;
            }
            if (stt > secT[k]) {
              secT[k] = stt;
              sec[k] = sv[k]!;
            }
          }
        }
        const complete = l.s3t != null ? l.s3t <= t : l.te != null && l.te <= t;
        if (complete) {
          if (!lastC || l.n > lastC.n) lastC = l;
          if (!l.pit && l.last != null && l.last < flTime) {
            flTime = l.last;
            flId = d.driver_id;
          }
        }
        if (l.ts <= t && (!live || l.n > live.n)) live = l;
      }
      const curLap = live ?? lastC;
      snaps.push({
        id: d.driver_id,
        code: d.code ?? d.driver_id.slice(0, 3).toUpperCase(),
        color: d.team_color ?? "hsl(var(--muted-foreground))",
        pos: d.pos?.[fi] ?? null,
        gap: d.gap?.[fi] ?? null,
        int: null,
        sec,
        lastTime: lastC?.last ?? null,
        pb,
        curLapN: curLap?.n ?? null,
        tyre: curLap?.tyre ?? null,
        tyl: curLap?.tyl ?? null,
        lapsDown: 0,
        isFL: false,
        isFLLap: false,
        pit: !!curLap?.pit,
        drs: (d.drs ?? []).some(([a, b]) => t >= a && t <= b),
      });
    }
    snaps.sort((a, b) => (a.pos ?? 99) - (b.pos ?? 99));
    const leaderLap = Math.max(0, ...snaps.map((s) => s.curLapN ?? 0));
    snaps.forEach((s, i) => {
      if (i > 0 && s.gap != null && snaps[i - 1].gap != null) s.int = s.gap - snaps[i - 1].gap!;
      s.lapsDown = s.curLapN != null ? Math.max(0, leaderLap - s.curLapN) : 0;
      s.isFL = s.id === flId;
      s.isFLLap = s.lastTime != null && s.lastTime === flTime;
    });
    return { snaps, bestSession, bestHolder, leaderLap, t, flTime, flId };
  }, [blob, fi]);
}

// ── Track ─────────────────────────────────────────────────────────────────────
function TrackSVG({
  blob,
  outlinePath,
  sectorPaths,
  startFinish,
  frame,
  active,
  showSectors,
  sel,
  setSel,
}: {
  blob: RaceReplayBlob;
  outlinePath: string | null;
  sectorPaths: string[] | null;
  startFinish: { ax: number; ay: number; bx: number; by: number; lx: number; ly: number } | null;
  frame: number;
  active: ReplaySafetyPeriod | null;
  showSectors: boolean;
  sel: string | null;
  setSel: (v: string | null) => void;
}) {
  const { min_x, max_x, min_y, max_y } = blob.bounds;
  const w = max_x - min_x || 1;
  const h = max_y - min_y || 1;
  const size = Math.max(w, h);
  const pad = size * 0.06;
  const flipY = (y: number) => min_y + max_y - y;
  const r = size / 74;
  const fs = size / 52;
  const lastFrame = blob.frames - 1;

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
      } else if (a) [x, y] = a;
      else if (b) [x, y] = b;
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

  const dim = sel != null;
  const ordered = sel ? [...cars.filter((c) => c.id !== sel), ...cars.filter((c) => c.id === sel)] : cars;

  return (
    <div
      className="aspect-[4/3] w-full rounded-lg transition-shadow duration-300 lg:aspect-auto lg:h-full"
      style={active ? { boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${SAFETY_STYLE[active.kind].color} 55%, transparent)` } : undefined}
    >
      <svg viewBox={`${min_x - pad} ${min_y - pad} ${w + 2 * pad} ${h + 2 * pad}`} className="h-full w-full" fill="none" role="img" aria-label="Race replay track">
        {outlinePath && !showSectors && (
          <path d={outlinePath} stroke={active ? SAFETY_STYLE[active.kind].color : "hsl(var(--muted-foreground))"} strokeOpacity={active ? 0.9 : 0.3} strokeWidth={active ? size / 110 : size / 150} strokeLinecap="round" strokeLinejoin="round" style={{ transition: "stroke 0.3s" }} />
        )}
        {showSectors && sectorPaths && (
          <>
            <path d={outlinePath ?? ""} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.14} strokeWidth={size / 130} strokeLinecap="round" />
            {sectorPaths.map((d, i) => (
              <path key={i} d={d} stroke={SECTOR_COLOR[i]} strokeOpacity={0.85} strokeWidth={size / 125} strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </>
        )}
        {startFinish && (
          <g>
            <line x1={startFinish.ax} y1={startFinish.ay} x2={startFinish.bx} y2={startFinish.by} stroke="hsl(var(--background))" strokeWidth={size / 55} />
            <line x1={startFinish.ax} y1={startFinish.ay} x2={startFinish.bx} y2={startFinish.by} stroke="hsl(var(--foreground))" strokeWidth={size / 55} strokeDasharray={`${size / 90} ${size / 90}`} />
          </g>
        )}
        {ordered.map((c) => {
          const isSel = c.id === sel;
          const rr = isSel ? r * 1.5 : r;
          const lblFs = fs * (isSel ? 1.2 : 0.82);
          return (
            <g key={c.id} onClick={() => setSel(isSel ? null : c.id)} opacity={dim && !isSel ? 0.3 : 1} style={{ cursor: "pointer", transition: "opacity 0.2s" }}>
              <circle cx={c.x} cy={c.y} r={r * 2.6} fill="transparent" />
              {isSel && <circle cx={c.x} cy={c.y} r={rr * 1.7} fill="none" stroke={c.color} strokeOpacity={0.45} strokeWidth={r * 0.35} />}
              <circle cx={c.x} cy={c.y} r={rr} fill={c.color} stroke="hsl(var(--background))" strokeWidth={rr * 0.28} />
              <text x={c.x} y={c.y - rr * 1.7} fontSize={lblFs} textAnchor="middle" className="fill-foreground font-mono" style={{ paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: lblFs * 0.32, strokeLinejoin: "round" }}>
                {c.code}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Timing tower ──────────────────────────────────────────────────────────────
function SectorBars({ snap, bestHolder }: { snap: Snap; bestHolder: (string | null)[] }) {
  return (
    <div className="flex items-center gap-0.5">
      {snap.sec.map((s, k) => {
        let cls = "bg-muted-foreground/25"; // no time yet
        if (snap.id === bestHolder[k]) cls = "bg-fastest-lap"; // session best (purple)
        else if (s != null && s === snap.pb[k]) cls = "bg-gain"; // personal best (green)
        else if (s != null) cls = "bg-muted-foreground/50"; // set, not a best
        return <span key={k} className={cn("h-1 w-2.5 rounded-sm", cls)} />;
      })}
    </div>
  );
}

function TimingTower({
  snaps,
  bestHolder,
  aidLabel,
  isRace,
  sel,
  setSel,
}: {
  snaps: Snap[];
  bestHolder: (string | null)[];
  aidLabel: string;
  isRace: boolean;
  sel: string | null;
  setSel: (v: string | null) => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border/60">
      <div className="flex items-center gap-1 border-b border-border/60 bg-muted/30 px-2 py-1.5 text-2xs uppercase tracking-wide text-muted-foreground">
        <span className="w-4 text-right">P</span>
        <span className="w-12 pl-1.5">Driver</span>
        <span className="ml-auto w-14 text-right">Gap</span>
        <span className="w-[3.9rem] text-right">Last</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence initial={false}>
          {snaps.map((s) => {
            const isSel = s.id === sel;
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
                  isSel ? "bg-primary/10" : "hover:bg-accent/50",
                  s.pit && "opacity-55",
                )}
              >
                <span className="w-4 shrink-0 text-right text-xs font-bold text-muted-foreground">{s.pos ?? "—"}</span>
                <span className="ml-0.5 h-3.5 w-1 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="w-8 shrink-0 text-sm font-bold" style={{ color: s.color }}>{s.code}</span>
                {s.tyre && (
                  <span className="inline-flex shrink-0 items-baseline gap-px text-[9px] font-bold" style={{ color: TYRE_COLOR[s.tyre] ?? "hsl(var(--muted-foreground))" }}>
                    {s.tyre}
                    {s.tyl != null && <span className="text-[8px] text-muted-foreground">{s.tyl}</span>}
                  </span>
                )}
                {s.drs && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gain" title={aidLabel} />}
                {s.pit && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-position-gold" title="In pit" />}
                {s.isFL && <span className="shrink-0 text-[8px] leading-none text-fastest-lap" title="Fastest lap">◆</span>}
                <span className="ml-auto flex w-14 shrink-0 flex-col items-end leading-tight">
                  <span className="text-2xs text-muted-foreground">{gapText}</span>
                  {s.pos !== 1 && s.int != null && <span className="text-[9px] text-muted-foreground/60">{fmtGap(s.int)}</span>}
                </span>
                <span className="flex w-[3.9rem] shrink-0 flex-col items-end gap-0.5">
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

// ── Root ──────────────────────────────────────────────────────────────────────
export default function RaceSimulator({ year, round, session = "R" }: Props) {
  const roundNum = parseInt(round, 10);
  const [sel, setSel] = useState<string | null>(null);
  const [showSectors, setShowSectors] = useState(false);
  useEffect(() => setSel(null), [session, roundNum]); // clear follow when switching session/round

  const index = useQuery({ queryKey: ["race-replay", "index", year, roundNum, session], queryFn: () => getRaceReplay(year, roundNum, session) });
  const blobQ = useQuery({
    queryKey: ["race-replay", "blob", index.data?.public_url],
    queryFn: () => fetchRaceReplayBlob(index.data!.public_url),
    enabled: !!index.data?.public_url,
  });
  const geomIndex = useQuery({ queryKey: ["circuit-geometry", "index", year, roundNum], queryFn: () => getCircuitGeometry(year, roundNum) });
  const geomBlob = useQuery({
    queryKey: ["circuit-geometry", "blob", geomIndex.data?.public_url],
    queryFn: () => fetchCircuitGeometryBlob(geomIndex.data!.public_url),
    enabled: !!geomIndex.data?.public_url,
  });

  const blob = blobQ.data;

  const geom = useMemo(() => {
    const g = geomBlob.data;
    const b = blob;
    if (!g || !b) return { outlinePath: null as string | null, sectorPaths: null as string[] | null, startFinish: null as null | { ax: number; ay: number; bx: number; by: number; lx: number; ly: number } };
    const flipY = (y: number) => b.bounds.min_y + b.bounds.max_y - y;
    const outlinePath = g.outline.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${flipY(p[1])}`).join(" ");
    // split outline into 3 sectors by distance
    const maxD = g.outline[g.outline.length - 1]?.[2] ?? 0;
    const seg = (lo: number, hi: number) =>
      g.outline.filter((p) => p[2] >= lo && p[2] <= hi).map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${flipY(p[1])}`).join(" ");
    const sectorPaths = maxD > 0 ? [seg(0, maxD / 3), seg(maxD / 3, (2 * maxD) / 3), seg((2 * maxD) / 3, maxD)] : null;
    let startFinish = null as null | { ax: number; ay: number; bx: number; by: number; lx: number; ly: number };
    if (g.outline.length >= 2) {
      const [x0, y0] = g.outline[0];
      const [x1, y1] = g.outline[1];
      let dx = x1 - x0, dy = y1 - y0;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      const span = Math.max(b.bounds.max_x - b.bounds.min_x, b.bounds.max_y - b.bounds.min_y);
      const half = span * 0.024;
      const px = -dy * half, py = dx * half;
      startFinish = { ax: x0 + px, ay: flipY(y0 + py), bx: x0 - px, by: flipY(y0 - py), lx: x0, ly: flipY(y0) };
    }
    return { outlinePath, sectorPaths, startFinish };
  }, [geomBlob.data, blob]);

  return (
    <F1Card>
      <F1CardHeader className="flex-row items-center gap-2 pb-2">
        <Radio className="h-4 w-4 text-primary" />
        <F1CardTitle className="text-base">Race Control</F1CardTitle>
        <span className="instrument-label ml-auto text-muted-foreground">
          {SESSION_NAME[session] ?? session}{index.data?.driver_count ? ` · ${index.data.driver_count} cars` : ""}
        </span>
      </F1CardHeader>
      <F1CardContent>
        {index.isLoading || (index.data && blobQ.isLoading) ? (
          <F1Skeleton variant="card" className="h-[440px]" />
        ) : !index.data || !blob ? (
          <div className="flex h-[360px] flex-col items-center justify-center gap-2 px-6 text-center">
            <Radio className="h-6 w-6 text-muted-foreground/50" />
            {SUPPORTED_SESSIONS.has(session) ? (
              <>
                <p className="text-sm text-muted-foreground">{SESSION_NAME[session] ?? session} replay not available for this round yet.</p>
                <p className="text-2xs text-muted-foreground">Pick another session above, or it appears once FastF1 exports it.</p>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Live replay covers Race, Qualifying &amp; Sprint.</p>
                <p className="text-2xs text-muted-foreground">Practice sessions aren’t replayed — pick Race, Quali or Sprint above.</p>
              </>
            )}
          </div>
        ) : (
          <SimBody blob={blob} geom={geom} sel={sel} setSel={setSel} showSectors={showSectors} setShowSectors={setShowSectors} />
        )}
      </F1CardContent>
    </F1Card>
  );
}

function SimBody({
  blob,
  geom,
  sel,
  setSel,
  showSectors,
  setShowSectors,
}: {
  blob: RaceReplayBlob;
  geom: { outlinePath: string | null; sectorPaths: string[] | null; startFinish: null | { ax: number; ay: number; bx: number; by: number; lx: number; ly: number } };
  sel: string | null;
  setSel: (v: string | null) => void;
  showSectors: boolean;
  setShowSectors: (v: boolean) => void;
}) {
  const { frame, setFrame, playing, setPlaying, speed, setSpeed, lastFrame } = usePlayhead(blob.frames);
  const fi = Math.round(frame);
  const { snaps, bestSession, bestHolder, leaderLap, t } = useTiming(blob, fi);
  const dur = blob.duration_s || 1;
  const safety = blob.safety ?? [];
  const overtakes = blob.overtakes ?? [];
  const rc = blob.rc ?? [];
  const active = safety.find((p) => t >= p.start_s && t <= p.end_s) ?? null;
  const atEnd = frame >= lastFrame;
  // 2026 regs dropped DRS (active aero + battery override instead) — never show "DRS".
  const aidLabel = blob.season >= 2026 ? "OVR" : "DRS";
  // Race/Sprint = progress-ordered (lap X/Y, laps-down); Quali/practice = best-lap-ordered.
  const isRace = blob.is_race !== false;
  const sessionName = SESSION_NAME[blob.session ?? "R"] ?? blob.session ?? "Session";
  // Older blobs lack the per-frame position schema — show the track alone, not dashes.
  const hasTiming = useMemo(
    () => blob.drivers.some((d) => Array.isArray(d.pos) && d.pos.some((v) => v != null)),
    [blob.drivers],
  );

  const codeOf = useMemo(() => {
    const m = new Map<string, string>();
    blob.drivers.forEach((d) => m.set(d.driver_id, d.code ?? d.driver_id.slice(0, 3).toUpperCase()));
    return (id: string | null) => (id ? m.get(id) ?? id.slice(0, 3).toUpperCase() : "—");
  }, [blob.drivers]);

  const selSnap = sel ? snaps.find((s) => s.id === sel) ?? null : null;
  // race-control feed (recent, newest first) + recent overtakes at/just-before the playhead
  const feedMsgs = useMemo(() => [...rc].filter((m) => m.t <= t).slice(-5).reverse(), [rc, t]);
  const recentPass = useMemo(() => [...overtakes].filter((o) => o.t <= t && o.t > t - 20), [overtakes, t]);

  return (
    <div className="flex flex-col gap-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        <button
          type="button"
          onClick={() => (atEnd ? (setFrame(0), setPlaying(true)) : setPlaying(!playing))}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-px" />}
        </button>
        <button type="button" onClick={() => { setPlaying(false); setFrame(0); }} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border hover:bg-accent" aria-label="Restart">
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        {isRace ? (
          <div className="instrument-label ml-1 flex items-baseline gap-1 text-muted-foreground">
            Lap <span className="readout text-lg text-primary">{leaderLap || "—"}</span>
            <span className="text-muted-foreground/60">/ {blob.total_laps ?? "—"}</span>
          </div>
        ) : (
          <div className="instrument-label ml-1 text-primary">{sessionName}</div>
        )}
        <span className="readout ml-2 text-sm text-foreground/80">{fmtClock(t)}</span>
        {active && (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide animate-pulse" style={{ color: SAFETY_STYLE[active.kind].color, backgroundColor: `color-mix(in srgb, ${SAFETY_STYLE[active.kind].color} 16%, transparent)` }}>
            {active.kind === "RED" ? <Flag className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
            {active.kind}
          </span>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => setShowSectors(!showSectors)} className={cn("mr-1 inline-flex min-h-8 items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors", showSectors ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent")}>
            <Layers className="h-3 w-3" /> Sectors
          </button>
          {SPEEDS.map((sp) => (
            <button key={sp} type="button" onClick={() => setSpeed(sp)} className={cn("min-h-8 rounded px-2 py-1 text-xs font-medium tabular-nums transition-colors", speed === sp ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent")}>
              {sp}×
            </button>
          ))}
        </div>
      </div>

      {/* Progress bar with safety bands + overtake ticks */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full">
          {safety.map((p, i) => (
            <span key={i} className="absolute top-0 h-full" style={{ left: `${(p.start_s / dur) * 100}%`, width: `${(Math.max(p.end_s - p.start_s, dur * 0.004) / dur) * 100}%`, backgroundColor: `color-mix(in srgb, ${SAFETY_STYLE[p.kind].color} 55%, transparent)` }} />
          ))}
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-2 -translate-y-1/2">
          {overtakes.map((o, i) => (
            <span key={i} className="absolute top-0 h-2 w-px bg-primary/45" style={{ left: `${(o.t / dur) * 100}%` }} />
          ))}
        </div>
        <input type="range" min={0} max={lastFrame} step={0.5} value={frame} onChange={(e) => { setPlaying(false); setFrame(Number(e.target.value)); }} className="relative h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted/70 accent-primary" aria-label="Race scrubber" />
      </div>

      {/* Track + timing tower */}
      <div className={cn("grid grid-cols-1 gap-3", hasTiming && "lg:grid-cols-[1fr_340px] lg:items-stretch lg:gap-4")}>
        <div className="lg:h-[clamp(380px,56vh,600px)]">
          <TrackSVG blob={blob} outlinePath={geom.outlinePath} sectorPaths={geom.sectorPaths} startFinish={geom.startFinish} frame={frame} active={active} showSectors={showSectors} sel={sel} setSel={setSel} />
        </div>
        {hasTiming && (
          <div className="lg:h-[clamp(380px,56vh,600px)]">
            <TimingTower snaps={snaps} bestHolder={bestHolder} aidLabel={aidLabel} isRace={isRace} sel={sel} setSel={setSel} />
          </div>
        )}
      </div>
      {!hasTiming && (
        <p className="text-2xs text-muted-foreground">Live timing tower is regenerating for this race — the track replay is ready now.</p>
      )}

      {/* Selected-driver focus — sector times + tyre, colour-coded vs bests */}
      {selSnap && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-primary/30 bg-primary/[0.04] px-3 py-2">
          <span className="flex items-center gap-1.5">
            <span className="h-4 w-1.5 rounded-full" style={{ backgroundColor: selSnap.color }} />
            <span className="text-sm font-bold" style={{ color: selSnap.color }}>{selSnap.code}</span>
            <span className="text-2xs text-muted-foreground">P{selSnap.pos ?? "—"}</span>
            {selSnap.tyre && (
              <span className="inline-flex items-baseline gap-px text-[10px] font-bold" style={{ color: TYRE_COLOR[selSnap.tyre] ?? "hsl(var(--muted-foreground))" }}>
                {selSnap.tyre}{selSnap.tyl != null && <span className="text-[9px] text-muted-foreground">{selSnap.tyl}</span>}
              </span>
            )}
          </span>
          <span className="flex items-center gap-2.5 text-xs tabular-nums">
            {selSnap.sec.map((v, k) => {
              const cls = v == null ? "text-muted-foreground/40" : v === bestSession[k] ? "text-fastest-lap" : v === selSnap.pb[k] ? "text-gain" : "text-foreground";
              return (
                <span key={k} className="flex items-baseline gap-1">
                  <span className="text-[9px] uppercase text-muted-foreground/60">S{k + 1}</span>
                  <span className={cn("readout", cls)}>{fmtSec(v)}</span>
                </span>
              );
            })}
          </span>
          <span className="ml-auto flex items-center gap-3 text-xs">
            <span className="flex items-baseline gap-1">
              <span className="text-[9px] uppercase text-muted-foreground/60">Last</span>
              <span className={cn("readout", selSnap.isFLLap ? "text-fastest-lap" : "text-foreground")}>{fmtLap(selSnap.lastTime)}</span>
            </span>
            <span className="flex items-baseline gap-1">
              <span className="text-[9px] uppercase text-muted-foreground/60">Gap</span>
              <span className="readout text-muted-foreground">{selSnap.pos === 1 ? (isRace ? "LEADER" : "—") : isRace && selSnap.lapsDown >= 1 ? `+${selSnap.lapsDown}L` : fmtGap(selSnap.gap)}</span>
            </span>
          </span>
        </div>
      )}

      {/* Sector legend (when the track is sector-coloured) */}
      {showSectors && (
        <div className="flex items-center gap-3 text-2xs text-muted-foreground">
          {["Sector 1", "Sector 2", "Sector 3"].map((l, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              <span className="h-1.5 w-3 rounded" style={{ backgroundColor: SECTOR_COLOR[i] }} />
              {l}
            </span>
          ))}
        </div>
      )}

      {/* Feeds — race control + recent passes */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {feedMsgs.length > 0 && (
          <div className="min-w-0 rounded-lg border border-border/50 bg-card/40 p-2">
            <div className="instrument-label mb-1 flex items-center gap-1 text-[9px]">
              <Radio className="h-2.5 w-2.5 text-primary" /> Race Control
            </div>
            <div className="flex flex-col gap-0.5">
              {feedMsgs.map((m, i) => (
                <div key={i} className={cn("flex items-start gap-1.5 text-2xs", i === 0 ? "text-foreground" : "text-muted-foreground")}>
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: RC_KIND_COLOR[m.kind] ?? RC_KIND_COLOR.info }} />
                  <span className="truncate">{m.msg}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {recentPass.length > 0 && (
          <div className="min-w-0 rounded-lg border border-border/50 bg-card/40 p-2">
            <div className="instrument-label mb-1 flex items-center gap-1 text-[9px] text-primary">Overtakes</div>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-2xs tabular-nums">
              {recentPass.slice(-6).reverse().map((o, i) => (
                <span key={i} className="text-muted-foreground">
                  <span className="font-bold text-gain">{codeOf(o.by)}</span> ▸ {codeOf(o.on)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
