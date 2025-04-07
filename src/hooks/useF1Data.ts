
import { useQuery } from "@tanstack/react-query";
import * as f1BackendService from "@/services/f1BackendService";
import { useApi } from "@/context/ApiContext";
import { toast } from "sonner";

// Basic retry configuration
const defaultRetryConfig = {
  retry: 3,
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
};

// Helper function to display a toast when backend is not connected
const useBackendCheck = () => {
  const { isBackendConnected } = useApi();
  
  if (!isBackendConnected) {
    return false;
  }
  
  return true;
};

// Hooks to access Python backend data
export const useDriverStandings = (year?: number) => {
  const backendAvailable = useBackendCheck();
  
  return useQuery({
    queryKey: ["backend", "driverStandings", year],
    queryFn: () => f1BackendService.getDriverStandings(year),
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: backendAvailable,
    ...defaultRetryConfig,
  });
};

export const useConstructorStandings = (year?: number) => {
  const backendAvailable = useBackendCheck();
  
  return useQuery({
    queryKey: ["backend", "constructorStandings", year],
    queryFn: () => f1BackendService.getConstructorStandings(year),
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: backendAvailable,
    ...defaultRetryConfig,
  });
};

export const useRaceSchedule = (year?: number) => {
  const backendAvailable = useBackendCheck();
  
  return useQuery({
    queryKey: ["backend", "raceSchedule", year],
    queryFn: () => f1BackendService.getRaceSchedule(year),
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: backendAvailable,
    ...defaultRetryConfig,
  });
};

export const useRaceResults = (year: number, round: string) => {
  const backendAvailable = useBackendCheck();
  
  return useQuery({
    queryKey: ["backend", "raceResults", year, round],
    queryFn: () => f1BackendService.getRaceResults(year, round),
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!year && !!round && backendAvailable,
    ...defaultRetryConfig,
  });
};

export const useRaceQualifying = (year: number, round: string) => {
  const backendAvailable = useBackendCheck();
  
  return useQuery({
    queryKey: ["backend", "qualifying", year, round],
    queryFn: () => f1BackendService.getRaceQualifying(year, round),
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!year && !!round && backendAvailable,
    ...defaultRetryConfig,
  });
};

export const useLapTimes = (year: number, round: string, firstDriverOnly: boolean = false) => {
  const backendAvailable = useBackendCheck();
  
  return useQuery({
    queryKey: ["backend", "lapTimes", year, round, firstDriverOnly ? "firstDriverOnly" : "allDrivers"],
    queryFn: async () => {
      try {
        // Add a small delay before making the request
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const data = await f1BackendService.getLapTimes(year, round, firstDriverOnly ? "true" : undefined);
        return data;
      } catch (error: any) {
        toast.error("Failed to fetch lap times");
        throw error;
      }
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!year && !!round && backendAvailable,
    ...defaultRetryConfig,
  });
};

export const useLastRaceResults = () => {
  const backendAvailable = useBackendCheck();
  
  return useQuery({
    queryKey: ["backend", "lastRaceResults"],
    queryFn: () => f1BackendService.getLastRaceResults(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: backendAvailable,
    ...defaultRetryConfig,
  });
};

export const useNextRace = () => {
  const backendAvailable = useBackendCheck();
  
  return useQuery({
    queryKey: ["backend", "nextRace"],
    queryFn: () => f1BackendService.getNextRace(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: backendAvailable,
    ...defaultRetryConfig,
  });
};

// Additional hooks used in the application (for components that were previously using Ergast API)
export const useRaceStatus = (sessionId?: string) => {
  const backendAvailable = useBackendCheck();
  
  // Using a mock for now, would need to implement in the Python backend
  return useQuery({
    queryKey: ["backend", "raceStatus", sessionId],
    queryFn: () => ({ data: [{ lap_number: "45/51" }] }), // Mock data
    staleTime: 1000 * 10, // 10 seconds
    enabled: !!sessionId && backendAvailable,
    ...defaultRetryConfig,
  });
};

export const useWeatherData = (sessionId?: string) => {
  const backendAvailable = useBackendCheck();
  
  // Using a mock for now, would need to implement in the Python backend
  return useQuery({
    queryKey: ["backend", "weatherData", sessionId],
    queryFn: () => ({ data: [{ air_temperature: 25, track_temperature: 35, humidity: 60 }] }), // Mock data
    staleTime: 1000 * 60, // 1 minute
    enabled: !!sessionId && backendAvailable,
    ...defaultRetryConfig,
  });
};
