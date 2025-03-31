
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useRaceSchedule } from "@/hooks/useF1Data";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";
import { getRaceResults, getLapTimes } from "@/services/f1Service";
import { toast } from "sonner";

interface LapTimeAnalysisProps {
  year: number;
}

const LapTimeAnalysis = ({ year }: LapTimeAnalysisProps) => {
  const { data: raceScheduleData, isLoading: isScheduleLoading } = useRaceSchedule(year);
  const [selectedRace, setSelectedRace] = useState<string>("");
  const [lapTimeData, setLapTimeData] = useState<any[]>([]);
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>(["VER", "HAM"]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);
  const [fastestLap, setFastestLap] = useState<number | null>(null);

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

  // Fetch lap time data when selected race changes
  useEffect(() => {
    if (selectedRace) {
      setIsLoading(true);
      setError(null);
      
      // First get race results to identify drivers
      getRaceResults(year, selectedRace)
        .then(results => {
          if (results?.data?.Results) {
            const drivers = results.data.Results.map((result: any) => ({
              driverId: result.Driver.driverId,
              code: result.Driver.code || result.Driver.familyName.substring(0, 3).toUpperCase(),
              name: `${result.Driver.givenName} ${result.Driver.familyName}`,
              team: result.Constructor?.constructorId || "unknown",
              fastLap: result.FastestLap ? {
                lap: parseInt(result.FastestLap.lap),
                time: convertLapTimeToSeconds(result.FastestLap.Time.time)
              } : null
            }));
            
            // Find fastest lap overall
            let fastest = Number.MAX_VALUE;
            let fastLap = null;
            
            drivers.forEach(driver => {
              if (driver.fastLap && driver.fastLap.time < fastest) {
                fastest = driver.fastLap.time;
                fastLap = driver.fastLap.time;
              }
            });
            
            setFastestLap(fastLap);
            setAvailableDrivers(drivers);
            
            // Then get lap times
            return getLapTimes(year, selectedRace);
          } else {
            throw new Error("No race results found");
          }
        })
        .then(lapData => {
          if (lapData?.data?.Races && lapData.data.Races.length > 0) {
            const race = lapData.data.Races[0];
            
            if (race.Laps && race.Laps.length > 0) {
              const driverLaps: Record<string, any[]> = {};
              
              // Process each lap
              race.Laps.forEach((lap: any) => {
                const lapNumber = parseInt(lap.number);
                
                lap.Timings.forEach((timing: any) => {
                  const driverId = timing.driverId;
                  const driver = availableDrivers.find(d => d.driverId === driverId);
                  const driverCode = driver?.code || driverId.substring(0, 3).toUpperCase();
                  const lapTime = convertLapTimeToSeconds(timing.time);
                  
                  if (!driverLaps[driverCode]) {
                    driverLaps[driverCode] = [];
                  }
                  
                  driverLaps[driverCode].push({
                    lap: lapNumber,
                    time: lapTime,
                    gap: fastestLap ? (lapTime - fastestLap) : 0
                  });
                });
              });
              
              // Transform into chart-friendly format
              const processedData = Object.entries(driverLaps).map(([driverCode, laps]) => {
                const driver = availableDrivers.find(d => d.code === driverCode);
                
                return {
                  driver: driverCode,
                  name: driver?.name || driverCode,
                  team: driver?.team || "unknown",
                  laps: laps.sort((a, b) => a.lap - b.lap)
                };
              });
              
              setLapTimeData(processedData);
            } else {
              setError("No lap data available for this race");
              setLapTimeData([]);
            }
          } else {
            setError("No lap data available");
            setLapTimeData([]);
          }
        })
        .catch(error => {
          console.error("Error fetching lap time data:", error);
          setError("Failed to load lap time data");
          setLapTimeData([]);
          toast.error("Failed to load lap time data");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [selectedRace, year, availableDrivers, fastestLap]);

  // Helper function to convert lap time (MM:SS.sss) to seconds
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

  // Format seconds back to MM:SS.sss
  const formatTime = (seconds: number): string => {
    if (!seconds) return "N/A";
    
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(3);
    return `${mins}:${secs.padStart(6, '0')}`;
  };

  const handleRaceChange = (value: string) => {
    setSelectedRace(value);
  };

  const handleDriverToggle = (driverCode: string) => {
    setSelectedDrivers(prev => 
      prev.includes(driverCode)
        ? prev.filter(d => d !== driverCode)
        : [...prev, driverCode]
    );
  };

  // Helper function to remove flag emojis from race names
  const removeFlag = (raceName: string) => {
    // This will match and remove flag emojis at the beginning followed by a space
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

  // Get lap times for selected drivers only
  const getSelectedDriversData = () => {
    const selectedData = lapTimeData
      .filter(driver => selectedDrivers.includes(driver.driver));
    
    if (selectedData.length === 0) return [];
    
    // Find the max number of laps among selected drivers
    const maxLaps = Math.max(
      ...selectedData.map(driver => driver.laps.length)
    );
    
    // Create a lap-by-lap chart data structure
    const chartData = Array.from({ length: maxLaps }, (_, i) => ({
      lap: i + 1
    }));
    
    // Add each driver's lap time
    selectedData.forEach(driver => {
      driver.laps.forEach((lap: any) => {
        if (lap.lap <= chartData.length) {
          chartData[lap.lap - 1][driver.driver] = lap.time;
        }
      });
    });
    
    return chartData;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <CardTitle>Lap Time Comparison</CardTitle>
            <CardDescription>Compare lap times between drivers</CardDescription>
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
                    {race.raceName && removeFlag(race.raceName)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[400px] w-full" />
        ) : error || lapTimeData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-center">
            <p className="text-muted-foreground">
              {error || `No lap time data available for ${getRaceName()}`}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              This could be because the race hasn't occurred yet or lap time data wasn't recorded.
            </p>
          </div>
        ) : (
          <div>
            <div className="mb-4 flex flex-wrap gap-2">
              {availableDrivers.map(driver => (
                <button
                  key={driver.code}
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    selectedDrivers.includes(driver.code)
                      ? 'bg-gray-800 text-white'
                      : 'bg-gray-200 text-gray-800'
                  }`}
                  onClick={() => handleDriverToggle(driver.code)}
                  style={{
                    borderLeft: `3px solid ${TEAM_COLORS[driver.team] || '#666'}`
                  }}
                >
                  {driver.code}
                </button>
              ))}
            </div>
            
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={getSelectedDriversData()}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis 
                    dataKey="lap" 
                    label={{ value: 'Lap Number', position: 'insideBottomRight', offset: -10 }} 
                  />
                  <YAxis 
                    label={{ value: 'Lap Time (seconds)', angle: -90, position: 'insideLeft' }} 
                    domain={['dataMin - 1', 'dataMax + 1']}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1a1a1a',
                      borderColor: '#333',
                      borderRadius: '5px'
                    }}
                    formatter={(value, name) => {
                      if (typeof value === 'number') {
                        return [formatTime(value), name];
                      }
                      return [value, name];
                    }}
                  />
                  <Legend />
                  
                  {fastestLap && (
                    <ReferenceLine 
                      y={fastestLap} 
                      stroke="red" 
                      strokeDasharray="3 3" 
                      label={{ value: 'Fastest Lap', position: 'right', fill: 'red' }} 
                    />
                  )}
                  
                  {availableDrivers
                    .filter(driver => selectedDrivers.includes(driver.code))
                    .map(driver => (
                      <Line
                        key={driver.code}
                        type="monotone"
                        dataKey={driver.code}
                        name={driver.code}
                        stroke={TEAM_COLORS[driver.team] || DRIVER_COLORS[driver.code] || "#666"}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 8 }}
                        connectNulls
                      />
                    ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LapTimeAnalysis;
