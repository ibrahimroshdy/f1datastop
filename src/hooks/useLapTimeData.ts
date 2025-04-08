
import { useState, useEffect, useMemo } from "react";
import { useRaceResults, useLapTimes } from "@/hooks/useF1Data";
import { toast } from "sonner";
import { formatTime } from "@/utils/lapTimeUtils";
import { useDataLoadingState } from "./useDataLoadingState";
import { 
  convertLapTimeToSeconds,
  processDriversFromResults,
  findFastestLapTime,
  processLapTimeData,
  getAverageTime
} from "@/utils/lapTimeDataUtils";
import { Driver, FastestLapTime } from "@/types/lapTimeTypes";

// Use export type for re-exporting types
export type { Driver, FastestLapTime };

export const useLapTimeData = (year: number, round: string, requestedDisplayMode: 'absolute' | 'gap') => {
  // Force absolute mode to avoid axis issues
  const displayMode = 'absolute';
  
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [hoveredDriver, setHoveredDriver] = useState<string | null>(null);
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
  const [fastestLapTime, setFastestLapTime] = useState<FastestLapTime | null>(null);
  const [totalLaps, setTotalLaps] = useState<number>(0);
  
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
    failureCount = 0 // Provide default value to avoid undefined errors
  } = useLapTimes(year, round, false); // Always fetch all laps
  
  const { 
    isProcessingData,
    loadingProgress,
    errorMessage,
    retryCount,
    setIsProcessingData,
    setErrorMessage,
    handleRetry
  } = useDataLoadingState(15); // Max 15 retries
  
  const isLoading = isResultsLoading || isLapTimesLoading || isProcessingData;
  const error = resultsError || lapTimesError;

  // Handle retries
  useEffect(() => {
    return handleRetry(refetchLapTimes, isError, failureCount);
  }, [isError, retryCount, refetchLapTimes, failureCount, handleRetry]);

  // Process race results data
  useEffect(() => {
    if (raceResultsData?.data?.Results && raceResultsData.data.Results.length > 0) {
      const drivers = processDriversFromResults(raceResultsData);
      setAvailableDrivers(drivers);
      
      // Select first driver or winner by default
      if (drivers.length > 0) {
        const winner = drivers.find(d => d.finishPosition === 1);
        if (winner) {
          setSelectedDrivers([winner.code]);
        } else {
          setSelectedDrivers([drivers[0].code]);
        }
      }

      // Find and set fastest lap
      const fastestLap = findFastestLapTime(drivers);
      if (fastestLap) {
        setFastestLapTime(fastestLap);
      }
    }
  }, [raceResultsData]);

  // Process lap times data
  useEffect(() => {
    if (lapTimesData?.data?.Races?.[0]?.Laps) {
      setIsProcessingData(true);
      setErrorMessage("Processing lap time data...");
      
      setTimeout(() => {
        const laps = lapTimesData.data.Races[0].Laps;
        setTotalLaps(laps.length);
        
        // Find fastest lap if not already set
        if (!fastestLapTime) {
          let fastestTime = Number.MAX_VALUE;
          let fastestDriver = '';
          
          laps.forEach((lap: any) => {
            lap.Timings.forEach((timing: any) => {
              const lapTime = convertLapTimeToSeconds(timing.time);
              if (lapTime < fastestTime) {
                fastestTime = lapTime;
                const driver = availableDrivers.find(d => d.driverId === timing.driverId);
                fastestDriver = driver?.code || timing.driverId;
              }
            });
          });
          
          if (fastestDriver) {
            setFastestLapTime({
              time: fastestTime,
              driver: fastestDriver
            });
          }
        }
        
        setIsProcessingData(false);
        setErrorMessage(null);
      }, 0);
    }
  }, [lapTimesData, availableDrivers, fastestLapTime, setIsProcessingData, setErrorMessage]);

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

  // Compute visible drivers based on hover state
  const visibleDrivers = useMemo(() => {
    if (hoveredDriver) {
      return selectedDrivers.includes(hoveredDriver) ? [hoveredDriver] : selectedDrivers;
    }
    return selectedDrivers;
  }, [hoveredDriver, selectedDrivers]);

  // Process chart data
  const chartData = useMemo(() => {
    return processLapTimeData(lapTimesData, availableDrivers, fastestLapTime);
  }, [lapTimesData, availableDrivers, fastestLapTime]);

  const maxLap = chartData.length > 0 
    ? Math.max(...chartData.map(lap => lap.lap)) 
    : totalLaps;

  // Create a getAverageTime function that uses the utility
  const getDriverAvgTime = (driverCode: string): number | null => {
    return getAverageTime(lapTimesData, driverCode, availableDrivers);
  };

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
    errorMessage,
    totalLaps,
    maxLap,
    fastestLapTime,
    handleDriverToggle,
    handleDriverHover,
    getAverageTime: getDriverAvgTime,
    convertLapTimeToSeconds,
    // Always return absolute displayMode regardless of what was requested
    displayMode 
  };
};
