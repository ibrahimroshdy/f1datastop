import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Swords } from "lucide-react";
import { BackLink } from "@/components/ui/back-link";
import { F1Card, F1CardContent, F1Skeleton } from "@/components/f1";
import { pageShell, pageStack } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { getH2H, getLeagueStandings } from "../api/leaguesClient";

export default function H2H() {
  const { id, userId } = useParams<{ id: string; userId: string }>();
  const leagueId = id as string;
  const { user } = useAuth();
  const meId = user?.id as string;

  const standings = useQuery({ queryKey: ["game", "standings", leagueId], queryFn: () => getLeagueStandings(leagueId) });
  const h2h = useQuery({
    queryKey: ["game", "h2h", leagueId, meId, userId],
    queryFn: () => getH2H(leagueId, meId, userId as string),
    enabled: !!meId && !!userId,
  });

  const meName = standings.data?.find((r) => r.user_id === meId)?.username ?? "You";
  const themName = standings.data?.find((r) => r.user_id === userId)?.username ?? "Rival";

  const agg = useMemo(() => {
    let a = 0, b = 0, aWins = 0, bWins = 0;
    for (const r of h2h.data ?? []) {
      a += Number(r.a_points); b += Number(r.b_points);
      if (Number(r.a_points) > Number(r.b_points)) aWins++;
      else if (Number(r.b_points) > Number(r.a_points)) bWins++;
    }
    return { a, b, aWins, bWins };
  }, [h2h.data]);

  return (
    <div className={pageShell}>
      <div className={cn(pageStack, "animate-fade-in")}>
        <BackLink to={`/game/leagues/${leagueId}`}>League</BackLink>
        <div className="space-y-1.5">
          <div className="instrument-label flex items-center gap-1.5 text-primary">
            <Swords className="h-3 w-3" /> Head to head
          </div>
          <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">
            {meName} <span className="text-muted-foreground">vs</span> {themName}
          </h1>
        </div>

        {h2h.isLoading ? (
          <F1Skeleton variant="card" className="h-64" />
        ) : (
          <>
            {/* Aggregate — the duel */}
            <F1Card>
              <F1CardContent className="flex flex-col gap-3 py-5">
                <div className="grid grid-cols-3 items-center gap-2 text-center">
                  <div>
                    <div className={cn("readout text-2xl", agg.a >= agg.b ? "text-primary" : "text-muted-foreground")}>{agg.a}</div>
                    <div className="text-2xs text-muted-foreground">{agg.aWins} rounds won</div>
                  </div>
                  <div className="instrument-label text-muted-foreground">total pts</div>
                  <div>
                    <div className={cn("readout text-2xl", agg.b >= agg.a ? "text-primary" : "text-muted-foreground")}>{agg.b}</div>
                    <div className="text-2xs text-muted-foreground">{agg.bWins} rounds won</div>
                  </div>
                </div>
                {agg.aWins + agg.bWins > 0 && (
                  <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                    <div className="bg-primary transition-all" style={{ width: `${(agg.aWins / (agg.aWins + agg.bWins)) * 100}%` }} />
                    <div className="bg-muted-foreground/40 transition-all" style={{ width: `${(agg.bWins / (agg.aWins + agg.bWins)) * 100}%` }} />
                  </div>
                )}
              </F1CardContent>
            </F1Card>

            {/* Per-round */}
            <F1Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="instrument-label px-4 py-2 text-left text-[10px]">Round</th>
                      <th className="instrument-label px-3 py-2 text-right text-[10px]">{meName}</th>
                      <th className="instrument-label px-3 py-2 text-right text-[10px]">{themName}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {h2h.data?.map((r) => {
                      const aw = Number(r.a_points) > Number(r.b_points);
                      const bw = Number(r.b_points) > Number(r.a_points);
                      return (
                        <tr key={r.round} className="border-b border-border/60">
                          <td className="px-4 py-2 text-muted-foreground">R{r.round}</td>
                          <td className={cn("px-3 py-2 text-right tabular-nums", aw && "font-semibold text-primary")}>{Number(r.a_points)}</td>
                          <td className={cn("px-3 py-2 text-right tabular-nums", bw && "font-semibold text-primary")}>{Number(r.b_points)}</td>
                        </tr>
                      );
                    })}
                    {(h2h.data?.length ?? 0) === 0 && (
                      <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">No graded rounds to compare yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </F1Card>
          </>
        )}
      </div>
    </div>
  );
}
