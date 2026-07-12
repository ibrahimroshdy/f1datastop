/** Medal styling for top-3 ranks — gold / silver / bronze, tuned for the dark terminal theme. */
export const MEDAL_BADGE: Record<number, string> = {
  1: "bg-position-gold/15 text-position-gold border-position-gold/40",
  2: "bg-position-silver/15 text-position-silver border-position-silver/45",
  3: "bg-position-bronze/15 text-position-bronze border-position-bronze/40",
};

export const MEDAL_SOLID: Record<number, string> = {
  1: "bg-position-gold text-background",
  2: "bg-position-silver text-background",
  3: "bg-position-bronze text-background",
};

export function medalBadge(rank: number): string {
  return MEDAL_BADGE[rank] ?? "border-transparent text-muted-foreground";
}
