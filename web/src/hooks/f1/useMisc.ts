import { useQuery } from "@tanstack/react-query";
import * as f1Service from "@/services/f1Service";
import { f1Keys } from "@/lib/f1/queryKeys";
import { defaultRetryConfig } from "./retryConfig";

export const useWeatherData = (sessionId?: string) => {
  return useQuery({
    queryKey: f1Keys.weatherData(sessionId),
    queryFn: () => f1Service.getWeatherData(sessionId),
    staleTime: 1000 * 60 * 2, // 2 minutes
    enabled: !!sessionId,
    ...defaultRetryConfig,
  });
};

export const useF1News = () => {
  return useQuery({
    queryKey: f1Keys.news(),
    queryFn: f1Service.getF1News,
    staleTime: 1000 * 60 * 15, // 15 minutes
    ...defaultRetryConfig,
  });
};

export const useF1Circuits = () => {
  return useQuery({
    queryKey: f1Keys.circuits(),
    queryFn: f1Service.getF1Circuits,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours (this rarely changes)
    ...defaultRetryConfig,
  });
};
