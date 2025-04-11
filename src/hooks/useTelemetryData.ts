import { useState, useEffect, useMemo } from "react";
import { useCarData, useDrivers, useLapData } from "@/hooks/useOpenF1Data";
import { processOpenF1CarData } from "@/utils/apiAdapters";
import { toast } from "sonner";

// Create a global cache for telemetry data to persist across component remounts
// This dramatically improves performance for large datasets
const globalTelemetryCache: {[key: string]: TelemetryDataPoint[]} = {};

export interface TelemetryDataPoint {
  time: number;
  speed: number;
  rpm: number;
  throttle: number;
  brake: number;
  gear: number;
  drs: number;
  lap?: number;
  sector?: number;
  isCorner?: boolean;
  cornerName?: string;
}

export interface Driver {
  driver_number: number;
  name: string;
  team_name: string;
  team_color: string;
  name_acronym: string;
  isLoading?: boolean;
  isDataLoaded?: boolean;
  hasError?: boolean;
}

export const useTelemetryData = (sessionKey: number, selectedDrivers: number[] = []) => {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [selectedTimeRange, setSelectedTimeRange] = useState<[number, number] | null>(null);
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [driverDataCache, setDriverDataCache] = useState<{[key: number]: TelemetryDataPoint[]}>({});
  const [driverLoadingState, setDriverLoadingState] = useState<{[key: number]: boolean}>({});

  // Reset cached data when session changes
  useEffect(() => {
    console.log("Session key changed in useTelemetryData:", sessionKey);
    
    // Clear the driver data cache when the session changes
    setDriverDataCache({});
    setDriverLoadingState({});
    setErrorMessage(null);
    setLoadingProgress(0);
    
    // Don't clear global cache as it might be needed for session comparison
  }, [sessionKey]);

  // Fetch drivers for the session
  const { 
    data: driversData, 
    isLoading: isDriversLoading, 
    error: driversError 
  } = useDrivers(sessionKey);

  // Fetch lap data for context
  const { 
    data: lapData, 
    isLoading: isLapDataLoading, 
    error: lapDataError 
  } = useLapData(sessionKey);

  // Process available drivers
  useEffect(() => {
    if (driversData?.data) {
      const teamColors: { [key: string]: string } = {
        "Red Bull Racing": "#0600EF",
        "Ferrari": "#DC0000",
        "Mercedes": "#00D2BE",
        "McLaren": "#FF8700",
        "Aston Martin": "#006F62",
        "Alpine": "#0090FF", 
        "Williams": "#005AFF",
        "RB": "#1E41FF",
        "Haas F1 Team": "#FFFFFF",
        "Kick Sauber": "#900000"
      };

      const drivers = driversData.data.map((driver: any) => ({
        driver_number: driver.driver_number,
        name: `${driver.first_name} ${driver.last_name}`,
        team_name: driver.team_name || "Unknown Team",
        team_color: teamColors[driver.team_name] || "#CCCCCC",
        name_acronym: driver.name_acronym,
        isLoading: false,
        isDataLoaded: false
      }));

      setAvailableDrivers(drivers);
    }
  }, [driversData]);

  // Update loading progress
  useEffect(() => {
    const isLoading = isDriversLoading || isLapDataLoading || Object.values(driverLoadingState).some(Boolean);
    
    if (isLoading) {
      let totalQueries = 2; // drivers + lap data
      let loadingDriversCount = Object.values(driverLoadingState).filter(Boolean).length;
      totalQueries += loadingDriversCount || 0;
      
      let completedQueries = 0;
      
      if (!isDriversLoading) completedQueries++;
      if (!isLapDataLoading) completedQueries++;
      
      const progress = Math.round((completedQueries / totalQueries) * 100);
      setLoadingProgress(progress);
    } else {
      setLoadingProgress(100);
    }
  }, [isDriversLoading, isLapDataLoading, driverLoadingState]);

  // Handle errors
  useEffect(() => {
    const error = driversError || lapDataError;
    
    if (error) {
      setErrorMessage("Error loading telemetry data. Please try again.");
      toast.error("Failed to load telemetry data", {
        description: "There was an error fetching the telemetry data. Please try again later.",
        duration: 5000,
      });
    } else {
      setErrorMessage(null);
    }
  }, [driversError, lapDataError]);

  // On component mount, check if we already have data in the global cache
  useEffect(() => {
    // Initialize the cache from global storage if available
    const cachedDrivers: {[key: number]: TelemetryDataPoint[]} = {};
    let foundCachedData = false;
    
    selectedDrivers.forEach(driverNum => {
      const cacheKey = `${sessionKey}_${driverNum}`;
      if (globalTelemetryCache[cacheKey]) {
        cachedDrivers[driverNum] = globalTelemetryCache[cacheKey];
        foundCachedData = true;
        
        // Also update driver states
        setAvailableDrivers(prev => 
          prev.map(d => 
            d.driver_number === driverNum 
              ? { ...d, isLoading: false, isDataLoaded: true } 
              : d
          )
        );
      }
    });
    
    if (foundCachedData) {
      setDriverDataCache(prev => ({
        ...prev,
        ...cachedDrivers
      }));
    }
  }, [sessionKey]);

  // Load driver data on demand
  const loadDriverData = async (driverNumber: number) => {
    // First check the global cache
    const cacheKey = `${sessionKey}_${driverNumber}`;
    
    if (globalTelemetryCache[cacheKey]) {
      // Use the global cache data
      setDriverDataCache(prev => ({
        ...prev,
        [driverNumber]: globalTelemetryCache[cacheKey]
      }));
      
      // Update driver states
      setAvailableDrivers(prev => 
        prev.map(d => 
          d.driver_number === driverNumber 
            ? { ...d, isLoading: false, isDataLoaded: true } 
            : d
        )
      );
      
      return;
    }
    
    // Skip if already loaded or loading
    if (driverDataCache[driverNumber] || driverLoadingState[driverNumber]) {
      return;
    }
    
    // Mark driver as loading
    setDriverLoadingState(prev => ({
      ...prev,
      [driverNumber]: true
    }));
    
    // Update driver states in available drivers
    setAvailableDrivers(prev => 
      prev.map(d => 
        d.driver_number === driverNumber 
          ? { ...d, isLoading: true } 
          : d
      )
    );
    
    try {
      console.log(`Fetching telemetry data for driver ${driverNumber}`);
      
      // Fetch data for a specific driver only - DON'T add limit param as it causes issues
      const result = await fetch(`/api/openf1/car_data?session_key=${sessionKey}&driver_number=${driverNumber}`, {
        mode: 'cors',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!result.ok) {
        console.error(`HTTP error for driver ${driverNumber}:`, result.status);
        throw new Error(`HTTP error ${result.status} when fetching driver ${driverNumber} data`);
      }
      
      // First get the response as text to validate it's actually JSON
      const responseText = await result.text();
      
      // Check if it looks like HTML (typically error pages start with <!DOCTYPE or <html)
      if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
        console.error(`HTML response for driver ${driverNumber}:`, responseText.substring(0, 100));
        throw new Error(`Server returned HTML instead of JSON for driver ${driverNumber}`);
      }
      
      // Try to parse the JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`JSON parse error for driver ${driverNumber}:`, parseError);
        throw new Error(`Invalid JSON response for driver ${driverNumber}`);
      }
      
      // Check if the response is actually empty (empty array)
      if (!data || !Array.isArray(data) || data.length === 0) {
        console.error(`Empty data array for driver ${driverNumber}`);
        throw new Error(`No telemetry data available for driver ${driverNumber}`);
      }
      
      console.log(`Received ${data.length} data points for driver ${driverNumber}`);
      
      // Additional validation: Ensure the data contains valid telemetry points
      // This prevents issues with malformed data causing rendering problems
      const validData = data.filter(item => 
        item && 
        typeof item.date === 'string' && 
        typeof item.speed === 'number' && 
        typeof item.rpm === 'number' && 
        typeof item.throttle === 'number' && 
        typeof item.brake === 'number' && 
        typeof item.n_gear === 'number' && 
        typeof item.drs === 'number'
      );
      
      // If no valid points are found after filtering, throw error
      if (validData.length === 0) {
        console.error(`No valid data points for driver ${driverNumber} after filtering`);
        throw new Error(`Invalid telemetry data format for driver ${driverNumber}`);
      }
      
      console.log(`${validData.length} valid data points for driver ${driverNumber}`);
      
      // Very large datasets need special handling
      let dataToProcess = validData;
      const dataSizeMB = JSON.stringify(dataToProcess).length / (1024 * 1024);
      
      // For extremely large datasets, use aggressive intelligent downsampling
      // Target sizes:
      // - < 1000 points for small datasets
      // - 500-800 points for medium datasets 
      // - 250-500 points for large datasets (> 5MB)
      
      // Adaptive sampling logic based on size
      let targetPoints = 1000;
      
      if (dataToProcess.length > 20000 || dataSizeMB > 10) {
        // Very large dataset (like driver 10)
        targetPoints = 250; 
      } else if (dataToProcess.length > 10000 || dataSizeMB > 5) {
        // Large dataset
        targetPoints = 500;
      } else if (dataToProcess.length > 5000) {
        // Medium dataset
        targetPoints = 800;
      }
      
      if (dataToProcess.length > targetPoints) {
        // Advanced sampling that preserves more data in dynamic segments
        // and less in stable segments to maintain important features
        
        const samplingRate = Math.ceil(dataToProcess.length / targetPoints);
        
        if (samplingRate <= 2) {
          // Simple evenly-spaced sampling for small reductions
          dataToProcess = dataToProcess.filter((_, index) => index % samplingRate === 0);
        } else {
          // Intelligent sampling for larger reductions
          const sampledData = [];
          let prevSpeed = -1;
          let prevRPM = -1;
          let prevThrottle = -1;
          let prevBrake = -1;
          let prevGear = -1;
          let prevDrs = -1;
          let consecutiveSkips = 0;
          const MAX_CONSECUTIVE_SKIPS = Math.min(samplingRate * 2, 10); // Never skip more than 10 points in a row
          
          for (let i = 0; i < dataToProcess.length; i++) {
            const point = dataToProcess[i];
            
            // Force include points at regular intervals to ensure we don't get too sparse
            const forceInclude = i % samplingRate === 0 || consecutiveSkips >= MAX_CONSECUTIVE_SKIPS;
            
            // Check if this point represents a significant change
            const speedDelta = Math.abs(point.speed - prevSpeed);
            const rpmDelta = Math.abs(point.rpm - prevRPM);
            const throttleDelta = Math.abs(point.throttle - prevThrottle);
            const brakeDelta = Math.abs(point.brake - prevBrake);
            const gearChanged = point.n_gear !== prevGear;
            const drsChanged = point.drs !== prevDrs;
            
            // Include points with significant changes or forced inclusion
            const significantChange = 
              speedDelta > 10 || 
              rpmDelta > 1000 || 
              throttleDelta > 20 || 
              brakeDelta > 20 || 
              gearChanged || 
              drsChanged;
              
            if (forceInclude || significantChange) {
              sampledData.push(point);
              
              // Update previous values
              prevSpeed = point.speed;
              prevRPM = point.rpm;
              prevThrottle = point.throttle;
              prevBrake = point.brake;
              prevGear = point.n_gear;
              prevDrs = point.drs;
              
              // Reset consecutive skips
              consecutiveSkips = 0;
            } else {
              consecutiveSkips++;
            }
          }
          
          // Always include the last point
          if (sampledData.length > 0 && 
              sampledData[sampledData.length - 1] !== dataToProcess[dataToProcess.length - 1]) {
            sampledData.push(dataToProcess[dataToProcess.length - 1]);
          }
          
          dataToProcess = sampledData;
        }
      }
      
      // Process the data
      const processedData = processOpenF1CarData(dataToProcess);
      
      // Verify processed data is valid
      if (!processedData || processedData.length === 0) {
        throw new Error(`Processing resulted in empty data for driver ${driverNumber}`);
      }
      
      // Store in the global cache
      globalTelemetryCache[cacheKey] = processedData;
      
      // Cache the data locally as well
      setDriverDataCache(prev => ({
        ...prev,
        [driverNumber]: processedData
      }));
      
      // Update driver states
      setAvailableDrivers(prev => 
        prev.map(d => 
          d.driver_number === driverNumber 
            ? { ...d, isLoading: false, isDataLoaded: true } 
            : d
        )
      );
      
      // Clear loading state
      setDriverLoadingState(prev => ({
        ...prev,
        [driverNumber]: false
      }));
    } catch (error: any) {
      console.error(`Error loading data for driver ${driverNumber}:`, error);
      
      // Update driver state to show error
      setAvailableDrivers(prev => 
        prev.map(d => 
          d.driver_number === driverNumber 
            ? { ...d, isLoading: false, isDataLoaded: false, hasError: true } 
            : d
        )
      );
      
      // Clear loading state
      setDriverLoadingState(prev => ({
        ...prev,
        [driverNumber]: false
      }));
      
      // Show toast notification for improved UX
      toast.error(`Couldn't load telemetry data for driver ${driverNumber}`, {
        description: error.message || "Please try selecting a different driver",
        duration: 5000
      });
    }
  };

  // Find time range for the session
  const timeRange = useMemo(() => {
    const allPoints: number[] = [];
    
    Object.entries(driverDataCache)
      .filter(([driverNumber]) => selectedDrivers.includes(parseInt(driverNumber)))
      .forEach(([_, driverData]) => {
        driverData.forEach(point => {
          allPoints.push(point.time);
        });
      });
    
    if (allPoints.length === 0) return null;
    
    const minTime = Math.min(...allPoints);
    const maxTime = Math.max(...allPoints);
    
    return [minTime, maxTime] as [number, number];
  }, [driverDataCache, selectedDrivers]);

  // Function to select a specific time range
  const setTimeRange = (range: [number, number] | null) => {
    setSelectedTimeRange(range);
  };

  // Check if we have any data for selected drivers
  const hasData = selectedDrivers.some(driverNumber => !!driverDataCache[driverNumber]);
  const isLoading = isDriversLoading || isLapDataLoading || Object.values(driverLoadingState).some(Boolean);

  return {
    telemetryData: driverDataCache,
    availableDrivers,
    isLoading,
    loadingProgress,
    errorMessage,
    hasData,
    timeRange,
    selectedTimeRange,
    setTimeRange,
    lapData: lapData?.data,
    loadDriverData,
    driverLoadingState
  };
}; 