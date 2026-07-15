import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserPlus, UserMinus, Crown, TrendingDown, Radio, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLeagueActivity, type ActivityRow } from "../api/leaguesClient";

const rel = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

function describe(a: ActivityRow): { Icon: LucideIcon; tone: string; text: ReactNode } {
  const who = a.actor_name || a.subject_name || "A player";
  switch (a.kind) {
    case "join":
      return { Icon: UserPlus, tone: "text-gain", text: <><b>{who}</b> joined the league</> };
    case "leave":
      return { Icon: UserMinus, tone: "text-muted-foreground", text: <><b>{who}</b> left</> };
    case "goat":
      return {
        Icon: Crown,
        tone: "text-position-gold",
        text: <><b>{a.subject_name}</b> was GOAT of round {a.round} · {a.detail?.points ?? 0} pts</>,
      };
    case "flop":
      return { Icon: TrendingDown, tone: "text-loss", text: <><b>{a.subject_name}</b> flopped round {a.round}</> };
    default:
      return { Icon: Radio, tone: "text-muted-foreground", text: a.kind };
  }
}

/** Live league activity — joins, GOAT/flop of the round. Self-hides when empty. */
export function LeagueActivity({ leagueId, className }: { leagueId: string; className?: string }) {
  const { data } = useQuery({
    queryKey: ["game", "league-activity", leagueId],
    queryFn: () => getLeagueActivity(leagueId, 15),
    staleTime: 30 * 1000,
  });
  if (!data || data.length === 0) return null;

  return (
    <section className={cn("space-y-2", className)}>
      <div className="instrument-label text-primary">Activity</div>
      <ul className="space-y-1.5">
        {data.map((a) => {
          const { Icon, tone, text } = describe(a);
          return (
            <li
              key={a.id}
              className="flex items-center gap-2.5 rounded-md border border-border bg-card/40 px-3 py-2 text-xs"
            >
              <Icon className={cn("h-3.5 w-3.5 shrink-0", tone)} />
              <span className="min-w-0 flex-1 truncate text-muted-foreground [&_b]:font-semibold [&_b]:text-foreground">
                {text}
              </span>
              <span className="shrink-0 text-2xs text-muted-foreground">{rel(a.created_at)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
