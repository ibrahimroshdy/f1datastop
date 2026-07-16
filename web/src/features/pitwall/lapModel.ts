import type { TelemetryBlob } from "@/services/telemetryService";
import type { DriverTelemetry } from "./hooks/usePitWallTelemetry";
import type { PitWallDriver } from "./hooks/usePitWallData";

/** One resolved driver lap, ready to drive the synchronized-telemetry view. */
export interface Lap {
  code: string;
  color: string;
  blob: TelemetryBlob;
  /** Cumulative seconds at each sample (integrated from speed over distance). */
  time: number[];
  x: number[];
  y: number[];
  /** Lap duration = time at the last sample. */
  dur: number;
}

export interface LapModel {
  laps: Lap[];
  /** Longest lap among the drivers — the playhead runs 0…maxDur. */
  maxDur: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number } | null;
}

/** Integrate lap time from speed (km/h) over distance (m). */
export function cumulativeTime(dist: number[], speed: number[]): number[] {
  const t = [0];
  for (let i = 1; i < dist.length; i++) {
    const dd = dist[i] - dist[i - 1];
    const v = (speed[i] + speed[i - 1]) / 2 / 3.6;
    t.push(t[i - 1] + (v > 0 ? dd / v : 0));
  }
  return t;
}

/** Build the lap model from resolved telemetry + the driver palette. */
export function buildLapModel(telemetry: DriverTelemetry[], drivers: PitWallDriver[]): LapModel {
  const colorOf: Record<string, string> = {};
  for (const d of drivers) colorOf[d.code] = d.team_color || "#9ca3af";

  const laps: Lap[] = [];
  let bounds: LapModel["bounds"] = null;
  for (const t of telemetry) {
    if (t.state?.status !== "done") continue;
    const blob = (t.state as { status: "done"; blob: TelemetryBlob }).blob;
    const ch = blob.channels;
    const dist = ch.distance;
    const speed = ch.speed;
    const x = ch.x;
    const y = ch.y;
    if (!dist || !speed || !x || !y) continue;
    const time = cumulativeTime(dist, speed);
    laps.push({ code: t.code, color: colorOf[t.code] || "#9ca3af", blob, time, x, y, dur: time[time.length - 1] ?? 0 });
    for (let i = 0; i < x.length; i++) {
      if (!bounds) bounds = { minX: x[i], maxX: x[i], minY: y[i], maxY: y[i] };
      else {
        bounds.minX = Math.min(bounds.minX, x[i]);
        bounds.maxX = Math.max(bounds.maxX, x[i]);
        bounds.minY = Math.min(bounds.minY, y[i]);
        bounds.maxY = Math.max(bounds.maxY, y[i]);
      }
    }
  }
  const maxDur = laps.reduce((m, l) => Math.max(m, l.dur), 0);
  return { laps, maxDur, bounds };
}

/** Closest sample index to time `t` in a monotonic cumulative-time array (binary search). */
export function idxAtTime(time: number[], t: number): number {
  if (time.length === 0) return 0;
  if (t <= time[0]) return 0;
  if (t >= time[time.length - 1]) return time.length - 1;
  let lo = 0;
  let hi = time.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (time[mid] < t) lo = mid;
    else hi = mid;
  }
  return t - time[lo] <= time[hi] - t ? lo : hi;
}

/** mm:ss.mmm from seconds. */
export function fmtLapClock(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${m}:${rest.toFixed(3).padStart(6, "0")}`;
}

export const TYRE_ABBR: Record<string, string> = {
  SOFT: "S",
  MEDIUM: "M",
  HARD: "H",
  INTERMEDIATE: "I",
  WET: "W",
};
