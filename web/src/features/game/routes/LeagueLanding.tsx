import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Flag, ListOrdered, Gauge, ArrowRight } from "lucide-react";
import { pageShell, pageStack } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { useNextRace, useDriverStandings } from "@/hooks/f1";
import { getPublicLeaguePreview } from "../api/publicClient";
import { StartLights } from "../components/pitwall/StartLights";
import { TimingTower, type TimingRow } from "../components/pitwall/TimingTower";
import { RaceControlFeed } from "../components/pitwall/TeamRadio";

/**
 * Public "Pit Wall" landing for the F1 DataStop League — what guests see at
 * `/game` before they sign in. Real, anon-readable F1 data (next race + this
 * season's championship) drives the countdown and the timing tower, so the page
 * is live from the first visit. The game's own global-league preview swaps in
 * here once the anon leaderboard RPC ships (Phase 1b).
 */
export default function LeagueLanding() {
  const year = new Date().getFullYear();
  const { data: nextResp } = useNextRace(year);
  const { data: standingsResp } = useDriverStandings(year);

  const next = nextResp?.data as
    | { raceName?: string; round?: string; date?: string; time?: string; Circuit?: { Location?: { country?: string } } }
    | null
    | undefined;
  const deadline = next?.date
    ? `${next.date}T${next.time ?? "12:00:00Z"}`
    : null;

  const gridRows: TimingRow[] = ((standingsResp?.data as unknown[] | undefined) ?? [])
    .slice(0, 6)
    .map((row) => {
      const r = row as {
        position: string;
        points: string;
        Driver: { givenName: string; familyName: string };
        Constructors?: { name: string; constructorId: string }[];
      };
      const team = r.Constructors?.[0];
      return {
        pos: Number(r.position),
        name: `${r.Driver.givenName} ${r.Driver.familyName}`,
        sub: team?.name,
        points: r.points,
        teamColor: TEAM_COLORS[team?.constructorId ?? ""] ?? TEAM_COLORS.default,
      };
    });

  // Real global-league standings — shown once the tower has a few players,
  // otherwise the F1 championship stands in so the page is never empty.
  const { data: previewResp } = useQuery({
    queryKey: ["game", "public-preview", year],
    queryFn: () => getPublicLeaguePreview(year, 8),
    staleTime: 60 * 1000,
  });
  const previewRows: TimingRow[] = (previewResp ?? []).map((r) => ({
    pos: r.rank,
    name: r.username,
    sub: r.exact_hits ? `${r.exact_hits} exact hits` : undefined,
    points: Math.round(Number(r.total_points)),
    avatarUrl: r.avatar_url ?? undefined,
  }));
  const showGameTower = previewRows.length >= 3;

  const steps = [
    {
      icon: Flag,
      title: "Call the grid",
      body: "Predict the finishing order — top 10 for Qualifying and the Race, top 8 on Sprint weekends. One deadline per weekend: first lights.",
    },
    {
      icon: Gauge,
      title: "Score like F1",
      body: "Exact slot pays full F1 points (25-18-15…). Right driver, wrong slot pays half. Nail a WDC & WCC call for a season-end bonus.",
    },
    {
      icon: ListOrdered,
      title: "Climb the tower",
      body: "Every pick feeds your league's timing tower. Spin up private leagues, chase the global board, and carry it across seasons.",
    },
  ];

  return (
    <div className={pageShell}>
      <div className={cn("mx-auto w-full", pageStack, "animate-fade-in")}>
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section
          className="relative overflow-hidden rounded-xl border border-border"
          style={{ background: "linear-gradient(135deg, hsl(var(--background)), hsl(var(--muted)))" }}
        >
          {/* carbon weave + red brake-glow atmosphere */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, hsl(var(--foreground)) 0 1px, transparent 1px 6px)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-30 blur-3xl"
            style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)" }}
          />
          <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-10 lg:p-10">
            <div className="space-y-4">
              <div className="instrument-label flex items-center gap-1.5 text-primary">
                <Trophy className="h-3 w-3" />
                F1 DataStop League · Season {year}
              </div>
              <h1 className="font-heading text-3xl font-bold leading-[1.05] tracking-tight sm:text-4xl md:text-5xl">
                Predict the grid.
                <br />
                Beat the paddock.
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                A free, season-long F1 prediction game. Call every grid, get scored
                on real F1 points, and climb the timing tower against friends and the
                world. Sprints included.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  to="/auth/login"
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                >
                  Join the League
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex min-h-11 items-center rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  How it works
                </a>
              </div>
            </div>

            {/* Start-light gantry → next race */}
            <div className="flex flex-col items-center gap-2 lg:pl-6">
              <StartLights to={deadline} fallback="TBC" />
              {next?.raceName ? (
                <div className="text-center text-xs text-muted-foreground">
                  Next: <span className="font-semibold text-foreground">{next.raceName}</span>
                  {next.Circuit?.Location?.country ? ` · ${next.Circuit.Location.country}` : ""}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {/* ── Race Control (announcements) — self-hides when empty ─────────── */}
        <RaceControlFeed />

        {/* ── How it works ─────────────────────────────────────────────────── */}
        <section id="how-it-works" className="scroll-mt-20 space-y-3">
          <div className="instrument-label text-primary">How it works</div>
          <div className="grid gap-4 sm:grid-cols-3">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.title} className="rounded-lg border border-border bg-card/40 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="readout text-lg font-bold tabular-nums text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold">{s.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Live tower: real global-league standings once it fills, else the grid ── */}
        {showGameTower ? (
          <section className="space-y-3">
            <div className="instrument-label text-primary">Global League · top of the tower</div>
            <TimingTower rows={previewRows} title="Standings" unit="PTS" />
            <p className="text-xs text-muted-foreground">Sign in and make your picks to climb it.</p>
          </section>
        ) : gridRows.length > 0 ? (
          <section className="space-y-3">
            <div className="instrument-label text-primary">
              The {year} grid · who you'll be calling
            </div>
            <TimingTower rows={gridRows} title="Drivers' Championship" />
            <p className="text-xs text-muted-foreground">
              Sign in to make your first picks before the next deadline.
            </p>
          </section>
        ) : null}

        {/* ── Final CTA ────────────────────────────────────────────────────── */}
        <section className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card/40 px-6 py-8 text-center">
          <h2 className="font-heading text-xl font-bold tracking-tight sm:text-2xl">
            Lights out on your season.
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Free to play. No app to install. Just call the grid and climb.
          </p>
          <Link
            to="/auth/login"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Join the League
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </div>
    </div>
  );
}
