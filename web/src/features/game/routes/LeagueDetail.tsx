import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Settings, Crown, ChevronRight, ChevronUp, ChevronDown, Minus, Swords } from "lucide-react";
import { BackLink } from "@/components/ui/back-link";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { F1Card, F1CardContent, F1CardHeader, F1CardTitle, F1Skeleton } from "@/components/f1";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { pageShell, pageStack } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { ACTIVE_GAME_SEASON, getGameSeasons, getGameSchedule } from "../api/gameClient";
import {
  getLeague, getLeagueStandings, getLeagueMembers, getLeagueRoundAwards, getLeagueAlltime,
  getLeagueStats, getLeagueRankHistory,
} from "../api/leaguesClient";
import { Podium } from "../components/Podium";
import { RankChart } from "../components/RankChart";
import { medalBadge } from "../utils/medal";

const RANK_PILL = "inline-flex h-7 min-w-7 items-center justify-center rounded-full border px-1.5 text-xs font-semibold tabular-nums";

function Movement({ n }: { n: number }) {
  if (!n) return <Minus className="h-3 w-3 text-muted-foreground/40" aria-label="no change" />;
  const up = n > 0;
  return (
    <span className={cn("inline-flex items-center text-2xs font-semibold tabular-nums", up ? "text-gain" : "text-destructive")}>
      {up ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      {Math.abs(n)}
    </span>
  );
}

export default function LeagueDetail() {
  const { id } = useParams<{ id: string }>();
  const leagueId = id as string;
  const { user } = useAuth();
  const [season, setSeason] = useState(ACTIVE_GAME_SEASON);
  const [view, setView] = useState<"season" | "alltime">("season");

  const seasons = useQuery({ queryKey: ["game", "seasons"], queryFn: () => getGameSeasons() });
  const league = useQuery({ queryKey: ["game", "league", leagueId], queryFn: () => getLeague(leagueId) });
  const members = useQuery({ queryKey: ["game", "leagueMembers", leagueId], queryFn: () => getLeagueMembers(leagueId) });
  const standings = useQuery({
    queryKey: ["game", "standings", leagueId, season],
    queryFn: () => getLeagueStandings(leagueId, season),
  });
  const awards = useQuery({
    queryKey: ["game", "awards", leagueId, season],
    queryFn: () => getLeagueRoundAwards(leagueId, season),
  });
  const schedule = useQuery({ queryKey: ["game", "schedule", season], queryFn: () => getGameSchedule(season) });
  const stats = useQuery({ queryKey: ["game", "leagueStats", leagueId, season], queryFn: () => getLeagueStats(leagueId, season) });
  const history = useQuery({ queryKey: ["game", "rankHistory", leagueId, season], queryFn: () => getLeagueRankHistory(leagueId, season) });
  const alltime = useQuery({
    queryKey: ["game", "alltime", leagueId],
    queryFn: () => getLeagueAlltime(leagueId),
    enabled: view === "alltime",
  });

  const iAmCaptain = members.data?.some((m) => m.user_id === user?.id && m.role === "captain");
  const gradedRounds = schedule.data?.filter((r) => r.has_results) ?? [];

  return (
    <div className={pageShell}>
      <div className={cn("mx-auto w-full max-w-2xl", pageStack, "animate-fade-in")}>
        <BackLink to="/game/leagues">Leagues</BackLink>

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1.5">
            <div className="instrument-label text-primary">League</div>
            <h1 className="truncate font-heading text-2xl font-bold tracking-tight md:text-3xl">
              {league.data?.name ?? "League"}
            </h1>
            <div className="text-2xs text-muted-foreground">
              {members.data?.length ?? "…"} members · {league.data?.is_public ? "Public" : "Private"}
            </div>
          </div>
          {iAmCaptain && (
            <Link to={`/game/leagues/${leagueId}/manage`}>
              <Button variant="outline" size="sm" className="min-h-11 gap-1.5"><Settings className="h-4 w-4" /> Manage</Button>
            </Link>
          )}
        </div>

        {/* Season selector + view toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg border border-border bg-card/40 p-1">
            <button onClick={() => setView("season")}
              className={cn("min-h-9 rounded-md px-3 py-1 text-xs font-medium", view === "season" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
              Season
            </button>
            <button onClick={() => setView("alltime")}
              className={cn("min-h-9 rounded-md px-3 py-1 text-xs font-medium", view === "alltime" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
              All-time
            </button>
          </div>
          {view === "season" && (
            <Select value={String(season)} onValueChange={(v) => setSeason(parseInt(v, 10))}>
              <SelectTrigger className="h-9 w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(seasons.data ?? [{ season: ACTIVE_GAME_SEASON, name: `${ACTIVE_GAME_SEASON}`, status: "active" }]).map((s) => (
                  <SelectItem key={s.season} value={String(s.season)}>{s.season}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Podium (season view) */}
        {view === "season" && (standings.data?.length ?? 0) > 0 && (
          <Podium rows={standings.data!} meId={user?.id} />
        )}

        {/* All-time standings */}
        {view === "alltime" ? (
          alltime.isLoading ? (
            <F1Skeleton variant="card" className="h-64" />
          ) : (
            <F1Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="w-10 px-3 py-2">#</th>
                      <th className="px-3 py-2">Player</th>
                      <th className="px-3 py-2 text-right">Seasons</th>
                      <th className="px-4 py-2 text-right">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alltime.data?.map((row) => (
                      <tr key={row.user_id} className={cn("border-b border-border/60", row.user_id === user?.id && "bg-primary/[0.06]")}>
                        <td className="px-3 py-2"><span className={cn(RANK_PILL, medalBadge(row.rank))}>{row.rank}</span></td>
                        <td className="px-3 py-2 font-medium">{row.username ?? "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{row.seasons_played}</td>
                        <td className="px-4 py-2 text-right font-semibold tabular-nums"><AnimatedNumber value={Number(row.total_points) || 0} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </F1Card>
          )
        ) : standings.isLoading ? (
          <F1Skeleton variant="card" className="h-64" />
        ) : (
          <F1Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="instrument-label w-10 px-3 py-2 text-left text-[10px]">#</th>
                    <th className="instrument-label px-3 py-2 text-left text-[10px]">Player</th>
                    <th className="instrument-label px-3 py-2 text-right text-[10px]">Exact</th>
                    <th className="instrument-label px-4 py-2 text-right text-[10px]">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.data?.map((row) => {
                    const isMe = row.user_id === user?.id;
                    return (
                      <tr key={row.user_id}
                        className={cn("border-b border-border/60 transition-colors", isMe ? "bg-primary/[0.08]" : "hover:bg-muted/30")}>
                        <td className={cn("px-3 py-2", isMe && "border-l-2 border-l-primary")}>
                          <div className="flex items-center gap-1.5">
                            <span className={cn(RANK_PILL, medalBadge(row.rank))}>{row.rank}</span>
                            <Movement n={row.movement} />
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <span className="font-medium">{row.username ?? "—"}</span>
                          {isMe && <span className="ml-1.5 rounded bg-primary/15 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-primary">You</span>}
                          {row.champions_correct > 0 && <Crown className="ml-1 inline h-3 w-3 text-position-gold" />}
                          {!isMe && (
                            <Link to={`/game/leagues/${leagueId}/h2h/${row.user_id}`}
                              className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/60 hover:bg-muted hover:text-primary"
                              aria-label={`Head to head vs ${row.username ?? "player"}`}>
                              <Swords className="h-3.5 w-3.5" />
                            </Link>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{row.exact_hits}</td>
                        <td className="px-4 py-2 text-right">
                          <AnimatedNumber value={Number(row.total_points) || 0} mono className="readout font-bold text-primary" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </F1Card>
        )}

        {/* Rank movement chart */}
        {view === "season" && (history.data?.length ?? 0) > 0 && (
          <F1Card>
            <F1CardHeader><F1CardTitle className="text-base">Rank movement</F1CardTitle></F1CardHeader>
            <F1CardContent><RankChart rows={history.data!} meId={user?.id} /></F1CardContent>
          </F1Card>
        )}

        {/* Player stats */}
        {view === "season" && (stats.data?.length ?? 0) > 0 && (
          <F1Card className="overflow-hidden p-0">
            <F1CardHeader className="px-4 pt-3"><F1CardTitle className="text-base">Player stats</F1CardTitle></F1CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2">Player</th>
                    <th className="px-3 py-2 text-right">Rds</th>
                    <th className="px-3 py-2 text-right">Avg</th>
                    <th className="px-3 py-2 text-right">Best</th>
                    <th className="px-4 py-2 text-right">Exact</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.data?.map((s) => (
                    <tr key={s.user_id} className={cn("border-b border-border/60", s.user_id === user?.id && "bg-primary/[0.06]")}>
                      <td className="px-4 py-2 font-medium">{s.username ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{s.rounds_played}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{Number(s.avg_round)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{Number(s.best_round)}</td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums">{s.exact_hits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </F1Card>
        )}

        {/* Per-race GOAT / flop */}
        {(awards.data?.length ?? 0) > 0 && (
          <F1Card>
            <F1CardHeader><F1CardTitle className="text-base">Race GOAT &amp; Flop</F1CardTitle></F1CardHeader>
            <F1CardContent className="flex flex-col gap-1.5 text-sm">
              {Object.entries(
                (awards.data ?? []).reduce<Record<number, { goat?: string; flop?: string }>>((acc, a) => {
                  acc[a.round] = acc[a.round] ?? {};
                  if (a.is_goat) acc[a.round].goat = a.username ?? "—";
                  if (a.is_flop) acc[a.round].flop = a.username ?? "—";
                  return acc;
                }, {}),
              ).map(([round, v]) => (
                <div key={round} className="flex items-center gap-2 text-xs">
                  <span className="timing w-8 text-muted-foreground">R{round}</span>
                  {v.goat && <span className="text-gain">🐐 {v.goat}</span>}
                  {v.flop && <span className="text-muted-foreground">🥶 {v.flop}</span>}
                </div>
              ))}
            </F1CardContent>
          </F1Card>
        )}

        {/* Reveal picks per graded round */}
        {gradedRounds.length > 0 && (
          <F1Card className="overflow-hidden p-0">
            <F1CardHeader className="px-4 pt-3"><F1CardTitle className="text-base">Reveal picks</F1CardTitle></F1CardHeader>
            <ul className="divide-y divide-border">
              {gradedRounds.map((r) => (
                <li key={r.round}>
                  <Link to={`/game/leagues/${leagueId}/round/${r.round}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40">
                    <span className="timing w-8 text-xs font-semibold text-muted-foreground">R{r.round}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{r.race_name}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </F1Card>
        )}
      </div>
    </div>
  );
}
