import { useQuery } from "@tanstack/react-query";
import * as f1Service from "@/services/f1Service";
import { optimizeLapData } from "@/utils/dataLoadingUtils";
import { toast } from "sonner";
import { useState } from "react";

// Helper function to create exponential backoff retry logic with more aggressive backoff
const createRetryConfig = (retryDelayBase = 2000, maxRetryAttempts = 5) => ({
  retry: maxRetryAttempts,
  retryDelay: (attemptIndex: number) => {
    // Enhanced exponential backoff with jitter to avoid thundering herd
    // More aggressive delay with higher base value and exponential growth
    const delay = Math.min(retryDelayBase * (2 ** attemptIndex) * (0.8 + Math.random() * 0.4), 60000);
    
    if (attemptIndex > 0) {
      toast.info(`Rate limit reached. Retrying in ${Math.round(delay/1000)} seconds...`, {
        id: `retry-toast-${attemptIndex}`,
        duration: delay,
      });
      console.log(`Rate limit retry attempt ${attemptIndex + 1} in ${Math.round(delay/1000)} seconds`);
    }
    
    return delay;
  }
});

// Default retry config with moderate settings
const defaultRetryConfig = createRetryConfig(2000, 5);

// Specialized retry config for lap times with higher delay and more attempts
const lapTimesRetryConfig = createRetryConfig(5000, 10);

export const useDriverStandings = (year?: number) => {
  return useQuery({
    queryKey: ["driverStandings", year],
    queryFn: () => f1Service.getDriverStandings(year),
    staleTime: 1000 * 60 * 5, // 5 minutes
    ...defaultRetryConfig,
  });
};

// New hook for OpenF1 Drivers
export const useOpenF1Drivers = (year?: number) => {
  return useQuery({
    queryKey: ["openF1Drivers", year],
    queryFn: () => f1Service.getOpenF1Drivers(year),
    staleTime: 1000 * 60 * 5, // 5 minutes
    ...defaultRetryConfig,
  });
};

export const useConstructorStandings = (year?: number) => {
  return useQuery({
    queryKey: ["constructorStandings", year],
    queryFn: () => f1Service.getConstructorStandings(year),
    staleTime: 1000 * 60 * 5, // 5 minutes
    ...defaultRetryConfig,
  });
};

export const useRaceSchedule = (year?: number) => {
  return useQuery({
    queryKey: ["raceSchedule", year],
    queryFn: () => f1Service.getRaceSchedule(year),
    staleTime: 1000 * 60 * 60, // 1 hour
    ...defaultRetryConfig,
  });
};

export const useRaceResults = (year: number, round: string) => {
  return useQuery({
    queryKey: ["raceResults", year, round],
    queryFn: () => f1Service.getRaceResults(year, round),
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!year && !!round,
    ...defaultRetryConfig,
  });
};

export const useRaceQualifying = (year: number, round: string) => {
  return useQuery({
    queryKey: ["qualifying", year, round],
    queryFn: () => f1Service.getRaceQualifying(year, round),
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!year && !!round,
    ...defaultRetryConfig,
  });
};

export const useLapTimes = (year: number, round: string, firstDriverOnly: boolean = false) => {
  return useQuery({
    queryKey: ["lapTimes", year, round, firstDriverOnly ? "firstDriverOnly" : "allDrivers"],
    queryFn: async () => {
      try {
        // Add a small delay before making the request to avoid immediate rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Instead of passing 'false' as a string, we should either pass a valid driver ID or omit it completely
        // to get all drivers' lap times
        const data = await f1Service.getLapTimes(year, round, firstDriverOnly ? "true" : undefined);
        return data;
      } catch (error: any) {
        if (error?.status === 429) {
          toast.error("Rate limit exceeded. System will retry automatically.", {
            description: "The F1 API has strict rate limits. Waiting before retry...",
            duration: 5000,
          });
        }
        throw error; // Re-throw the error to let React Query handle retries
      }
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!year && !!round,
    ...lapTimesRetryConfig,
    gcTime: 1000 * 60 * 60 * 2, // 2 hours
  });
};

export const usePitStops = (year: number, round: string) => {
  return useQuery({
    queryKey: ["pitStops", year, round],
    queryFn: () => f1Service.getPitStops(year, round),
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!year && !!round,
    ...defaultRetryConfig,
  });
};

export const useLastRaceResults = (year?: number) => {
  return useQuery({
    queryKey: ["lastRaceResults", year],
    queryFn: () => f1Service.getLastRaceResults(year),
    staleTime: 1000 * 60 * 5, // 5 minutes
    ...defaultRetryConfig,
  });
};

export const useNextRace = (year?: number) => {
  return useQuery({
    queryKey: ["nextRace", year],
    queryFn: () => f1Service.getNextRace(year),
    staleTime: 1000 * 60 * 5, // 5 minutes
    ...defaultRetryConfig,
  });
};

export const useRaceStatus = (sessionId?: string) => {
  return useQuery({
    queryKey: ["raceStatus", sessionId],
    queryFn: () => f1Service.getRaceStatus(sessionId),
    staleTime: 1000 * 60, // 1 minute
    enabled: !!sessionId,
    ...defaultRetryConfig,
  });
};

export const useDriverInfo = (year?: number) => {
  return useQuery({
    queryKey: ["driverInfo", year],
    queryFn: () => f1Service.getDriverInfo(year),
    staleTime: 1000 * 30, // 30 seconds
    ...defaultRetryConfig,
  });
};

export const useWeatherData = (sessionId?: string) => {
  return useQuery({
    queryKey: ["weatherData", sessionId],
    queryFn: () => f1Service.getWeatherData(sessionId),
    staleTime: 1000 * 60 * 2, // 2 minutes
    enabled: !!sessionId,
    ...defaultRetryConfig,
  });
};

export const useF1News = () => {
  return useQuery({
    queryKey: ["f1News"],
    queryFn: f1Service.getF1News,
    staleTime: 1000 * 60 * 15, // 15 minutes
    ...defaultRetryConfig,
  });
};

export const useF1Circuits = () => {
  return useQuery({
    queryKey: ["f1Circuits"],
    queryFn: f1Service.getF1Circuits,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours (this rarely changes)
    ...defaultRetryConfig,
  });
};
