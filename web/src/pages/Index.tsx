import { useDriverStandings, useConstructorStandings, useRaceSchedule, useLastRaceResults, useLastRacePitStops } from "@/hooks/useF1Data";
import { useEffect, useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { getTeamColor } from "@/utils/teamUtils";
import { pageShell, pageStack } from "@/lib/layout";
import LastRaceResultsCard from "@/components/dashboard/LastRaceResultsCard";
import FastestPitStopCard from "@/components/dashboard/FastestPitStopCard";
import QualifyingResultsCard from "@/components/dashboard/QualifyingResultsCard";
import MuiSankeyChart from "@/components/analytics/MuiSankeyChart";
import RaceDetailDialog from "@/components/calendar/RaceDetailDialog";
import { useTheme } from "@/context/ThemeContext";
import {
  F1Card,
  F1CardContent,
  F1CardDescription,
  F1CardHeader,
  F1CardTitle,
} from "@/components/f1";
import { DriverAvatar } from "@/components/f1";
import { GitCompare, Activity, Calendar, Clock, ChevronRight, Flag as FlagIcon, TriangleAlert } from "lucide-react";
import ReactCountryFlag from "react-country-flag";
import CountryFlag, { getCountryCode } from "@/components/common/CountryFlag";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import { getNextSession } from "@/utils/nextSessionUtils";
import { cn } from "@/lib/utils";
import { F1Skeleton } from "@/components/f1";
import { F1EmptyState } from "@/components/f1/F1EmptyState";

import useAnalytics from '@/hooks/useAnalytics';
import useClarity from '@/hooks/useClarity';

type IndexScheduleRace = {
  date: string;
  time?: string;
  season: string;
  round: string;
  raceName: string;
  Circuit?: { Location?: { country?: string; locality?: string } };
  [key: string]: unknown;
};

type DriverStanding = {
  position?: string;
  points?: string;
  Driver?: { driverId?: string; givenName?: string; familyName?: string; code?: string };
  Constructors?: Array<{ constructorId?: string; name?: string }>;
};

const Index = () => {
  const {
    data: driverStandings,
    isLoading: isDriversLoading
  } = useDriverStandings();
  const {
    data: constructorStandings,
    isLoading: isConstructorsLoading
  } = useConstructorStandings();
  const {
    data: raceSchedule,
    isLoading: isScheduleLoading
  } = useRaceSchedule();
  const {
    data: lastRaceResults,
    isLoading: isResultsLoading
  } = useLastRaceResults();
  const {
    data: _lastRacePitStops,
    isLoading: isPitStopsLoading
  } = useLastRacePitStops();

  const { isGlass } = useTheme();
  const isLoading = isDriversLoading || isConstructorsLoading || isScheduleLoading || isResultsLoading || isPitStopsLoading;
  const [isOffline, setIsOffline] = useState(false);
  const [isSankeyDialogOpen, setIsSankeyDialogOpen] = useState(false);
  const [isNextRaceDialogOpen, setIsNextRaceDialogOpen] = useState(false);

  const analytics = useAnalytics();
  const clarity = useClarity();

  // Check if season is complete
  const isSeasonComplete = useMemo(() => {
    if (!raceSchedule?.data) return false;
    const now = new Date();
    const completedRaces = raceSchedule.data.filter(
      (race: IndexScheduleRace) => new Date(race.date) < now
    );
    return completedRaces.length === raceSchedule.data.length && completedRaces.length > 0;
  }, [raceSchedule?.data]);

  // Get last completed race info
  const lastCompletedRace = useMemo(() => {
    if (!raceSchedule?.data) return null;
    const races = raceSchedule.data;
    const now = new Date();
    const completedRaces = races.filter((race: IndexScheduleRace) => new Date(race.date) < now);
    if (completedRaces.length === 0) return null;
    const lastRace = completedRaces[completedRaces.length - 1];
    return {
      year: parseInt(lastRace.season),
      round: lastRace.round,
      raceName: getRaceNameWithoutEmoji(lastRace.raceName),
      country: lastRace.Circuit?.Location?.country || "",
      countryCode: getCountryCode(lastRace.Circuit?.Location?.country || "") || "",
      raceData: lastRace, // Full race data for the dialog
    };
  }, [raceSchedule?.data]);

  useEffect(() => {
    // Only show offline warning for critical API failures (standings and schedule)
    // Don't show offline for "no data" scenarios like early season with no completed races
    const hasCriticalError =
      (driverStandings?.error && !driverStandings?.data) ||
      (constructorStandings?.error && !constructorStandings?.data) ||
      (raceSchedule?.error && !raceSchedule?.data);

    setIsOffline(Boolean(hasCriticalError));
  }, [driverStandings, constructorStandings, raceSchedule]);

  useEffect(() => {
    analytics.trackContentView(
      'homepage',
      'page',
      'F1 DataStop Homepage',
      { sponsor_visible: true }
    );

    clarity.setTag('page_type', 'homepage');
    clarity.setTag('page_version', 'v2');
  }, [analytics, clarity]);

  const nextRace = raceSchedule?.data?.find((race: { date: string; time?: string }) => {
    const raceDate = new Date(race.date + "T" + (race.time || "00:00:00Z"));
    return raceDate > new Date();
  });

  // Season telemetry: round progress + championship leaders for the status pills
  const seasonStats = useMemo(() => {
    const races = (raceSchedule?.data ?? []) as IndexScheduleRace[];
    const totalRounds = races.length;
    const now = new Date();
    const completedRounds = races.filter((race) => new Date(race.date) < now).length;
    return { totalRounds, completedRounds };
  }, [raceSchedule?.data]);

  // Top drivers for the championship mini-list (dense app rows)
  const topDrivers = useMemo(
    () => ((driverStandings?.data ?? []) as DriverStanding[]).slice(0, 5),
    [driverStandings?.data]
  );

  // Upcoming races for the "Next races" list
  const upcomingRaces = useMemo(() => {
    const races = (raceSchedule?.data ?? []) as IndexScheduleRace[];
    const now = new Date();
    return races
      .filter((race) => new Date(race.date + "T" + (race.time || "00:00:00Z")) > now)
      .slice(0, 5);
  }, [raceSchedule?.data]);

  return (
    <div className={pageShell}>
      <div className={cn("mx-auto w-full max-w-6xl", pageStack, "animate-fade-in")}>
        {/* ── Greeting block (compact, app-style — NOT a big hero) ───────── */}
        <GreetingBlock
          seasonStats={seasonStats}
          isSeasonComplete={isSeasonComplete}
          isOffline={isOffline}
        />

        {/* ── Next session status card (compact, tappable → race dialog) ── */}
        <NextSessionCard
          nextRace={nextRace}
          isSeasonComplete={isSeasonComplete}
          onOpenNextRace={() => setIsNextRaceDialogOpen(true)}
        />

        {isLoading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* ── Dense app-list row: Championship + Next races ─────────── */}
            <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
              <ChampionshipMiniList drivers={topDrivers} />
              <NextRacesList races={upcomingRaces} isSeasonComplete={isSeasonComplete} />
            </div>

            {/* ── Qualifying → Race Progression (full width) ─────────────── */}
            <SectionLabel icon={<Activity className="h-3 w-3" />}>
              Race Progression Scope
            </SectionLabel>
            <F1Card
              variant={isGlass ? "glass" : "default"}
              glassVariant={isGlass ? "panel" : "default"}
              className="scope-frame border-border p-0"
            >
              <F1CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <F1CardTitle
                      icon={<GitCompare className="h-5 w-5 text-primary" />}
                      className="text-lg md:text-xl"
                    >
                      Qualifying to Race Progression
                    </F1CardTitle>
                    <F1CardDescription>
                      How drivers progressed from qualifying to race positions
                    </F1CardDescription>
                  </div>
                  {lastCompletedRace && (
                    <button
                      onClick={() => setIsSankeyDialogOpen(true)}
                      className="shrink-0 rounded-md border timing text-xs font-medium uppercase tracking-wide border-border bg-secondary/50 text-secondary-foreground hover:bg-secondary flex items-center gap-1.5 py-1 px-2 cursor-pointer hover:border-primary/50 transition-all"
                    >
                      <ReactCountryFlag
                        countryCode={lastCompletedRace.countryCode}
                        svg
                        style={{ width: "14px", height: "auto" }}
                        title={lastCompletedRace.country}
                      />
                      <span>{lastCompletedRace.raceName}</span>
                    </button>
                  )}
                </div>
              </F1CardHeader>
              <F1CardContent className="p-0 h-[550px]">
                {lastCompletedRace ? (
                  <MuiSankeyChart
                    year={lastCompletedRace.year}
                    round={lastCompletedRace.round}
                  />
                ) : (
                  <F1EmptyState
                    type="season-start"
                    title="Season Starting Soon"
                    description="Qualifying to race progression will appear here once the first race is completed."
                    size="md"
                  />
                )}
              </F1CardContent>
            </F1Card>

            {/* ── Last race readouts ────────────────────────────────────── */}
            <SectionLabel icon={<FlagIcon className="h-3 w-3" />}>
              Last Race Readouts
            </SectionLabel>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              <QualifyingResultsCard />
              <LastRaceResultsCard
                lastRaceResults={lastRaceResults}
                isResultsLoading={isResultsLoading}
                getTeamColor={getTeamColor}
              />
              <FastestPitStopCard />
            </div>
          </>
        )}
      </div>

      {/* Race Detail Dialog for Sankey Chart */}
      {lastCompletedRace?.raceData && (
        <RaceDetailDialog
          isOpen={isSankeyDialogOpen}
          onClose={() => setIsSankeyDialogOpen(false)}
          race={lastCompletedRace.raceData}
        />
      )}

      {/* Race Detail Dialog for the next race */}
      {nextRace && (
        <RaceDetailDialog
          isOpen={isNextRaceDialogOpen}
          onClose={() => setIsNextRaceDialogOpen(false)}
          race={nextRace}
        />
      )}
    </div>
  );
};

// ── Instrument section eyebrow ──────────────────────────────────────────────
const SectionLabel = ({
  icon,
  children,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="instrument-label -mb-2 flex items-center gap-1.5 text-primary">
    {icon}
    <span>{children}</span>
  </div>
);

// ── Status pill (live dot / round / status) ─────────────────────────────────
const StatusPill = ({
  children,
  live,
  tone = "muted",
}: {
  children: React.ReactNode;
  live?: boolean;
  tone?: "muted" | "primary" | "warning";
}) => (
  <span
    className={cn(
      "inline-flex w-fit items-center gap-1.5 rounded-md border px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide",
      tone === "primary" && "border-primary/40 bg-primary/10 text-primary",
      tone === "warning" && "border-position-gold/40 bg-position-gold/10 text-position-gold",
      tone === "muted" && "border-border bg-secondary/50 text-secondary-foreground"
    )}
  >
    {live && (
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-primary/60 animate-live-pulse" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
      </span>
    )}
    {children}
  </span>
);

// ── Compact greeting block — the native-app front door (no big hero) ─────────
const GreetingBlock = ({
  seasonStats,
  isSeasonComplete,
  isOffline,
}: {
  seasonStats: { totalRounds: number; completedRounds: number };
  isSeasonComplete: boolean;
  isOffline: boolean;
}) => {
  const currentYear = new Date().getFullYear();
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        <div className="instrument-label flex items-center gap-1.5 text-primary">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-primary/60 animate-live-pulse" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <span>Live · Season {currentYear}</span>
        </div>
        <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">
          Formula 1<span className="text-primary"> Pit Wall</span>
        </h1>
      </div>

      <div className="flex w-fit flex-wrap items-center gap-1.5">
        <StatusPill tone="primary">
          Round{" "}
          <span className="timing">
            {seasonStats.totalRounds
              ? `${seasonStats.completedRounds}/${seasonStats.totalRounds}`
              : "—"}
          </span>
        </StatusPill>
        <StatusPill tone={isSeasonComplete ? "muted" : "muted"}>
          {isSeasonComplete ? "Complete" : "In Progress"}
        </StatusPill>
        {isOffline && (
          <StatusPill tone="warning">
            <TriangleAlert className="h-3 w-3" />
            Cached
          </StatusPill>
        )}
      </div>
    </div>
  );
};

// ── Compact "next session" status card — tappable → existing race dialog ─────
const NextSessionCard = ({
  nextRace,
  isSeasonComplete,
  onOpenNextRace,
}: {
  nextRace: IndexScheduleRace | undefined;
  isSeasonComplete: boolean;
  onOpenNextRace: () => void;
}) => {
  const { session: nextSession, raceName, country } = useMemo(
    () => getNextSession(nextRace),
    [nextRace]
  );

  const sessionDate = useMemo(() => {
    if (!nextSession) return null;
    return new Date(nextSession.date + "T" + (nextSession.time || "00:00:00Z"));
  }, [nextSession]);

  const calculateTimeLeft = useCallback(() => {
    if (!sessionDate) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    const diff = sessionDate.getTime() - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / (1000 * 60)) % 60),
      seconds: Math.floor((diff / 1000) % 60),
    };
  }, [sessionDate]);

  const [countdown, setCountdown] = useState(calculateTimeLeft);

  useEffect(() => {
    if (!sessionDate) return;
    setCountdown(calculateTimeLeft());
    const timer = setInterval(() => setCountdown(calculateTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, [sessionDate, calculateTimeLeft]);

  const isUrgent = countdown.days < 3;
  const isImminent = countdown.days === 0 && countdown.hours < 6;
  const pad = (n: number) => String(n).padStart(2, "0");

  if (!nextRace || !nextSession || !sessionDate) {
    return (
      <F1Card size="sm" className="p-3">
        <div className="instrument-label mb-1 flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          Next Session
        </div>
        <p className="timing text-sm text-muted-foreground">
          {isSeasonComplete ? "Season complete" : "Schedule pending"}
        </p>
      </F1Card>
    );
  }

  return (
    <F1Card
      size="sm"
      interactive
      onClick={onOpenNextRace}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenNextRace();
        }
      }}
      aria-label={`Next session: ${getRaceNameWithoutEmoji(raceName)} ${nextSession.shortName}. Open race details.`}
      className={cn(
        "group cursor-pointer p-3 transition-all hover:border-primary/40",
        isImminent && "border-primary/50"
      )}
    >
      <div className="instrument-label mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          Next Session
        </span>
        <span
          className={cn(
            "timing rounded px-1.5 py-0.5 text-xs",
            isImminent
              ? "bg-primary/15 text-primary"
              : isUrgent
                ? "bg-position-gold/15 text-position-gold"
                : "bg-secondary text-secondary-foreground"
          )}
        >
          {nextSession.shortName}
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        <span className="shrink-0 rounded-md bg-muted p-1.5">
          <CountryFlag country={country} size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold leading-tight">
            {getRaceNameWithoutEmoji(raceName)}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3 shrink-0" />
            <span className="timing">
              {sessionDate.toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        </div>

        {/* Compact mono countdown row (not huge digits) */}
        <div className="hidden shrink-0 items-baseline gap-1 sm:flex">
          <span
            className={cn(
              "readout text-base md:text-lg",
              isUrgent ? "text-primary" : "text-foreground"
            )}
          >
            {countdown.days > 0 && `${countdown.days}d `}
            {pad(countdown.hours)}:{pad(countdown.minutes)}:{pad(countdown.seconds)}
          </span>
        </div>

        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>

      {/* Mobile countdown row — under the GP line, compact mono */}
      <div className="mt-2 flex items-baseline gap-1.5 border-t border-border pt-2 sm:hidden">
        <span className="instrument-label">In</span>
        <span
          className={cn(
            "readout text-base",
            isUrgent ? "text-primary" : "text-foreground"
          )}
        >
          {countdown.days > 0 && `${countdown.days}d `}
          {pad(countdown.hours)}:{pad(countdown.minutes)}:{pad(countdown.seconds)}
        </span>
      </div>
    </F1Card>
  );
};

// ── Championship mini standings list (dense hairline rows) ───────────────────
const ChampionshipMiniList = ({ drivers }: { drivers: DriverStanding[] }) => {
  return (
    <F1Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="instrument-label flex items-center gap-1.5 text-primary">
          <FlagIcon className="h-3 w-3" />
          Championship
        </div>
        <Link
          to="/standings"
          className="inline-flex shrink-0 items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-primary"
        >
          Standings
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {drivers.length === 0 ? (
        <div className="px-4 py-8">
          <F1EmptyState type="season-start" size="sm" />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {drivers.map((d, idx) => {
            const pos = Number(d.position) || idx + 1;
            const name = `${d.Driver?.givenName ?? ""} ${d.Driver?.familyName ?? ""}`.trim();
            const code = d.Driver?.code ?? d.Driver?.familyName?.slice(0, 3).toUpperCase() ?? "—";
            const team = d.Constructors?.[0]?.name ?? "";
            const driverId = d.Driver?.driverId;
            const teamColor = getTeamColor(d.Constructors?.[0]?.constructorId ?? "default");

            const row = (
              <div className="flex items-center gap-3 px-4 py-2">
                <span
                  className={cn(
                    "timing w-5 shrink-0 text-center text-sm",
                    pos === 1 ? "text-position-gold" : "text-muted-foreground"
                  )}
                >
                  {pos}
                </span>
                <span
                  className="h-7 w-0.5 shrink-0 rounded-full"
                  style={{ backgroundColor: teamColor }}
                  aria-hidden
                />
                <DriverAvatar driverCode={code} driverName={name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold leading-tight">{name || code}</div>
                  <div className="truncate text-2xs text-muted-foreground">{team}</div>
                </div>
                <span className="timing shrink-0 text-sm font-semibold tabular-nums">
                  {d.points ?? "0"}
                  <span className="ml-1 text-2xs text-muted-foreground">PTS</span>
                </span>
              </div>
            );

            return (
              <li key={driverId ?? `${code}-${idx}`}>
                {driverId ? (
                  <Link
                    to={`/drivers/${driverId}`}
                    className="block transition-colors hover:bg-muted/50"
                  >
                    {row}
                  </Link>
                ) : (
                  row
                )}
              </li>
            );
          })}
        </ul>
      )}
    </F1Card>
  );
};

// ── Next races compact list (dense hairline rows) ────────────────────────────
const NextRacesList = ({
  races,
  isSeasonComplete,
}: {
  races: IndexScheduleRace[];
  isSeasonComplete: boolean;
}) => {
  return (
    <F1Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="instrument-label flex items-center gap-1.5 text-primary">
          <Calendar className="h-3 w-3" />
          Next Races
        </div>
        <Link
          to="/calendar"
          className="inline-flex shrink-0 items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-primary"
        >
          Calendar
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {races.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="timing text-sm text-muted-foreground">
            {isSeasonComplete ? "Season complete" : "Schedule pending"}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {races.map((race) => {
            const date = new Date(race.date + "T" + (race.time || "00:00:00Z"));
            const country = race.Circuit?.Location?.country ?? "";
            return (
              <li key={race.round} className="flex items-center gap-3 px-4 py-2">
                <span className="timing w-7 shrink-0 text-center text-2xs text-muted-foreground">
                  R{race.round}
                </span>
                <span className="shrink-0 rounded-md bg-muted p-1">
                  <CountryFlag country={country} size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold leading-tight">
                    {getRaceNameWithoutEmoji(race.raceName)}
                  </div>
                  <div className="truncate text-2xs text-muted-foreground">
                    {race.Circuit?.Location?.locality ?? country}
                  </div>
                </div>
                <span className="timing shrink-0 text-right text-xs leading-tight text-muted-foreground">
                  <span className="block font-semibold text-foreground">
                    {date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                  <span className="block text-2xs">
                    {date.toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </F1Card>
  );
};

// Dashboard Loading Skeleton
const DashboardSkeleton = () => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <F1Skeleton variant="card" className="h-[320px]" />
        <F1Skeleton variant="card" className="h-[320px]" />
      </div>

      {/* Standings Row Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2">
          <F1Skeleton variant="card" className="h-[400px]" />
        </div>
        <F1Skeleton variant="card" className="h-[400px]" />
      </div>

      {/* Sankey Skeleton */}
      <F1Skeleton variant="chart" className="h-[500px]" />

      {/* Readouts Row Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <F1Skeleton variant="card" className="h-[300px]" />
        <F1Skeleton variant="card" className="h-[300px]" />
        <F1Skeleton variant="card" className="h-[300px]" />
      </div>
    </div>
  );
};

export default Index;
