import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { MEDAL_SOLID } from "../utils/medal";

type PodiumEntry = { user_id: string; username: string | null; total_points: number; rank: number };

/** Top-3 podium — 1st centered + tallest, 2nd left, 3rd right. */
export function Podium({ rows, meId }: { rows: PodiumEntry[]; meId?: string }) {
  const top3 = rows.filter((r) => r.rank <= 3).sort((a, b) => a.rank - b.rank);
  if (top3.length === 0) return null;
  const byRank = (r: number) => top3.find((x) => x.rank === r);
  // visual order: 2 · 1 · 3
  const order = [byRank(2), byRank(1), byRank(3)].filter(Boolean) as PodiumEntry[];
  const blockH: Record<number, string> = { 1: "h-20", 2: "h-14", 3: "h-10" };

  return (
    <div className="flex items-end justify-center gap-2 sm:gap-4">
      {order.map((e) => {
        const mine = e.user_id === meId;
        return (
          <div key={e.user_id} className="flex w-full max-w-[8.5rem] flex-col items-center gap-1.5">
            {e.rank === 1 && <Crown className="h-5 w-5 text-amber-400" />}
            <div className="w-full truncate text-center">
              <div className={cn("truncate text-sm font-semibold", mine && "text-primary")}>
                {e.username ?? "—"}
              </div>
              <div className="readout text-xs tabular-nums text-muted-foreground">
                {Number(e.total_points)} pts
              </div>
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
