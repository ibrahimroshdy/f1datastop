import { useDriverStandings, useConstructorStandings, useRaceSchedule, useLastRaceResults, useLastRacePitStops } from "@/hooks/useF1Data";
import { useEffect, useState, useMemo } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { getTeamColor } from "@/utils/teamUtils";
import HeaderSection from "@/components/dashboard/HeaderSection";
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
import { GitCompare } from "lucide-react";
import ReactCountryFlag from "react-country-flag";
import { getCountryCode } from "@/components/common/CountryFlag";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
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

  const nextRace = raceSchedule?.data?.find(race => {
    const raceDate = new Date(race.date + "T" + (race.time || "00:00:00Z"));
    return raceDate > new Date();
  });

  return (
    <MainLayout>
      <div className="min-h-0 bg-transparent text-foreground">
        {/* Hero Header Section */}
        <HeaderSection nextRace={nextRace} isOffline={isOffline} />

        {isLoading ? (
          <DashboardSkeleton />
        ) : (
          <div className="space-y-6 stagger-children">
            {/* Top Row: Combined Standings & Season Overview */}
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
            <F1Card
              variant={isGlass ? "glass" : "default"}
              glassVariant={isGlass ? "panel" : "default"}
              className="border-border p-0"
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
                      className="shrink-0 rounded-md border text-xs font-medium border-border bg-secondary/50 text-secondary-foreground hover:bg-secondary flex items-center gap-1.5 py-1 px-2 cursor-pointer hover:border-primary/50 transition-all"
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              <QualifyingResultsCard />
              <LastRaceResultsCard
                lastRaceResults={lastRaceResults}
                isResultsLoading={isResultsLoading}
                getTeamColor={getTeamColor}
              />
              <FastestPitStopCard />
            </div>
          </div>
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
    </MainLayout>
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
