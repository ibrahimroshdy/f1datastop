
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
