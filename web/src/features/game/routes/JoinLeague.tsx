import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { F1Card, F1CardContent, F1Skeleton } from "@/components/f1";
import { pageShell, pageStack } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { useGameActivation } from "../hooks/useGameActivation";
import { getLeagueInvitePreview, joinLeagueByCode } from "../api/leaguesClient";

export default function JoinLeague() {
  const { code } = useParams<{ code: string }>();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { isActivated, activate, activating } = useGameActivation();

  const preview = useQuery({
    queryKey: ["game", "invitePreview", code],
    queryFn: () => getLeagueInvitePreview(code as string),
    enabled: !!code,
  });
  const join = useMutation({
    mutationFn: () => joinLeagueByCode(code as string),
    onSuccess: (id) => { qc.invalidateQueries({ queryKey: ["game", "myLeagues"] }); nav(`/game/leagues/${id}`); },
  });

  return (
    <div className={pageShell}>
      <div className={cn("mx-auto w-full max-w-xl", pageStack, "animate-fade-in")}>
        <div className="space-y-1.5">
          <div className="instrument-label flex items-center gap-1.5 text-primary">
            <Users className="h-3 w-3" /> League invite
          </div>
          <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">Join a league</h1>
        </div>

        {preview.isLoading ? (
          <F1Skeleton variant="card" className="h-32" />
        ) : !preview.data ? (
          <F1Card><F1CardContent className="py-6 text-sm text-muted-foreground">
            This invite code isn't valid. <Link to="/game/leagues" className="text-primary">Go to Leagues</Link>.
          </F1CardContent></F1Card>
        ) : (
          <F1Card>
            <F1CardContent className="flex flex-col items-start gap-3 py-6">
              <div>
                <div className="text-lg font-semibold">{preview.data.name}</div>
                <div className="text-2xs text-muted-foreground">{preview.data.member_count} members</div>
              </div>
              {!isActivated ? (
                <>
                  <p className="text-sm text-muted-foreground">Join the F1 League first, then hop into this league.</p>
                  <Button className="min-h-11" onClick={() => activate()} disabled={activating}>
                    {activating ? "Joining…" : "Join the F1 League"}
                  </Button>
                </>
              ) : (
                <Button className="min-h-11" onClick={() => join.mutate()} disabled={join.isPending}>
                  {join.isPending ? "Joining…" : `Join ${preview.data.name}`}
                </Button>
              )}
              {join.error ? <p className="text-xs text-destructive">{(join.error as Error).message}</p> : null}
            </F1CardContent>
          </F1Card>
        )}
      </div>
    </div>
  );
}
