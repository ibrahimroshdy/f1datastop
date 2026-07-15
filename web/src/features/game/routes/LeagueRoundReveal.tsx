import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BackLink } from "@/components/ui/back-link";
import { F1Card, F1CardContent, F1Skeleton, F1Avatar } from "@/components/f1";
import { getTeamColorById } from "@/constants/f1Colors";
import { pageShell, pageStack } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { getSeasonDrivers, getGameSchedule, ACTIVE_GAME_SEASON } from "../api/gameClient";
import { getRoundReveal } from "../api/leaguesClient";

const initials = (n?: string | null) => (n ?? "").trim().slice(0, 2).toUpperCase() || undefined;

const SESSION_LABEL: Record<string, string> = { Q: "Quali", S: "Sprint", R: "Race" };
const POS_RING: Record<number, string> = {
  1: "text-position-gold",
  2: "text-position-silver",
  3: "text-position-bronze",
};

type Pick = { code: string; color: string };

export default function LeagueRoundReveal() {
  const { id, round: roundParam } = useParams<{ id: string; round: string }>();
  const leagueId = id as string;
  const round = parseInt(roundParam ?? "0", 10);
  const { user } = useAuth();

  const reveal = useQuery({
    queryKey: ["game", "reveal", leagueId, round],
    queryFn: () => getRoundReveal(leagueId, round),
  });
  const drivers = useQuery({ queryKey: ["game", "drivers", ACTIVE_GAME_SEASON], queryFn: () => getSeasonDrivers() });
  const schedule = useQuery({ queryKey: ["game", "schedule", ACTIVE_GAME_SEASON], queryFn: () => getGameSchedule() });

  const driverMeta = useMemo(() => {
    const m = new Map<string, Pick>();
    for (const d of drivers.data ?? []) {
      m.set(d.driver_id, {
        code: d.code ?? d.name,
        color: d.constructor_id ? getTeamColorById(d.constructor_id) : "hsl(var(--muted-foreground))",
      });
    }
    return m;
  }, [drivers.data]);

  // group reveal rows: user -> session -> [picks by pos]
  const byUser = useMemo(() => {
    const m = new Map<string, { userId: string; username: string; sessions: Record<string, Pick[]> }>();
    for (const r of reveal.data ?? []) {
      const u = m.get(r.user_id) ?? { userId: r.user_id, username: r.username ?? "—", sessions: {} };
      u.sessions[r.session_type] = u.sessions[r.session_type] ?? [];
      u.sessions[r.session_type][r.pos - 1] = driverMeta.get(r.driver_id) ?? { code: r.driver_id, color: "hsl(var(--muted-foreground))" };
      m.set(r.user_id, u);
    }
    // me first
    return [...m.values()].sort((a, b) => (a.userId === user?.id ? -1 : b.userId === user?.id ? 1 : 0));
  }, [reveal.data, driverMeta, user?.id]);

  const raceName = schedule.data?.find((r) => r.round === round)?.race_name ?? `Round ${round}`;

  return (
    <div className={pageShell}>
      <div className={cn(pageStack, "animate-fade-in")}>
        <BackLink to={`/game/leagues/${leagueId}`}>League</BackLink>
        <div className="space-y-1.5">
          <div className="instrument-label text-primary">Round {round} · Picks reveal</div>
          <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">{raceName}</h1>
        </div>

        {reveal.isLoading ? (
          <F1Skeleton variant="card" className="h-40" />
        ) : byUser.length === 0 ? (
          <F1Card><F1CardContent className="py-6 text-sm text-muted-foreground">
            Picks aren't revealed for this round — either the weekend hasn't locked yet, or this league keeps picks private.
          </F1CardContent></F1Card>
        ) : (
          byUser.map((u) => {
            const isMe = u.userId === user?.id;
            return (
              <div key={u.userId} className={cn("overflow-hidden rounded-xl border bg-card/40", isMe ? "border-primary/40" : "border-border")}>
                <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                  <F1Avatar fallback={initials(u.username)} alt={u.username} size="sm" />
                  <span className="font-heading text-sm font-bold">{u.username}</span>
                  {isMe && <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-primary">You</span>}
                </div>
                <div className="flex flex-col divide-y divide-border/50">
                  {["Q", "S", "R"].filter((s) => u.sessions[s]).map((s) => (
                    <div key={s} className="flex flex-wrap items-center gap-1.5 px-3 py-2">
                      <span className="instrument-label w-12 shrink-0 text-[10px] text-muted-foreground">{SESSION_LABEL[s]}</span>
                      {u.sessions[s].map((p, i) => (
                        <span key={i} className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/40 py-0.5 pl-1 pr-1.5">
                          <span className="h-3.5 w-1 rounded-full" style={{ backgroundColor: p?.color ?? "transparent" }} />
                          <span className={cn("font-mono text-[9px] font-bold tabular-nums", POS_RING[i + 1] ?? "text-muted-foreground/60")}>{i + 1}</span>
                          <span className="font-mono text-2xs font-semibold">{p?.code ?? "—"}</span>
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
