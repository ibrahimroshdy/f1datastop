
import { useState, useEffect, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useRaceResults, useLapTimes } from "@/hooks/useF1Data";
import { toast } from "sonner";
import { processLapTimeData, getDriverAverageLapTime } from "@/utils/lapTimeUtils";
import DriverSelector from "./DriverSelector";
import LapTimeLineChart from "./LapTimeLineChart";
import DisplayModeToggle from "./DisplayModeToggle";

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

  // Memoize chart data to avoid recalculations
  const chartData = useMemo(() => {
    const { chartData, fastestLapTime: fastestLap } = processLapTimeData(
      lapTimesData,
      availableDrivers,
      displayMode
    );
    
    if (fastestLap) {
      setFastestLapTime(fastestLap);
    }
    
    return chartData;
  }, [lapTimesData, availableDrivers, displayMode]);

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

  const getDriverAverage = (driverCode: string) => {
    return getDriverAverageLapTime(chartData, driverCode);
  };

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
      <div className="mb-4 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">
            {displayMode === 'absolute' ? 'Absolute Lap Times' : 'Gap to Fastest Lap'}
          </h3>
          <DisplayModeToggle 
            displayMode={displayMode} 
            onToggle={toggleDisplayMode} 
          />
        </div>
        
        <DriverSelector 
          availableDrivers={availableDrivers}
          selectedDrivers={selectedDrivers}
          onDriverToggle={handleDriverToggle}
          displayMode={displayMode}
          fastestLapTime={fastestLapTime}
          getAverageTime={getDriverAverage}
        />
      </div>
      
      <LapTimeLineChart 
        chartData={chartData}
        availableDrivers={availableDrivers}
        selectedDrivers={selectedDrivers}
        displayMode={displayMode}
        fastestLapTime={fastestLapTime}
      />
    </div>
  );
};

export default LapTimeChart;
