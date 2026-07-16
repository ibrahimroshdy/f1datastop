import type { CircuitGeometryBlob } from "@/services/circuitGeometryService";
import type { RaceReplayBlob } from "@/services/raceReplayService";
import { TEAM_COLORS } from "@/constants/f1Colors";

// Replay blobs carry only team_color (FastF1's palette, which differs slightly from
// ours), not a constructor id. Match to the NEAREST app team colour so we can show
// team logos next to drivers — exact-hex reverse-mapping missed most teams.
const hexToRgb = (h: string): [number, number, number] | null => {
  const s = h.replace("#", "").trim();
  if (s.length < 6) return null;
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
};
const PALETTE = Object.entries(TEAM_COLORS)
  .map(([id, hex]) => ({ id, rgb: hexToRgb(hex) }))
  .filter((p): p is { id: string; rgb: [number, number, number] } => !!p.rgb);

export function constructorIdFromColor(hex?: string | null): string | undefined {
  if (!hex) return undefined;
  const rgb = hexToRgb(hex);
  if (!rgb) return undefined;
  let best: string | undefined;
  let bestD = Infinity;
  for (const p of PALETTE) {
    const d = (p.rgb[0] - rgb[0]) ** 2 + (p.rgb[1] - rgb[1]) ** 2 + (p.rgb[2] - rgb[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p.id;
    }
  }
  // Guard against mapping an odd/greyish colour onto a random team.
  return bestD < 9000 ? best : undefined;
}

/** Per-driver timing snapshot at one frame (mirrors RaceSimulator's useTiming). */
export interface Snap {
  id: string;
  code: string;
  color: string;
  pos: number | null;
  gap: number | null;
  int: number | null;
  sec: (number | null)[];
  lastTime: number | null;
  pb: [number, number, number];
  curLapN: number | null;
  tyre: string | null;
  tyl: number | null;
  lapsDown: number;
  isFL: boolean;
  isFLLap: boolean;
  pit: boolean;
  drs: boolean;
  /** Fraction (0–1) through the current lap — drives the telemetry crosshair. */
  frac: number;
}

export interface TimingResult {
  snaps: Snap[];
  bestHolder: (string | null)[];
  leaderLap: number;
  t: number;
  flId: string | null;
}

export function computeTiming(blob: RaceReplayBlob, fi: number): TimingResult {
  const t = blob.times[fi] ?? 0;
  const bestSession: [number, number, number] = [Infinity, Infinity, Infinity];
  const bestHolder: (string | null)[] = [null, null, null];
  let flTime = Infinity;
  let flId: string | null = null;
  const snaps: Snap[] = [];

  for (const d of blob.drivers) {
    const laps = d.laps ?? [];
    const pb: [number, number, number] = [Infinity, Infinity, Infinity];
    let live: (typeof laps)[number] | null = null;
    let lastC: (typeof laps)[number] | null = null;
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
    // Fraction through the current lap (for the telemetry crosshair).
    let frac = 0;
    if (live) {
      const te = live.te ?? (live.last != null ? live.ts + live.last : live.ts + 90);
      const span = te - live.ts || 1;
      frac = Math.max(0, Math.min(1, (t - live.ts) / span));
    }
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
      frac,
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
  return { snaps, bestHolder, leaderLap, t, flId };
}

/**
 * Fraction (0–1) through its current lap for one driver at a frame — used to sweep
 * the telemetry crosshair in sync with the single race-replay playhead.
 */
export function refLapFrac(blob: RaceReplayBlob, code: string | null, frame: number): number {
  if (!code) return 0;
  const d = blob.drivers.find((x) => x.code === code);
  if (!d) return 0;
  const t = blob.times[Math.round(frame)] ?? 0;
  let live: { ts: number; te?: number | null; last?: number | null; n: number } | null = null;
  for (const l of d.laps ?? []) if (l.ts <= t && (!live || l.n > live.n)) live = l;
  if (!live) return 0;
  const te = live.te ?? (live.last != null ? live.ts + live.last : live.ts + 90);
  const span = te - live.ts || 1;
  return Math.max(0, Math.min(1, (t - live.ts) / span));
}

export interface Car {
  id: string;
  code: string;
  color: string;
  x: number;
  y: number;
}

/** Interpolated car positions at a (fractional) frame. flipY into SVG space. */
export function interpCars(blob: RaceReplayBlob, frame: number): Car[] {
  const lastFrame = blob.frames - 1;
  const flipY = (y: number) => blob.bounds.min_y + blob.bounds.max_y - y;
  const i = Math.floor(frame);
  const frac = frame - i;
  const j = Math.min(i + 1, lastFrame);
  const out: Car[] = [];
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
}

/**
 * Approx live speed (km/h) per driver from the replay positions — Δposition / Δtime.
 * FastF1 X/Y are in 1/10 m, times[] in real seconds. Works for every car on track.
 */
export function carSpeeds(blob: RaceReplayBlob, frame: number): Record<string, number> {
  const i = Math.max(1, Math.round(frame));
  const dt = (blob.times[i] ?? 0) - (blob.times[i - 1] ?? 0);
  const m: Record<string, number> = {};
  if (dt <= 0) return m;
  for (const d of blob.drivers) {
    const a = d.xy[i - 1];
    const b = d.xy[i];
    if (a && b && d.code) {
      const dist = Math.hypot(b[0] - a[0], b[1] - a[1]) / 10; // 1/10 m → m
      m[d.code] = (dist / dt) * 3.6;
    }
  }
  return m;
}

export interface GeomPaths {
  outlinePath: string | null;
  sectorPaths: string[] | null;
  startFinish: { ax: number; ay: number; bx: number; by: number } | null;
}

/** Build the track outline, 3-sector split, and start/finish line in blob.bounds space. */
export function buildGeom(geom: CircuitGeometryBlob | undefined, blob: RaceReplayBlob): GeomPaths {
  if (!geom) return { outlinePath: null, sectorPaths: null, startFinish: null };
  const flipY = (y: number) => blob.bounds.min_y + blob.bounds.max_y - y;
  const outlinePath = geom.outline.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${flipY(p[1])}`).join(" ");
  const maxD = geom.outline[geom.outline.length - 1]?.[2] ?? 0;
  const seg = (lo: number, hi: number) =>
    geom.outline
      .filter((p) => p[2] >= lo && p[2] <= hi)
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${flipY(p[1])}`)
      .join(" ");
  const sectorPaths = maxD > 0 ? [seg(0, maxD / 3), seg(maxD / 3, (2 * maxD) / 3), seg((2 * maxD) / 3, maxD)] : null;
  let startFinish: GeomPaths["startFinish"] = null;
  if (geom.outline.length >= 2) {
    const [x0, y0] = geom.outline[0];
    const [x1, y1] = geom.outline[1];
    let dx = x1 - x0;
    let dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const span = Math.max(blob.bounds.max_x - blob.bounds.min_x, blob.bounds.max_y - blob.bounds.min_y);
    const half = span * 0.024;
    startFinish = { ax: x0 - dy * half, ay: flipY(y0 + dx * half), bx: x0 + dy * half, by: flipY(y0 - dx * half) };
  }
  return { outlinePath, sectorPaths, startFinish };
}

export const SECTOR_COLOR = ["hsl(330 85% 60%)", "hsl(210 90% 58%)", "hsl(150 70% 48%)"];
export const TYRE_HSL: Record<string, string> = {
  S: "hsl(0 85% 55%)",
  M: "hsl(45 95% 55%)",
  H: "hsl(0 0% 92%)",
  I: "hsl(140 68% 46%)",
  W: "hsl(210 90% 56%)",
};
export const SAFETY_STYLE: Record<string, { label: string; color: string }> = {
  SC: { label: "Safety Car", color: "hsl(45 96% 50%)" },
  VSC: { label: "Virtual SC", color: "hsl(45 96% 50%)" },
  RED: { label: "Red Flag", color: "hsl(var(--destructive))" },
};

export const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
export const fmtLap = (s: number | null) =>
  s == null ? "—" : `${Math.floor(s / 60)}:${(s % 60).toFixed(3).padStart(6, "0")}`;
export const fmtGap = (s: number | null) => (s == null ? "—" : s < 0.05 ? "—" : `+${s.toFixed(1)}`);
