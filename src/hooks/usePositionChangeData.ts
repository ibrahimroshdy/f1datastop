
import { useState, useEffect, useMemo } from "react";
import { useRaceResults, useLapTimes } from "@/hooks/useF1Data";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { toast } from "sonner";

export interface Driver {
  driverId: string;
  code: string;
  name: string;
  team: string;
  finishPosition: number;
  grid: number;
}

export interface PositionChangeSummary {
  start: number;
  end: number;
  change: number;
  improved: boolean;
}

export const usePositionChangeData = (year: number, round: string) => {
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [hoveredDriver, setHoveredDriver] = useState<string | null>(null);
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
  const [totalLaps, setTotalLaps] = useState<number>(0);
  const [isProcessingData, setIsProcessingData] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);

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
    refetch: refetchLapTimes,
    isError,
    failureCount
  } = useLapTimes(year, round, false); // Always fetch all laps
  
  const isLoading = isResultsLoading || isLapTimesLoading || isProcessingData;
  const error = resultsError || lapTimesError;

  // Auto-retry on error with increased delay between retries
  useEffect(() => {
    if (isError && retryCount < 10) {
      const delaySeconds = Math.min(3 * (2 ** retryCount), 30);
      setLoadingProgress((retryCount * 10));
      
      const timer = setTimeout(() => {
        toast.info(`Retrying position data... Attempt ${retryCount + 1}/10`, {
          id: `position-retry-${retryCount}`,
          duration: 3000,
        });
        
        setRetryCount(prev => prev + 1);
        refetchLapTimes();
      }, delaySeconds * 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isError, retryCount, refetchLapTimes, failureCount]);

  // Set only the first driver selected by default
  useEffect(() => {
    if (raceResultsData?.data?.Results && raceResultsData.data.Results.length > 0) {
      const drivers = raceResultsData.data.Results.map((result: any) => ({
        driverId: result.Driver.driverId,
        code: result.Driver.code || result.Driver.familyName.substring(0, 3).toUpperCase(),
        name: `${result.Driver.givenName} ${result.Driver.familyName}`,
        team: result.Constructor?.constructorId || "unknown",
        finishPosition: parseInt(result.position) || 0,
        grid: parseInt(result.grid) || 0,
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

  // Update total laps when lap data changes
  useEffect(() => {
    if (lapTimesData?.data?.Races?.[0]?.Laps) {
      setIsProcessingData(true);
      // Use setTimeout to allow UI to update before processing large dataset
      setTimeout(() => {
        const laps = lapTimesData.data.Races[0].Laps;
        setTotalLaps(laps.length);
        setIsProcessingData(false);
      }, 0);
    }
  }, [lapTimesData]);

  const handleDriverToggle = (driverCode: string) => {
    setSelectedDrivers(prev => 
      prev.includes(driverCode)
        ? prev.filter(d => d !== driverCode)
        : [...prev, driverCode]
    );
  };

  const handleDriverHover = (driverCode: string | null) => {
    setHoveredDriver(driverCode);
  };

  // Calculate visible drivers (either all selected or just the hovered one)
  const visibleDrivers = useMemo(() => {
    if (hoveredDriver) {
      return selectedDrivers.includes(hoveredDriver) ? [hoveredDriver] : selectedDrivers;
    }
    return selectedDrivers;
  }, [hoveredDriver, selectedDrivers]);

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

  // Find starting and final positions for each driver
  const getPositionChangeSummary = (driverCode: string): PositionChangeSummary | null => {
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

  return {
    chartData,
    availableDrivers,
    selectedDrivers,
    hoveredDriver,
    visibleDrivers,
    isLoading,
    isProcessingData,
    isError,
    error,
    retryCount,
    loadingProgress,
    totalLaps,
    maxLap,
    handleDriverToggle,
    handleDriverHover,
    getPositionChangeSummary,
  };
};
