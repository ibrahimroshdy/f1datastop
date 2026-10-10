import { useQuery } from "@tanstack/react-query";
import * as f1Service from "@/services/f1Service";
import { f1Keys } from "@/lib/f1/queryKeys";
import { defaultRetryConfig } from "./retryConfig";

export const useRaceSchedule = (year?: number) => {
  return useQuery({
    queryKey: f1Keys.schedule(year),
    queryFn: () => f1Service.getRaceSchedule(year),
    staleTime: 1000 * 60 * 60, // 1 hour
    ...defaultRetryConfig,
  });
};

export const useNextRace = (year?: number) => {
  return useQuery({
    queryKey: f1Keys.nextRace(year),
    queryFn: () => f1Service.getNextRace(year),
    staleTime: 1000 * 60 * 5, // 5 minutes
    ...defaultRetryConfig,
  });
};

export const useLastRaceResults = (year?: number) => {
  return useQuery({
    queryKey: f1Keys.lastRaceResults(year),
    queryFn: () => f1Service.getLastRaceResults(year),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
