
import { useState, useEffect, useMemo } from "react";
import { useRaceResults, useLapTimes } from "@/hooks/useF1Data";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { toast } from "sonner";
import { formatTime } from "@/utils/lapTimeUtils";

export interface Driver {
  driverId: string;
  code: string;
  name: string;
  team: string;
  finishPosition: number;
  hasFastestLap?: boolean;
}

export const useLapTimeData = (year: number, round: string, requestedDisplayMode: 'absolute' | 'gap') => {
  // Force absolute mode to avoid axis issues
  const displayMode = 'absolute';
  
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [hoveredDriver, setHoveredDriver] = useState<string | null>(null);
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
  const [fastestLapTime, setFastestLapTime] = useState<{ time: number, driver: string } | null>(null);
  const [totalLaps, setTotalLaps] = useState<number>(0);
  const [isProcessingData, setIsProcessingData] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  useEffect(() => {
    if (isError && retryCount < 15) { // Up to 15 retry attempts
      const delaySeconds = Math.min(5 * (2 ** retryCount), 60); // Backoff up to 60 seconds
      
      // Format progress with exactly 2 decimal places
      setLoadingProgress(parseFloat((retryCount * 7).toFixed(2)));
      setErrorMessage(`Rate limit exceeded (429). Automatic retry ${retryCount + 1}/15 in ${delaySeconds} seconds...`);
      
      const timer = setTimeout(() => {
        toast.info(`Retrying lap time data... Attempt ${retryCount + 1}/15`, {
          id: `laptime-retry-${retryCount}`,
          duration: 3000,
        });
        
        setRetryCount(prev => prev + 1);
        refetchLapTimes();
      }, delaySeconds * 1000);
      
      return () => clearTimeout(timer);
    } else if (!isError && !isLoading) {
      setErrorMessage(null);
      setLoadingProgress(100.00); // Make sure we show exactly 100.00%
    }
  }, [isError, retryCount, refetchLapTimes, failureCount, isLoading]);

  useEffect(() => {
    if (raceResultsData?.data?.Results && raceResultsData.data.Results.length > 0) {
      const drivers = raceResultsData.data.Results.map((result: any) => {
        const hasFastestLap = result.FastestLap?.rank === "1";
        const fastestLapTime = hasFastestLap ? 
          convertLapTimeToSeconds(result.FastestLap?.Time?.time) : null;
        
        return {
          driverId: result.Driver.driverId,
          code: result.Driver.code || result.Driver.familyName.substring(0, 3).toUpperCase(),
          name: `${result.Driver.givenName} ${result.Driver.familyName}`,
          team: result.Constructor?.constructorId || "unknown",
          finishPosition: parseInt(result.position) || 0,
          hasFastestLap,
          fastestLapTime
        };
      });
      
      setAvailableDrivers(drivers);
      
      if (drivers.length > 0) {
        const winner = drivers.find(d => d.finishPosition === 1);
        if (winner) {
          setSelectedDrivers([winner.code]);
        } else {
          setSelectedDrivers([drivers[0].code]);
        }
      }

      let fastestDriver = null;
      let fastestTime = Number.MAX_VALUE;

      drivers.forEach(driver => {
        if (driver.hasFastestLap && driver.fastestLapTime && driver.fastestLapTime < fastestTime) {
          fastestTime = driver.fastestLapTime;
          fastestDriver = driver.code;
        }
      });

      if (fastestDriver) {
        setFastestLapTime({ 
          time: fastestTime,
          driver: fastestDriver
        });
      }
    }
  }, [raceResultsData]);

  useEffect(() => {
    if (lapTimesData?.data?.Races?.[0]?.Laps) {
      setIsProcessingData(true);
      const processingMessage = "Processing lap time data...";
      setErrorMessage(processingMessage);
      
      setTimeout(() => {
        const laps = lapTimesData.data.Races[0].Laps;
        setTotalLaps(laps.length);
        
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
  }, [lapTimesData, availableDrivers, fastestLapTime]);

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

  const visibleDrivers = useMemo(() => {
    if (hoveredDriver) {
      return selectedDrivers.includes(hoveredDriver) ? [hoveredDriver] : selectedDrivers;
    }
    return selectedDrivers;
  }, [hoveredDriver, selectedDrivers]);

  const convertLapTimeToSeconds = (lapTimeStr: string): number => {
    if (!lapTimeStr) return 0;
    
    const timeParts = lapTimeStr.split(':');
    if (timeParts.length === 2) {
      const minutes = parseFloat(timeParts[0]);
      const seconds = parseFloat(timeParts[1]);
      return minutes * 60 + seconds;
    }
    
    return parseFloat(lapTimeStr);
  };

  const getAverageTime = (driverCode: string): number | null => {
    if (!lapTimesData?.data?.Races || !driverCode) return null;
    
    const race = lapTimesData.data.Races[0];
    if (!race?.Laps) return null;
    
    const driver = availableDrivers.find(d => d.code === driverCode);
    if (!driver) return null;
    
    const driverId = driver.driverId;
    let totalTime = 0;
    let lapCount = 0;
    
    race.Laps.forEach((lap: any) => {
      const driverTiming = lap.Timings.find((timing: any) => timing.driverId === driverId);
      if (driverTiming) {
        const lapTime = convertLapTimeToSeconds(driverTiming.time);
        if (lapTime > 0) {
          totalTime += lapTime;
          lapCount++;
        }
      }
    });
    
    return lapCount > 0 ? totalTime / lapCount : null;
  };

  const chartData = useMemo(() => {
    if (!lapTimesData?.data?.Races?.[0]?.Laps || !fastestLapTime) {
      return [];
    }
    
    const race = lapTimesData.data.Races[0];
    const laps = race.Laps;
    const processedData: any[] = [];
    
    laps.forEach((lap: any) => {
      const lapNumber = parseInt(lap.number);
      const lapData: any = { lap: lapNumber };
      
      lap.Timings.forEach((timing: any) => {
        const driver = availableDrivers.find(d => d.driverId === timing.driverId);
        if (driver) {
          const lapTime = convertLapTimeToSeconds(timing.time);
          
          lapData[driver.code] = lapTime;
          lapData[`${driver.code}_original`] = lapTime;
        }
      });
      
      processedData.push(lapData);
    });
    
    return processedData;
  }, [lapTimesData, availableDrivers, fastestLapTime]);

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
    errorMessage,
    totalLaps,
    maxLap,
    fastestLapTime,
    handleDriverToggle,
    handleDriverHover,
    getAverageTime,
    convertLapTimeToSeconds,
    // Always return absolute displayMode regardless of what was requested
    displayMode 
  };
};
