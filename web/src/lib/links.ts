/**
 * One place that builds the app's addresses (docs/design/decisions.md D19, D20, D30).
 * Every name in the app links through these, so a route can change in one file.
 * Paths match the routes in App.tsx; the profile pages accept the Ergast ids as slugs.
 */

/** Seasons the app offers, newest first (the data starts in 2018, as YearSelector always did). */
export const FIRST_SEASON = 2018;
export const currentSeason = (): number => new Date().getFullYear();
export const seasons = (): number[] => {
  const out: number[] = [];
  for (let y = currentSeason(); y >= FIRST_SEASON; y--) out.push(y);
  return out;
};

/** `?season=` only when it is not the current season, so ordinary links stay clean. */
export function seasonSearch(season?: number | null): string {
  return season && season !== currentSeason() ? `?season=${season}` : "";
}

export const driverHref = (driverId: string, season?: number | null) =>
  `/drivers/${encodeURIComponent(driverId)}${seasonSearch(season)}`;

export const teamHref = (constructorId: string, season?: number | null) =>
  `/teams/${encodeURIComponent(constructorId)}${seasonSearch(season)}`;

export const circuitHref = (circuitId: string) => `/circuits/${encodeURIComponent(circuitId)}`;

/** A Grand Prix's full page (D20), optionally on one of its sections. */
export function raceHref(season: number | string, round: number | string, tab?: string, session?: string): string {
  const q = new URLSearchParams();
  if (tab) q.set("tab", tab);
  if (session) q.set("session", session);
  const s = q.toString();
  return `/race-analysis/${season}/${round}${s ? `?${s}` : ""}`;
}

/** The quick-look address (D30): the current page with `?race=2026-21`, so Back closes it. */
export const QUICK_LOOK_PARAM = "race";
export const quickLookValue = (season: number | string, round: number | string) => `${season}-${round}`;

export function parseQuickLook(value: string | null): { season: number; round: number } | null {
  const m = value?.match(/^(\d{4})-(\d{1,2})$/);
  return m ? { season: Number(m[1]), round: Number(m[2]) } : null;
}
