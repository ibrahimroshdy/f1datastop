
import { useState, useEffect, useMemo } from "react";
import { LineChart, Line, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { XAxis, YAxis } from '@/utils/rechartsWrapper';
import { Skeleton } from "@/components/ui/skeleton";
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";
import { useRaceResults, useLapTimes } from "@/hooks/useF1Data";
import { toast } from "sonner";

interface LapTimeChartProps {
  year: number;
  round: string;
  currentPage?: number;
  itemsPerPage?: number;
}

const LapTimeChart = ({ year, round, currentPage = 1, itemsPerPage = 10 }: LapTimeChartProps) => {
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);
  const [totalLaps, setTotalLaps] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isProcessingData, setIsProcessingData] = useState<boolean>(false);

  // Use React Query hooks for data fetching with pagination
  const { 
    data: raceResultsData, 
    isLoading: isResultsLoading, 
    error: resultsError 
  } = useRaceResults(year, round);
  
  const { 
    data: lapTimesData, 
    isLoading: isLapTimesLoading, 
    error: lapTimesError 
  } = useLapTimes(year, round, currentPage, itemsPerPage);
  
  const isLoading = isResultsLoading || isLapTimesLoading || isProcessingData;
  const error = resultsError || lapTimesError;

  // Process available drivers once race results are loaded
  useEffect(() => {
    if (raceResultsData?.data?.Results) {
      const drivers = raceResultsData.data.Results.map((result: any) => ({
        driverId: result.Driver.driverId,
        code: result.Driver.code || result.Driver.familyName.substring(0, 3).toUpperCase(),
        name: `${result.Driver.givenName} ${result.Driver.familyName}`,
        team: result.Constructor?.constructorId || "unknown",
      }));
      
      setAvailableDrivers(drivers);
      
      // Auto-select top drivers if none selected
      if (selectedDrivers.length === 0 && drivers.length > 0) {
        const topDrivers = drivers
          .slice(0, Math.min(3, drivers.length))
          .map(d => d.code);
        
        setSelectedDrivers(topDrivers);
      }
    }
  }, [raceResultsData, selectedDrivers.length]);

  // Update total laps and pages when lap data changes
  useEffect(() => {
    if (lapTimesData?.data) {
      setTotalLaps(lapTimesData.data.totalLaps || 0);
      setTotalPages(lapTimesData.data.totalPages || 1);
    }
  }, [lapTimesData]);

  const handleDriverToggle = (driverCode: string) => {
    setSelectedDrivers(prev => 
      prev.includes(driverCode)
        ? prev.filter(d => d !== driverCode)
        : [...prev, driverCode]
    );
  };

  // Process lap time data for the current page
  const processedData = useMemo(() => {
    if (!lapTimesData?.data?.Races || lapTimesData.data.Races.length === 0) {
      return [];
    }

    const race = lapTimesData.data.Races[0];
    if (!race?.Laps || race.Laps.length === 0) {
      return [];
    }

    // Process each lap in the current page
    return race.Laps.map((lap: any) => {
      const lapNumber = parseInt(lap.number);
      const lapData: any = { lap: lapNumber };

      lap.Timings.forEach((timing: any) => {
        const driverId = timing.driverId;
        const lapTime = timing.time;

        // Convert lap time (mm:ss.SSS) to seconds for easier charting
        const timeParts = lapTime.includes(':') 
          ? lapTime.split(':') 
          : ['0', lapTime];
        
        const minutes = parseFloat(timeParts[0]);
        const seconds = parseFloat(timeParts[1]);
        const timeInSeconds = minutes * 60 + seconds;

        const driver = availableDrivers.find(d => d.driverId === driverId);
        const driverCode = driver?.code || driverId.substring(0, 3).toUpperCase();

        lapData[driverCode] = timeInSeconds;
      });

      return lapData;
    });
  }, [lapTimesData, availableDrivers]);

  // Format function for tooltip
  const formatTime = (seconds: number | null): string => {
    if (seconds === null || isNaN(seconds)) return "N/A";
    
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(3);
    return `${mins}:${secs.padStart(6, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Skeleton className="h-[500px] w-full" />
        {isProcessingData && (
          <p className="text-sm text-muted-foreground mt-2">
            Processing lap time data...
          </p>
        )}
      </div>
    );
  }

  if (error || processedData.length === 0) {
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

  // Calculate current page range for display
  const startLap = ((currentPage - 1) * itemsPerPage) + 1;
  const endLap = Math.min(startLap + processedData.length - 1, totalLaps);

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
            data={processedData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis 
              dataKey="lap" 
              label={{ value: `Lap Number (${startLap}-${endLap} of ${totalLaps})`, position: 'insideBottomRight', offset: -10 }} 
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
                borderRadius: '5px',
                color: 'white'
              }}
              formatter={(value, name) => {
                if (typeof value === 'number') {
                  const driverCode = String(name);
                  const driver = availableDrivers.find(d => d.code === driverCode);
                  const driverName = driver ? `${driver.name}` : driverCode;
                  
                  return [formatTime(value), driverName];
                }
                return [value, name];
              }}
              labelFormatter={(label) => `Lap ${label}`}
            />
            <Legend formatter={(value) => {
              const driverCode = String(value);
              const driver = availableDrivers.find(d => d.code === driverCode);
              return driver ? `${driverCode} (${driver.name.split(' ').pop()})` : driverCode;
            }} />
            
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
      
      <div className="text-xs text-muted-foreground mt-2 flex justify-between">
        <span>Page {currentPage} of {totalPages}</span>
        <span>Viewing laps {startLap}-{endLap} of {totalLaps}</span>
      </div>
    </div>
  );
};

export default LapTimeChart;
