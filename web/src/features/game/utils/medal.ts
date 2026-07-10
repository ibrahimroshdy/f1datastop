/** Medal styling for top-3 ranks — gold / silver / bronze, tuned for the dark terminal theme. */
export const MEDAL_BADGE: Record<number, string> = {
  1: "bg-amber-400/15 text-amber-300 border-amber-400/40",
  2: "bg-slate-300/15 text-slate-200 border-slate-300/45",
  3: "bg-orange-500/15 text-orange-300 border-orange-500/40",
};

export const MEDAL_SOLID: Record<number, string> = {
  1: "bg-amber-400 text-amber-950",
  2: "bg-slate-300 text-slate-900",
  3: "bg-orange-500 text-orange-950",
};

export function medalBadge(rank: number): string {
  return MEDAL_BADGE[rank] ?? "border-transparent text-muted-foreground";
}
