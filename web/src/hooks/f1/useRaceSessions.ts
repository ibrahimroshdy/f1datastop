import { useQuery } from "@tanstack/react-query";
import * as f1Service from "@/services/f1Service";
import { f1Keys } from "@/lib/f1/queryKeys";
import { defaultRetryConfig } from "./retryConfig";

export const useRaceResults = (year: number, round: string) => {
  return useQuery({
    queryKey: f1Keys.raceResults(year, round),
    queryFn: () => f1Service.getRaceResults(year, round),
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!year && !!round,
    ...defaultRetryConfig,
  });
};

export const useRaceQualifying = (year: number, round: string) => {
  return useQuery({
    queryKey: f1Keys.qualifying(year, round),
    queryFn: () => f1Service.getRaceQualifying(year, round),
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!year && !!round,
    ...defaultRetryConfig,
  });
};

export const useSprintResults = (year: number, round: string) => {
  return useQuery({
    queryKey: f1Keys.sprintResults(year, round),
    queryFn: () => f1Service.getSprintResults(year, round),
    retry: 1,
    retryDelay: 1000,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!year && !!round
  });
};

export const useRaceStatus = (sessionId?: string) => {
  return useQuery({
    queryKey: f1Keys.raceStatus(sessionId),
    queryFn: () => f1Service.getRaceStatus(sessionId),
    staleTime: 1000 * 60, // 1 minute
    enabled: !!sessionId,
    ...defaultRetryConfig,
  });
};
