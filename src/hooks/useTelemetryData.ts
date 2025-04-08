import { useState, useEffect, useMemo } from "react";
import { useCarData, useDrivers, useLapData } from "@/hooks/useOpenF1Data";
import { processOpenF1CarData } from "@/utils/apiAdapters";
import { toast } from "sonner";

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
}

export const useTelemetryData = (sessionKey: number, selectedDrivers: number[] = []) => {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [selectedTimeRange, setSelectedTimeRange] = useState<[number, number] | null>(null);
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [driverDataCache, setDriverDataCache] = useState<{[key: number]: TelemetryDataPoint[]}>({});
  const [driverLoadingState, setDriverLoadingState] = useState<{[key: number]: boolean}>({});

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

  // Load driver data on demand
  const loadDriverData = async (driverNumber: number) => {
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
      // Fetch data for a specific driver only
      const result = await fetch(`/api/openf1/car_data?session_key=${sessionKey}&driver_number=${driverNumber}`, {
        mode: 'cors',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (result.ok) {
        const data = await result.json();
        const processedData = processOpenF1CarData(data);
        
        // Cache the data
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
      } else {
        throw new Error(`Failed to fetch data for driver ${driverNumber} with status ${result.status}`);
      }
    } catch (error) {
      console.error(`Error loading data for driver ${driverNumber}:`, error);
      
      // Check if it's a timeout or 500 error
      const errorStr = error.toString();
      if (errorStr.includes('TimeoutError') || errorStr.includes('ReadTimeout') || errorStr.includes('status 500')) {
        toast.warning(`Limited data available for driver #${driverNumber}`, {
          description: "The data source timed out or returned an error. This session may have limited telemetry data.",
          duration: 5000,
        });
      } else {
        toast.error(`Error loading data for driver #${driverNumber}`, {
          duration: 3000
        });
      }
      
      // Mark as not loading
      setDriverLoadingState(prev => ({
        ...prev,
        [driverNumber]: false
      }));
      
      // Update driver states
      setAvailableDrivers(prev => 
        prev.map(d => 
          d.driver_number === driverNumber 
            ? { ...d, isLoading: false } 
            : d
        )
      );
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