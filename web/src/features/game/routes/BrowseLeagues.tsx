import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/ui/back-link";
import { F1Card, F1CardContent, F1Skeleton } from "@/components/f1";
import { pageShell, pageStack } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { listPublicLeagues, joinPublicLeague } from "../api/leaguesClient";
import { LeagueCrest } from "../components/pitwall/LeagueCrest";

export default function BrowseLeagues() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const leagues = useQuery({ queryKey: ["game", "publicLeagues"], queryFn: () => listPublicLeagues() });
  const join = useMutation({
    mutationFn: (id: string) => joinPublicLeague(id),
    onSuccess: (_d, id) => { qc.invalidateQueries({ queryKey: ["game", "myLeagues"] }); nav(`/game/leagues/${id}`); },
  });

  return (
    <div className={pageShell}>
      <div className={cn(pageStack, "animate-fade-in")}>
        <BackLink to="/game/leagues">Leagues</BackLink>
        <div className="space-y-1.5">
          <div className="instrument-label flex items-center gap-1.5 text-primary">
            <Globe className="h-3 w-3" /> Discover
          </div>
          <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">Public Leagues</h1>
        </div>

        {leagues.isLoading ? (
          <F1Skeleton variant="card" className="h-40" />
        ) : (leagues.data?.length ?? 0) === 0 ? (
          <F1Card><F1CardContent className="py-6 text-sm text-muted-foreground">
            No public leagues yet — create one from the Leagues page.
          </F1CardContent></F1Card>
        ) : (
          <F1Card className="overflow-hidden p-0">
            <ul className="divide-y divide-border">
              {leagues.data?.map((l) => (
                <li key={l.id} className="flex items-center gap-3 px-4 py-3">
                  <LeagueCrest league={{ id: l.id, name: l.name }} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{l.name}</div>
                    <div className="text-2xs text-muted-foreground">
                      {l.member_count} member{l.member_count === 1 ? "" : "s"}
                    </div>
                  </div>
                  <Button size="sm" className="min-h-11" disabled={join.isPending} onClick={() => join.mutate(l.id)}>
                    Join
                  </Button>
                </li>
              ))}
            </ul>
          </F1Card>
        )}
        {join.error ? <p className="text-xs text-destructive">{(join.error as Error).message}</p> : null}
      </div>
    </div>
  );
}
