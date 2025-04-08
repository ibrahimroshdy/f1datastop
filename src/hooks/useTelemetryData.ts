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
}

export const useTelemetryData = (sessionKey: number, selectedDrivers: number[] = []) => {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [selectedTimeRange, setSelectedTimeRange] = useState<[number, number] | null>(null);
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  // Create fixed-size array for car data queries
  // Using individual hooks - max 3 drivers to keep performance manageable
  const carDataQuery1 = useCarData(sessionKey, selectedDrivers[0] || 0);
  const carDataQuery2 = useCarData(sessionKey, selectedDrivers[1] || 0);
  const carDataQuery3 = useCarData(sessionKey, selectedDrivers[2] || 0);

  // Collect all car data queries into an array
  const carDataQueries = useMemo(() => {
    const queries = [];
    if (selectedDrivers[0]) queries.push(carDataQuery1);
    if (selectedDrivers[1]) queries.push(carDataQuery2);
    if (selectedDrivers[2]) queries.push(carDataQuery3);
    return queries;
  }, [selectedDrivers, carDataQuery1, carDataQuery2, carDataQuery3]);

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
        name_acronym: driver.name_acronym
      }));

      setAvailableDrivers(drivers);

      // Auto-select the first driver if none selected
      if (selectedDrivers.length === 0 && drivers.length > 0) {
        // This is handled by the parent component
      }
    }
  }, [driversData, selectedDrivers]);

  // Update loading progress
  useEffect(() => {
    const isLoading = isDriversLoading || isLapDataLoading || carDataQueries.some(q => q.isLoading);
    
    if (isLoading) {
      let totalQueries = 2 + carDataQueries.length; // drivers + lap data + car data queries
      let completedQueries = 0;
      
      if (!isDriversLoading) completedQueries++;
      if (!isLapDataLoading) completedQueries++;
      
      carDataQueries.forEach(query => {
        if (!query.isLoading) completedQueries++;
      });
      
      const progress = Math.round((completedQueries / totalQueries) * 100);
      setLoadingProgress(progress);
    } else {
      setLoadingProgress(100);
    }
  }, [isDriversLoading, isLapDataLoading, carDataQueries]);

  // Handle errors
  useEffect(() => {
    const error = driversError || lapDataError || carDataQueries.some(q => q.error);
    
    if (error) {
      setErrorMessage("Error loading telemetry data. Please try again.");
      toast.error("Failed to load telemetry data", {
        description: "There was an error fetching the telemetry data. Please try again later.",
        duration: 5000,
      });
    } else {
      setErrorMessage(null);
    }
  }, [driversError, lapDataError, carDataQueries]);

  // Process telemetry data
  const telemetryData = useMemo(() => {
    const result: { [key: number]: TelemetryDataPoint[] } = {};
    
    carDataQueries.forEach((query, index) => {
      if (query.data?.data && selectedDrivers[index]) {
        const driverNumber = selectedDrivers[index];
        const processedData = processOpenF1CarData(query.data.data);
        result[driverNumber] = processedData;
      }
    });
    
    return result;
  }, [carDataQueries, selectedDrivers]);

  // Find time range for the session
  const timeRange = useMemo(() => {
    const allPoints: number[] = [];
    
    Object.values(telemetryData).forEach(driverData => {
      driverData.forEach(point => {
        allPoints.push(point.time);
      });
    });
    
    if (allPoints.length === 0) return null;
    
    const minTime = Math.min(...allPoints);
    const maxTime = Math.max(...allPoints);
    
    return [minTime, maxTime] as [number, number];
  }, [telemetryData]);

  // Function to toggle a driver selection
  const toggleDriverSelection = (driverNumber: number) => {
    // This would be implemented in the parent component
  };

  // Function to select a specific time range
  const setTimeRange = (range: [number, number] | null) => {
    setSelectedTimeRange(range);
  };

  // Check if we have any data
  const hasData = Object.keys(telemetryData).length > 0;
  const isLoading = isDriversLoading || isLapDataLoading || carDataQueries.some(q => q.isLoading);

  return {
    telemetryData,
    availableDrivers,
    isLoading,
    loadingProgress,
    errorMessage,
    hasData,
    timeRange,
    selectedTimeRange,
    setTimeRange,
    lapData: lapData?.data
  };
}; 