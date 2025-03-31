
import { useState, useEffect, useCallback, useMemo } from "react";
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
  const [fastestLap, setFastestLap] = useState<number | null>(null);

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

  // Memoize chart data to avoid recalculations
  const chartData = useMemo(() => {
    if (!lapTimesData?.data?.Races || !lapTimesData.data.Races.length) {
      return [];
    }
    
    const race = lapTimesData.data.Races[0];
    
    if (!race.Laps || !race.Laps.length) {
      return [];
    }
    
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
          time: lapTime
        });
      });
    });
    
    const maxLaps = Math.max(
      ...Object.values(driverLaps).map(laps => laps.length)
    );
    
    const formattedData = Array.from({ length: maxLaps }, (_, i) => ({
      lap: i + 1
    }));
    
    Object.entries(driverLaps).forEach(([driverCode, laps]) => {
      laps.forEach(lap => {
        if (lap.lap <= formattedData.length) {
          formattedData[lap.lap - 1][driverCode] = lap.time;
        }
      });
    });
    
    return formattedData;
  }, [lapTimesData, availableDrivers]);

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

  return (
    <div className="h-full">
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
              label={{ value: 'Lap Time (seconds)', angle: -90, position: 'insideLeft' }} 
              domain={['dataMin - 1', 'dataMax + 1']}
              yAxisId="lapTime"
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
