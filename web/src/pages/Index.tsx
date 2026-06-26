import { useDriverStandings, useConstructorStandings, useRaceSchedule, useLastRaceResults, useLastRacePitStops } from "@/hooks/useF1Data";
import { useEffect, useState, useMemo, useCallback } from "react";
import { getTeamColor } from "@/utils/teamUtils";
import { pageShell, pageStack } from "@/lib/layout";
import CombinedStandingsCard from "@/components/dashboard/CombinedStandingsCard";
import SeasonChampionshipCard from "@/components/dashboard/SeasonChampionshipCard";
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
import { GitCompare, Activity, Calendar, Clock, ChevronRight, Flag as FlagIcon } from "lucide-react";
import ReactCountryFlag from "react-country-flag";
import CountryFlag, { getCountryCode } from "@/components/common/CountryFlag";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import { getNextSession } from "@/utils/nextSessionUtils";
import { cn } from "@/lib/utils";
import { F1Skeleton } from "@/components/f1";
import { F1EmptyState } from "@/components/f1/F1EmptyState";
import { CountUp } from "@/components/CountUp";

import useAnalytics from '@/hooks/useAnalytics';
import useClarity from '@/hooks/useClarity';

type IndexScheduleRace = {
  date: string;
  time?: string;
  season: string;
  round: string;
  raceName: string;
  Circuit?: { Location?: { country?: string } };
  [key: string]: unknown;
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
  const [, setStandingsExpanded] = useState(false);
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

  // Season telemetry: round progress + championship leaders for the hero readouts
  const seasonStats = useMemo(() => {
    const races = (raceSchedule?.data ?? []) as IndexScheduleRace[];
    const totalRounds = races.length;
    const now = new Date();
    const completedRounds = races.filter((race) => new Date(race.date) < now).length;

    const driverLeader = (driverStandings?.data?.[0] ?? null) as {
      Driver?: { givenName?: string; familyName?: string; code?: string };
      points?: string;
    } | null;
    const constructorLeader = (constructorStandings?.data?.[0] ?? null) as {
      Constructor?: { name?: string };
      points?: string;
    } | null;

    return { totalRounds, completedRounds, driverLeader, constructorLeader };
  }, [raceSchedule?.data, driverStandings?.data, constructorStandings?.data]);

  return (
    <div className={pageShell}>
      <div className={cn(pageStack, "animate-fade-in")}>
        <TelemetryHero
          nextRace={nextRace}
          seasonStats={seasonStats}
          isSeasonComplete={isSeasonComplete}
          isOffline={isOffline}
          onOpenNextRace={() => setIsNextRaceDialogOpen(true)}
        />

        {isLoading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* Top Row: Combined Standings & Season Overview */}
            <SectionLabel icon={<FlagIcon className="h-3 w-3" />}>
              Championship Telemetry
            </SectionLabel>
            <div className={`grid grid-cols-1 gap-4 md:gap-6 ${isSeasonComplete ? '' : 'lg:grid-cols-3'}`}>
              <div className={isSeasonComplete ? '' : 'lg:col-span-2'}>
                <CombinedStandingsCard 
                  constructorStandings={constructorStandings} 
                  driverStandings={driverStandings}
                  getTeamColor={getTeamColor}
                  onExpandChange={setStandingsExpanded}
                />
              </div>
              {!isSeasonComplete && <SeasonChampionshipCard />}
            </div>

            {/* Second Row: Qualifying → Race Progression (full width) */}
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

            {/* Third Row: Race Data Cards */}
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

      {/* Race Detail Dialog for the next race (hero) */}
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

// ── Hero readout cell (instrument label + mono value) ────────────────────────
const ReadoutCell = ({
  label,
  value,
  unit,
  emphasis,
  className,
}: {
  label: string;
  value: React.ReactNode;
  unit?: React.ReactNode;
  emphasis?: boolean;
  className?: string;
}) => (
  <div className={cn("data-row min-w-0", className)}>
    <span className="instrument-label shrink-0">{label}</span>
    <span className="flex min-w-0 items-baseline gap-1">
      <span
        className={cn(
          "readout truncate text-sm",
          emphasis ? "text-primary" : "text-foreground"
        )}
      >
        {value}
      </span>
      {unit && (
        <span className="shrink-0 text-xs text-muted-foreground">{unit}</span>
      )}
    </span>
  </div>
);

type HeroSeasonStats = {
  totalRounds: number;
  completedRounds: number;
  driverLeader: {
    Driver?: { givenName?: string; familyName?: string; code?: string };
    points?: string;
  } | null;
  constructorLeader: {
    Constructor?: { name?: string };
    points?: string;
  } | null;
};

// ── Telemetry Terminal hero — the instrument cluster front door ──────────────
const TelemetryHero = ({
  nextRace,
  seasonStats,
  isSeasonComplete,
  isOffline,
  onOpenNextRace,
}: {
  nextRace: IndexScheduleRace | undefined;
  seasonStats: HeroSeasonStats;
  isSeasonComplete: boolean;
  isOffline: boolean;
  onOpenNextRace: () => void;
}) => {
  const { isGlass } = useTheme();
  const currentYear = new Date().getFullYear();

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

  const driver = seasonStats.driverLeader?.Driver;
  const driverName = driver
    ? `${driver.givenName ?? ""} ${driver.familyName ?? ""}`.trim()
    : "—";
  const constructorName = seasonStats.constructorLeader?.Constructor?.name ?? "—";
  const driverLeaderPoints =
    seasonStats.driverLeader?.points != null &&
    Number.isFinite(Number(seasonStats.driverLeader.points))
      ? Number(seasonStats.driverLeader.points)
      : null;

  return (
    <F1Card
      variant={isGlass ? "glass" : "default"}
      glassVariant={isGlass ? "panel" : "default"}
      className="scope-frame p-0"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] divide-y divide-border lg:divide-x lg:divide-y-0">
        {/* Left — identity + live/next session readout */}
        <div className="flex flex-col gap-4 p-4 md:p-6">
          <div className="space-y-1.5">
            <div className="instrument-label flex items-center gap-1.5 text-primary">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-primary/60 animate-live-pulse" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <span>Live Telemetry · Season {currentYear}</span>
            </div>
            <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">
              Formula 1<span className="text-primary"> Pit Wall</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Real-time race data, championship standings, and analytics
            </p>
          </div>

          {nextRace && nextSession && sessionDate ? (
            <button
              type="button"
              onClick={onOpenNextRace}
              aria-label={`Next session: ${getRaceNameWithoutEmoji(raceName)} ${nextSession.shortName}. Open race details.`}
              className={cn(
                "group mt-auto w-full rounded-lg border border-border bg-muted/40 p-3 text-left transition-all hover:border-primary/40 hover:bg-muted/60",
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
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </div>

              {/* Countdown readout */}
              <div className="mt-3 grid grid-cols-4 gap-2 border-t border-border pt-3">
                {[
                  { v: countdown.days, l: "Days" },
                  { v: countdown.hours, l: "Hrs" },
                  { v: countdown.minutes, l: "Min" },
                  { v: countdown.seconds, l: "Sec" },
                ].map((u) => (
                  <div key={u.l} className="text-center">
                    <div
                      className={cn(
                        "readout text-xl md:text-2xl",
                        isUrgent ? "text-primary" : "text-foreground"
                      )}
                    >
                      {pad(u.v)}
                    </div>
                    <div className="instrument-label mt-0.5">{u.l}</div>
                  </div>
                ))}
              </div>
            </button>
          ) : (
            <div className="mt-auto rounded-lg border border-border bg-muted/40 p-3">
              <div className="instrument-label mb-1 flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                Next Session
              </div>
              <p className="timing text-sm text-muted-foreground">
                {isSeasonComplete ? "Season complete" : "Schedule pending"}
              </p>
            </div>
          )}
        </div>

        {/* Right — season status readouts (hairline instrument grid) */}
        <div className="flex flex-col p-4 md:p-6">
          <div className="instrument-label mb-2 flex items-center gap-1.5 text-primary">
            <Activity className="h-3 w-3" />
            Season Status
          </div>
          <div className="hairline-grid">
            <ReadoutCell
              label="Round"
              value={
                seasonStats.totalRounds ? (
                  <>
                    <CountUp value={seasonStats.completedRounds} /> /{" "}
                    {seasonStats.totalRounds}
                  </>
                ) : (
                  "—"
                )
              }
            />
            <ReadoutCell
              label="Drivers' Leader"
              value={driverName}
              unit={
                driverLeaderPoints != null ? (
                  <>
                    <CountUp value={driverLeaderPoints} /> pts
                  </>
                ) : undefined
              }
              emphasis
            />
            <ReadoutCell
              label="Constructors' Leader"
              value={constructorName}
              unit={
                seasonStats.constructorLeader?.points
                  ? `${seasonStats.constructorLeader.points} pts`
                  : undefined
              }
            />
            <ReadoutCell
              label="Status"
              value={isSeasonComplete ? "Complete" : "In Progress"}
            />
          </div>

          {isOffline && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-position-gold/40 bg-position-gold/10 p-2.5">
              <FlagIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-position-gold" />
              <div className="min-w-0">
                <div className="instrument-label text-position-gold">
                  Signal Degraded
                </div>
                <p className="text-xs text-muted-foreground">
                  Live API unreachable — showing cached data.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </F1Card>
  );
};

// Dashboard Loading Skeleton
const DashboardSkeleton = () => {
  
  return (
    <div className="space-y-6">
      {/* Top Row Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2">
          <F1Skeleton variant="card" className="h-[400px]" />
        </div>
        <F1Skeleton variant="card" className="h-[400px]" />
      </div>
      
      {/* Second Row Skeleton */}
      <F1Skeleton variant="chart" className="h-[500px]" />
      
      {/* Third Row Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <F1Skeleton variant="card" className="h-[300px]" />
        <F1Skeleton variant="card" className="h-[300px]" />
        <F1Skeleton variant="card" className="h-[300px]" />
      </div>
    </div>
  );
};

export default Index;
