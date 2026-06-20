import React, { useState, Suspense, lazy } from 'react';
import { useParams, useNavigate } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import YearSelector from "@/components/common/YearSelector";
import CountryFlag from "@/components/common/CountryFlag";
import DataSourceBadge from "@/components/analytics/DataSourceBadge";
import { useRaceSchedule } from "@/hooks/useF1Data";
import { useSessionsByYear } from "@/hooks/useOpenF1Data";
import { cn } from "@/lib/utils";
import {
  F1Card,
  F1CardContent,
  F1CardDescription,
  F1CardHeader,
  F1CardTitle,
  F1ChartContainer,
  SessionSelector,
  type SessionOption,
} from "@/components/f1";
import { useThemeVariant } from "@/hooks/useThemeVariant";
import { 
  BarChart3, Clock, TrendingUp, Flag, Wrench, 
  TrendingUpIcon, GitCompare, Cloud, Radio, 
  Gauge, Trophy, Car, Info, Loader2,
  AlertCircle
} from "lucide-react";

// Lazy load chart components for performance
const MuiLapTimeChart = lazy(() => import("@/components/analytics/MuiLapTimeChart"));
const MuiPositionChart = lazy(() => import("@/components/analytics/MuiPositionChart"));
const MuiQualifyingChart = lazy(() => import("@/components/analytics/MuiQualifyingChart"));
const MuiSankeyChart = lazy(() => import("@/components/analytics/MuiSankeyChart"));
const MuiPitStopTable = lazy(() => import("@/components/analytics/MuiPitStopTable"));
const YearComparisonAnalytics = lazy(() => import("@/components/analytics/YearComparisonAnalytics"));
const WeatherAnalysis = lazy(() => import("@/components/analytics/WeatherAnalysis"));
const TeamRadio = lazy(() => import("@/components/analytics/TeamRadio"));
const TelemetryDashboard = lazy(() => import("@/components/analytics/TelemetryDashboard"));
const SessionResults = lazy(() => import("@/components/analytics/SessionResults"));
const OvertakesAnalysis = lazy(() => import("@/components/analytics/OvertakesAnalysis"));

// Get default year - always use current year
const getDefaultYear = () => {
  return new Date().getFullYear();
};

type RaceScheduleEntry = {
  round: string;
  raceName: string;
  date: string;
  Circuit?: { circuitName?: string; Location?: { country?: string } };
};

type OpenF1SessionEntry = {
  date_start: string;
  session_key: number;
  session_type: string;
  meeting_key: number;
  session_name: string;
  date_end: string;
};

/** Lazy tab content fallback — uses theme-aware F1Card + F1ChartContainer */
const TabLoadingFallback = () => {
  const { cardVariant, glassVariant } = useThemeVariant();
  return (
    <F1Card
      variant={cardVariant}
      glassVariant={glassVariant}
      className="overflow-hidden"
    >
      <F1CardContent className="px-4 pb-4">
        <F1ChartContainer isLoading minHeight={400} loadingMessage="Loading analysis..." />
      </F1CardContent>
    </F1Card>
  );
};

const RaceAnalysis = () => {
  const { year: urlYear, round: urlRound } = useParams();
  const navigate = useNavigate();
  const { cardVariant, glassVariant, isGlass } = useThemeVariant();
  
  // State
  const [selectedYear, setSelectedYear] = useState<number>(
    urlYear ? parseInt(urlYear) : getDefaultYear()
  );
  const [selectedRace, setSelectedRace] = useState<string>(urlRound || "1");
  const [selectedTab, setSelectedTab] = useState<string>("lapTimes");
  const [mainTab, setMainTab] = useState<string>("raceAnalytics");
  const [selectedSessionKey, setSelectedSessionKey] = useState<number | null>(null);
  const [availableSessions, setAvailableSessions] = useState<SessionOption[]>([]);
  
  // Data fetching
  const { data: raceScheduleData, isLoading: isRaceScheduleLoading } = useRaceSchedule(selectedYear);
  const { data: openF1SessionsData, isLoading: isOpenF1Loading } = useSessionsByYear(selectedYear);
  
  // Get current race info
  const currentRace = React.useMemo(() => {
    if (!raceScheduleData?.data) return null;
    return raceScheduleData.data.find((r: RaceScheduleEntry) => r.round === selectedRace);
  }, [raceScheduleData, selectedRace]);
  
  // Process OpenF1 sessions for the selected race
  React.useEffect(() => {
    if (!openF1SessionsData?.data || !currentRace) {
      setAvailableSessions([]);
      return;
    }
    
    // Find matching meeting by date or name
    const raceDate = new Date(currentRace.date);
    const matchingSessions = openF1SessionsData.data.filter((session: OpenF1SessionEntry) => {
      const sessionDate = new Date(session.date_start);
      // Match if within same week
      const daysDiff = Math.abs((sessionDate.getTime() - raceDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff < 7;
    });
    
    if (matchingSessions.length > 0) {
      const sortedSessions = [...matchingSessions].sort(
        (a: OpenF1SessionEntry, b: OpenF1SessionEntry) =>
          new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
      );
      setAvailableSessions(sortedSessions);
      
      // Default to Race session
      const raceSession = sortedSessions.find((s: OpenF1SessionEntry) => s.session_type === "Race");
      if (raceSession && !selectedSessionKey) {
        setSelectedSessionKey(raceSession.session_key);
      } else if (!selectedSessionKey && sortedSessions.length > 0) {
        setSelectedSessionKey(sortedSessions[0].session_key);
      }
    }
  }, [openF1SessionsData, currentRace, selectedSessionKey]);
  
  // Handlers
  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    setSelectedRace("1");
    setSelectedSessionKey(null);
    navigate(`/race-analysis/${year}/1`);
  };
  
  const handleRaceChange = (value: string) => {
    setSelectedRace(value);
    setSelectedSessionKey(null);
    navigate(`/race-analysis/${selectedYear}/${value}`);
  };
  
  const handleSessionChange = (value: string) => {
    setSelectedSessionKey(null);
    setTimeout(() => setSelectedSessionKey(Number(value)), 50);
  };
  
  // Check if OpenF1 data is available (2023+)
  const hasOpenF1Data = selectedYear >= 2023 && availableSessions.length > 0;
  
  // Tab configurations with data sources
  const analyticsTabs = [
    { id: 'lapTimes', label: 'Lap Times', icon: Clock, source: 'ergast' as const },
    { id: 'positions', label: 'Positions', icon: TrendingUp, source: 'ergast' as const },
    { id: 'qualifying', label: 'Qualifying', icon: Flag, source: 'ergast' as const },
    { id: 'progression', label: 'Quali → Race', icon: TrendingUpIcon, source: 'ergast' as const },
    { id: 'pitstops', label: 'Pit Stops', icon: Wrench, source: 'ergast' as const },
  ];
  
  const liveDataTabs = [
    { id: 'weather', label: 'Weather', icon: Cloud, source: 'openf1' as const },
    { id: 'radio', label: 'Team Radio', icon: Radio, source: 'openf1' as const },
    { id: 'telemetry', label: 'Telemetry', icon: Gauge, source: 'openf1' as const },
    { id: 'results', label: 'Results', icon: Trophy, source: 'openf1' as const },
    { id: 'overtakes', label: 'Overtakes', icon: Car, source: 'openf1' as const },
  ];
  
  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", isGlass ? "bg-primary/10" : "bg-primary/10")}>
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Race Analysis</h1>
              <p className="text-sm text-muted-foreground">
                Comprehensive race data and telemetry
              </p>
            </div>
          </div>
        </div>
        
        {/* Main Tabs */}
        <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
          <TabsList className={cn(
            "grid grid-cols-2 w-full",
            isGlass && "bg-white/5 border border-white/10"
          )}>
            <TabsTrigger value="raceAnalytics" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Race Analytics
            </TabsTrigger>
            <TabsTrigger value="seasonComparison" className="gap-2">
              <GitCompare className="h-4 w-4" />
              Season Comparison
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="raceAnalytics" className="mt-6 space-y-4">
            {/* Info Alert */}
            <div className={cn(
              "flex items-start gap-3 p-3 rounded-lg border text-sm",
              isGlass 
                ? "bg-blue-500/10 border-blue-500/20 text-blue-300" 
                : "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300"
            )}>
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Unified race analysis combining historical data (Ergast) and real-time telemetry (OpenF1 for 2023+).
              </span>
            </div>
            
            {/* Race Selection Card */}
            <F1Card variant={cardVariant} glassVariant={glassVariant} className={cn("overflow-hidden p-0", isGlass && "border-white/10")}>
              <F1CardHeader className="pb-3 pt-4 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flag className="h-4 w-4 text-primary" />
                    <F1CardTitle className="text-base">Race Selection</F1CardTitle>
                  </div>
                  {currentRace && (
                    <div className="flex items-center gap-2">
                      <CountryFlag country={currentRace.Circuit?.Location?.country || ''} size={16} />
                      <span className="text-sm font-medium">
                        {currentRace.raceName?.replace('Grand Prix', 'GP').replace(/[\u{1F1E0}-\u{1F1FF}]{2}/gu, '').trim()}
                      </span>
                    </div>
                  )}
                </div>
              </F1CardHeader>
              <F1CardContent className="px-4 pb-4">
                <div className="flex flex-wrap gap-4">
                  {/* Year Selector */}
                  <div className="w-full sm:w-auto">
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Season</label>
                    <YearSelector selectedYear={selectedYear} onYearChange={handleYearChange} />
                  </div>
                  
                  {/* Race Selector with Flags */}
                  <div className="w-full sm:flex-1 sm:min-w-[200px]">
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Grand Prix</label>
                    {isRaceScheduleLoading ? (
                      <div className="w-full flex items-center gap-2">
                        <Skeleton className="h-10 w-full" />
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <Select value={selectedRace} onValueChange={handleRaceChange}>
                        <SelectTrigger className={cn("w-full", isGlass && "bg-white/5 border-white/10")}>
                          <SelectValue placeholder="Select race" />
                        </SelectTrigger>
                        <SelectContent>
                          {raceScheduleData?.data?.map((race: RaceScheduleEntry) => (
                            <SelectItem key={race.round} value={race.round}>
                              <span className="flex items-center gap-2">
                                <CountryFlag country={race.Circuit?.Location?.country || ''} size={14} />
                                <span className="text-muted-foreground text-xs">R{race.round}</span>
                                {race.Circuit?.circuitName || race.raceName}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  
                  {/* Session Selector (for OpenF1 data) */}
                  {hasOpenF1Data && (
                    <SessionSelector
                      sessions={availableSessions}
                      selectedSessionKey={selectedSessionKey}
                      onSessionChange={handleSessionChange}
                      isLoading={isOpenF1Loading}
                    />
                  )}
                </div>
              </F1CardContent>
            </F1Card>
            
            {/* Analysis Tabs */}
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              {/* Desktop tabs - Compact pill style */}
              <div className="hidden lg:block space-y-3">
                {/* Historical Data Section */}
                <div className={cn(
                  "rounded-lg p-3",
                  isGlass ? "bg-zinc-900/30 border border-zinc-800/50" : "bg-muted/30"
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <DataSourceBadge source="ergast" showTooltip={false} />
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Historical Data</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {analyticsTabs.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setSelectedTab(tab.id)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                          selectedTab === tab.id
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "hover:bg-muted text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <tab.icon className="h-3 w-3" />
                        <span>{tab.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Live Telemetry Section */}
                {hasOpenF1Data && (
                  <div className={cn(
                    "rounded-lg p-3",
                    isGlass ? "bg-zinc-900/30 border border-zinc-800/50" : "bg-muted/30"
                  )}>
                    <div className="flex items-center gap-2 mb-2">
                      <DataSourceBadge source="openf1" showTooltip={false} />
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Live Telemetry</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {liveDataTabs.map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setSelectedTab(tab.id)}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                            selectedTab === tab.id
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "hover:bg-muted text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <tab.icon className="h-3 w-3" />
                          <span>{tab.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Mobile dropdown */}
              <div className="block lg:hidden mb-4">
                <Select value={selectedTab} onValueChange={setSelectedTab}>
                  <SelectTrigger className={cn("w-full", isGlass && "bg-white/5 border-white/10")}>
                    <SelectValue placeholder="Select analysis" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="px-2 py-1 text-xs text-muted-foreground">Historical Data</div>
                    {analyticsTabs.map(tab => (
                      <SelectItem key={tab.id} value={tab.id}>
                        <div className="flex items-center gap-2">
                          <tab.icon className="h-4 w-4" />
                          <span>{tab.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                    {hasOpenF1Data && (
                      <>
                        <div className="px-2 py-1 text-xs text-muted-foreground border-t mt-1 pt-1">Live Telemetry</div>
                        {liveDataTabs.map(tab => (
                          <SelectItem key={tab.id} value={tab.id}>
                            <div className="flex items-center gap-2">
                              <tab.icon className="h-4 w-4" />
                              <span>{tab.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Tab Content */}
              <Suspense fallback={<TabLoadingFallback />}>
                {/* Analytics Tabs (Ergast) */}
                <TabsContent value="lapTimes" className="mt-4">
                  <F1Card variant={cardVariant} glassVariant={glassVariant} className={cn("overflow-hidden p-0", isGlass && "border-white/10")}>
                    <F1CardHeader className="pb-2 pt-3 px-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-primary" />
                          <F1CardTitle className="text-base">Lap Time Analysis</F1CardTitle>
                        </div>
                        <DataSourceBadge source="ergast" />
                      </div>
                      <F1CardDescription className="text-xs">Compare lap-by-lap times between drivers</F1CardDescription>
                    </F1CardHeader>
                    <F1CardContent className="min-h-[480px] px-4 pb-4">
                      <MuiLapTimeChart year={selectedYear} round={selectedRace} />
                    </F1CardContent>
                  </F1Card>
                </TabsContent>
                
                <TabsContent value="positions" className="mt-4">
                  <F1Card variant={cardVariant} glassVariant={glassVariant} className={cn("overflow-hidden p-0", isGlass && "border-white/10")}>
                    <F1CardHeader className="pb-2 pt-3 px-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-primary" />
                          <F1CardTitle className="text-base">Position Changes</F1CardTitle>
                        </div>
                        <DataSourceBadge source="ergast" />
                      </div>
                      <F1CardDescription className="text-xs">Track position changes throughout the race</F1CardDescription>
                    </F1CardHeader>
                    <F1CardContent className="min-h-[480px] px-4 pb-4">
                      <MuiPositionChart year={selectedYear} round={selectedRace} />
                    </F1CardContent>
                  </F1Card>
                </TabsContent>
                
                <TabsContent value="qualifying" className="mt-4">
                  <F1Card variant={cardVariant} glassVariant={glassVariant} className={cn("overflow-hidden p-0", isGlass && "border-white/10")}>
                    <F1CardHeader className="pb-2 pt-3 px-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Flag className="h-4 w-4 text-primary" />
                          <F1CardTitle className="text-base">Qualifying Analysis</F1CardTitle>
                        </div>
                        <DataSourceBadge source="ergast" />
                      </div>
                      <F1CardDescription className="text-xs">Compare qualifying times across Q1, Q2, and Q3</F1CardDescription>
                    </F1CardHeader>
                    <F1CardContent className="min-h-[400px] max-h-[600px] overflow-auto px-4 pb-4">
                      <MuiQualifyingChart year={selectedYear} round={selectedRace} />
                    </F1CardContent>
                  </F1Card>
                </TabsContent>
                
                <TabsContent value="progression" className="mt-4">
                  <F1Card variant={cardVariant} glassVariant={glassVariant} className={cn("overflow-hidden p-0", isGlass && "border-white/10")}>
                    <F1CardHeader className="pb-2 pt-3 px-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <TrendingUpIcon className="h-4 w-4 text-primary" />
                          <F1CardTitle className="text-base">Qualifying to Race Progression</F1CardTitle>
                        </div>
                        <DataSourceBadge source="ergast" />
                      </div>
                      <F1CardDescription className="text-xs">Visualize progression from qualifying to race results</F1CardDescription>
                    </F1CardHeader>
                    <F1CardContent className="h-[550px] px-4 pb-4">
                      <MuiSankeyChart year={selectedYear} round={selectedRace} />
                    </F1CardContent>
                  </F1Card>
                </TabsContent>
                
                <TabsContent value="pitstops" className="mt-4">
                  <F1Card variant={cardVariant} glassVariant={glassVariant} className={cn("overflow-hidden p-0", isGlass && "border-white/10")}>
                    <F1CardHeader className="pb-2 pt-3 px-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Wrench className="h-4 w-4 text-primary" />
                          <F1CardTitle className="text-base">Pit Stop Analysis</F1CardTitle>
                        </div>
                        <DataSourceBadge source="ergast" />
                      </div>
                      <F1CardDescription className="text-xs">Individual pit stop durations for each driver</F1CardDescription>
                    </F1CardHeader>
                    <F1CardContent className="h-[600px] px-4 pb-4">
                      <MuiPitStopTable year={selectedYear} round={selectedRace} />
                    </F1CardContent>
                  </F1Card>
                </TabsContent>
                
                {/* Live Data Tabs (OpenF1) */}
                {hasOpenF1Data ? (
                  <>
                    <TabsContent value="weather" className="mt-4">
                      <F1Card variant={cardVariant} glassVariant={glassVariant} className={cn("overflow-hidden p-0", isGlass && "border-white/10")}>
                        <F1CardHeader className="pb-2 pt-3 px-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Cloud className="h-4 w-4 text-primary" />
                              <F1CardTitle className="text-base">Weather Conditions</F1CardTitle>
                            </div>
                            <DataSourceBadge source="openf1" />
                          </div>
                          <F1CardDescription className="text-xs">Track temperature, humidity, and wind conditions</F1CardDescription>
                        </F1CardHeader>
                        <F1CardContent className="min-h-[400px] px-4 pb-4">
                          <WeatherAnalysis 
                            year={selectedYear} 
                            round={selectedRace}
                            sessionKey={selectedSessionKey || undefined}
                          />
                        </F1CardContent>
                      </F1Card>
                    </TabsContent>
                    
                    <TabsContent value="radio" className="mt-4">
                      <F1Card variant={cardVariant} glassVariant={glassVariant} className={cn("overflow-hidden p-0", isGlass && "border-white/10")}>
                        <F1CardHeader className="pb-2 pt-3 px-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Radio className="h-4 w-4 text-primary" />
                              <F1CardTitle className="text-base">Team Radio</F1CardTitle>
                            </div>
                            <DataSourceBadge source="openf1" />
                          </div>
                          <F1CardDescription className="text-xs">Driver and team radio communications</F1CardDescription>
                        </F1CardHeader>
                        <F1CardContent className="min-h-[400px] px-4 pb-4">
                          <TeamRadio 
                            year={selectedYear} 
                            round={selectedRace}
                            sessionKey={selectedSessionKey || undefined}
                          />
                        </F1CardContent>
                      </F1Card>
                    </TabsContent>
                    
                    <TabsContent value="telemetry" className="mt-4">
                      <F1Card variant={cardVariant} glassVariant={glassVariant} className={cn("overflow-hidden p-0", isGlass && "border-white/10")}>
                        <F1CardHeader className="pb-2 pt-3 px-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Gauge className="h-4 w-4 text-primary" />
                              <F1CardTitle className="text-base">Telemetry Dashboard</F1CardTitle>
                            </div>
                            <DataSourceBadge source="openf1" />
                          </div>
                          <F1CardDescription className="text-xs">Speed, throttle, brake, and gear data</F1CardDescription>
                        </F1CardHeader>
                        <F1CardContent className="min-h-[500px] px-4 pb-4">
                          <TelemetryDashboard 
                            year={selectedYear} 
                            round={selectedRace}
                            sessionKey={selectedSessionKey || undefined}
                          />
                        </F1CardContent>
                      </F1Card>
                    </TabsContent>
                    
                    <TabsContent value="results" className="mt-4">
                      <F1Card variant={cardVariant} glassVariant={glassVariant} className={cn("overflow-hidden p-0", isGlass && "border-white/10")}>
                        <F1CardHeader className="pb-2 pt-3 px-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Trophy className="h-4 w-4 text-primary" />
                              <F1CardTitle className="text-base">Session Results</F1CardTitle>
                            </div>
                            <DataSourceBadge source="openf1" />
                          </div>
                          <F1CardDescription className="text-xs">Final classification and standings</F1CardDescription>
                        </F1CardHeader>
                        <F1CardContent className="min-h-[500px] px-4 pb-4">
                          <SessionResults 
                            year={selectedYear} 
                            round={selectedRace}
                            sessionKey={selectedSessionKey || undefined}
                          />
                        </F1CardContent>
                      </F1Card>
                    </TabsContent>
                    
                    <TabsContent value="overtakes" className="mt-4">
                      <F1Card variant={cardVariant} glassVariant={glassVariant} className={cn("overflow-hidden p-0", isGlass && "border-white/10")}>
                        <F1CardHeader className="pb-2 pt-3 px-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Car className="h-4 w-4 text-primary" />
                              <F1CardTitle className="text-base">Overtakes Analysis</F1CardTitle>
                            </div>
                            <DataSourceBadge source="openf1" />
                          </div>
                          <F1CardDescription className="text-xs">Track every overtake during the race</F1CardDescription>
                        </F1CardHeader>
                        <F1CardContent className="min-h-[500px] px-4 pb-4">
                          <OvertakesAnalysis 
                            year={selectedYear} 
                            round={selectedRace}
                            sessionKey={selectedSessionKey || undefined}
                          />
                        </F1CardContent>
                      </F1Card>
                    </TabsContent>
                  </>
                ) : (
                  // Show alert for years without OpenF1 data
                  liveDataTabs.map(tab => (
                    <TabsContent key={tab.id} value={tab.id} className="mt-4">
                      <F1Card variant={cardVariant} glassVariant={glassVariant} className={cn("overflow-hidden p-0", isGlass && "border-white/10")}>
                        <F1CardContent className="py-12">
                          <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              Live telemetry data from OpenF1 is only available for races from 2023 onwards.
                              Please select a race from 2023 or later to view {tab.label.toLowerCase()} data.
                            </AlertDescription>
                          </Alert>
                        </F1CardContent>
                      </F1Card>
                    </TabsContent>
                  ))
                )}
              </Suspense>
            </Tabs>
          </TabsContent>
          
          <TabsContent value="seasonComparison" className="mt-6">
            {/* Info Alert */}
            <div className={cn(
              "flex items-start gap-3 p-3 rounded-lg border text-sm mb-4",
              isGlass 
                ? "bg-amber-500/10 border-amber-500/20 text-amber-300" 
                : "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300"
            )}>
              <GitCompare className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Compare lap times, position changes, and qualifying data between different seasons.
              </span>
            </div>
            
            <Suspense fallback={<TabLoadingFallback />}>
              <YearComparisonAnalytics />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default RaceAnalysis;

