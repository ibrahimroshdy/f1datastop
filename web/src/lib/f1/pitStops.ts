/**
 * Pit-stop table helpers (BUG-008).
 *
 * A stop without a duration (car retired in the pit lane; 36 such FastF1 rows in 2026)
 * became NaN through parseFloat(null), and Math.min over the list then printed "NaN" as
 * the session's fastest stop. Durations are parsed to number | null, and stats only use
 * real values.
 */
export function parseDuration(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  let n: number;
  if (typeof v === "number") n = v;
  else {
    // Jolpica writes stops of a minute or more as M:SS.sss ("1:21.474"); parseFloat read that as 1.
    const m = /^\s*(?:(\d+):)?(\d+(?:\.\d+)?)\s*$/.exec(String(v));
    n = m ? Number(m[1] ?? 0) * 60 + Number(m[2]) : NaN;
  }
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function durationStats(durations: Array<number | null>): { min: number | null; max: number | null } {
  const real = durations.filter((d): d is number => d !== null && Number.isFinite(d));
  if (!real.length) return { min: null, max: null };
  return { min: Math.min(...real), max: Math.max(...real) };
}
