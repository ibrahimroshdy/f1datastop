import React, { useState, Suspense, lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, HelpCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import YearSelector from '@/components/common/YearSelector';
import { SelectRace } from '@/components/common/SelectRace';
import { useRaceSchedule } from '@/hooks/useF1Data';
import { useSessionsByYear } from '@/hooks/useOpenF1Data';
import MainLayout from '@/components/layout/MainLayout';
import { Skeleton } from "@/components/ui/skeleton";

// Lazy-load heavy components
const TelemetryDashboard = lazy(() => import('@/components/analytics/TelemetryDashboard'));
const WeatherAnalysis = lazy(() => import('@/components/analytics/WeatherAnalysis'));
const TeamRadio = lazy(() => import('@/components/analytics/TeamRadio'));

// Component for the tab content loading state
const TabLoadingFallback = () => (
  <div className="h-[400px] w-full flex flex-col items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
    <p className="text-muted-foreground">Loading data...</p>
  </div>
);

const RaceAnalysisPage = () => {
  const { year = new Date().getFullYear(), round = "last" } = useParams();
  const navigate = useNavigate();
  const [selectedYear, setSelectedYear] = useState<number>(parseInt(year.toString()));
  const [selectedRound, setSelectedRound] = useState<string>(round);
  const [activeTab, setActiveTab] = useState<string>("weather");
  
  // Get race schedule from Ergast
  const { 
    data: scheduleData, 
    isLoading: isScheduleLoading 
  } = useRaceSchedule(selectedYear);
  
  // Get OpenF1 sessions for this year
  const {
    data: openF1SessionsData,
    isLoading: isOpenF1Loading
  } = useSessionsByYear(selectedYear);
  
  const hasOpenF1Data = React.useMemo(() => {
    if (!openF1SessionsData?.data || openF1SessionsData.data.length === 0) return false;
    
    // Group by meeting to count unique race weekends
    const meetings = new Set();
    openF1SessionsData.data.forEach(session => {
      meetings.add(session.meeting_key);
    });
    
    return meetings.size > 0;
  }, [openF1SessionsData]);
  
  // Find the race from the schedule
  const selectedRace = React.useMemo(() => {
    if (isScheduleLoading || !scheduleData?.data) return null;
    const races = scheduleData.data;
    
    if (selectedRound === "last") {
      // Find the last completed race
      const now = new Date();
      const completedRaces = races.filter(race => new Date(race.date) < now);
      return completedRaces[completedRaces.length - 1] || races[0];
    } else if (selectedRound === "next") {
      // Find the next upcoming race
      const now = new Date();
      const upcomingRaces = races.filter(race => new Date(race.date) > now);
      return upcomingRaces[0] || races[races.length - 1];
    } else {
      // Find the race with the specified round
      return races.find(race => race.round === selectedRound) || races[0];
    }
  }, [scheduleData, selectedRound, isScheduleLoading]);
  
  // Handle year change
  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    navigate(`/race-analysis/${year}/${selectedRound}`);
  };
  
  // Handle race change
  const handleRaceChange = (round: string) => {
    setSelectedRound(round);
    navigate(`/race-analysis/${selectedYear}/${round}`);
  };

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };
  
  // Determine if we should show placeholder content during initial load
  const isInitialLoading = isScheduleLoading || isOpenF1Loading;
  
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="text-3xl font-bold">F1 Race Info</h1>
          
          <div className="flex items-center gap-2">
            <YearSelector 
              selectedYear={selectedYear} 
              onYearChange={handleYearChange} 
            />
            
            <SelectRace
              year={selectedYear}
              selectedRound={selectedRound}
              onRoundChange={handleRaceChange}
            />
          </div>
        </div>
        
        <Card>
          {isInitialLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48" />
              <div className="mt-6 space-y-4">
                <Skeleton className="h-[400px] w-full" />
              </div>
            </div>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="text-2xl">
                  {selectedRace?.raceName || "Race Info"}
                </CardTitle>
                <CardDescription>
                  {selectedRace?.Circuit?.circuitName}, {selectedRace?.date}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedYear < 2023 && (
                  <Alert className="mb-6">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Limited data available</AlertTitle>
                    <AlertDescription>
                      Enhanced telemetry and weather data from OpenF1 is only available for races from 2023 onwards.
                      Limited Ergast data is still available for historical races.
                    </AlertDescription>
                  </Alert>
                )}
                
                <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-8">
                  <TabsList className="grid grid-cols-3 w-full">
                    <TabsTrigger value="weather">Weather</TabsTrigger>
                    <TabsTrigger value="radio">Team Radio</TabsTrigger>
                    <TabsTrigger value="telemetry">Telemetry</TabsTrigger>
                  </TabsList>
                  
                  <Suspense fallback={<TabLoadingFallback />}>
                    {/* Only render the active tab to avoid unnecessary API requests and improve performance */}
                    <TabsContent value="weather" className="space-y-4">
                      {activeTab === "weather" && (
                        <>
                          <WeatherAnalysis 
                            year={selectedYear} 
                            round={selectedRace?.round || "1"} 
                          />
                          
                          <div className="bg-primary-foreground/5 rounded-lg p-4 text-sm">
                            <div className="flex items-start gap-2">
                              <HelpCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                              <div>
                                <p className="font-medium mb-1">About Weather Data</p>
                                <p className="text-muted-foreground">
                                  Weather conditions significantly impact race strategy and car performance. Track temperature 
                                  affects tire grip, while air temperature, humidity, and pressure influence engine performance. 
                                  Wind can create challenging conditions on certain parts of the track.
                                </p>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="radio" className="space-y-4">
                      {activeTab === "radio" && (
                        <>
                          <TeamRadio 
                            year={selectedYear} 
                            round={selectedRace?.round || "1"} 
                          />
                          
                          <div className="bg-primary-foreground/5 rounded-lg p-4 text-sm">
                            <div className="flex items-start gap-2">
                              <HelpCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                              <div>
                                <p className="font-medium mb-1">About Team Radio</p>
                                <p className="text-muted-foreground">
                                  Team radio communications provide insight into race strategy, driver emotions, 
                                  and critical moments during the race. Engineers and drivers exchange information 
                                  about tire conditions, pit stop strategies, and race developments.
                                </p>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="telemetry" className="space-y-4">
                      {activeTab === "telemetry" && (
                        <>
                          <TelemetryDashboard 
                            year={selectedYear} 
                            round={selectedRace?.round || "1"} 
                          />
                          
                          <div className="bg-primary-foreground/5 rounded-lg p-4 text-sm">
                            <div className="flex items-start gap-2">
                              <HelpCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                              <div>
                                <p className="font-medium mb-1">About Telemetry Data</p>
                                <p className="text-muted-foreground">
                                  Telemetry data shows real-time car information including speed, RPM, throttle position, 
                                  brake pressure, gear selection, and DRS activation. This data allows you to analyze 
                                  driver techniques and car performance throughout the race.
                                </p>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </TabsContent>
                  </Suspense>
                </Tabs>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </MainLayout>
  );
};

export default RaceAnalysisPage; 