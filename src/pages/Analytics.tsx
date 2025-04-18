import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import YearSelector from "@/components/common/YearSelector";
import LapTimeChart from "@/components/analytics/LapTimeChart";
import PositionChangeChart from "@/components/analytics/PositionChangeChart";
import QualifyingChart from "@/components/analytics/QualifyingChart";
import PitStopTable from "@/components/analytics/PitStopTable";
import YearComparisonAnalytics from "@/components/analytics/YearComparisonAnalytics";
import { useRaceSchedule } from "@/hooks/useF1Data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Loader2, GitCompare } from "lucide-react";
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
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div className="flex flex-col md:flex-row items-center gap-4">
                <YearSelector selectedYear={selectedYear} onYearChange={handleYearChange} />
                
                {isRaceScheduleLoading ? (
                  <div className="w-[250px] flex items-center space-x-2">
                    <Skeleton className="h-10 w-full" />
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Select value={selectedRace} onValueChange={handleRaceChange}>
                    <SelectTrigger className="w-[250px]">
                      <SelectValue placeholder="Select race" />
                    </SelectTrigger>
                    <SelectContent>
                      {isRaceScheduleLoading ? (
                        <SelectItem value="loading">
                          <div className="flex items-center">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Loading races...
                          </div>
                        </SelectItem>
                      ) : (
                        raceScheduleData?.data?.map((race: any) => (
                          <SelectItem key={race.round} value={race.round}>
                            {race.Circuit?.circuitName || cleanRaceName(race.raceName)}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="lapTimes">Race Times</TabsTrigger>
                <TabsTrigger value="positions">Race Position Changes</TabsTrigger>
                <TabsTrigger value="qualifying">Qualifying</TabsTrigger>
                <TabsTrigger value="pitstops">Pit Stops</TabsTrigger>
              </TabsList>
              
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
              
              <TabsContent value="pitstops" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Pit Stop Analysis</CardTitle>
                    <CardDescription>
                      Detailed pit stop timings and strategies for each driver.
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
            <Alert className="mb-4 bg-amber-50 text-amber-800 border-amber-200">
              <GitCompare className="h-4 w-4" />
              <AlertDescription>
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
