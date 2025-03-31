import { useQuery } from "@tanstack/react-query";
import * as f1Service from "@/services/f1Service";

export const useDriverStandings = (year = new Date().getFullYear().toString()) => {
  return useQuery({
    queryKey: ["driverStandings", year],
    queryFn: () => f1Service.getDriverStandings(year),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  });
};

export const useConstructorStandings = (year = new Date().getFullYear().toString()) => {
  return useQuery({
    queryKey: ["constructorStandings", year],
    queryFn: () => f1Service.getConstructorStandings(year),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  });
};

export const useRaceSchedule = (year = new Date().getFullYear().toString()) => {
  return useQuery({
    queryKey: ["raceSchedule", year],
    queryFn: () => f1Service.getRaceSchedule(year),
    staleTime: 1000 * 60 * 10, // 10 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  });
};

export const useLastRaceResults = (year = new Date().getFullYear().toString()) => {
  return useQuery({
    queryKey: ["lastRaceResults", year],
    queryFn: () => f1Service.getLastRaceResults(year),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  });
};

export const useNextRace = () => {
  return useQuery({
    queryKey: ["nextRace"],
    queryFn: f1Service.getNextRace,
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

export const useDriverInfo = (sessionId?: string) => {
  return useQuery({
    queryKey: ["driverInfo", sessionId],
    queryFn: () => f1Service.getDriverInfo(sessionId),
    staleTime: 1000 * 30, // 30 seconds
    enabled: !!sessionId,
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

export const useCurrentRace = () => {
  return useQuery({
    queryKey: ["currentRace"],
    queryFn: f1Service.getCurrentRace,
    staleTime: 1000 * 60, // 1 minute
    refetchInterval: 1000 * 60, // Refetch every minute
    retry: 2,
    refetchOnWindowFocus: false,
  });
};
