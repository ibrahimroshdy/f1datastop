import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Globe, Lock, ChevronRight, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BackLink } from "@/components/ui/back-link";
import { F1Card, F1CardContent, F1CardHeader, F1CardTitle, F1Skeleton, PageHeader } from "@/components/f1";
import { pageShell, pageStack } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { getMyLeagues, createLeague, joinLeagueByCode } from "../api/leaguesClient";
import { LeagueCrest } from "../components/pitwall/LeagueCrest";
import { medalBadge } from "../utils/medal";

export default function Leagues() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const leagues = useQuery({ queryKey: ["game", "myLeagues"], queryFn: () => getMyLeagues() });

  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [code, setCode] = useState("");

  const create = useMutation({
    mutationFn: () => createLeague(name.trim(), isPublic),
    onSuccess: (id) => { qc.invalidateQueries({ queryKey: ["game", "myLeagues"] }); nav(`/game/leagues/${id}`); },
  });
  const join = useMutation({
    mutationFn: () => joinLeagueByCode(code.trim()),
    onSuccess: (id) => { qc.invalidateQueries({ queryKey: ["game", "myLeagues"] }); nav(`/game/leagues/${id}`); },
  });

  return (
    <div className={pageShell}>
      <div className={cn(pageStack, "animate-fade-in")}>
        <BackLink to="/game">Predictions</BackLink>
        <PageHeader
          eyebrow="Leagues"
          title="Your Leagues"
          actions={
            <Link to="/game/leagues/browse">
              <Button variant="outline" className="min-h-11 gap-1.5"><Search className="h-4 w-4" /> Browse</Button>
            </Link>
          }
        />

        {leagues.isLoading ? (
          <F1Skeleton variant="card" className="h-40" />
        ) : (
          <F1Card className="overflow-hidden p-0">
            <ul className="divide-y divide-border">
              {leagues.data?.map((l) => (
                <li key={l.league_id}>
                  <Link to={`/game/leagues/${l.league_id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
                    <LeagueCrest league={{ id: l.league_id, name: l.name }} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold">{l.name}</span>
                        {l.role === "captain" && <Crown className="h-3.5 w-3.5 text-position-gold" />}
                        {l.slug === "global" ? <Globe className="h-3 w-3 text-muted-foreground" />
                          : l.is_public ? <Globe className="h-3 w-3 text-muted-foreground" />
                          : <Lock className="h-3 w-3 text-muted-foreground" />}
                      </div>
                      <div className="text-2xs text-muted-foreground">
                        {l.member_count} member{l.member_count === 1 ? "" : "s"} · {Number(l.my_points)} pts
                      </div>
                    </div>
                    {l.my_rank ? (
                      <span className={cn("inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full border px-1.5 text-xs font-bold tabular-nums", medalBadge(l.my_rank))}>
                        P{l.my_rank}
                      </span>
                    ) : null}
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </F1Card>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <F1Card>
            <F1CardHeader><F1CardTitle className="text-base">Create a league</F1CardTitle></F1CardHeader>
            <F1CardContent className="flex flex-col gap-2">
              <Input placeholder="League name" value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
                Public (anyone can discover &amp; join)
              </label>
              <Button className="min-h-11 gap-1.5" disabled={name.trim().length < 2 || create.isPending}
                onClick={() => create.mutate()}>
                <Plus className="h-4 w-4" /> {create.isPending ? "Creating…" : "Create league"}
              </Button>
              {create.error ? <p className="text-xs text-destructive">{(create.error as Error).message}</p> : null}
            </F1CardContent>
          </F1Card>

          <F1Card>
            <F1CardHeader><F1CardTitle className="text-base">Join with a code</F1CardTitle></F1CardHeader>
            <F1CardContent className="flex flex-col gap-2">
              <Input placeholder="INVITE CODE" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="h-11 font-mono uppercase" />
              <Button variant="outline" className="min-h-11" disabled={code.trim().length < 4 || join.isPending}
                onClick={() => join.mutate()}>
                {join.isPending ? "Joining…" : "Join league"}
              </Button>
              {join.error ? <p className="text-xs text-destructive">{(join.error as Error).message}</p> : null}
            </F1CardContent>
          </F1Card>
        </div>
      </div>
    </div>
  );
}
