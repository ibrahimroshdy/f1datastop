import { useState, useEffect, useMemo } from "react";
import { useCarData, useDrivers, useLapData } from "@/hooks/useOpenF1Data";
import { processOpenF1CarData } from "@/utils/apiAdapters";
import { toast } from "sonner";
import { useF1Metadata } from "@/hooks/useF1Metadata";
import { useQueries } from "@tanstack/react-query";
import * as openF1Service from "@/services/openF1Service";
import { telemetryKeys } from "@/lib/f1/queryKeys";

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Use the new metadata hook for dynamic colors
  const { getTeamColor } = useF1Metadata();

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

  // Process available drivers with dynamic colors
  const availableDrivers = useMemo(() => {
    if (!driversData?.data) return [];

    return driversData.data.map((driver: any) => ({
      driver_number: driver.driver_number,
      name: `${driver.first_name} ${driver.last_name}`,
      team_name: driver.team_name || "Unknown Team",
      team_color: getTeamColor(driver.team_name || "default"),
      name_acronym: driver.name_acronym,
      isLoading: false, // Will be updated by query status
      isDataLoaded: false // Will be updated by query status
    }));
  }, [driversData, getTeamColor]);

  // Use useQueries to fetch telemetry for selected drivers in parallel
  const driverQueries = useQueries({
    queries: selectedDrivers.map(driverNumber => ({
      queryKey: telemetryKeys.session(sessionKey, driverNumber),
      queryFn: async () => {
        const result = await openF1Service.getCarData(sessionKey, driverNumber);
        if (result.error) throw new Error(result.error as string);

        // Process data immediately
        const processed = processOpenF1CarData(result.data);
        if (!processed || processed.length === 0) {
          // Fallback or empty
          return [];
        }
        return processed;
      },
      staleTime: Infinity, // Telemetry data for a past session doesn't change
      enabled: !!sessionKey && !!driverNumber,
    }))
  });

  // Aggregate data from queries
  const driverDataCache = useMemo(() => {
    const cache: { [key: number]: TelemetryDataPoint[] } = {};
    selectedDrivers.forEach((driverNumber, index) => {
      const query = driverQueries[index];
      if (query.data) {
        cache[driverNumber] = query.data;
      }
    });
    return cache;
  }, [driverQueries, selectedDrivers]);

  // Update driver loading states based on queries
  const driversWithState = useMemo(() => {
    return availableDrivers.map(driver => {
      const index = selectedDrivers.indexOf(driver.driver_number);
      if (index === -1) return driver;

      const query = driverQueries[index];
      return {
        ...driver,
        isLoading: query.isLoading,
        isDataLoaded: !!query.data,
        hasError: query.isError
      };
    });
  }, [availableDrivers, selectedDrivers, driverQueries]);

  // Calculate loading progress
  useEffect(() => {
    const total = 2 + selectedDrivers.length; // drivers + lapData + selected drivers
    let completed = 0;
    if (!isDriversLoading) completed++;
    if (!isLapDataLoading) completed++;
    selectedDrivers.forEach((_, index) => {
      if (!driverQueries[index].isLoading) completed++;
    });

    setLoadingProgress(Math.round((completed / total) * 100));
  }, [isDriversLoading, isLapDataLoading, driverQueries, selectedDrivers]);

  // Handle errors
  useEffect(() => {
    const error = driversError || lapDataError || driverQueries.find(q => q.error)?.error;

    if (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      if (msg.includes('HTML instead of JSON')) {
        setErrorMessage("The API is returning HTML instead of data. This typically happens when the F1 API is experiencing issues. Please try again later.");
        toast.error("F1 API service issue");
      } else {
        setErrorMessage("Error loading telemetry data.");
        // Only toast if it's a new error to avoid spam
        if (!errorMessage) toast.error("Failed to load telemetry data");
      }
    } else {
      setErrorMessage(null);
    }
  }, [driversError, lapDataError, driverQueries]);

  // Find time range
  const timeRange = useMemo(() => {
    const allPoints: number[] = [];
    Object.values(driverDataCache).forEach(data => {
      data.forEach(point => allPoints.push(point.time));
    });

    if (allPoints.length === 0) return null;
    return [Math.min(...allPoints), Math.max(...allPoints)] as [number, number];
  }, [driverDataCache]);

  // Load driver data (now just adding to selectedDrivers in parent component handles this, 
  // but keeping interface for compatibility if needed, though parent controls selectedDrivers)
  const loadDriverData = async (driverNumber: number) => {
    // No-op: The parent component should add the driver to selectedDrivers, 
    // which triggers the useQueries hook.
    console.log("loadDriverData called - ensure parent updates selectedDrivers");
  };

  const isLoading = isDriversLoading || isLapDataLoading || driverQueries.some(q => q.isLoading);
  const hasData = Object.keys(driverDataCache).length > 0;

  return {
    telemetryData: driverDataCache,
    availableDrivers: driversWithState,
    isLoading,
    loadingProgress,
    errorMessage,
    hasData,
    timeRange,
    selectedTimeRange,
    setTimeRange: setSelectedTimeRange,
    lapData: lapData?.data,
    loadDriverData,
    driverLoadingState: {} // Deprecated
  };
}; 