import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BackLink } from "@/components/ui/back-link";
import { F1Card, F1CardContent, F1CardHeader, F1CardTitle, F1Skeleton } from "@/components/f1";
import { pageShell, pageStack } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { getSeasonDrivers, getGameSchedule, ACTIVE_GAME_SEASON } from "../api/gameClient";
import { getRoundReveal } from "../api/leaguesClient";

const SESSION_LABEL: Record<string, string> = { Q: "Quali", S: "Sprint", R: "Race" };

export default function LeagueRoundReveal() {
  const { id, round: roundParam } = useParams<{ id: string; round: string }>();
  const leagueId = id as string;
  const round = parseInt(roundParam ?? "0", 10);

  const reveal = useQuery({
    queryKey: ["game", "reveal", leagueId, round],
    queryFn: () => getRoundReveal(leagueId, round),
  });
  const drivers = useQuery({ queryKey: ["game", "drivers", ACTIVE_GAME_SEASON], queryFn: () => getSeasonDrivers() });
  const schedule = useQuery({ queryKey: ["game", "schedule", ACTIVE_GAME_SEASON], queryFn: () => getGameSchedule() });

  const codeById = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of drivers.data ?? []) m.set(d.driver_id, d.code ?? d.name);
    return m;
  }, [drivers.data]);

  // group reveal rows: user -> session -> [driver codes by pos]
  const byUser = useMemo(() => {
    const m = new Map<string, { username: string; sessions: Record<string, string[]> }>();
    for (const r of reveal.data ?? []) {
      const u = m.get(r.user_id) ?? { username: r.username ?? "—", sessions: {} };
      u.sessions[r.session_type] = u.sessions[r.session_type] ?? [];
      u.sessions[r.session_type][r.pos - 1] = codeById.get(r.driver_id) ?? r.driver_id;
      m.set(r.user_id, u);
    }
    return [...m.values()];
  }, [reveal.data, codeById]);

  const raceName = schedule.data?.find((r) => r.round === round)?.race_name ?? `Round ${round}`;

  return (
    <div className={pageShell}>
      <div className={cn("mx-auto w-full max-w-2xl", pageStack, "animate-fade-in")}>
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
          byUser.map((u) => (
            <F1Card key={u.username}>
              <F1CardHeader><F1CardTitle className="text-base">{u.username}</F1CardTitle></F1CardHeader>
              <F1CardContent className="flex flex-col gap-2 text-sm">
                {["Q", "S", "R"].filter((s) => u.sessions[s]).map((s) => (
                  <div key={s} className="flex flex-wrap items-center gap-1.5">
                    <span className="instrument-label w-14 text-muted-foreground">{SESSION_LABEL[s]}</span>
                    {u.sessions[s].map((code, i) => (
                      <span key={i} className="rounded bg-muted px-1.5 py-0.5 font-mono text-2xs">
                        {i + 1}.{code}
                      </span>
                    ))}
                  </div>
                ))}
              </F1CardContent>
            </F1Card>
          ))
        )}
      </div>
    </div>
  );
}
