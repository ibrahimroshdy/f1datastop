import { Crown } from "lucide-react";
import { F1Avatar } from "@/components/f1";
import { cn } from "@/lib/utils";
import { MEDAL_SOLID } from "../utils/medal";
import type { StandingRow } from "../api/leaguesClient";

/** First two letters of a player's name for the avatar fallback (undefined → generic icon). */
const initials = (n?: string | null) => (n ?? "").trim().slice(0, 2).toUpperCase() || undefined;

/** Why `a` ranks above `b` when they tie on points — the tiebreak cascade made transparent. */
function tiebreakReason(a: StandingRow, b: StandingRow | undefined): string | null {
  if (!b || Number(a.total_points) !== Number(b.total_points)) return null;
  if (a.exact_hits !== b.exact_hits) return "more exact hits";
  if (a.champions_correct !== b.champions_correct) return "champion pick";
  if (a.goat_count !== b.goat_count) return "more race wins";
  return "earlier entry";
}

/** Top-3 podium — 1st centered + tallest, 2nd left, 3rd right, with tiebreak reasons. */
export function Podium({ rows, meId }: { rows: StandingRow[]; meId?: string }) {
  const ranked = [...rows].sort((a, b) => a.rank - b.rank);
  const top3 = ranked.filter((r) => r.rank <= 3);
  if (top3.length === 0) return null;
  const byRank = (r: number) => top3.find((x) => x.rank === r);
  const order = [byRank(2), byRank(1), byRank(3)].filter(Boolean) as StandingRow[];
  const blockH: Record<number, string> = { 1: "h-20", 2: "h-14", 3: "h-10" };

  return (
    <div className="flex items-end justify-center gap-2 sm:gap-4">
      {order.map((e) => {
        const mine = e.user_id === meId;
        const below = ranked.find((r) => r.rank === e.rank + 1);
        const tb = tiebreakReason(e, below);
        return (
          <div key={e.user_id} className="flex w-full max-w-[9rem] flex-col items-center gap-1">
            {e.rank === 1 && <Crown className="h-5 w-5 text-position-gold" />}
            <F1Avatar
              src={e.avatar_url ?? undefined}
              fallback={initials(e.username)}
              alt={e.username ?? "Player"}
              size={e.rank === 1 ? "lg" : "md"}
              showRing={mine}
              teamColor={mine ? "hsl(var(--primary))" : undefined}
            />
            <div className="w-full truncate text-center">
              <div className={cn("truncate text-sm font-semibold", mine && "text-primary")}>
                {e.username ?? "—"}
              </div>
              <div className="readout text-xs tabular-nums text-muted-foreground">
                {Number(e.total_points)} pts
              </div>
              {tb && <div className="text-[10px] text-muted-foreground/70">via {tb}</div>}
            </div>
            <div
              className={cn(
                "flex w-full items-start justify-center rounded-t-lg pt-1.5 text-lg font-extrabold tabular-nums",
                blockH[e.rank],
                MEDAL_SOLID[e.rank],
              )}
            >
              {e.rank}
            </div>
          </div>
        );
      })}
    </div>
  );
}
