
import { useState, useEffect, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useRaceResults, useLapTimes } from "@/hooks/useF1Data";
import { toast } from "sonner";
import { processLapTimeData, getDriverAverageLapTime } from "@/utils/lapTimeUtils";
import DriverSelector from "./DriverSelector";
import LapTimeLineChart from "./LapTimeLineChart";
import DisplayModeToggle from "./DisplayModeToggle";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface LapTimeChartProps {
  year: number;
  round: string;
}

const LapTimeChart = ({ year, round }: LapTimeChartProps) => {
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);
  const [fastestLapTime, setFastestLapTime] = useState<{time: number, driver: string} | null>(null);
  const [displayMode, setDisplayMode] = useState<'absolute' | 'gap'>('absolute');
  const [loadFullData, setLoadFullData] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  // Use React Query hooks for data fetching
  const { 
    data: raceResultsData, 
    isLoading: isResultsLoading, 
    error: resultsError 
  } = useRaceResults(year, round);
  
  const { 
    data: lapTimesData, 
    isLoading: isLapTimesLoading, 
    error: lapTimesError,
    refetch: refetchLapTimes
  } = useLapTimes(year, round, loadFullData);
  
  const isLoading = isResultsLoading || isLapTimesLoading;
  const error = resultsError || lapTimesError;
  
  // Set only the first driver selected by default
  useEffect(() => {
    if (raceResultsData?.data?.Results && raceResultsData.data.Results.length > 0) {
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
      
      // Auto-select only the winner by default
      if (drivers.length > 0) {
        const winner = drivers.find(d => d.finishPosition === 1);
        if (winner) {
          setSelectedDrivers([winner.code]);
        } else {
          setSelectedDrivers([drivers[0].code]);
        }
      }
    }
  }, [raceResultsData]);

  const handleLoadAllData = async () => {
    setIsLoadingMore(true);
    setLoadFullData(true);
    await refetchLapTimes();
    setIsLoadingMore(false);
    toast.success("Full lap data loaded successfully");
  };

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

  const totalLaps = chartData.length;
  const isPartialData = !loadFullData && totalLaps > 10;

  return (
    <div className="h-full">
      <div className="mb-4 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">
            {displayMode === 'absolute' ? 'Absolute Lap Times' : 'Gap to Fastest Lap'}
          </h3>
          <div className="flex flex-wrap gap-2">
            <DisplayModeToggle 
              displayMode={displayMode} 
              onToggle={toggleDisplayMode} 
            />
            
            {isPartialData && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={handleLoadAllData}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>Load All Laps</>
                )}
              </Button>
            )}
          </div>
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
      
      {isPartialData && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Showing partial lap data. Click "Load All Laps" to view complete race data.
        </p>
      )}
    </div>
  );
};

export default LapTimeChart;
