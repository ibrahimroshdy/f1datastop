
import { useQuery } from "@tanstack/react-query";
import * as f1BackendService from "@/services/f1BackendService";
import { toast } from "sonner";

// Basic retry configuration
const defaultRetryConfig = {
  retry: 3,
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
};

// Hooks to access Python backend data
export const useDriverStandings = (year?: number) => {
  return useQuery({
    queryKey: ["backend", "driverStandings", year],
    queryFn: () => f1BackendService.getDriverStandings(year),
    staleTime: 1000 * 60 * 5, // 5 minutes
    ...defaultRetryConfig,
  });
};

export const useConstructorStandings = (year?: number) => {
  return useQuery({
    queryKey: ["backend", "constructorStandings", year],
    queryFn: () => f1BackendService.getConstructorStandings(year),
    staleTime: 1000 * 60 * 5, // 5 minutes
    ...defaultRetryConfig,
  });
};

export const useRaceSchedule = (year?: number) => {
  return useQuery({
    queryKey: ["backend", "raceSchedule", year],
    queryFn: () => f1BackendService.getRaceSchedule(year),
    staleTime: 1000 * 60 * 60, // 1 hour
    ...defaultRetryConfig,
  });
};

export const useRaceResults = (year: number, round: string) => {
  return useQuery({
    queryKey: ["backend", "raceResults", year, round],
    queryFn: () => f1BackendService.getRaceResults(year, round),
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!year && !!round,
    ...defaultRetryConfig,
  });
};

export const useRaceQualifying = (year: number, round: string) => {
  return useQuery({
    queryKey: ["backend", "qualifying", year, round],
    queryFn: () => f1BackendService.getRaceQualifying(year, round),
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!year && !!round,
    ...defaultRetryConfig,
  });
};

export const useLapTimes = (year: number, round: string, firstDriverOnly: boolean = false) => {
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
    enabled: !!year && !!round,
    ...defaultRetryConfig,
  });
};

export const useLastRaceResults = () => {
  return useQuery({
    queryKey: ["backend", "lastRaceResults"],
    queryFn: () => f1BackendService.getLastRaceResults(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    ...defaultRetryConfig,
  });
};

export const useNextRace = () => {
  return useQuery({
    queryKey: ["backend", "nextRace"],
    queryFn: () => f1BackendService.getNextRace(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    ...defaultRetryConfig,
  });
};
