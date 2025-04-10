import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Trophy } from "lucide-react";
import { useDriverStandings, useConstructorStandings, useRaceSchedule, useLastRaceResults } from "@/hooks/useF1Data";
import { useEffect, useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { getTeamColor, getCountryFlag } from "@/utils/teamUtils";
import HeaderSection from "@/components/dashboard/HeaderSection";
import DriverStandingsTable from "@/components/dashboard/DriverStandingsTable";
import ConstructorStandingsCard from "@/components/dashboard/ConstructorStandingsCard";
import LastRaceResultsCard from "@/components/dashboard/LastRaceResultsCard";
import RaceScheduleContent from "@/components/dashboard/RaceScheduleContent";
import ConstructorStandingsContent from "@/components/dashboard/ConstructorStandingsContent";
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

  const isLoading = isDriversLoading || isConstructorsLoading || isScheduleLoading || isResultsLoading;
  const [isOffline, setIsOffline] = useState(false);

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

  const handleRaceSelect = (raceName: string, round: string) => {
    analytics.trackF1Event('race_selection', raceName, {
      round,
      season: new Date().getFullYear()
    });
    
    clarity.trackF1Event('race', 'selection', raceName);
  };

  const handleFeatureCardClick = (featureName: string) => {
    analytics.trackInteraction(`feature_${featureName}`, 'click');
    
    clarity.trackInteraction(`feature_${featureName}`);
  };

  return (
    <MainLayout>
      <div className="min-h-screen bg-f1-dark text-white p-4 md:p-8">
        <HeaderSection nextRace={nextRace} isOffline={isOffline} />
        
        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <Loader2 className="w-12 h-12 animate-spin text-f1-red" />
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="col-span-2 bg-gray-900 border-gray-800">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-f1-red" />
                      Driver Standings
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <DriverStandingsTable driverStandings={driverStandings} getTeamColor={getTeamColor} />
                </CardContent>
              </Card>
              
              <div className="space-y-6">
                <ConstructorStandingsCard constructorStandings={constructorStandings} getTeamColor={getTeamColor} />
                <LastRaceResultsCard 
                  lastRaceResults={lastRaceResults} 
                  isResultsLoading={isResultsLoading} 
                  getTeamColor={getTeamColor} 
                />
              </div>
            </div>
            
            <Tabs defaultValue="schedule">
              <TabsList className="bg-gray-800">
                <TabsTrigger 
                  value="schedule" 
                  className="data-[state=active]:bg-f1-red"
                  onClick={() => handleFeatureCardClick('schedule_tab')}
                >
                  Race Schedule
                </TabsTrigger>
                <TabsTrigger 
                  value="constructors" 
                  className="data-[state=active]:bg-f1-red"
                  onClick={() => handleFeatureCardClick('constructors_tab')}
                >
                  Constructor Standings
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="schedule" className="bg-gray-900 rounded-lg border border-gray-800 p-4 mt-4">
                <RaceScheduleContent 
                  raceSchedule={raceSchedule} 
                  nextRace={nextRace} 
                  getCountryFlag={getCountryFlag}
                />
              </TabsContent>
              
              <TabsContent value="constructors" className="bg-gray-900 rounded-lg border border-gray-800 p-4 mt-4">
                <ConstructorStandingsContent 
                  constructorStandings={constructorStandings} 
                  getTeamColor={getTeamColor}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Index;
