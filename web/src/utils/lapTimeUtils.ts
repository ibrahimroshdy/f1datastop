/**
 * Utility functions for working with lap times
 */

/**
 * Converts a lap time string (e.g. "1:30.456") to seconds (90.456)
 */
export const convertLapTimeToSeconds = (lapTime: string): number => {
  if (!lapTime) return 0;

  const parts = lapTime.includes(':')
    ? lapTime.split(':')
    : ['0', lapTime];

  if (parts.length !== 2) return 0;

  const minutes = parseFloat(parts[0]);
  const seconds = parseFloat(parts[1]);
  const total = minutes * 60 + seconds;

  return Number.isFinite(total) ? total : 0;
};

/**
 * Formats a time in seconds to a string (e.g. 90.456 to "1:30.46")
 */
export const formatTime = (seconds: number): string => {
  if (!seconds) return "N/A";
  
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2);
  return `${mins}:${secs.padStart(5, '0')}`;
};

/**
 * Formats a percentage to have two decimal places
 */
export const formatPercentage = (value: number): string => {
  return value.toFixed(2);
};

/**
 * Processes lap time data for use in charts
 */
export const processLapTimeData = (
  lapTimesData: any, 
  availableDrivers: any[], 
  displayMode: 'absolute' | 'gap'
) => {
  if (!lapTimesData?.data?.Races || !lapTimesData.data.Races.length) {
    return { chartData: [], fastestLapTime: null };
  }
  
  const race = lapTimesData.data.Races[0];
  
  if (!race.Laps || !race.Laps.length) {
    return { chartData: [], fastestLapTime: null };
  }

  // Find the fastest lap time in the entire race
  let overallFastestLap = { time: Number.MAX_VALUE, driver: '', lap: 0 };
  
  // Process lap time data lap by lap
  const data = race.Laps.map((lap: any) => {
    const lapNumber = parseInt(lap.number);
    const lapData: any = { lap: lapNumber };
    
    lap.Timings.forEach((timing: any) => {
      const driverId = timing.driverId;
      const driver = availableDrivers.find(d => d.driverId === driverId);
      const driverCode = driver?.code || driverId.substring(0, 3).toUpperCase();
      const lapTime = convertLapTimeToSeconds(timing.time);
      
      // Track fastest lap
      if (lapTime > 0 && lapTime < overallFastestLap.time) {
        overallFastestLap = { 
          time: lapTime, 
          driver: driverCode,
          lap: lapNumber
        };
      }
      
      lapData[driverCode] = lapTime;
      lapData[`${driverCode}_raw`] = timing.time; // Store original time format
    });
    
    return lapData;
  });
  
  // Set the fastest lap for the reference line
  const fastestLapTime = overallFastestLap.time < Number.MAX_VALUE 
    ? { time: overallFastestLap.time, driver: overallFastestLap.driver }
    : null;
  
  // For now, we'll only return absolute mode data to avoid axis issues
  return { chartData: data, fastestLapTime };
};

/**
 * Calculate driver's average lap time
 */
export const getDriverAverageLapTime = (chartData: any[], driverCode: string) => {
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
