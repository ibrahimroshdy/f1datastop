/**
 * Deterministic per-league identity so every league looks distinct even before
 * a captain customises it. A DB-set crest/accent overrides the derived value.
 */
const ACCENTS = [
  "#e10600", "#00d2be", "#ff8700", "#0090ff", "#6692ff",
  "#358c75", "#b6babd", "#2293d1", "#9b1b30", "#ff87bc",
];

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

/** A stable accent hex for a league (DB value wins, else derived from id/name). */
export function leagueAccent(league: { id?: string; name?: string; accent?: string | null }): string {
  if (league.accent) return league.accent;
  return ACCENTS[hash(league.id ?? league.name ?? "") % ACCENTS.length];
}

/** The crest glyph — a set emoji, else a 1–2 letter monogram from the name. */
export function leagueCrest(league: { name?: string; crest?: string | null }): string {
  if (league.crest) return league.crest;
  const words = (league.name ?? "").trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  return initials || "F1";
}
