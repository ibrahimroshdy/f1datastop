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
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";

interface LapTimeAnalysisResponsiveProps {
  year: number;
}

const LapTimeAnalysisResponsive = ({ year }: LapTimeAnalysisResponsiveProps) => {
  const { data: raceScheduleData, isLoading: isScheduleLoading } = useRaceSchedule(year);
  const [selectedRace, setSelectedRace] = useState<string>("");
  const [lapTimeData, setLapTimeData] = useState<any[]>([]);
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);
  const [fastestLap, setFastestLap] = useState<number | null>(null);
  const [displayMode, setDisplayMode] = useState<'absolute' | 'gap'>('absolute');
  const isMobile = useIsMobile();

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
    if (availableDrivers.length > 0 && selectedDrivers.length === 0) {
      // Auto-select top 3 drivers by default
      const top3Drivers = availableDrivers.slice(0, 3).map(driver => driver.code);
      setSelectedDrivers(top3Drivers);
    }
  }, [availableDrivers, selectedDrivers]);

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

  const getSelectedDriversData = () => {
    const selectedData = lapTimeData
      .filter(driver => selectedDrivers.includes(driver.driver));
    
    if (selectedData.length === 0) return [];
    
    const maxLaps = Math.max(
      ...selectedData.map(driver => driver.laps.length)
    );
    
    const chartData = Array.from({ length: maxLaps }, (_, i) => ({
      lap: i + 1
    }));
    
    selectedData.forEach(driver => {
      driver.laps.forEach((lap: any) => {
        if (lap.lap <= chartData.length) {
          if (displayMode === 'absolute') {
            chartData[lap.lap - 1][driver.driver] = lap.time;
            chartData[lap.lap - 1][`${driver.driver}_raw`] = formatTime(lap.time);
          } else {
            chartData[lap.lap - 1][driver.driver] = lap.gap;
            chartData[lap.lap - 1][`${driver.driver}_raw`] = formatTime(lap.time);
          }
        }
      });
    });
    
    return chartData;
  };

  const toggleDisplayMode = () => {
    setDisplayMode(prev => prev === 'absolute' ? 'gap' : 'absolute');
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
          <div>
            <CardTitle>Lap Time Analysis</CardTitle>
            <CardDescription>Compare lap times between drivers</CardDescription>
          </div>
          <div className="flex flex-col xs:flex-row gap-2">
            <Select 
              value={selectedRace} 
              onValueChange={handleRaceChange}
              disabled={isScheduleLoading || isLoading}
            >
              <SelectTrigger className="w-full xs:w-[180px]">
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
            <Button 
              onClick={toggleDisplayMode} 
              variant="outline" 
              size="sm"
              className="h-10"
            >
              Show {displayMode === 'absolute' ? 'Gaps' : 'Absolute Times'}
            </Button>
          </div>
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
            <Tabs defaultValue="drivers">
              <TabsList className="mb-4">
                <TabsTrigger value="drivers">Drivers</TabsTrigger>
                <TabsTrigger value="chart">Chart</TabsTrigger>
              </TabsList>
              
              <TabsContent value="drivers" className="mt-0">
                <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                  {availableDrivers.map(driver => (
                    <button
                      key={driver.code}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
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
              </TabsContent>
              
              <TabsContent value="chart" className="mt-0">
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={getSelectedDriversData()}
                      margin={{ top: 20, right: 30, left: isMobile ? 5 : 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis 
                        dataKey="lap" 
                        label={isMobile ? undefined : { value: 'Lap Number', position: 'insideBottomRight', offset: -10 }} 
                        xAxisId="lapTime"
                        tickCount={isMobile ? 5 : 10}
                      />
                      <YAxis 
                        label={isMobile ? undefined : { 
                          value: displayMode === 'absolute' ? 'Lap Time (seconds)' : 'Gap to Fastest (seconds)', 
                          angle: -90, 
                          position: 'insideLeft' 
                        }} 
                        domain={displayMode === 'absolute' ? ['dataMin - 1', 'dataMax + 1'] : [0, 'dataMax + 0.5']}
                        yAxisId="lapTime"
                        width={isMobile ? 30 : 60}
                        tickFormatter={(value) => {
                          if (displayMode === 'absolute') {
                            return formatTime(value);
                          } else {
                            return `+${value.toFixed(1)}`;
                          }
                        }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1a1a1a',
                          borderColor: '#333',
                          borderRadius: '5px'
                        }}
                        formatter={(value, name) => {
                          if (typeof value === 'number') {
                            const driverCode = String(name).split(' ')[0];
                            return displayMode === 'absolute' 
                              ? [formatTime(value), name]
                              : [`+${value.toFixed(3)}s`, name];
                          }
                          return [value, name];
                        }}
                      />
                      <Legend 
                        formatter={(value) => {
                          const driverCode = value.split(' ')[0];
                          const driver = availableDrivers.find(d => d.code === driverCode);
                          return driver ? `${driverCode}` : driverCode;
                        }}
                        wrapperStyle={{ fontSize: isMobile ? '10px' : '12px' }}
                      />
                      
                      {fastestLap && displayMode === 'absolute' && (
                        <ReferenceLine 
                          y={fastestLap} 
                          stroke="red" 
                          strokeDasharray="3 3" 
                          label={isMobile ? undefined : { value: `Fastest Lap: ${formatTime(fastestLap)}`, position: 'right', fill: 'red' }} 
                          yAxisId="lapTime"
                          xAxisId="lapTime"
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
                            dot={{ r: isMobile ? 2 : 3, fill: TEAM_COLORS[driver.team] || DRIVER_COLORS[driver.code] || "#666" }}
                            activeDot={{ r: isMobile ? 5 : 8 }}
                            connectNulls
                            xAxisId="lapTime"
                            yAxisId="lapTime"
                          />
                        ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LapTimeAnalysisResponsive;
