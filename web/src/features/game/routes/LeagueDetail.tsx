import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Settings, Crown, ChevronRight } from "lucide-react";
import { BackLink } from "@/components/ui/back-link";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { F1Card, F1CardContent, F1CardHeader, F1CardTitle, F1Skeleton } from "@/components/f1";
import { pageShell, pageStack } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { ACTIVE_GAME_SEASON, getGameSeasons, getGameSchedule } from "../api/gameClient";
import {
  getLeague, getLeagueStandings, getLeagueMembers, getLeagueRoundAwards,
} from "../api/leaguesClient";

const MEDAL = ["text-yellow-500", "text-slate-300", "text-amber-600"];

export default function LeagueDetail() {
  const { id } = useParams<{ id: string }>();
  const leagueId = id as string;
  const { user } = useAuth();
  const [season, setSeason] = useState(ACTIVE_GAME_SEASON);

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

        {/* Season selector */}
        <div className="flex items-center gap-2">
          <span className="instrument-label text-muted-foreground">Season</span>
          <Select value={String(season)} onValueChange={(v) => setSeason(parseInt(v, 10))}>
            <SelectTrigger className="h-9 w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(seasons.data ?? [{ season: ACTIVE_GAME_SEASON, name: `${ACTIVE_GAME_SEASON}`, status: "active" }]).map((s) => (
                <SelectItem key={s.season} value={String(s.season)}>{s.season}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Standings */}
        {standings.isLoading ? (
          <F1Skeleton variant="card" className="h-64" />
        ) : (
          <F1Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="w-10 px-3 py-2">#</th>
                    <th className="px-3 py-2">Player</th>
                    <th className="px-3 py-2 text-right">Exact</th>
                    <th className="px-4 py-2 text-right">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.data?.map((row) => (
                    <tr key={row.user_id}
                      className={cn("border-b border-border/60", row.user_id === user?.id && "bg-primary/[0.06]")}>
                      <td className={cn("px-3 py-2 font-semibold tabular-nums",
                        row.rank <= 3 ? MEDAL[row.rank - 1] : "text-muted-foreground")}>
                        {row.rank}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-medium">{row.username ?? "—"}</span>
                        {row.champions_correct > 0 && <Crown className="ml-1 inline h-3 w-3 text-yellow-500" />}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{row.exact_hits}</td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums">{Number(row.total_points)}</td>
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
                  {v.goat && <span className="text-emerald-500">🐐 {v.goat}</span>}
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
