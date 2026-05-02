import { useQuery } from "@tanstack/react-query";
import * as openF1Service from "@/services/openF1Service";
import { toast } from "sonner";
import { useState } from "react";
import { findMatchingOpenF1Session } from "@/utils/apiAdapters";

// Helper function to create exponential backoff retry logic with jitter
const createRetryConfig = (retryDelayBase = 2000, maxRetryAttempts = 5) => ({
  retry: maxRetryAttempts,
  retryDelay: (attemptIndex: number) => {
    // Enhanced exponential backoff with jitter to avoid thundering herd
    const delay = Math.min(retryDelayBase * (2 ** attemptIndex) * (0.8 + Math.random() * 0.4), 60000);
    
    if (attemptIndex > 0) {
      toast.info(`Rate limit reached. Retrying in ${Math.round(delay/1000)} seconds...`, {
        id: `openf1-retry-toast-${attemptIndex}`,
        duration: delay,
      });
      console.log(`Rate limit retry attempt ${attemptIndex + 1} in ${Math.round(delay/1000)} seconds`);
    }
    
    return delay;
  }
});

// Default retry config with moderate settings
const defaultRetryConfig = createRetryConfig(2000, 5);

// Get latest session
export const useLatestSession = () => {
  return useQuery({
    queryKey: ["openF1LatestSession"],
    queryFn: openF1Service.getLatestSession,
    staleTime: 1000 * 60, // 1 minute
    ...defaultRetryConfig,
  });
};

// Get sessions by year
export const useSessionsByYear = (year: number) => {
  return useQuery({
    queryKey: ["openF1Sessions", year],
    queryFn: () => openF1Service.getSessionsByYear(year),
    staleTime: 1000 * 60 * 60, // 1 hour
    ...defaultRetryConfig,
  });
};

// Get specific session by meeting key and session type
export const useSession = (meetingKey: number, sessionType?: string) => {
  return useQuery({
    queryKey: ["openF1Session", meetingKey, sessionType],
    queryFn: () => openF1Service.getSession(meetingKey, sessionType),
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!meetingKey,
    ...defaultRetryConfig,
  });
};

// Get lap data for a session
export const useLapData = (sessionKey: number, driverNumber?: number) => {
  const [loadingState, setLoadingState] = useState({
    progress: 0,
    isLoading: true
  });

  const query = useQuery({
    queryKey: ["openF1LapData", sessionKey, driverNumber],
    queryFn: async () => {
      setLoadingState({ progress: 10, isLoading: true });
      const result = await openF1Service.getLapData(sessionKey, driverNumber);
      setLoadingState({ progress: 100, isLoading: false });
      return result;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!sessionKey,
    refetchOnWindowFocus: false, // Prevent refetching when window regains focus
    ...defaultRetryConfig,
  });

  return {
    ...query,
    loadingState
  };
};

// Get car telemetry data for a session
export const useCarData = (sessionKey: number, driverNumber?: number) => {
  const [loadingState, setLoadingState] = useState({
    progress: 0,
    isLoading: true
  });

  const query = useQuery({
    queryKey: ["openF1CarData", sessionKey, driverNumber],
    queryFn: async () => {
      setLoadingState({ progress: 10, isLoading: true });
      const result = await openF1Service.getCarData(sessionKey, driverNumber);
      setLoadingState({ progress: 100, isLoading: false });
      return result;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!sessionKey,
    refetchOnWindowFocus: false, // Prevent refetching when window regains focus
    ...defaultRetryConfig,
  });

  return {
    ...query,
    loadingState
  };
};

// Get weather data for a session
export const useWeatherData = (sessionKey: number) => {
  return useQuery({
    queryKey: ["openF1WeatherData", sessionKey],
    queryFn: () => openF1Service.getWeatherData(sessionKey),
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!sessionKey,
    refetchOnWindowFocus: false, // Prevent refetching when window regains focus
    ...defaultRetryConfig,
  });
};

// Get driver info for a session
export const useDrivers = (sessionKey: number, driverNumber?: number) => {
  return useQuery({
    queryKey: ["openF1Drivers", sessionKey, driverNumber],
    queryFn: () => openF1Service.getDrivers(sessionKey, driverNumber),
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!sessionKey,
    refetchOnWindowFocus: false, // Prevent refetching when window regains focus
    ...defaultRetryConfig,
  });
};

// Get team radio for a session
export const useTeamRadio = (sessionKey: number, driverNumber?: number) => {
  return useQuery({
    queryKey: ["openF1TeamRadio", sessionKey, driverNumber],
    queryFn: () => openF1Service.getTeamRadio(sessionKey, driverNumber),
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!sessionKey,
    refetchOnWindowFocus: false, // Prevent refetching when window regains focus
    ...defaultRetryConfig,
  });
};

// Get race control messages for a session
export const useRaceControl = (sessionKey: number) => {
  return useQuery({
    queryKey: ["openF1RaceControl", sessionKey],
    queryFn: () => openF1Service.getRaceControl(sessionKey),
    staleTime: 1000 * 60 * 60,
    enabled: !!sessionKey,
    ...defaultRetryConfig,
  });
};

// Get position data for a session
export const usePositionData = (sessionKey: number, driverNumber?: number) => {
  return useQuery({
    queryKey: ["openF1PositionData", sessionKey, driverNumber],
    queryFn: () => openF1Service.getPositionData(sessionKey, driverNumber),
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!sessionKey,
    ...defaultRetryConfig,
  });
};

// Get overtakes data for a session
export const useOvertakes = (sessionKey: number, overtakingDriverNumber?: number, overtakenDriverNumber?: number, position?: number) => {
  return useQuery({
    queryKey: ["openF1Overtakes", sessionKey, overtakingDriverNumber, overtakenDriverNumber, position],
    queryFn: () => openF1Service.getOvertakes(sessionKey, overtakingDriverNumber, overtakenDriverNumber, position),
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!sessionKey,
    ...defaultRetryConfig,
  });
};

// Get lap data for a session
export const useLaps = (sessionKey: number, driverNumber?: number, lapNumber?: number) => {
  return useQuery({
    queryKey: ["openF1Laps", sessionKey, driverNumber, lapNumber],
    queryFn: () => openF1Service.getLaps(sessionKey, driverNumber, lapNumber),
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!sessionKey,
    ...defaultRetryConfig,
  });
};

// Get starting grid data for a session
export const useStartingGrid = (sessionKey: number) => {
  return useQuery({
    queryKey: ["openF1StartingGrid", sessionKey],
    queryFn: () => openF1Service.getStartingGrid(sessionKey),
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!sessionKey,
    ...defaultRetryConfig,
  });
};

// Special utility hook to match Ergast year/round to OpenF1 session
export const useOpenF1SessionFromErgast = (year: number, round: string, sessionType?: string) => {
  // First get all sessions for the year
  const sessionsQuery = useSessionsByYear(year);
  
  // Then find the matching session
  return useQuery({
    queryKey: ["openF1SessionFromErgast", year, round, sessionType],
    queryFn: () => {
      const sessions = sessionsQuery.data?.data || [];
      const matchingSession = findMatchingOpenF1Session(sessions, year, round, sessionType);
      
      if (!matchingSession) {
        return { data: null, error: "No matching session found" };
      }
      
      return { data: matchingSession, error: null };
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!sessionsQuery.data && !sessionsQuery.isLoading,
    ...defaultRetryConfig,
  });
}; 

/** Single batched fetch for `/drivers?session_key=latest` — subscribe from many cards without N parallel requests. */
export const useLatestSessionDrivers = (enabled = true) => {
  return useQuery({
    queryKey: ["openF1LatestSessionDrivers"],
    queryFn: () => openF1Service.getLatestSessionDrivers(),
    staleTime: 1000 * 60 * 60 * 24,
    enabled,
    refetchOnWindowFocus: false,
    ...defaultRetryConfig,
  });
};

// Get latest driver info (e.g. headshot_url) via driver number or acronym
export const useLatestDriver = (driverNumber?: number, nameAcronym?: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ["openF1LatestDriver", driverNumber, nameAcronym],
    queryFn: () => openF1Service.getLatestDriver(driverNumber, nameAcronym),
    staleTime: 1000 * 60 * 60 * 24, // 24h — headshots rarely change; cuts parallel OpenF1 load on driver grids
    enabled: enabled && (!!driverNumber || !!nameAcronym),
    refetchOnWindowFocus: false,
    ...defaultRetryConfig,
  });
};