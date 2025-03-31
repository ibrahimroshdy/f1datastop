
import { useQuery } from "@tanstack/react-query";
import * as f1Service from "@/services/f1Service";

export const useDriverStandings = () => {
  return useQuery({
    queryKey: ["driverStandings"],
    queryFn: f1Service.getDriverStandings,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useConstructorStandings = () => {
  return useQuery({
    queryKey: ["constructorStandings"],
    queryFn: f1Service.getConstructorStandings,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useRaceSchedule = () => {
  return useQuery({
    queryKey: ["raceSchedule"],
    queryFn: f1Service.getRaceSchedule,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};

export const useLastRaceResults = () => {
  return useQuery({
    queryKey: ["lastRaceResults"],
    queryFn: f1Service.getLastRaceResults,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

// Add missing hook functions
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
