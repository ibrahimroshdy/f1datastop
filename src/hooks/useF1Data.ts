
import { useQuery } from "@tanstack/react-query";
import * as openF1Service from "@/services/openf1Service";
import * as newsService from "@/services/newsService";
import { useState, useEffect } from "react";

export const useNextRace = () => {
  return useQuery({
    queryKey: ["nextRace"],
    queryFn: openF1Service.getNextRace,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchInterval: 1000 * 60 * 15, // 15 minutes
  });
};

export const useLiveRaceData = (sessionId: number | null) => {
  return useQuery({
    queryKey: ["liveRaceData", sessionId],
    queryFn: () => sessionId ? openF1Service.getLiveTimingData(sessionId) : Promise.resolve({ data: null, error: new Error("No session ID"), isLoading: false }),
    staleTime: 1000 * 10, // 10 seconds
    refetchInterval: 1000 * 15, // 15 seconds
    enabled: !!sessionId,
  });
};

export const useDriverInfo = (sessionId: number | null) => {
  return useQuery({
    queryKey: ["driverInfo", sessionId],
    queryFn: () => sessionId ? openF1Service.getDriverInfo(sessionId) : Promise.resolve({ data: null, error: new Error("No session ID"), isLoading: false }),
    staleTime: 1000 * 60 * 30, // 30 minutes
    enabled: !!sessionId,
  });
};

export const useWeatherData = (sessionId: number | null) => {
  return useQuery({
    queryKey: ["weatherData", sessionId],
    queryFn: () => sessionId ? openF1Service.getWeatherData(sessionId) : Promise.resolve({ data: null, error: new Error("No session ID"), isLoading: false }),
    staleTime: 1000 * 60, // 1 minute
    refetchInterval: 1000 * 60 * 5, // 5 minutes
    enabled: !!sessionId,
  });
};

export const useRaceStatus = (sessionId: number | null) => {
  return useQuery({
    queryKey: ["raceStatus", sessionId],
    queryFn: () => sessionId ? openF1Service.getRaceStatus(sessionId) : Promise.resolve({ data: null, error: new Error("No session ID"), isLoading: false }),
    staleTime: 1000 * 10, // 10 seconds
    refetchInterval: 1000 * 15, // 15 seconds
    enabled: !!sessionId,
  });
};

export const useF1News = () => {
  return useQuery({
    queryKey: ["f1News"],
    queryFn: newsService.getF1News,
    staleTime: 1000 * 60 * 10, // 10 minutes
    refetchInterval: 1000 * 60 * 30, // 30 minutes
  });
};

export const useSessionContext = () => {
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const nextRaceQuery = useNextRace();
  
  useEffect(() => {
    if (nextRaceQuery.data?.data && Array.isArray(nextRaceQuery.data.data) && nextRaceQuery.data.data.length > 0) {
      const nextSession = nextRaceQuery.data.data[0];
      if (nextSession.session_key) {
        setActiveSessionId(nextSession.session_key);
      }
    }
  }, [nextRaceQuery.data]);
  
  return {
    activeSessionId,
    setActiveSessionId,
    nextRaceQuery,
  };
};
