import { Loader2 } from "lucide-react";
import { useDriverStandings, useConstructorStandings, useRaceSchedule, useLastRaceResults, useLastRacePitStops } from "@/hooks/useF1Data";
import { useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { getTeamColor, getCountryFlag } from "@/utils/teamUtils";
import HeaderSection from "@/components/dashboard/HeaderSection";
import CombinedStandingsCard, { CombinedStandingsCardProps } from "@/components/dashboard/CombinedStandingsCard";
import SeasonalReviewPanel from "@/components/dashboard/SeasonalReviewPanel";
import LastRaceResultsCard from "@/components/dashboard/LastRaceResultsCard";
import LastRaceResultsChart from "@/components/dashboard/LastRaceResultsChart";
import LapTimesChart from "@/components/dashboard/LapTimesChart";
import FastestPitStopCard from "@/components/dashboard/FastestPitStopCard";
import QualifyingResultsCard from "@/components/dashboard/QualifyingResultsCard";
import QualifyingToRaceChart from "@/components/dashboard/QualifyingToRaceChart";

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
    clarity.setTag('page_version', 'v1');
  }, [analytics, clarity]);

  const nextRace = raceSchedule?.data?.find(race => {
    const raceDate = new Date(race.date + "T" + (race.time || "00:00:00Z"));
    return raceDate > new Date();
  });

  return (
    <MainLayout>
      <div className="min-h-0 bg-background text-foreground">
        <HeaderSection nextRace={nextRace} isOffline={isOffline} />

        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Top Row: Combined Standings & Seasonal Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

            {/* Second Row, top half: 2/3 Qualifying → Race Progression and 1/3 Race Progression */}
            <div className="grid grid-cols-1 lg:grid-cols-3 items-stretch gap-2 md:gap-3">
              {/* Left (2/3): Qualifying → Race Progression */}
              <div className="h-full lg:col-span-2">
                <QualifyingToRaceChart compact />
              </div>
              {/* Right (1/3): Race Progression */}
              <div className="lg:col-span-1">
                <LastRaceResultsChart
                  lastRaceResults={lastRaceResults}
                  isResultsLoading={isResultsLoading}
                  getTeamColor={getTeamColor}
                  compact
                />
              </div>
            </div>

            {/* Second Row, bottom half: Lap Times full width */}
            <div>
              <LapTimesChart
                lastRaceResults={lastRaceResults}
                isResultsLoading={isResultsLoading}
                getTeamColor={getTeamColor}
                compact
              />
            </div>

            {/* Third Row: Race Data Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

export default Index;
