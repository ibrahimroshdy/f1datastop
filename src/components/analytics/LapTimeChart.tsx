
import { useState, useEffect, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useRaceResults, useLapTimes } from "@/hooks/useF1Data";
import { processLapTimeData } from "@/utils/lapTimeUtils";
import DriverSelector from "./DriverSelector";
import LapTimeLineChart from "./LapTimeLineChart";
import DisplayModeToggle from "./DisplayModeToggle";
import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface LapTimeChartProps {
  year: number;
  round: string;
}

const LapTimeChart = ({ year, round }: LapTimeChartProps) => {
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [hoveredDriver, setHoveredDriver] = useState<string | null>(null);
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);
  const [fastestLapTime, setFastestLapTime] = useState<{time: number, driver: string} | null>(null);
  const [displayMode, setDisplayMode] = useState<'absolute' | 'gap'>('absolute');
  const [retryCount, setRetryCount] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("Loading lap time data...");

  const { 
    data: raceResultsData, 
    isLoading: isResultsLoading, 
    error: resultsError 
  } = useRaceResults(year, round);
  
  const { 
    data: lapTimesData, 
    isLoading: isLapTimesLoading, 
    error: lapTimesError,
    refetch: refetchLapTimes,
    isError,
    isFetching,
    failureCount
  } = useLapTimes(year, round, undefined);
  
  const isLoading = isResultsLoading || isLapTimesLoading;
  const error = resultsError || lapTimesError;

  // Auto-retry on error with increased delay between retries
  useEffect(() => {
    if (isError && retryCount < 10) {
      const delaySeconds = Math.min(3 * (2 ** retryCount), 30);
      setLoadingProgress((retryCount * 10));
      setLoadingMessage(`Rate limit reached. Retry ${retryCount + 1}/10 in ${delaySeconds} seconds...`);
      
      console.log(`Retrying lap times fetch attempt ${retryCount + 1}/10 in ${delaySeconds} seconds`);
      
      const timer = setTimeout(() => {
        setRetryCount(prev => prev + 1);
        refetchLapTimes();
      }, delaySeconds * 1000);
      
      return () => clearTimeout(timer);
    } else if (!isError && !isLoading && !isFetching) {
      setLoadingProgress(100);
      setLoadingMessage("Loading complete!");
    } else if (isFetching) {
      setLoadingProgress(50);
      setLoadingMessage("Fetching lap time data...");
    }
  }, [isError, retryCount, refetchLapTimes, isLoading, isFetching, failureCount]);
  
  // Setup available drivers when race results load
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
        grid: parseInt(result.grid) || 0,
      }));
      
      setAvailableDrivers(drivers);
      
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

  // Process lap time data
  const chartData = useMemo(() => {
    if (!lapTimesData || Object.keys(lapTimesData).length === 0) {
      return [];
    }
    
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

  // Event handlers
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

  const getDriverAverage = (driverCode: string): number | null => {
    const result = getDriverAverageLapTime(chartData, driverCode);
    if (result === null) return null;
    return parseFloat(result.avg);
  };

  const handleDriverHover = (driverCode: string | null) => {
    setHoveredDriver(driverCode);
  };

  const visibleDrivers = useMemo(() => {
    if (hoveredDriver) {
      return selectedDrivers.includes(hoveredDriver) ? [hoveredDriver] : selectedDrivers;
    }
    return selectedDrivers;
  }, [hoveredDriver, selectedDrivers]);

  // Loading state with retry information
  if (isLoading || (isError && retryCount < 10) || isFetching) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-4">
        <Skeleton className="h-full w-full opacity-30" /> 
        <div className="absolute flex flex-col items-center justify-center space-y-6 w-3/4 max-w-md">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <div className="w-full space-y-2">
            <Progress 
              value={loadingProgress} 
              className="h-2 w-full" 
              indicatorClassName={isError ? "bg-yellow-500" : "bg-blue-500"}
            />
            <p className="text-center text-muted-foreground text-sm">
              {loadingMessage}
            </p>
            {isError && (
              <Alert className="mt-4 bg-yellow-50 border-yellow-200 text-yellow-900">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-xs">
                  Rate limit exceeded (429 error). The system will automatically retry.
                  This happens because the F1 API has strict rate limits.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Error state after max retries
  if (error && retryCount >= 10) {
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
          
          <Alert className="bg-red-50 border-red-200 text-red-900 mb-4">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription>
              After multiple attempts, we couldn't load the lap time data due to API rate limits. 
              Please try again later or select a different race.
            </AlertDescription>
          </Alert>
          
          <div className="max-h-52">
            <DriverSelector 
              availableDrivers={availableDrivers}
              selectedDrivers={selectedDrivers}
              onDriverToggle={handleDriverToggle}
              displayMode={displayMode}
              fastestLapTime={fastestLapTime}
              getAverageTime={getDriverAverage}
              onDriverHover={handleDriverHover}
            />
          </div>
        </div>
        
        <div className="flex flex-col items-center justify-center h-[500px] text-center">
          <p className="text-muted-foreground">
            Unable to load lap time data after multiple attempts
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Please try again later or select a different race
          </p>
        </div>
      </div>
    );
  }

  // No data available state
  if (chartData.length === 0) {
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

  // Normal view with data
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
          onDriverHover={handleDriverHover}
        />
      </div>
      
      <LapTimeLineChart 
        chartData={chartData}
        availableDrivers={availableDrivers}
        selectedDrivers={visibleDrivers}
        displayMode={displayMode}
        fastestLapTime={fastestLapTime}
        hoveredDriver={hoveredDriver}
      />
    </div>
  );
};

const getDriverAverageLapTime = (chartData: any[], driverCode: string) => {
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

export default LapTimeChart;
