import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import YearSelector from "@/components/common/YearSelector";
import LapTimeChart from "@/components/analytics/LapTimeChart";
import PositionChangeChart from "@/components/analytics/PositionChangeChart";
import QualifyingChart from "@/components/analytics/QualifyingChart";
import PitStopTable from "@/components/analytics/PitStopTable";
import ProgressionChart from "@/components/analytics/ProgressionChart";
import YearComparisonAnalytics from "@/components/analytics/YearComparisonAnalytics";
import { useRaceSchedule } from "@/hooks/useF1Data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Loader2, GitCompare, Clock, TrendingUp, Timer, Flag, Wrench, TrendingUpIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// Function to determine the most appropriate default year
const getDefaultYear = () => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0-based (0 = January)
  
  // If we're in the early months of the year (before April), 
  // use previous year as default as current season might have too few races
  return (currentMonth < 3) ? currentYear - 1 : currentYear;
};

const Analytics = () => {
  const [selectedYear, setSelectedYear] = useState<number>(getDefaultYear());
  const [selectedTab, setSelectedTab] = useState<string>("lapTimes");
  const [selectedRace, setSelectedRace] = useState<string>("1");
  
  const { data: raceScheduleData, isLoading: isRaceScheduleLoading } = useRaceSchedule(selectedYear);
  
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
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="text-3xl font-bold">F1 Analytics</h1>
        </div>
        
        <p className="text-sm text-muted-foreground -mt-4 mb-4">
          View comprehensive race data including lap times, position changes, qualifying, and pit stops.
        </p>
        
        <Tabs defaultValue="raceAnalytics" className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="raceAnalytics">Race Analytics</TabsTrigger>
            <TabsTrigger value="seasonComparison">Season Comparison</TabsTrigger>
          </TabsList>
          
          <TabsContent value="raceAnalytics" className="mt-6">
            <Alert className="mb-4 bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Analyze detailed race data including lap times, position changes, qualifying performance, and pit stop strategies for any race in the selected season.
              </AlertDescription>
            </Alert>

            <Card className="mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Race Selection</CardTitle>
                <CardDescription>Select the season and race to analyze</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-4">
                    <div className="w-full xs:w-auto">
                      <label className="text-sm font-medium mb-1 block">Year</label>
                      <YearSelector selectedYear={selectedYear} onYearChange={handleYearChange} />
                    </div>
                    <div className="w-full xs:w-auto flex-1">
                      <label className="text-sm font-medium mb-1 block">Race</label>
                      {isRaceScheduleLoading ? (
                        <div className="w-full flex items-center space-x-2">
                          <Skeleton className="h-10 w-full" />
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <Select value={selectedRace} onValueChange={handleRaceChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select race" />
                          </SelectTrigger>
                          <SelectContent>
                            {raceScheduleData?.data?.map((race: any) => (
                              <SelectItem key={race.round} value={race.round}>
                                {race.Circuit?.circuitName || cleanRaceName(race.raceName)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              {/* Tabs for larger screens */}
              <div className="hidden md:block">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="lapTimes" className="flex gap-2 items-center">
                    <Clock className="h-4 w-4" />
                    <span>Race Times</span>
                  </TabsTrigger>
                  <TabsTrigger value="positions" className="flex gap-2 items-center">
                    <TrendingUp className="h-4 w-4" />
                    <span>Race Position Changes</span>
                  </TabsTrigger>
                  <TabsTrigger value="qualifying" className="flex gap-2 items-center">
                    <Flag className="h-4 w-4" />
                    <span>Qualifying</span>
                  </TabsTrigger>
                  <TabsTrigger value="progression" className="flex gap-2 items-center">
                    <TrendingUpIcon className="h-4 w-4" />
                    <span>Quali to Race</span>
                  </TabsTrigger>
                  <TabsTrigger value="pitstops" className="flex gap-2 items-center">
                    <Wrench className="h-4 w-4" />
                    <span>Pit Stops</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Dropdown for mobile screens */}
              <div className="block md:hidden mb-4">
                <Select value={selectedTab} onValueChange={setSelectedTab}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select analysis" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lapTimes">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>Race Times</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="positions">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        <span>Race Position Changes</span>
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
              
              <TabsContent value="lapTimes" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Race Time Analysis</CardTitle>
                    <CardDescription>
                      Compare lap-by-lap times between drivers during a race.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-[600px]">
                    {selectedTab === "lapTimes" && (
                      <LapTimeChart 
                        year={selectedYear} 
                        round={selectedRace} 
                      />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="positions" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Race Position Changes</CardTitle>
                    <CardDescription>
                      Track how drivers' positions change throughout the race.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-[600px] p-4">
                    {selectedTab === "positions" && (
                      <PositionChangeChart 
                        year={selectedYear} 
                        round={selectedRace} 
                      />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="qualifying" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Qualifying Analysis</CardTitle>
                    <CardDescription>
                      Compare qualifying lap times across Q1, Q2, and Q3 sessions.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-[600px] p-4">
                    {selectedTab === "qualifying" && (
                      <QualifyingChart 
                        year={selectedYear} 
                        round={selectedRace} 
                      />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="progression" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Qualifying to Race Progression</CardTitle>
                    <CardDescription>
                      Visualize how drivers progress from qualifying positions to race results.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-[600px] p-4">
                    {selectedTab === "progression" && (
                      <ProgressionChart 
                        year={selectedYear} 
                        round={selectedRace} 
                      />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="pitstops" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Pit Stop Analysis</CardTitle>
                    <CardDescription>
                      Individual pit stop durations for each driver. Duration includes pit entry, exit and red flag time, if necessary (MM:ss.sss format).
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-[600px] p-4">
                    {selectedTab === "pitstops" && (
                      <PitStopTable 
                        year={selectedYear} 
                        round={selectedRace} 
                      />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>
          
          <TabsContent value="seasonComparison" className="mt-6">
            <Alert className="mb-4 bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800">
              <GitCompare className="h-4 w-4 mr-2 flex-shrink-0" />
              <AlertDescription className="pl-0">
                Compare lap times, position changes, and qualifying data between different seasons to see how performance has evolved.
              </AlertDescription>
            </Alert>
            
            <YearComparisonAnalytics />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default Analytics;
