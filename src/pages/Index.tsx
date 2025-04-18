import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Trophy, Users, ChartColumn } from "lucide-react";
import { useDriverStandings, useConstructorStandings, useRaceSchedule, useLastRaceResults, useLastRacePitStops } from "@/hooks/useF1Data";
import { useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { getTeamColor, getCountryFlag } from "@/utils/teamUtils";
import HeaderSection from "@/components/dashboard/HeaderSection";
import DriverStandingsTable from "@/components/dashboard/DriverStandingsTable";
import ConstructorStandingsCard from "@/components/dashboard/ConstructorStandingsCard";
import LastRaceResultsCard from "@/components/dashboard/LastRaceResultsCard";
import FastestPitStopCard from "@/components/dashboard/FastestPitStopCard";
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
  const [showAllDrivers, setShowAllDrivers] = useState(false);

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
      <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
        <HeaderSection nextRace={nextRace} isOffline={isOffline} />
        
        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Driver Standings
                    </CardTitle>
                    <button 
                      onClick={() => setShowAllDrivers(!showAllDrivers)} 
                      className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      <Users className="h-4 w-4" />
                      {showAllDrivers ? 'Show Top 10' : 'Show All Drivers'}
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <DriverStandingsTable 
                    driverStandings={driverStandings} 
                    getTeamColor={getTeamColor}
                    showAllDrivers={showAllDrivers}
                  />
                </CardContent>
              </Card>
              
              <ConstructorStandingsCard constructorStandings={constructorStandings} getTeamColor={getTeamColor} />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
