
/**
 * Utility functions for optimizing data loading
 */

/**
 * Takes full lap data and returns a subset based on loading mode
 * This function no longer filters data - it just returns it as is
 * We keep it for backward compatibility
 * @param data The complete lap data from the API
 * @param loadFullData Flag is no longer used
 * @returns Original lap data unchanged
 */
export const optimizeLapData = (data: any, loadFullData: boolean = false) => {
  // We no longer optimize by removing laps - we always return the full data
  return data;
};
