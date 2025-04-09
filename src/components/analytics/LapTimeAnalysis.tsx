import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useRaceSchedule } from "@/hooks/useF1Data";
import { LineChart, Line, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { XAxis, YAxis, ReferenceLine } from '@/utils/rechartsWrapper';
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";
import { getRaceResults, getLapTimes } from "@/services/f1Service";
import { toast } from "sonner";
import LapTimeLineChart from "./LapTimeLineChart";
import { Button } from "@/components/ui/button";
import { BarChart2, LineChart as LucideLineChart } from "lucide-react";

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
  const [displayMode, setDisplayMode] = useState<'absolute' | 'gap'>('absolute');
  const [hoveredDriver, setHoveredDriver] = useState<string | null>(null);

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

  useEffect(() => {
    if (selectedRace) {
      setIsLoading(true);
      setError(null);
      
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

  const getSelectedDriversData = (selectedDrivers: string[]) => {
    if (!lapTimeData || !selectedDrivers.length) return [];

    // Filter data to include only selected drivers
    const selectedData = lapTimeData.filter(lap => 
      selectedDrivers.includes(lap.driver)
    );

    // Calculate max laps from selected data
    const maxLaps = Math.max(...selectedData.map(lap => lap.lap));
    
    const chartData = [];

    // Create an array with one entry per lap
    for (let lap = 1; lap <= maxLaps; lap++) {
      const lapInfo: any = { lap };
      
      // Add data for each selected driver
      selectedDrivers.forEach(driverCode => {
        const driverLapData = selectedData.find(d => 
          d.driver === driverCode && d.lap === lap
        );
        
        if (driverLapData) {
          const rawTime = driverLapData.time;
          // Add raw time value for analysis 
          lapInfo[`${driverCode}_raw`] = formatTime(rawTime);
          
          // If display mode is 'gap', calculate time difference from fastest lap
          if (displayMode === 'gap' && fastestLap) {
            const gapTime = rawTime - fastestLap;
            lapInfo[driverCode] = gapTime;
          } else {
            lapInfo[driverCode] = rawTime;
          }
          
          // Add metadata for outlier detection
          lapInfo[`${driverCode}_isRaw`] = true;
        }
      });
      
      chartData.push(lapInfo);
    }

    return chartData;
  };

  return (
    <Card className="relative">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <CardTitle className="text-2xl">Lap Time Analysis</CardTitle>
            <CardDescription>
              {isScheduleLoading
                ? "Loading race data..."
                : `${getRaceName()} - ${year}`}
            </CardDescription>
          </div>
          <div className="flex gap-2 items-center">
            <Select
              value={selectedRace}
              onValueChange={handleRaceChange}
              disabled={isScheduleLoading}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select a race" />
              </SelectTrigger>
              <SelectContent>
                {raceScheduleData?.data
                  ?.sort((a, b) => parseInt(a.round) - parseInt(b.round))
                  .map((race) => (
                    <SelectItem key={race.round} value={race.round}>
                      {race.round}: {removeFlag(race.raceName)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <div className="bg-muted rounded-md p-1 flex gap-1">
              <Button
                variant={displayMode === 'absolute' ? "default" : "ghost"}
                size="icon"
                onClick={() => setDisplayMode('absolute')}
                className="h-8 w-8 p-0"
                title="Show absolute lap times"
              >
                <BarChart2 className="h-4 w-4" />
              </Button>
              <Button
                variant={displayMode === 'gap' ? "default" : "ghost"}
                size="icon"
                onClick={() => setDisplayMode('gap')}
                className="h-8 w-8 p-0"
                title="Show gaps to fastest lap"
              >
                <LucideLineChart className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-[450px] w-full" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-[450px]">
            <p className="text-red-500 mb-2">Error: {error}</p>
            <p className="text-muted-foreground">
              Try selecting a different race
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {availableDrivers.map((driver) => (
                <Button
                  key={driver.code}
                  variant={selectedDrivers.includes(driver.code) ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleDriverToggle(driver.code)}
                  className="flex items-center gap-1"
                  style={{
                    backgroundColor: selectedDrivers.includes(driver.code) 
                      ? (TEAM_COLORS[driver.team] || DRIVER_COLORS[driver.code] || "#666")
                      : 'transparent',
                    color: selectedDrivers.includes(driver.code) && isColorLight(TEAM_COLORS[driver.team] || DRIVER_COLORS[driver.code] || "#666")
                      ? 'black' 
                      : selectedDrivers.includes(driver.code) ? 'white' : 'inherit',
                    borderColor: TEAM_COLORS[driver.team] || DRIVER_COLORS[driver.code] || "#666"
                  }}
                  onMouseEnter={() => setHoveredDriver(driver.code)}
                  onMouseLeave={() => setHoveredDriver(null)}
                >
                  <span className="text-xs">{driver.code}</span>
                </Button>
              ))}
            </div>
            <LapTimeLineChart
              chartData={getSelectedDriversData(selectedDrivers)}
              availableDrivers={availableDrivers}
              selectedDrivers={selectedDrivers}
              displayMode={displayMode}
              fastestLapTime={fastestLap ? { time: fastestLap, driver: availableDrivers.find(d => d.fastLap?.time === fastestLap)?.code || "Unknown" } : null}
              hoveredDriver={hoveredDriver}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
};

// Helper function to determine if a color is light for text contrast
const isColorLight = (color: string): boolean => {
  if (!color || color === 'transparent') return false;
  
  // If it's a hex color
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 155;
  }
  
  return false;
};

export default LapTimeAnalysis;
