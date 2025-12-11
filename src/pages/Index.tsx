import { useDriverStandings, useConstructorStandings, useRaceSchedule, useLastRaceResults, useLastRacePitStops } from "@/hooks/useF1Data";
import { useEffect, useState, useMemo } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { getTeamColor } from "@/utils/teamUtils";
import HeaderSection from "@/components/dashboard/HeaderSection";
import CombinedStandingsCard from "@/components/dashboard/CombinedStandingsCard";
import SeasonalReviewPanel from "@/components/dashboard/SeasonalReviewPanel";
import LastRaceResultsCard from "@/components/dashboard/LastRaceResultsCard";
import FastestPitStopCard from "@/components/dashboard/FastestPitStopCard";
import QualifyingResultsCard from "@/components/dashboard/QualifyingResultsCard";
import MuiSankeyChart from "@/components/analytics/MuiSankeyChart";
import RaceDetailDialog from "@/components/calendar/RaceDetailDialog";
import { useTheme } from "@/context/ThemeContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { GitCompare } from "lucide-react";
import ReactCountryFlag from "react-country-flag";
import { getCountryCode } from "@/components/common/CountryFlag";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
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
  const [isSankeyDialogOpen, setIsSankeyDialogOpen] = useState(false);

  const analytics = useAnalytics();
  const clarity = useClarity();

  // Get last completed race info
  const lastCompletedRace = useMemo(() => {
    if (!raceSchedule?.data) return null;
    const races = raceSchedule.data;
    const now = new Date();
    const completedRaces = races.filter((race: any) => new Date(race.date) < now);
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

  // Glass styling
  const glassStyle = isGlass ? {
    background: 'var(--glass-bg)',
    backdropFilter: 'blur(var(--glass-blur))',
    WebkitBackdropFilter: 'blur(var(--glass-blur))',
    border: '1px solid var(--glass-border)',
  } : {};

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

            {/* Second Row: Qualifying → Race Progression (full width) */}
            <Card className="bg-card border-border" style={glassStyle}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <GitCompare className="h-5 w-5 text-primary" />
                      Qualifying to Race Progression
                    </CardTitle>
                    <CardDescription>
                      How drivers progressed from qualifying to race positions
                    </CardDescription>
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
              </CardHeader>
              <CardContent className="p-0 h-[550px]">
                {lastCompletedRace && (
                  <MuiSankeyChart 
                    year={lastCompletedRace.year} 
                    round={lastCompletedRace.round} 
                  />
                )}
              </CardContent>
            </Card>

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
