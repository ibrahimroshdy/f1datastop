import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Flag, ChevronRight, Lock, History, BookOpen, Users, Medal, UserCircle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { F1Card, F1CardContent, F1Skeleton } from "@/components/f1";
import { pageShell, pageStack } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useGameActivation } from "../hooks/useGameActivation";
import { isGameAdmin } from "../utils/isGameAdmin";
import { getGameSchedule, getMyTotal, ACTIVE_GAME_SEASON } from "../api/gameClient";

function QuickLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
    >
      {icon}
      {label}
    </Link>
  );
}

function ActivatedHub({ entryId }: { entryId: string }) {
  const { user } = useAuth();
  const schedule = useQuery({ queryKey: ["game", "schedule", ACTIVE_GAME_SEASON], queryFn: () => getGameSchedule() });
  const total = useQuery({ queryKey: ["game", "total", entryId], queryFn: () => getMyTotal(entryId), enabled: !!entryId });

  const nextOpen = schedule.data?.find((r) => !r.is_locked);

  return (
    <div className={cn(pageShell, pageStack, "animate-fade-in")}>
      <div className="space-y-1.5">
        <div className="instrument-label flex items-center gap-1.5 text-primary">
          <Trophy className="h-3 w-3" /> {ACTIVE_GAME_SEASON} F1 League
        </div>
        <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">Your F1 League</h1>
        {total.data && (
          <p className="text-sm text-muted-foreground">
            <span className="readout text-primary">{Number(total.data.total_points)}</span> points ·{" "}
            {total.data.exact_hits} exact hits
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <QuickLink to="/game/champions" icon={<Medal className="h-4 w-4 text-primary" />} label="Champions" />
        <QuickLink to="/game/leagues" icon={<Users className="h-4 w-4 text-primary" />} label="Leagues" />
        <QuickLink to="/game/history" icon={<History className="h-4 w-4 text-primary" />} label="History" />
        <QuickLink to="/game/profile" icon={<UserCircle className="h-4 w-4 text-primary" />} label="Profile" />
        <QuickLink to="/game/rules" icon={<BookOpen className="h-4 w-4 text-primary" />} label="Rules" />
        {isGameAdmin(user) && (
          <QuickLink to="/game/admin" icon={<ShieldAlert className="h-4 w-4 text-primary" />} label="Admin" />
        )}
      </div>

      {nextOpen && (
        <Link to={`/game/predict/${nextOpen.round}`}>
          <F1Card className="transition-colors hover:border-primary/50">
            <F1CardContent className="flex items-center justify-between gap-3 py-4">
              <div>
                <div className="instrument-label text-primary">Next up · Round {nextOpen.round}</div>
                <div className="text-base font-semibold">{nextOpen.race_name}</div>
                <div className="text-xs text-muted-foreground">Make your picks →</div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </F1CardContent>
          </F1Card>
        </Link>
      )}

      <div className="space-y-1.5">
        <div className="instrument-label text-muted-foreground">All rounds</div>
        {schedule.isLoading ? (
          <F1Skeleton variant="card" className="h-64" />
        ) : (
          <F1Card className="overflow-hidden p-0">
            <ul className="divide-y divide-border">
              {schedule.data?.map((r) => (
                <li key={r.round}>
                  <Link
                    to={`/game/predict/${r.round}`}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    <span className="timing w-8 shrink-0 text-xs font-semibold text-muted-foreground">
                      R{String(r.round).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {r.race_name}
                        {r.is_sprint && (
                          <span className="ml-1.5 text-2xs uppercase tracking-wide text-yellow-500">Sprint</span>
                        )}
                      </div>
                    </div>
                    {r.is_locked ? (
                      <span className="instrument-label inline-flex items-center gap-1 text-muted-foreground">
                        <Lock className="h-3 w-3" /> {r.has_results ? "Graded" : "Locked"}
                      </span>
                    ) : (
                      <span className="instrument-label text-primary">Open</span>
                    )}
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
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

export default function GameHub() {
  const { isActivated, isLoading, activate, activating, error, entryId } = useGameActivation();

  if (isLoading) {
    return (
      <div className={cn(pageShell, pageStack)}>
        <F1Skeleton variant="card" className="h-40" />
      </div>
    );
  }

  if (!isActivated || !entryId) {
    return (
      <div className={cn(pageShell, pageStack, "animate-fade-in")}>
        <div className="space-y-1.5">
          <div className="instrument-label flex items-center gap-1.5 text-primary">
            <Trophy className="h-3 w-3" /> Prediction Game
          </div>
          <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">Join the F1 League</h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            Predict qualifying &amp; race top-10s every weekend, pick your champions, and climb your
            league. Activate to start playing the {ACTIVE_GAME_SEASON} season.
          </p>
        </div>
        <F1Card>
          <F1CardContent className="flex flex-col items-start gap-3 py-6">
            <Button size="lg" className="min-h-11 gap-2" onClick={() => activate()} disabled={activating}>
              <Flag className="h-4 w-4" />
              {activating ? "Joining…" : "Join the F1 League"}
            </Button>
            {error ? <p className="text-xs text-destructive">{error.message}</p> : null}
          </F1CardContent>
        </F1Card>
      </div>
    );
  }

  return <ActivatedHub entryId={entryId} />;
}
