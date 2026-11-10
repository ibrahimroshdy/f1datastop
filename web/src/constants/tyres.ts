/**
 * Pirelli compound colours, one set for the whole app: tyre icons, stint strips, charts and
 * the social cards (analysis/social/session_results/session_results.py, TYRE).
 * docs/design/decisions.md D16. Keys are the compound letter; full names map through `tyreCode`.
 */
export const TYRE_COLORS: Record<string, string> = {
  S: "#DA291C",
  M: "#FFD12E",
  H: "#F0F0EC",
  I: "#43B02A",
  W: "#2F8CFF",
};

export const TYRE_LABELS: Record<string, string> = {
  S: "Soft",
  M: "Medium",
  H: "Hard",
  I: "Intermediate",
  W: "Wet",
};

/** "SOFT", "soft", "S" → "S". Unknown compounds return null, never a guess. */
export function tyreCode(compound?: string | null): string | null {
  const c = (compound ?? "").trim().toUpperCase().charAt(0);
  return c in TYRE_COLORS ? c : null;
}

/** The compound's colour, or the muted ink when the compound is unknown. */
export function tyreColor(compound?: string | null): string {
  const c = tyreCode(compound);
  return c ? TYRE_COLORS[c] : "hsl(var(--muted-foreground))";
}
