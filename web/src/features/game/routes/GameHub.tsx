import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Flag, ChevronRight, Lock, History, BookOpen, Users, Medal, UserCircle, ShieldAlert, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { F1Card, F1CardContent, F1CardHeader, F1CardTitle, F1Skeleton } from "@/components/f1";
import { pageShell, pageStack } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useGameActivation } from "../hooks/useGameActivation";
import { isGameAdmin } from "../utils/isGameAdmin";
import {
  getGameSchedule, getMyTotal, getGlobalPercentile, getPlayerBadges, getMyHistory, ACTIVE_GAME_SEASON,
} from "../api/gameClient";
import { Countdown } from "../components/Countdown";
import { BadgeRow } from "../components/BadgeRow";
import { FormSparkline } from "../components/FormSparkline";
import { JokerPicker } from "../components/JokerPicker";
import { RaceControlFeed } from "../components/pitwall/TeamRadio";
import { ShareCard } from "../components/pitwall/ShareCard";

const QUICK_NAV = [
  { to: "/game/leagues", icon: Users, label: "Leagues" },
  { to: "/game/champions", icon: Medal, label: "Champions" },
  { to: "/game/history", icon: History, label: "History" },
  { to: "/game/profile", icon: UserCircle, label: "Profile" },
  { to: "/game/rules", icon: BookOpen, label: "Rules" },
] as const;

function StatCell({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="px-3 py-3">
      <p className="instrument-label text-[10px]">{label}</p>
      <p className="readout mt-1.5 text-xl leading-none sm:text-2xl" style={accent ? { color: accent } : undefined}>
        {value}
      </p>
    </div>
  );
}

function ActivatedHub({ entryId }: { entryId: string }) {
  const { user } = useAuth();
  const uid = user?.id as string;
  const schedule = useQuery({ queryKey: ["game", "schedule", ACTIVE_GAME_SEASON], queryFn: () => getGameSchedule() });
  const total = useQuery({ queryKey: ["game", "total", entryId], queryFn: () => getMyTotal(entryId), enabled: !!entryId });
  const percentile = useQuery({ queryKey: ["game", "percentile", uid], queryFn: () => getGlobalPercentile(uid), enabled: !!uid });
  const badges = useQuery({ queryKey: ["game", "badges", uid], queryFn: () => getPlayerBadges(uid), enabled: !!uid });
  const history = useQuery({ queryKey: ["game", "history", entryId], queryFn: () => getMyHistory(entryId), enabled: !!entryId });

  // Per-round point totals (for the form line + the schedule scoreboard).
  const pointsByRound = useMemo(() => {
    const m = new Map<number, number>();
    for (const s of history.data ?? []) m.set(s.round, (m.get(s.round) ?? 0) + Number(s.points));
    return m;
  }, [history.data]);
  const form = useMemo(
    () => [...pointsByRound.entries()].sort((a, b) => a[0] - b[0]).slice(-6).map(([, v]) => v),
    [pointsByRound],
  );
  const bestRound = useMemo(() => Math.max(0, ...pointsByRound.values()), [pointsByRound]);

  const nextOpen = schedule.data?.find((r) => !r.is_locked);
  const points = Number(total.data?.total_points) || 0;
  const hits = Number(total.data?.exact_hits) || 0;

  return (
    <div className={cn(pageShell, pageStack, "animate-fade-in")}>
      {/* Race Control — announcements pinned to the top of the paddock */}
      <RaceControlFeed limit={3} />

      {/* Identity + live scoreboard */}
      <div className="space-y-3">
        <div className="space-y-1">
          <div className="instrument-label flex items-center gap-1.5 text-primary">
            <Trophy className="h-3 w-3" /> {ACTIVE_GAME_SEASON} F1 League
          </div>
          <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">Your F1 League</h1>
        </div>
        <div className="grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card/40 sm:grid-cols-4 sm:divide-y-0">
          <StatCell label="Points" value={<AnimatedNumber value={points} mono />} accent="hsl(var(--primary))" />
          <StatCell label="Rank" value={percentile.data != null ? <>Top {Math.round(Number(percentile.data))}%</> : "—"} />
          <StatCell label="Exact Hits" value={<AnimatedNumber value={hits} mono />} accent="hsl(var(--fastest-lap))" />
          <StatCell label="Best Round" value={<AnimatedNumber value={bestRound} mono />} />
        </div>
        <ShareCard
          seasonYear={ACTIVE_GAME_SEASON}
          points={points}
          exactHits={hits}
          percentile={percentile.data != null ? Math.round(Number(percentile.data)) : null}
        />
      </div>

      {/* Next race — the hero call to action */}
      {nextOpen && (
        <Link to={`/game/predict/${nextOpen.round}`} className="group block">
          <div className="relative overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/[0.16] via-primary/[0.05] to-transparent p-4 transition-shadow hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.35)]">
            <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
            <div className="instrument-label flex items-center gap-1.5 text-primary">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-live-pulse rounded-full bg-primary/60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              Next up · Round {nextOpen.round}{nextOpen.is_sprint ? " · Sprint" : ""}
            </div>
            <div className="mt-1.5 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="font-heading text-xl font-bold tracking-tight md:text-2xl">{nextOpen.race_name}</div>
                {nextOpen.deadline && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Locks in <Countdown to={nextOpen.deadline} className="readout font-semibold text-primary" />
                  </div>
                )}
              </div>
              <Button className="min-h-11 shrink-0 gap-1.5">
                <Flag className="h-4 w-4" /> Make picks
              </Button>
            </div>
          </div>
        </Link>
      )}

      {/* Form + badges + joker */}
      <div className="grid gap-3 lg:grid-cols-2">
        <F1Card>
          <F1CardHeader className="flex-row items-center justify-between pb-2">
            <F1CardTitle className="text-base">Your form</F1CardTitle>
            {percentile.data != null && (
              <span className="instrument-label inline-flex items-center gap-1 text-primary">
                <TrendingUp className="h-3 w-3" /> Top {Math.round(Number(percentile.data))}%
              </span>
            )}
          </F1CardHeader>
          <F1CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="instrument-label text-muted-foreground">Last {form.length || 0} rounds</span>
              {form.length >= 2 ? <FormSparkline points={form} /> : <span className="text-2xs text-muted-foreground">—</span>}
            </div>
            <BadgeRow badges={badges.data ?? []} />
          </F1CardContent>
        </F1Card>
        <JokerPicker />
      </div>

      {/* Quick nav */}
      <nav className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {QUICK_NAV.map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            className="flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-card/40 text-2xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:border-primary/30 hover:bg-accent hover:text-foreground"
          >
            <Icon className="h-4 w-4 text-primary" />
            {label}
          </Link>
        ))}
        {isGameAdmin(user) && (
          <Link
            to="/game/admin"
            className="flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-card/40 text-2xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:border-primary/30 hover:bg-accent hover:text-foreground"
          >
            <ShieldAlert className="h-4 w-4 text-primary" /> Admin
          </Link>
        )}
      </nav>

      {/* All rounds — with your score */}
      <div className="space-y-1.5">
        <div className="instrument-label text-muted-foreground">Season · all rounds</div>
        {schedule.isLoading ? (
          <F1Skeleton variant="card" className="h-64" />
        ) : (
          <F1Card className="overflow-hidden p-0">
            <ul className="divide-y divide-border/70">
              {schedule.data?.map((r) => {
                const scored = r.has_results ? pointsByRound.get(r.round) : undefined;
                return (
                  <li key={r.round}>
                    <Link
                      to={`/game/predict/${r.round}`}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40",
                        !r.is_locked && "bg-primary/[0.04]",
                      )}
                    >
                      <span className="timing w-8 shrink-0 text-xs font-semibold text-muted-foreground">
                        R{String(r.round).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {r.race_name}
                          {r.is_sprint && (
                            <span className="ml-1.5 text-2xs uppercase tracking-wide text-fastest-lap">Sprint</span>
                          )}
                        </div>
                      </div>
                      {scored != null ? (
                        <span className="readout text-sm font-bold text-primary">
                          +{scored}
                        </span>
                      ) : r.is_locked ? (
                        <span className="instrument-label inline-flex items-center gap-1 text-muted-foreground">
                          <Lock className="h-3 w-3" /> Locked
                        </span>
                      ) : (
                        <span className="instrument-label rounded-full bg-primary/10 px-2 py-0.5 text-primary">Open</span>
                      )}
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                );
              })}
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
