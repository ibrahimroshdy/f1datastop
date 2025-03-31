
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useRaceSchedule, useRaceResults, useRaceQualifying } from "@/hooks/useF1Data";
import { 
  LineChart, 
  Line, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend, 
  ScatterChart, 
  Scatter, 
  ZAxis,
  Cell
} from 'recharts';
import { XAxis, YAxis, ReferenceLine } from '@/utils/rechartsWrapper';
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";

interface RaceResultsAnalysisProps {
  year: number;
}

const RaceResultsAnalysis = ({ year }: RaceResultsAnalysisProps) => {
  const { data: raceScheduleData, isLoading: isScheduleLoading } = useRaceSchedule(year);
  const [selectedRace, setSelectedRace] = useState<string>("");
  const { data: raceResultsData, isLoading: isResultsLoading } = useRaceResults(year, selectedRace);
  const { data: qualifyingResultsData, isLoading: isQualifyingLoading } = useRaceQualifying(year, selectedRace);

  useEffect(() => {
    if (raceScheduleData?.data && raceScheduleData.data.length > 0 && !selectedRace) {
      const sortedRaces = [...raceScheduleData.data].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime());
      
      const lastCompletedRace = sortedRaces
        .filter(race => new Date(race.date) < new Date())
        .pop();
        
      if (lastCompletedRace) {
        setSelectedRace(lastCompletedRace.round);
      } else if (sortedRaces.length > 0) {
        setSelectedRace(sortedRaces[0].round);
      }
    }
  }, [raceScheduleData, selectedRace]);

  const handleRaceChange = (value: string) => {
    setSelectedRace(value);
  };

  const processRaceData = () => {
    if (!raceResultsData?.data || !raceResultsData.data.Results) return [];
    
    return raceResultsData.data.Results.map((result: any) => {
      const driver = result.Driver;
      const position = parseInt(result.position);
      const grid = parseInt(result.grid);
      const constructor = result.Constructor || { constructorId: "unknown" };
      
      return {
        position,
        grid: grid === 0 ? 20 : grid,
        driver: driver.code || driver.familyName.substring(0, 3).toUpperCase(),
        constructorId: constructor.constructorId.toLowerCase(),
        positionChange: grid === 0 ? 0 : grid - position,
        laps: parseInt(result.laps),
        status: result.status,
        time: result.Time ? result.Time.time : null,
        color: TEAM_COLORS[constructor.constructorId.toLowerCase()] || TEAM_COLORS.default
      };
    }).sort((a: any, b: any) => a.position - b.position);
  };

  const processQualifyingData = () => {
    if (!qualifyingResultsData?.data || !qualifyingResultsData.data.QualifyingResults) return [];
    
    return qualifyingResultsData.data.QualifyingResults.map((result: any) => {
      const driver = result.Driver;
      const constructor = result.Constructor || { constructorId: "unknown" };
      const q1 = result.Q1 ? convertLapTimeToSeconds(result.Q1) : null;
      const q2 = result.Q2 ? convertLapTimeToSeconds(result.Q2) : null;
      const q3 = result.Q3 ? convertLapTimeToSeconds(result.Q3) : null;
      
      return {
        position: parseInt(result.position),
        driver: driver.code || driver.familyName.substring(0, 3).toUpperCase(),
        constructorId: constructor.constructorId.toLowerCase(),
        q1,
        q2,
        q3,
        bestTime: q3 || q2 || q1,
        color: TEAM_COLORS[constructor.constructorId.toLowerCase()] || TEAM_COLORS.default
      };
    }).sort((a: any, b: any) => a.position - b.position);
  };

  const convertLapTimeToSeconds = (lapTime: string): number => {
    if (!lapTime) return 0;
    
    const parts = lapTime.includes(':') 
      ? lapTime.split(':') 
      : ['0', lapTime];
    
    if (parts.length !== 2) return 0;
    
    const minutes = parseFloat(parts[0]);
    const seconds = parseFloat(parts[1]);
    
    return minutes * 60 + seconds;
  };

  const raceData = processRaceData();
  const qualifyingDisplayData = processQualifyingData();

  // Helper function to remove flag emojis from race names
  const removeFlag = (raceName: string) => {
    if (raceName && raceName.length > 3 && raceName.indexOf(' ') > 0) {
      return raceName.substring(raceName.indexOf(' ') + 1);
    }
    return raceName;
  };

  const getRaceName = () => {
    if (!raceScheduleData?.data) return "Loading...";
    const race = raceScheduleData.data.find(race => race.round === selectedRace);
    return race ? removeFlag(race.raceName) : "Unknown Race";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <CardTitle>Race Analysis</CardTitle>
            <CardDescription>
              {selectedRace ? getRaceName() : "Select a race to view analysis"}
            </CardDescription>
          </div>
          <Select 
            value={selectedRace} 
            onValueChange={handleRaceChange}
            disabled={isScheduleLoading}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select a race" />
            </SelectTrigger>
            <SelectContent>
              {isScheduleLoading ? (
                <SelectItem value="loading">Loading...</SelectItem>
              ) : (
                raceScheduleData?.data?.map((race) => (
                  <SelectItem key={race.round} value={race.round}>
                    {race.raceName && removeFlag(race.raceName)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="grid">
          <TabsList className="mb-4">
            <TabsTrigger value="grid">Grid vs Finish</TabsTrigger>
            <TabsTrigger value="qualifying">Qualifying Times</TabsTrigger>
          </TabsList>
          
          <TabsContent value="grid">
            {isResultsLoading ? (
              <Skeleton className="h-[350px] w-full" />
            ) : !raceResultsData?.data?.Results || raceResultsData.data.Results.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[350px] text-center">
                <p className="text-muted-foreground">No race results available</p>
                <p className="text-sm text-muted-foreground mt-2">This could be because the race hasn't occurred yet or results weren't recorded.</p>
              </div>
            ) : (
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis 
                      type="number" 
                      dataKey="grid" 
                      name="Grid Position" 
                      domain={[1, 20]}
                      label={{ value: 'Grid Position', position: 'bottom' }}
                      reversed
                      xAxisId="grid"
                    />
                    <YAxis 
                      type="number" 
                      dataKey="position" 
                      name="Finish Position" 
                      domain={[1, 20]}
                      label={{ value: 'Finish Position', angle: -90, position: 'left' }}
                      reversed
                      yAxisId="position"
                    />
                    <ZAxis range={[50, 400]} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1a1a1a',
                        borderColor: '#333',
                        borderRadius: '5px'
                      }}
                      formatter={(value, name, props) => {
                        if (name === 'Grid Position') {
                          return [value, 'Started'];
                        }
                        return [value, 'Finished'];
                      }}
                      labelFormatter={(value, payload) => {
                        if (!payload || payload.length === 0) return '';
                        const item = payload[0].payload;
                        return `${item.driver} (${item.positionChange > 0 ? '+' : ''}${item.positionChange} positions)`;
                      }}
                    />
                    <Legend />
                    <ReferenceLine x={1} y={1} stroke="#666" strokeDasharray="3 3" xAxisId="grid" yAxisId="position" />
                    <ReferenceLine x={20} y={20} stroke="#666" strokeDasharray="3 3" xAxisId="grid" yAxisId="position" />
                    <Scatter 
                      name="Drivers" 
                      data={raceData}
                      xAxisId="grid"
                      yAxisId="position"
                    >
                      {raceData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.color} 
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="qualifying">
            {isQualifyingLoading ? (
              <Skeleton className="h-[350px] w-full" />
            ) : !qualifyingResultsData?.data?.QualifyingResults || qualifyingResultsData.data.QualifyingResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[350px] text-center">
                <p className="text-muted-foreground">No qualifying data available</p>
                <p className="text-sm text-muted-foreground mt-2">This could be because qualifying hasn't occurred yet or data wasn't recorded.</p>
              </div>
            ) : (
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis 
                      dataKey="driver" 
                      type="category"
                    />
                    <YAxis 
                      type="number"
                      domain={['dataMin - 0.5', 'dataMax + 0.5']}
                      tickFormatter={(value) => value.toFixed(0)}
                      label={{ value: 'Lap Time (s)', angle: -90, position: 'left' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1a1a1a',
                        borderColor: '#333',
                        borderRadius: '5px'
                      }}
                      formatter={(value, name) => {
                        if (name === 'Q1') return [formatTime(value as number), 'Q1'];
                        if (name === 'Q2') return [formatTime(value as number), 'Q2'];
                        if (name === 'Q3') return [formatTime(value as number), 'Q3'];
                        return [value, name];
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="q1" 
                      name="Q1" 
                      stroke="#8884d8" 
                      activeDot={{ r: 8 }}
                      connectNulls
                    />
                    <Line 
                      type="monotone" 
                      dataKey="q2" 
                      name="Q2" 
                      stroke="#82ca9d" 
                      activeDot={{ r: 8 }}
                      connectNulls
                    />
                    <Line 
                      type="monotone" 
                      dataKey="q3" 
                      name="Q3" 
                      stroke="#ffc658" 
                      activeDot={{ r: 8 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

const formatTime = (seconds: number) => {
  if (!seconds) return "N/A";
  
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  return `${mins}:${secs.padStart(6, '0')}`;
};

export default RaceResultsAnalysis;
