
import { Driver, FastestLapTime } from "@/types/lapTimeTypes";

/**
 * Converts a lap time string (e.g. "1:30.456") to seconds (90.456)
 */
export const convertLapTimeToSeconds = (lapTimeStr: string): number => {
  if (!lapTimeStr) return 0;
  
  const timeParts = lapTimeStr.split(':');
  if (timeParts.length === 2) {
    const minutes = parseFloat(timeParts[0]);
    const seconds = parseFloat(timeParts[1]);
    return minutes * 60 + seconds;
  }
  
  return parseFloat(lapTimeStr);
};

/**
 * Processes driver data from race results
 */
export const processDriversFromResults = (resultsData: any): Driver[] => {
  if (!resultsData?.data?.Results || resultsData.data.Results.length === 0) {
    return [];
  }
  
  return resultsData.data.Results.map((result: any) => {
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
};

/**
 * Find the fastest lap time from available drivers
 */
export const findFastestLapTime = (drivers: Driver[]): FastestLapTime | null => {
  let fastestDriver = null;
  let fastestTime = Number.MAX_VALUE;

  drivers.forEach(driver => {
    if (driver.hasFastestLap && driver.fastestLapTime && driver.fastestLapTime < fastestTime) {
      fastestTime = driver.fastestLapTime;
      fastestDriver = driver.code;
    }
  });

  return fastestDriver ? { time: fastestTime, driver: fastestDriver } : null;
};

/**
 * Process lap time data into chart format
 */
export const processLapTimeData = (
  lapTimesData: any,
  availableDrivers: Driver[],
  fastestLapTime: FastestLapTime | null
) => {
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
};

/**
 * Calculate average lap time for a driver
 */
export const getAverageTime = (
  lapTimesData: any,
  driverCode: string,
  availableDrivers: Driver[]
): number | null => {
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
