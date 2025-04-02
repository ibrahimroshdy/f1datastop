
import { useState, useEffect, useMemo } from "react";
import { LineChart, Line, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { XAxis, YAxis, ReferenceLine } from '@/utils/rechartsWrapper';
import { Skeleton } from "@/components/ui/skeleton";
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";
import { useRaceResults, useLapTimes } from "@/hooks/useF1Data";
import { toast } from "sonner";

interface LapTimeChartProps {
  year: number;
  round: string;
}

const LapTimeChart = ({ year, round }: LapTimeChartProps) => {
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>(["VER", "HAM", "LEC"]);
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);
  const [fastestLapTime, setFastestLapTime] = useState<{time: number, driver: string} | null>(null);
  const [displayMode, setDisplayMode] = useState<'absolute' | 'gap'>('absolute');

  // Use React Query hooks for data fetching
  const { 
    data: raceResultsData, 
    isLoading: isResultsLoading, 
    error: resultsError 
  } = useRaceResults(year, round);
  
  const { 
    data: lapTimesData, 
    isLoading: isLapTimesLoading, 
    error: lapTimesError 
  } = useLapTimes(year, round);
  
  const isLoading = isResultsLoading || isLapTimesLoading;
  const error = resultsError || lapTimesError;
  
  // Process available drivers once race results are loaded
  useEffect(() => {
    if (raceResultsData?.data?.Results) {
      const drivers = raceResultsData.data.Results.map((result: any) => ({
        driverId: result.Driver.driverId,
        code: result.Driver.code || result.Driver.familyName.substring(0, 3).toUpperCase(),
        name: `${result.Driver.givenName} ${result.Driver.familyName}`,
        team: result.Constructor?.constructorId || "unknown",
        hasFastestLap: result.FastestLap?.rank === "1" || false,
        fastestLapTime: result.FastestLap?.Time?.time || null,
        finishPosition: parseInt(result.position) || 0,
      }));
      
      setAvailableDrivers(drivers);
      
      // Auto-select the top 3 finishers and the driver with fastest lap if available
      if (drivers.length > 0) {
        const topDrivers = drivers
          .sort((a, b) => a.finishPosition - b.finishPosition)
          .slice(0, 3)
          .map(d => d.code);
        
        const fastestLapDriver = drivers.find(d => d.hasFastestLap);
        if (fastestLapDriver && !topDrivers.includes(fastestLapDriver.code)) {
          topDrivers.push(fastestLapDriver.code);
        }
        
        if (topDrivers.length > 0) {
          setSelectedDrivers(topDrivers);
        }
      }
    }
  }, [raceResultsData]);

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

  const handleDriverToggle = (driverCode: string) => {
    setSelectedDrivers(prev => 
      prev.includes(driverCode)
        ? prev.filter(d => d !== driverCode)
        : [...prev, driverCode]
    );
  };

  const toggleDisplayMode = () => {
    setDisplayMode(prev => prev === 'absolute' ? 'gap' : 'absolute');
  };

  // Memoize chart data to avoid recalculations
  const chartData = useMemo(() => {
    if (!lapTimesData?.data?.Races || !lapTimesData.data.Races.length) {
      return [];
    }
    
    const race = lapTimesData.data.Races[0];
    
    if (!race.Laps || !race.Laps.length) {
      return [];
    }

    // Find the fastest lap time in the entire race
    let overallFastestLap = { time: Number.MAX_VALUE, driver: '', lap: 0 };
    
    // Process lap time data lap by lap
    const data = race.Laps.map((lap: any) => {
      const lapNumber = parseInt(lap.number);
      const lapData: any = { lap: lapNumber };
      
      lap.Timings.forEach((timing: any) => {
        const driverId = timing.driverId;
        const driver = availableDrivers.find(d => d.driverId === driverId);
        const driverCode = driver?.code || driverId.substring(0, 3).toUpperCase();
        const lapTime = convertLapTimeToSeconds(timing.time);
        
        // Track fastest lap
        if (lapTime > 0 && lapTime < overallFastestLap.time) {
          overallFastestLap = { 
            time: lapTime, 
            driver: driverCode,
            lap: lapNumber
          };
        }
        
        lapData[driverCode] = lapTime;
        lapData[`${driverCode}_raw`] = timing.time; // Store original time format
      });
      
      return lapData;
    });
    
    // Set the fastest lap for the reference line
    if (overallFastestLap.time < Number.MAX_VALUE) {
      setFastestLapTime({
        time: overallFastestLap.time,
        driver: overallFastestLap.driver
      });
    }
    
    // If we're in gap mode, calculate gaps to fastest lap
    if (displayMode === 'gap' && data.length > 0) {
      // Find baseline (typically the race leader) for each lap
      return data.map(lap => {
        const lapNumber = lap.lap;
        const newLap = { lap: lapNumber };
        
        // Find the fastest time in this lap
        let fastestInLap = Number.MAX_VALUE;
        availableDrivers.forEach(driver => {
          const time = lap[driver.code];
          if (time && time > 0 && time < fastestInLap) {
            fastestInLap = time;
          }
        });
        
        // Calculate gaps for each driver
        availableDrivers.forEach(driver => {
          const time = lap[driver.code];
          if (time && time > 0) {
            newLap[driver.code] = time - fastestInLap;
            newLap[`${driver.code}_raw`] = lap[`${driver.code}_raw`];
          }
        });
        
        return newLap;
      });
    }
    
    return data;
  }, [lapTimesData, availableDrivers, displayMode]);

  if (isLoading) {
    return <Skeleton className="h-full w-full" />;
  }

  if (error || chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <p className="text-muted-foreground">
          No lap time data available for this race
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          This could be because the race hasn't occurred yet or lap time data wasn't recorded.
        </p>
      </div>
    );
  }

  // Calculate driver's average lap time
  const getDriverAverageLapTime = (driverCode: string) => {
    if (chartData.length === 0) return null;
    
    let totalTime = 0;
    let lapsCount = 0;
    
    chartData.forEach(lap => {
      if (lap[driverCode] && lap[driverCode] > 0) {
        totalTime += lap[driverCode];
        lapsCount++;
      }
    });
    
    if (lapsCount === 0) return null;
    
    return {
      avg: (totalTime / lapsCount).toFixed(3),
      laps: lapsCount
    };
  };

  return (
    <div className="h-full">
      <div className="mb-4 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">
            {displayMode === 'absolute' ? 'Absolute Lap Times' : 'Gap to Fastest Lap'}
          </h3>
          <button 
            onClick={toggleDisplayMode}
            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 rounded text-sm"
          >
            Show {displayMode === 'absolute' ? 'Gaps' : 'Absolute Times'}
          </button>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {availableDrivers.map(driver => {
            const avgData = getDriverAverageLapTime(driver.code);
            return (
              <button
                key={driver.code}
                className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${
                  selectedDrivers.includes(driver.code)
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-200 text-gray-800'
                }`}
                onClick={() => handleDriverToggle(driver.code)}
                style={{
                  borderLeft: `3px solid ${TEAM_COLORS[driver.team] || '#666'}`
                }}
              >
                <span>{driver.code}</span>
                {avgData && (
                  <span className="text-xs opacity-75 ml-1">
                    {displayMode === 'absolute' ? formatTime(Number(avgData.avg)) : ''}
                  </span>
                )}
                {fastestLapTime?.driver === driver.code && (
                  <span className="text-purple-500 ml-1">⚡</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      
      <div className="h-[500px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis 
              dataKey="lap" 
              label={{ value: 'Lap Number', position: 'insideBottomRight', offset: -10 }} 
              xAxisId="lapTime"
            />
            <YAxis 
              label={{ 
                value: displayMode === 'absolute' ? 'Lap Time (seconds)' : 'Gap to Fastest (seconds)', 
                angle: -90, 
                position: 'insideLeft' 
              }} 
              domain={displayMode === 'absolute' ? ['dataMin - 1', 'dataMax + 1'] : [0, 'dataMax + 0.5']}
              yAxisId="lapTime"
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1a1a1a',
                borderColor: '#333',
                borderRadius: '5px'
              }}
              formatter={(value, name, props) => {
                if (typeof value !== 'number') return [value, name];
                
                const driverCode = String(name).split(' ')[0];
                const originalTime = props.payload[`${driverCode}_raw`];
                
                if (displayMode === 'absolute') {
                  return [formatTime(value), name];
                } else {
                  // Gap mode
                  return [
                    `+${value.toFixed(3)}s (${originalTime})`,
                    name
                  ];
                }
              }}
              labelFormatter={(label) => `Lap ${label}`}
            />
            <Legend />
            
            {fastestLapTime && displayMode === 'absolute' && (
              <ReferenceLine 
                y={fastestLapTime.time} 
                stroke="purple" 
                strokeDasharray="3 3" 
                label={{ 
                  value: `Fastest Lap: ${formatTime(fastestLapTime.time)} (${fastestLapTime.driver})`, 
                  position: 'right', 
                  fill: 'purple' 
                }} 
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
                  name={`${driver.code} (${driver.name.split(' ').pop()})`}
                  stroke={TEAM_COLORS[driver.team] || DRIVER_COLORS[driver.code] || "#666"}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 8 }}
                  connectNulls
                  xAxisId="lapTime"
                  yAxisId="lapTime"
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default LapTimeChart;
