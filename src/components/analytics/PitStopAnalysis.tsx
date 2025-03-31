
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useRaceSchedule } from "@/hooks/useF1Data";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TEAM_COLORS } from "@/constants/f1Colors";
import { getPitStops } from "@/services/f1Service";
import { toast } from "sonner";

interface PitStopAnalysisProps {
  year: number;
}

const PitStopAnalysis = ({ year }: PitStopAnalysisProps) => {
  const { data: raceScheduleData, isLoading: isScheduleLoading } = useRaceSchedule(year);
  const [selectedRace, setSelectedRace] = useState<string>("");
  const [pitStopData, setPitStopData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update selected race when schedule changes
  useEffect(() => {
    if (raceScheduleData?.data && raceScheduleData.data.length > 0 && !selectedRace) {
      // Select the latest race by default
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

  // Fetch pit stop data when selected race changes
  useEffect(() => {
    if (selectedRace) {
      setIsLoading(true);
      setError(null);
      
      getPitStops(year, selectedRace)
        .then(response => {
          if (response && response.data) {
            const processedData = processPitStopData(response.data);
            setPitStopData(processedData);
          } else {
            setPitStopData([]);
            setError("No pit stop data available");
          }
        })
        .catch(error => {
          console.error("Error fetching pit stop data:", error);
          setPitStopData([]);
          setError("Failed to load pit stop data");
          toast.error("Failed to load pit stop data");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [selectedRace, year]);

  // Process pit stop data for the chart
  const processPitStopData = (data: any) => {
    // Check if the required data structures exist
    if (!data || !data.MRData || !data.MRData.RaceTable || !data.MRData.RaceTable.Races || 
        data.MRData.RaceTable.Races.length === 0) {
      return [];
    }
    
    const race = data.MRData.RaceTable.Races[0];
    
    // If no pit stops data is available
    if (!race.PitStops || race.PitStops.length === 0) {
      return [];
    }
    
    // Group pit stops by driver and calculate average
    const pitStopsByDriver: Record<string, {times: number[], constructor: string, driverCode: string}> = {};
    
    race.PitStops.forEach((stop: any) => {
      const driverId = stop.driverId;
      const seconds = convertToSeconds(stop.duration);
      
      if (!pitStopsByDriver[driverId]) {
        // Find constructor for this driver
        let constructor = "unknown";
        let driverCode = driverId.toUpperCase().substring(0, 3);
        
        if (race.Results) {
          const driverResult = race.Results.find((r: any) => r.Driver.driverId === driverId);
          if (driverResult) {
            if (driverResult.Constructor) {
              constructor = driverResult.Constructor.constructorId;
            }
            if (driverResult.Driver.code) {
              driverCode = driverResult.Driver.code;
            }
          }
        }
        
        pitStopsByDriver[driverId] = {
          times: [],
          constructor,
          driverCode
        };
      }
      
      pitStopsByDriver[driverId].times.push(seconds);
    });
    
    // Calculate averages and format for chart
    return Object.entries(pitStopsByDriver).map(([driverId, data]) => {
      const totalTime = data.times.reduce((sum, time) => sum + time, 0);
      const avgTime = data.times.length > 0 ? totalTime / data.times.length : 0;
      
      return {
        driver: data.driverCode,
        avgPitTime: parseFloat(avgTime.toFixed(3)),
        constructorId: data.constructor,
        count: data.times.length
      };
    }).sort((a, b) => a.avgPitTime - b.avgPitTime);
  };

  // Helper to convert MM:SS.sss to seconds
  const convertToSeconds = (timeString: string): number => {
    if (!timeString) return 0;
    
    const parts = timeString.split(':');
    if (parts.length !== 2) return 0;
    
    const minutes = parseFloat(parts[0]);
    const seconds = parseFloat(parts[1]);
    
    return minutes * 60 + seconds;
  };

  const handleRaceChange = (value: string) => {
    setSelectedRace(value);
  };

  const getRaceName = () => {
    if (!raceScheduleData?.data) return "Loading...";
    const race = raceScheduleData.data.find(race => race.round === selectedRace);
    return race ? race.raceName : "Unknown Race";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <CardTitle>Pit Stop Analysis</CardTitle>
            <CardDescription>Average pit stop duration by driver</CardDescription>
          </div>
          <Select 
            value={selectedRace} 
            onValueChange={handleRaceChange}
            disabled={isScheduleLoading || isLoading}
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
                    {race.raceName}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[350px] w-full" />
        ) : error || pitStopData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[350px] text-center">
            <p className="text-muted-foreground">
              {error || `No pit stop data available for ${getRaceName()}`}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              This could be because the race hasn't occurred yet or pit stop data wasn't recorded.
            </p>
          </div>
        ) : (
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={pitStopData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} horizontal={true} vertical={false} />
                <XAxis type="number" domain={['dataMin - 1', 'dataMax + 1']} unit="s" />
                <YAxis dataKey="driver" type="category" width={40} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1a1a1a',
                    borderColor: '#333',
                    borderRadius: '5px',
                    color: 'white'
                  }} 
                  formatter={(value, name) => [`${value} seconds`, 'Avg Pit Time']}
                  labelFormatter={(value) => {
                    const driver = pitStopData.find(d => d.driver === value);
                    return `${value} (${driver?.count || 0} stops)`;
                  }}
                />
                <Bar 
                  dataKey="avgPitTime" 
                  name="Average Pit Time" 
                  radius={[0, 4, 4, 0]}
                >
                  {pitStopData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={TEAM_COLORS[entry.constructorId] || "#f1263d"} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PitStopAnalysis;
