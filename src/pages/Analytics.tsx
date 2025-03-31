
import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import YearSelector from "@/components/common/YearSelector";
import LapTimeChart from "@/components/analytics/LapTimeChart";
import PositionChangeChart from "@/components/analytics/PositionChangeChart";
import { useRaceSchedule } from "@/hooks/useF1Data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Analytics = () => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedTab, setSelectedTab] = useState<string>("lapTimes");
  const [selectedRace, setSelectedRace] = useState<string>("1");
  
  const { data: raceScheduleData, isLoading: isRaceScheduleLoading } = useRaceSchedule(selectedYear);
  
  // Handler for year changes
  const handleYearChange = (year: number) => {
    setSelectedYear(year);
  };

  // Handler for race selection
  const handleRaceChange = (value: string) => {
    setSelectedRace(value);
  };

  // Remove emoji flags from race names
  const removeFlag = (raceName: string) => {
    if (raceName && raceName.length > 3 && raceName.indexOf(' ') > 0) {
      return raceName.substring(raceName.indexOf(' ') + 1);
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
            
            <Select value={selectedRace} onValueChange={handleRaceChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select race" />
              </SelectTrigger>
              <SelectContent>
                {isRaceScheduleLoading ? (
                  <SelectItem value="loading">Loading...</SelectItem>
                ) : (
                  raceScheduleData?.data?.map((race: any) => (
                    <SelectItem key={race.round} value={race.round}>
                      {removeFlag(race.raceName)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        
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
                  Compare lap times between drivers during a race
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[600px]">
                <LapTimeChart 
                  year={selectedYear} 
                  round={selectedRace} 
                />
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
                <PositionChangeChart 
                  year={selectedYear} 
                  round={selectedRace} 
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default Analytics;
