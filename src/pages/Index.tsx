import { useDriverStandings, useConstructorStandings, useRaceSchedule, useLastRaceResults, useLastRacePitStops } from "@/hooks/useF1Data";
import { useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { getTeamColor } from "@/utils/teamUtils";
import HeaderSection from "@/components/dashboard/HeaderSection";
import CombinedStandingsCard from "@/components/dashboard/CombinedStandingsCard";
import SeasonalReviewPanel from "@/components/dashboard/SeasonalReviewPanel";
import LastRaceResultsCard from "@/components/dashboard/LastRaceResultsCard";
import LastRaceResultsChart from "@/components/dashboard/LastRaceResultsChart";
import LapTimesChart from "@/components/dashboard/LapTimesChart";
import FastestPitStopCard from "@/components/dashboard/FastestPitStopCard";
import QualifyingResultsCard from "@/components/dashboard/QualifyingResultsCard";
import QualifyingToRaceChart from "@/components/dashboard/QualifyingToRaceChart";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { F1Skeleton } from "@/components/f1";

import useAnalytics from '@/hooks/useAnalytics';
import useClarity from '@/hooks/useClarity';

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
    data: lastRacePitStops,
    isLoading: isPitStopsLoading
  } = useLastRacePitStops();

  const { isGlass } = useTheme();
  const isLoading = isDriversLoading || isConstructorsLoading || isScheduleLoading || isResultsLoading || isPitStopsLoading;
  const [isOffline, setIsOffline] = useState(false);
  const [standingsExpanded, setStandingsExpanded] = useState(false);

  const analytics = useAnalytics();
  const clarity = useClarity();

  useEffect(() => {
    if (driverStandings?.error || constructorStandings?.error || raceSchedule?.error || lastRaceResults?.error) {
      setIsOffline(true);
    }
  }, [driverStandings, constructorStandings, raceSchedule, lastRaceResults]);

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
            {/* Top Row: Combined Standings & Seasonal Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
              <div className="lg:col-span-2">
                <CombinedStandingsCard 
                  constructorStandings={constructorStandings} 
                  driverStandings={driverStandings}
                  getTeamColor={getTeamColor}
                  onExpandChange={setStandingsExpanded}
                />
              </div>
              <SeasonalReviewPanel expandedView={standingsExpanded} />
            </div>

            {/* Second Row: Qualifying → Race Progression and Race Results Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 items-stretch gap-4 md:gap-6">
              {/* Left (2/3): Qualifying → Race Progression */}
              <div className="h-full lg:col-span-2">
                <QualifyingToRaceChart compact />
              </div>
              {/* Right (1/3): Race Results Chart */}
              <div className="lg:col-span-1">
                <LastRaceResultsChart
                  lastRaceResults={lastRaceResults}
                  isResultsLoading={isResultsLoading}
                  getTeamColor={getTeamColor}
                  compact
                />
              </div>
            </div>

            {/* Lap Times Chart - Full Width */}
            <div>
              <LapTimesChart
                lastRaceResults={lastRaceResults}
                isResultsLoading={isResultsLoading}
                getTeamColor={getTeamColor}
                compact
              />
            </div>

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
    </MainLayout>
  );
};

// Dashboard Loading Skeleton
const DashboardSkeleton = () => {
  const { isGlass } = useTheme();
  
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2">
          <F1Skeleton variant="chart" className="h-[350px]" />
        </div>
        <F1Skeleton variant="chart" className="h-[350px]" />
      </div>
      
      {/* Lap Times Skeleton */}
      <F1Skeleton variant="chart" className="h-[300px]" />
      
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
