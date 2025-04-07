
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Trophy, AlertTriangle, ServerCrash } from "lucide-react";
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
import { useApi } from "@/context/ApiContext";
import { Button } from "@/components/ui/button";

const Index = () => {
  const { isBackendConnected, backendUrl } = useApi();
  
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

  const nextRace = raceSchedule?.data?.find(race => {
    const raceDate = new Date(race.date + "T" + (race.time || "00:00:00Z"));
    return raceDate > new Date();
  });

  // If backend is not connected, show a message
  if (!isBackendConnected) {
    return (
      <MainLayout>
        <div className="min-h-screen bg-f1-dark text-white p-4 md:p-8">
          <HeaderSection nextRace={null} isOffline={true} />
          
          <div className="flex flex-col items-center justify-center h-[50vh] text-center p-4">
            <ServerCrash className="w-20 h-20 text-red-500 mb-4" />
            <h2 className="text-2xl font-bold mb-4">Backend Not Connected</h2>
            <p className="mb-8 text-gray-300 max-w-md">
              The Python FastF1 backend server is not running or cannot be reached at <code className="bg-gray-800 px-2 py-1 rounded">{backendUrl}</code>
            </p>
            <div className="space-y-4">
              <div className="bg-gray-800 p-4 rounded-lg text-left">
                <p className="font-mono text-sm mb-2">To start the backend server:</p>
                <ul className="list-disc pl-5 space-y-2 text-sm">
                  <li>Navigate to the backend directory: <code className="bg-gray-900 px-2 py-0.5 rounded">cd backend</code></li>
                  <li>Create a virtual environment: <code className="bg-gray-900 px-2 py-0.5 rounded">python -m venv venv</code></li>
                  <li>Activate it: 
                    <ul className="pl-5 mt-1 space-y-1">
                      <li>Windows: <code className="bg-gray-900 px-2 py-0.5 rounded">venv\Scripts\activate</code></li>
                      <li>Mac/Linux: <code className="bg-gray-900 px-2 py-0.5 rounded">source venv/bin/activate</code></li>
                    </ul>
                  </li>
                  <li>Install dependencies: <code className="bg-gray-900 px-2 py-0.5 rounded">pip install -r requirements.txt</code></li>
                  <li>Start server: <code className="bg-gray-900 px-2 py-0.5 rounded">uvicorn main:app --reload</code></li>
                </ul>
              </div>
              <Button 
                className="bg-blue-600 hover:bg-blue-700" 
                onClick={() => window.location.reload()}
              >
                Retry Connection
              </Button>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-screen bg-f1-dark text-white p-4 md:p-8">
        <HeaderSection nextRace={nextRace} isOffline={false} />
        
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
                <TabsTrigger value="schedule" className="data-[state=active]:bg-f1-red">Race Schedule</TabsTrigger>
                <TabsTrigger value="constructors" className="data-[state=active]:bg-f1-red">Constructor Standings</TabsTrigger>
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
