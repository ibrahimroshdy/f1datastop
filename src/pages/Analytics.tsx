
import { useState, useEffect } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import YearSelector from "@/components/common/YearSelector";
import LapTimeChart from "@/components/analytics/LapTimeChart";
import PositionChangeChart from "@/components/analytics/PositionChangeChart";
import { useRaceSchedule } from "@/hooks/useF1Data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, ArrowUp, ArrowDown, Minus, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const Analytics = () => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-3xl font-bold">F1 Analytics</h1>
          <div className="flex flex-col md:flex-row items-center gap-4">
            <YearSelector selectedYear={selectedYear} onYearChange={handleYearChange} />
            
            {isRaceScheduleLoading ? (
              <div className="w-[250px] flex items-center space-x-2">
                <Skeleton className="h-10 w-full" />
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Select value={selectedRace} onValueChange={handleRaceChange}>
                <SelectTrigger className="w-[250px] bg-f1-black text-white border-gray-700">
                  <SelectValue placeholder="Select race" />
                </SelectTrigger>
                <SelectContent className="bg-black border-gray-700 text-white">
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
        
        <Alert className="mb-4 bg-blue-50 text-blue-800 border-blue-200">
          <Info className="h-4 w-4" />
          <AlertDescription>
            View lap-by-lap data including position changes and timing information. 
            Select a race and switch between tabs to explore different analytics.
            If data loading fails, the system will automatically retry loading the information.
          </AlertDescription>
        </Alert>
        
        {selectedTab === "positions" && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-medium">Position Change Legend:</span>
            <Badge className="flex items-center gap-1 bg-green-100 text-green-800">
              <ArrowUp size={12} /> Improved
            </Badge>
            <Badge className="flex items-center gap-1 bg-red-100 text-red-800">
              <ArrowDown size={12} /> Lost positions
            </Badge>
            <Badge className="flex items-center gap-1 bg-gray-100 text-gray-800">
              <Minus size={12} /> No change
            </Badge>
          </div>
        )}
        
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="lapTimes">Lap Times</TabsTrigger>
            <TabsTrigger value="positions">Position Changes</TabsTrigger>
          </TabsList>
          
          <TabsContent value="lapTimes" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Lap Time Analysis</CardTitle>
                <CardDescription>
                  Compare lap-by-lap times between drivers during a race
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
                <CardTitle>Position Changes</CardTitle>
                <CardDescription>
                  Track how drivers' positions change throughout the race
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[600px]">
                {selectedTab === "positions" && (
                  <PositionChangeChart 
                    year={selectedYear} 
                    round={selectedRace} 
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default Analytics;
