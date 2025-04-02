
import { useState, useEffect, useMemo } from "react";
import { LineChart, Line, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { XAxis, YAxis } from '@/utils/rechartsWrapper';
import { Skeleton } from "@/components/ui/skeleton";
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";
import { useRaceResults, useLapTimes } from "@/hooks/useF1Data";
import { toast } from "sonner";

interface PositionChangeChartProps {
  year: number;
  round: string;
}

const PositionChangeChart = ({ year, round }: PositionChangeChartProps) => {
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);
  const [totalLaps, setTotalLaps] = useState<number>(0);

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
        finishPosition: parseInt(result.position) || 0,
        grid: parseInt(result.grid) || 0,
      }));
      
      setAvailableDrivers(drivers);
      
      // Auto-select the top 5 finishers if available
      if (drivers.length > 0) {
        const topDrivers = drivers
          .sort((a, b) => a.finishPosition - b.finishPosition)
          .slice(0, 5)
          .map(d => d.code);
        
        if (topDrivers.length > 0) {
          setSelectedDrivers(topDrivers);
        }
      }
    }
  }, [raceResultsData]);

  // Update total laps when lap data changes
  useEffect(() => {
    if (lapTimesData?.data?.Races?.[0]?.Laps) {
      const laps = lapTimesData.data.Races[0].Laps;
      setTotalLaps(laps.length);
    }
  }, [lapTimesData]);

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
    
    // Process position data lap by lap
    return race.Laps.map((lap: any) => {
      const lapNumber = parseInt(lap.number);
      const lapData: any = { lap: lapNumber };
      
      lap.Timings.forEach((timing: any) => {
        const driverId = timing.driverId;
        const position = parseInt(timing.position);
        
        const driver = availableDrivers.find(d => d.driverId === driverId);
        const driverCode = driver?.code || driverId.substring(0, 3).toUpperCase();
        
        lapData[driverCode] = position;
      });
      
      return lapData;
    });
  }, [lapTimesData, availableDrivers]);

  if (isLoading) {
    return <Skeleton className="h-full w-full" />;
  }

  if (error || chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <p className="text-muted-foreground">
          No position data available for this race
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          This could be because the race hasn't occurred yet or position data wasn't recorded.
        </p>
      </div>
    );
  }

  // Find starting and final positions for each driver
  const getPositionChangeSummary = (driverCode: string) => {
    if (chartData.length === 0) return null;
    
    const firstLap = chartData[0];
    const lastLap = chartData[chartData.length - 1];
    
    if (!firstLap[driverCode] || !lastLap[driverCode]) return null;
    
    const startPos = firstLap[driverCode];
    const endPos = lastLap[driverCode];
    const posChange = startPos - endPos;
    
    return {
      start: startPos,
      end: endPos,
      change: posChange,
      improved: posChange > 0
    };
  };

  // Calculate maximum lap number from the data
  const maxLap = chartData.length > 0 
    ? Math.max(...chartData.map(lap => lap.lap)) 
    : totalLaps;

  return (
    <div className="h-full">
      <div className="mb-4 flex flex-wrap gap-2">
        {availableDrivers.map(driver => {
          const summary = getPositionChangeSummary(driver.code);
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
              {summary && (
                <span className={`text-xs ${summary.improved ? 'text-green-500' : 'text-red-500'}`}>
                  {summary.improved ? `↑${summary.change}` : summary.change === 0 ? '→' : `↓${Math.abs(summary.change)}`}
                </span>
              )}
            </button>
          );
        })}
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
              xAxisId="position"
              // Explicitly set domain to show all laps
              domain={[1, maxLap]}
              type="number"
              allowDecimals={false}
              // Add more ticks to show lap numbers more clearly
              ticks={Array.from({length: maxLap > 10 ? 10 : maxLap}, (_, i) => Math.max(1, Math.round(i * maxLap / 10)))}
            />
            <YAxis 
              reversed 
              domain={[1, 20]} 
              label={{ value: 'Position', angle: -90, position: 'insideLeft' }} 
              yAxisId="position"
              ticks={[1, 5, 10, 15, 20]}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1a1a1a',
                borderColor: '#333',
                borderRadius: '5px'
              }}
              formatter={(value, name, props) => {
                const driverCode = String(name).split(' ')[0];
                const driver = availableDrivers.find(d => d.code === driverCode);
                
                return [
                  `Position: ${value}`,
                  driver ? `${driverCode} (${driver.name.split(' ').pop()})` : driverCode
                ];
              }}
              labelFormatter={(label) => `Lap ${label}`}
            />
            <Legend />
            
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
                  dot={{ r: 1 }}
                  activeDot={{ r: 6 }}
                  connectNulls
                  xAxisId="position"
                  yAxisId="position"
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PositionChangeChart;
