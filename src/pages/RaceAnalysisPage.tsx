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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// Add interface for session data
interface SessionOption {
  session_key: number;
  session_name: string;
  session_type: string;
  date_start: string;
  date_end: string;
  meeting_key: number;
}

// Lazy-load heavy components
const TelemetryDashboard = lazy(() => import('@/components/analytics/TelemetryDashboard'));
const WeatherAnalysis = lazy(() => import('@/components/analytics/WeatherAnalysis'));
const TeamRadio = lazy(() => import('@/components/analytics/TeamRadio'));
const LapTimeTab = lazy(() => import('@/components/analytics/LapTimeTab'));

// Component for the tab content loading state
const TabLoadingFallback = () => (
  <div className="h-[400px] w-full flex flex-col items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
    <p className="text-muted-foreground">Loading data...</p>
  </div>
);

// Function to determine the default year (current year is 2025)
const getCurrentYear = () => 2025; // Hard-coding 2025 as the current year

const RaceAnalysisPage = () => {
  // Use getCurrentYear() to always default to the current real-world year (2025)
  const { year = getCurrentYear(), round = "last" } = useParams();
  const navigate = useNavigate();
  const [selectedYear, setSelectedYear] = useState<number>(parseInt(year.toString()));
  const [selectedRound, setSelectedRound] = useState<string>(round);
  const [activeTab, setActiveTab] = useState<string>("weather");
  
  // Add state for the selected session
  const [selectedSessionKey, setSelectedSessionKey] = useState<number | null>(null);
  const [availableSessions, setAvailableSessions] = useState<SessionOption[]>([]);
  
  // Get OpenF1 sessions for this year (primary data source)
  const {
    data: openF1SessionsData,
    isLoading: isOpenF1Loading
  } = useSessionsByYear(selectedYear);
  
  // Get race schedule from Ergast (backup for legacy data only)
  const { 
    data: scheduleData, 
    isLoading: isScheduleLoading 
  } = useRaceSchedule(selectedYear);
  
  const hasOpenF1Data = React.useMemo(() => {
    if (!openF1SessionsData?.data || openF1SessionsData.data.length === 0) return false;
    
    // Group by meeting to count unique race weekends
    const meetings = new Set();
    openF1SessionsData.data.forEach(session => {
      meetings.add(session.meeting_key);
    });
    
    return meetings.size > 0;
  }, [openF1SessionsData]);
  
  // Find the selected meeting/race
  const selectedMeeting = React.useMemo(() => {
    if (isOpenF1Loading || !openF1SessionsData?.data) return null;
    
    // Group sessions by meeting for easier processing
    const meetingGroups: { [key: string]: any[] } = {};
    openF1SessionsData.data.forEach(session => {
      const key = session.meeting_key.toString();
      if (!meetingGroups[key]) {
        meetingGroups[key] = [];
      }
      meetingGroups[key].push(session);
    });
    
    // Sort by date
    const sortedMeetings = Object.values(meetingGroups)
      .map(sessions => sessions[0])
      .sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime());
    
    if (selectedRound === "last") {
      // Find the last completed meeting
      const now = new Date();
      const completedMeetings = sortedMeetings.filter(meeting => 
        new Date(meeting.date_end) < now
      );
      
      return completedMeetings.length > 0 
        ? completedMeetings[completedMeetings.length - 1]
        : (sortedMeetings.length > 0 ? sortedMeetings[0] : null);
    } 
    else if (selectedRound === "next") {
      // Find the next upcoming meeting
      const now = new Date();
      const upcomingMeetings = sortedMeetings.filter(meeting => 
        new Date(meeting.date_start) > now
      );
      
      return upcomingMeetings.length > 0
        ? upcomingMeetings[0]
        : (sortedMeetings.length > 0 ? sortedMeetings[sortedMeetings.length - 1] : null);
    } 
    else {
      // Find the meeting with the matching key
      const meetingKey = parseInt(selectedRound);
      if (!isNaN(meetingKey)) {
        const matchingSessions = meetingGroups[meetingKey.toString()];
        if (matchingSessions && matchingSessions.length > 0) {
          // Prioritize race sessions
          const raceSession = matchingSessions.find(s => s.session_type === "Race");
          return raceSession || matchingSessions[0];
        }
      }
      
      // If no match found, return the first meeting as fallback
      return sortedMeetings.length > 0 ? sortedMeetings[0] : null;
    }
  }, [openF1SessionsData, selectedRound, isOpenF1Loading]);
  
  // Format the session date for display
  const formattedDate = React.useMemo(() => {
    if (!selectedMeeting) return "";
    
    const date = new Date(selectedMeeting.date_start);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    });
  }, [selectedMeeting]);
  
  // Get all available sessions for the selected meeting
  React.useEffect(() => {
    if (!openF1SessionsData?.data || !selectedMeeting) {
      setAvailableSessions([]);
      return;
    }
    
    // Filter sessions for the current meeting
    const meetingKey = selectedMeeting.meeting_key;
    const sessions = openF1SessionsData.data.filter(
      (session: any) => session.meeting_key === meetingKey
    );
    
    // Sort sessions by date
    const sortedSessions = [...sessions].sort(
      (a: any, b: any) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
    );
    
    setAvailableSessions(sortedSessions);
    
    // Set the selected session to the first one or the Race session if available
    if (sortedSessions.length > 0) {
      const raceSession = sortedSessions.find((s: any) => s.session_type === "Race");
      const defaultSession = raceSession || sortedSessions[0];
      
      if (!selectedSessionKey || !sortedSessions.some((s: any) => s.session_key === selectedSessionKey)) {
        setSelectedSessionKey(defaultSession.session_key);
      }
    } else {
      setSelectedSessionKey(null);
    }
  }, [openF1SessionsData, selectedMeeting, selectedSessionKey]);
  
  // Get the selected session details
  const selectedSession = React.useMemo(() => {
    if (!availableSessions.length) return null;
    
    return selectedSessionKey 
      ? availableSessions.find(s => s.session_key === selectedSessionKey) 
      : availableSessions[0];
  }, [availableSessions, selectedSessionKey]);
  
  // Handle year change
  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    navigate(`/race-analysis/${year}/${selectedRound}`);
  };
  
  // Handle race change
  const handleRaceChange = (round: string) => {
    setSelectedRound(round);
    setSelectedSessionKey(null); // Reset selected session when changing race
    navigate(`/race-analysis/${selectedYear}/${round}`);
  };

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };
  
  // Handle session change
  const handleSessionChange = (value: string) => {
    console.log("Changing session to:", value);
    
    // Force a re-render of all components by first clearing the session key
    setSelectedSessionKey(null);
    
    // Then after a short delay, set the new session key
    // This ensures the components detect the change and reload their data
    setTimeout(() => {
      setSelectedSessionKey(Number(value));
    }, 50);
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
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                  <div>
                    <CardTitle className="text-2xl">
                      {selectedMeeting ? `${selectedMeeting.country_name} Grand Prix` : "Race Info"}
                    </CardTitle>
                    <CardDescription>
                      {selectedMeeting?.location}, {formattedDate}
                    </CardDescription>
                  </div>
                  
                  {/* Session selector dropdown - remove the extra badge */}
                  {availableSessions.length > 1 && (
                    <div className="mt-4 md:mt-0">
                      <Select 
                        value={selectedSessionKey?.toString() || ""} 
                        onValueChange={handleSessionChange}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Select Session" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSessions.map((session) => (
                            <SelectItem 
                              key={session.session_key} 
                              value={session.session_key.toString()}
                            >
                              {session.session_type}: {session.session_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
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
                  <TabsList className="grid grid-cols-4 w-full">
                    <TabsTrigger value="weather">Weather</TabsTrigger>
                    <TabsTrigger value="radio">Team Radio</TabsTrigger>
                    <TabsTrigger value="telemetry">Telemetry</TabsTrigger>
                    <TabsTrigger value="lap-time">Lap Times</TabsTrigger>
                  </TabsList>
                  
                  <Suspense fallback={<TabLoadingFallback />}>
                    {/* Only render the active tab to avoid unnecessary API requests and improve performance */}
                    <TabsContent value="weather" className="space-y-4">
                      {activeTab === "weather" && (
                        <>
                          <WeatherAnalysis 
                            year={selectedYear} 
                            round={selectedRound}
                            sessionType={selectedSession?.session_type || undefined}
                            sessionKey={selectedSessionKey || undefined}
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
                            round={selectedRound}
                            sessionType={selectedSession?.session_type || undefined}
                            sessionKey={selectedSessionKey || undefined}
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
                            round={selectedRound}
                            sessionType={selectedSession?.session_type || undefined}
                            sessionKey={selectedSessionKey || undefined}
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
                    
                    <TabsContent value="lap-time" className="space-y-4">
                      {activeTab === "lap-time" && (
                        <>
                          <LapTimeTab 
                            year={selectedYear} 
                            round={selectedRound}
                            sessionType={selectedSession?.session_type || undefined}
                            sessionKey={selectedSessionKey || undefined}
                          />
                          
                          <div className="bg-primary-foreground/5 rounded-lg p-4 text-sm">
                            <div className="flex items-start gap-2">
                              <HelpCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                              <div>
                                <p className="font-medium mb-1">About Lap Times</p>
                                <p className="text-muted-foreground">
                                  Lap time analysis shows how drivers perform over the course of a session. The data includes overall 
                                  lap times and individual sector times, highlighting personal bests and session records.
                                  This allows you to see where drivers gain or lose time on track and their consistency over a stint.
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