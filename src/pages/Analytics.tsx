import { useState, useMemo } from "react";
import MainLayout from "@/components/layout/MainLayout";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import {
  F1Card,
  F1CardContent,
  F1CardDescription,
  F1CardHeader,
  F1CardTitle,
} from "@/components/f1";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import YearSelector from "@/components/common/YearSelector";
// MUI X Charts versions
import MuiLapTimeChart from "@/components/analytics/MuiLapTimeChart";
import MuiPositionChart from "@/components/analytics/MuiPositionChart";
import MuiQualifyingChart from "@/components/analytics/MuiQualifyingChart";
import MuiPitStopTable from "@/components/analytics/MuiPitStopTable";
import MuiSankeyChart from "@/components/analytics/MuiSankeyChart";
import YearComparisonAnalytics from "@/components/analytics/YearComparisonAnalytics";
import { useRaceSchedule } from "@/hooks/useF1Data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Info, Loader2, GitCompare, Clock, TrendingUp, Timer, Flag, Wrench, TrendingUpIcon, BarChart3, MapPin, Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import CountryFlag from "@/components/common/CountryFlag";

// Function to determine the most appropriate default year - always use current year
const getDefaultYear = () => {
  return new Date().getFullYear();
};

type AnalyticsRaceOption = {
  round: string;
  raceName: string;
  date: string;
  Circuit?: {
    circuitName?: string;
    Location?: { country?: string; locality?: string };
  };
};

const Analytics = () => {
  const [selectedYear, setSelectedYear] = useState<number>(getDefaultYear());
  const [selectedTab, setSelectedTab] = useState<string>("lapTimes");
  const [selectedRace, setSelectedRace] = useState<string>("1");
  const { isGlass, baseTheme } = useTheme();
  const isDark = baseTheme === 'dark';
  const chartSurfaceVariant = isGlass ? ("glass" as const) : ("default" as const);
  const chartSurfaceGlass = isGlass ? ("panel" as const) : ("default" as const);
  
  const { data: raceScheduleData, isLoading: isRaceScheduleLoading } = useRaceSchedule(selectedYear);
  
  // Get currently selected race info
  const selectedRaceInfo = useMemo(() => {
    if (!raceScheduleData?.data) return null;
    return raceScheduleData.data.find((race: AnalyticsRaceOption) => race.round === selectedRace);
  }, [raceScheduleData, selectedRace]);
  
  // Handler for year changes
  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    // Reset race selection when year changes to prevent errors
    setSelectedRace("1");
  };

  // Handler for race selection
  const handleRaceChange = (value: string) => {
    setSelectedRace(value);
  };

  // Remove emoji flags from race names
  const cleanRaceName = (raceName: string) => {
    if (!raceName) return "";
    
    // Remove flag emoji if present (typically at the start followed by a space)
    if (raceName && raceName.length > 3 && raceName.indexOf(' ') > 0) {
      return raceName.substring(raceName.indexOf(' ') + 1);
    }
    
    // Make sure to include circuit name
    if (raceName.includes("Grand Prix")) {
      const parts = raceName.split("Grand Prix");
      if (parts.length > 1) {
        return `${parts[0]}Grand Prix`;
      }
    }
    
    return raceName;
  };

  return (
    <MainLayout>
      <PageContainer>
        <PageHeader
          icon={<BarChart3 />}
          title="F1 Analytics"
          description="Comprehensive race data analysis"
        />

        <Tabs defaultValue="raceAnalytics" className="w-full">
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
                Analyze detailed race data including lap times, position changes, qualifying performance, and pit stop strategies.
              </span>
            </div>

            {/* Race Selection Card */}
            <F1Card
              variant={chartSurfaceVariant}
              glassVariant={chartSurfaceGlass}
              className={cn("overflow-hidden p-0", isGlass && "border-white/10")}
            >
              <F1CardHeader className="pb-3 pt-4 px-4">
                <div className="flex items-center gap-2">
                  <Flag className="h-4 w-4 text-primary" />
                  <F1CardTitle className="!text-base !font-semibold">Race Selection</F1CardTitle>
                </div>
              </F1CardHeader>
              <F1CardContent className="px-4 pb-4">
                <div className="flex flex-wrap gap-4">
                  <div className="w-full sm:w-auto">
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Season</label>
                    <YearSelector selectedYear={selectedYear} onYearChange={handleYearChange} />
                  </div>
                  <div className="w-full sm:flex-1 sm:min-w-[200px]">
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Grand Prix</label>
                    {isRaceScheduleLoading ? (
                      <div className="w-full flex items-center gap-2">
                        <Skeleton className="h-10 w-full" />
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <Select value={selectedRace} onValueChange={handleRaceChange}>
                        <SelectTrigger className={cn(
                          "w-full",
                          isGlass && "bg-white/5 border-white/10"
                        )}>
                          <SelectValue placeholder="Select race" />
                        </SelectTrigger>
                        <SelectContent>
                          {raceScheduleData?.data?.map((race: AnalyticsRaceOption) => (
                            <SelectItem key={race.round} value={race.round}>
                              <span className="flex items-center gap-2">
                                <span className="text-muted-foreground text-xs">R{race.round}</span>
                                {race.Circuit?.circuitName || cleanRaceName(race.raceName)}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </F1CardContent>
            </F1Card>
            
            {/* Circuit Info Display */}
            {selectedRaceInfo && (
              <div className={cn(
                "flex flex-wrap items-center gap-4 p-3 rounded-lg border text-sm",
                isDark 
                  ? "bg-zinc-900/50 border-zinc-800" 
                  : "bg-zinc-50 border-zinc-200",
                isGlass && "bg-white/5 border-white/10"
              )}>
                {/* Country flag and race name */}
                <div className="flex items-center gap-2">
                  <CountryFlag 
                    country={selectedRaceInfo.Circuit?.Location?.country || ''} 
                    className="h-4 w-6"
                  />
                  <span className="font-semibold">{cleanRaceName(selectedRaceInfo.raceName)}</span>
                </div>
                
                {/* Circuit name */}
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="text-xs">{selectedRaceInfo.Circuit?.circuitName}</span>
                </div>
                
                {/* Location */}
                <div className="text-xs text-muted-foreground">
                  {selectedRaceInfo.Circuit?.Location?.locality}, {selectedRaceInfo.Circuit?.Location?.country}
                </div>
                
                {/* Date */}
                <div className="flex items-center gap-1.5 text-muted-foreground ml-auto">
                  <Calendar className="h-3.5 w-3.5" />
                  <span className="text-xs">
                    {new Date(selectedRaceInfo.date).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                </div>
                
                {/* Round badge */}
                <Badge variant="outline" className="text-xs">
                  Round {selectedRaceInfo.round}
                </Badge>
              </div>
            )}
            
            {/* Analysis Tabs */}
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              {/* Tabs for larger screens */}
              <div className="hidden md:block">
                <TabsList className={cn(
                  "grid w-full grid-cols-5",
                  isGlass && "bg-white/5 border border-white/10"
                )}>
                  <TabsTrigger value="lapTimes" className="gap-1.5 text-xs">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Lap Times</span>
                  </TabsTrigger>
                  <TabsTrigger value="positions" className="gap-1.5 text-xs">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>Positions</span>
                  </TabsTrigger>
                  <TabsTrigger value="qualifying" className="gap-1.5 text-xs">
                    <Flag className="h-3.5 w-3.5" />
                    <span>Qualifying</span>
                  </TabsTrigger>
                  <TabsTrigger value="progression" className="gap-1.5 text-xs">
                    <TrendingUpIcon className="h-3.5 w-3.5" />
                    <span>Quali → Race</span>
                  </TabsTrigger>
                  <TabsTrigger value="pitstops" className="gap-1.5 text-xs">
                    <Wrench className="h-3.5 w-3.5" />
                    <span>Pit Stops</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Dropdown for mobile screens */}
              <div className="block md:hidden mb-4">
                <Select value={selectedTab} onValueChange={setSelectedTab}>
                  <SelectTrigger className={cn(
                    "w-full",
                    isGlass && "bg-white/5 border-white/10"
                  )}>
                    <SelectValue placeholder="Select analysis" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lapTimes">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>Lap Times</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="positions">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        <span>Position Changes</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="qualifying">
                      <div className="flex items-center gap-2">
                        <Flag className="h-4 w-4" />
                        <span>Qualifying</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="progression">
                      <div className="flex items-center gap-2">
                        <TrendingUpIcon className="h-4 w-4" />
                        <span>Quali to Race</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="pitstops">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4" />
                        <span>Pit Stops</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <TabsContent value="lapTimes" className="mt-4">
                <F1Card
                  variant={chartSurfaceVariant}
                  glassVariant={chartSurfaceGlass}
                  className={cn("overflow-hidden p-0", isGlass && "border-white/10")}
                >
                  <F1CardHeader className="pb-2 pt-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        <F1CardTitle className="!text-base !font-semibold">Lap Time Analysis</F1CardTitle>
                      </div>
                      <Badge variant="outline" className="text-xs font-normal">
                        MUI X Charts
                      </Badge>
                    </div>
                    <F1CardDescription className="text-xs">
                      Compare lap-by-lap times between drivers
                    </F1CardDescription>
                  </F1CardHeader>
                  <F1CardContent className="min-h-[480px] px-4 pb-4">
                    {selectedTab === "lapTimes" && (
                      <MuiLapTimeChart 
                        year={selectedYear} 
                        round={selectedRace} 
                      />
                    )}
                  </F1CardContent>
                </F1Card>
              </TabsContent>
              
              <TabsContent value="positions" className="mt-4">
                <F1Card
                  variant={chartSurfaceVariant}
                  glassVariant={chartSurfaceGlass}
                  className={cn("overflow-hidden p-0", isGlass && "border-white/10")}
                >
                  <F1CardHeader className="pb-2 pt-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        <F1CardTitle className="!text-base !font-semibold">Position Changes</F1CardTitle>
                      </div>
                      <Badge variant="outline" className="text-xs font-normal">
                        MUI X Charts
                      </Badge>
                    </div>
                    <F1CardDescription className="text-xs">
                      Track how positions change throughout the race
                    </F1CardDescription>
                  </F1CardHeader>
                  <F1CardContent className="min-h-[480px] px-4 pb-4">
                    {selectedTab === "positions" && (
                      <MuiPositionChart 
                        year={selectedYear} 
                        round={selectedRace} 
                      />
                    )}
                  </F1CardContent>
                </F1Card>
              </TabsContent>
              
              <TabsContent value="qualifying" className="mt-4">
                <F1Card
                  variant={chartSurfaceVariant}
                  glassVariant={chartSurfaceGlass}
                  className={cn("overflow-hidden p-0", isGlass && "border-white/10")}
                >
                  <F1CardHeader className="pb-2 pt-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Flag className="h-4 w-4 text-primary" />
                        <F1CardTitle className="!text-base !font-semibold">Qualifying Analysis</F1CardTitle>
                      </div>
                      <Badge variant="outline" className="text-xs font-normal">
                        MUI X Charts
                      </Badge>
                    </div>
                    <F1CardDescription className="text-xs">
                      Compare qualifying times across Q1, Q2, and Q3
                    </F1CardDescription>
                  </F1CardHeader>
                  <F1CardContent className="min-h-[400px] max-h-[600px] overflow-auto px-4 pb-4">
                    {selectedTab === "qualifying" && (
                      <MuiQualifyingChart 
                        year={selectedYear} 
                        round={selectedRace} 
                      />
                    )}
                  </F1CardContent>
                </F1Card>
              </TabsContent>
              
              <TabsContent value="progression" className="mt-4">
                <F1Card
                  variant={chartSurfaceVariant}
                  glassVariant={chartSurfaceGlass}
                  className={cn("overflow-hidden p-0", isGlass && "border-white/10")}
                >
                  <F1CardHeader className="pb-2 pt-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUpIcon className="h-4 w-4 text-primary" />
                        <F1CardTitle className="!text-base !font-semibold">Qualifying to Race Progression</F1CardTitle>
                      </div>
                      <Badge variant="outline" className="text-xs font-normal">
                        Nivo Sankey
                      </Badge>
                    </div>
                    <F1CardDescription className="text-xs">
                      Visualize progression from qualifying to race results
                    </F1CardDescription>
                  </F1CardHeader>
                  <F1CardContent className="h-[550px] px-4 pb-4">
                    {selectedTab === "progression" && (
                      <MuiSankeyChart 
                        year={selectedYear} 
                        round={selectedRace} 
                      />
                    )}
                  </F1CardContent>
                </F1Card>
              </TabsContent>
              
              <TabsContent value="pitstops" className="mt-4">
                <F1Card
                  variant={chartSurfaceVariant}
                  glassVariant={chartSurfaceGlass}
                  className={cn("overflow-hidden p-0", isGlass && "border-white/10")}
                >
                  <F1CardHeader className="pb-2 pt-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-primary" />
                        <F1CardTitle className="!text-base !font-semibold">Pit Stop Analysis</F1CardTitle>
                      </div>
                      <Badge variant="outline" className="text-xs font-normal">
                        MUI X Data Grid
                      </Badge>
                    </div>
                    <F1CardDescription className="text-xs">
                      Individual pit stop durations for each driver
                    </F1CardDescription>
                  </F1CardHeader>
                  <F1CardContent className="h-[550px] px-4 pb-4">
                    {selectedTab === "pitstops" && (
                      <MuiPitStopTable 
                        year={selectedYear} 
                        round={selectedRace} 
                      />
                    )}
                  </F1CardContent>
                </F1Card>
              </TabsContent>
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
                Compare lap times, position changes, and qualifying data between different seasons to see how performance has evolved.
              </span>
            </div>
            
            <YearComparisonAnalytics />
          </TabsContent>
        </Tabs>
      </PageContainer>
    </MainLayout>
  );
};

export default Analytics;
