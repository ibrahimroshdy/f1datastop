
import { useQuery } from "@tanstack/react-query";
import * as f1Service from "@/services/f1Service";
import { optimizeLapData } from "@/utils/dataLoadingUtils";

export const useDriverStandings = (year?: number) => {
  return useQuery({
    queryKey: ["driverStandings", year],
    queryFn: () => f1Service.getDriverStandings(year),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useConstructorStandings = (year?: number) => {
  return useQuery({
    queryKey: ["constructorStandings", year],
    queryFn: () => f1Service.getConstructorStandings(year),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useRaceSchedule = (year?: number) => {
  return useQuery({
    queryKey: ["raceSchedule", year],
    queryFn: () => f1Service.getRaceSchedule(year),
    staleTime: 1000 * 60 * 60, // 1 hour
  });
};

export const useRaceResults = (year: number, round: string) => {
  return useQuery({
    queryKey: ["raceResults", year, round],
    queryFn: () => f1Service.getRaceResults(year, round),
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!year && !!round,
  });
};

export const useRaceQualifying = (year: number, round: string) => {
  return useQuery({
    queryKey: ["qualifying", year, round],
    queryFn: () => f1Service.getRaceQualifying(year, round),
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!year && !!round,
  });
};

export const useLapTimes = (year: number, round: string, firstDriverOnly: boolean = false) => {
  return useQuery({
    queryKey: ["lapTimes", year, round, firstDriverOnly ? "firstDriverOnly" : "allDrivers"],
    queryFn: async () => {
      // Instead of passing 'false' as a string, we should either pass a valid driver ID or omit it completely
      // to get all drivers' lap times
      const data = await f1Service.getLapTimes(year, round, firstDriverOnly ? "true" : undefined);
      return data;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!year && !!round,
    retry: 3, // Increase retry attempts
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    gcTime: 1000 * 60 * 60 * 2, // 2 hours
  });
};

export const usePitStops = (year: number, round: string) => {
  return useQuery({
    queryKey: ["pitStops", year, round],
    queryFn: () => f1Service.getPitStops(year, round),
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!year && !!round,
  });
};

export const useLastRaceResults = (year?: number) => {
  return useQuery({
    queryKey: ["lastRaceResults", year],
    queryFn: () => f1Service.getLastRaceResults(year),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useNextRace = (year?: number) => {
  return useQuery({
    queryKey: ["nextRace", year],
    queryFn: () => f1Service.getNextRace(year),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useRaceStatus = (sessionId?: string) => {
  return useQuery({
    queryKey: ["raceStatus", sessionId],
    queryFn: () => f1Service.getRaceStatus(sessionId),
    staleTime: 1000 * 60, // 1 minute
    enabled: !!sessionId,
  });
};

export const useDriverInfo = (year?: number) => {
  return useQuery({
    queryKey: ["driverInfo", year],
    queryFn: () => f1Service.getDriverInfo(year),
    staleTime: 1000 * 30, // 30 seconds
  });
};

export const useWeatherData = (sessionId?: string) => {
  return useQuery({
    queryKey: ["weatherData", sessionId],
    queryFn: () => f1Service.getWeatherData(sessionId),
    staleTime: 1000 * 60 * 2, // 2 minutes
    enabled: !!sessionId,
  });
};

export const useF1News = () => {
  return useQuery({
    queryKey: ["f1News"],
    queryFn: f1Service.getF1News,
    staleTime: 1000 * 60 * 15, // 15 minutes
  });
};

export const useF1Circuits = () => {
  return useQuery({
    queryKey: ["f1Circuits"],
    queryFn: f1Service.getF1Circuits,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours (this rarely changes)
  });
};
