
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
  
  return minutes * 60 + seconds;
};

/**
 * Formats a time in seconds to a string (e.g. 90.456 to "1:30.456")
 */
export const formatTime = (seconds: number): string => {
  if (!seconds) return "N/A";
  
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  return `${mins}:${secs.padStart(6, '0')}`;
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
  
  // If we're in gap mode, calculate gaps to fastest lap
  if (displayMode === 'gap' && data.length > 0) {
    // Find baseline (typically the race leader) for each lap
    return { 
      chartData: data.map(lap => {
        const lapNumber = lap.lap;
        const newLap = { lap: lapNumber };
        
        // Find the fastest time in this lap
        let fastestInLap = Number.MAX_VALUE;
        availableDrivers.forEach(driver => {
          const time = lap[driver.code];
          if (time && time > 0 && time < fastestInLap) {
            fastestInLap = time;
          }
        });
        
        // Calculate gaps for each driver
        availableDrivers.forEach(driver => {
          const time = lap[driver.code];
          if (time && time > 0) {
            newLap[driver.code] = time - fastestInLap;
            newLap[`${driver.code}_raw`] = lap[`${driver.code}_raw`];
          }
        });
        
        return newLap;
      }),
      fastestLapTime 
    };
  }
  
  return { chartData, fastestLapTime };
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
