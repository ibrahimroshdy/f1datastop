/**
 * Utility functions for optimizing data loading
 */

/**
 * Takes full lap data and returns a subset based on loading mode
 * @param data The complete lap data from the API
 * @param loadFullData Flag to determine if we should return all laps or just a subset
 * @returns Filtered lap data
 */
export const optimizeLapData = (data: any, loadFullData: boolean = false) => {
  if (!data || !data.data || !data.data.Races || !data.data.Races.length) {
    return data;
  }

  const races = data.data.Races;
  
  if (!loadFullData && races[0]?.Laps && races[0].Laps.length > 10) {
    // Create a copy of the data to avoid mutating the original
    const optimizedData = JSON.parse(JSON.stringify(data));
    const laps = optimizedData.data.Races[0].Laps;
    const totalLaps = laps.length;
    
    // Take key laps - first 5 laps, last 5 laps, and some in the middle
    // This provides a good overview of race start, finish, and middle
    const keptLaps = [];
    
    // Keep first 5 laps
    keptLaps.push(...laps.slice(0, 5));
    
    // Keep some laps from the middle (every ~10th lap)
    if (totalLaps > 20) {
      const step = Math.max(Math.floor(totalLaps / 10), 1);
      for (let i = 5; i < totalLaps - 5; i += step) {
        keptLaps.push(laps[i]);
      }
    } else {
      // For shorter races, keep every other lap from the middle
      for (let i = 5; i < totalLaps - 5; i += 2) {
        keptLaps.push(laps[i]);
      }
    }
    
    // Keep last 5 laps
    keptLaps.push(...laps.slice(totalLaps - 5));
    
    // Replace the laps array with our filtered version
    optimizedData.data.Races[0].Laps = keptLaps;
    return optimizedData;
  }
  
  return data;
};
