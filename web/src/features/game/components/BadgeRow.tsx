import { Flag, Trophy, Medal, Target, Star, type LucideIcon } from "lucide-react";
import type { Badge } from "../api/gameClient";

const ICON: Record<string, LucideIcon> = {
  pole: Flag,
  winner: Trophy,
  podium: Medal,
  bullseye: Target,
  fullhouse: Star,
};

/** Earned achievement chips. */
export function BadgeRow({ badges }: { badges: Badge[] }) {
  if (badges.length === 0) {
    return <p className="text-2xs text-muted-foreground">No badges yet — nail some picks to earn them.</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((b) => {
        const Icon = ICON[b.key] ?? Star;
        return (
          <span
            key={b.key}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/[0.07] px-2.5 py-1 text-xs font-medium"
            title={b.label}
          >
            <Icon className="h-3.5 w-3.5 text-primary" />
            {b.label}
            {b.count > 1 && <span className="text-2xs text-muted-foreground">×{b.count}</span>}
          </span>
        );
      })}
    </div>
  );
}
