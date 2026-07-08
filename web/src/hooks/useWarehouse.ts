import { useQuery } from "@tanstack/react-query";
import {
  getWeather,
  getOvertakes,
  getRaceControl,
  getSessionsDb,
  getLapsDb,
} from "@/services/warehouseEnrichment";

const HOUR = 60 * 60 * 1000;

/** FastF1-native weather time series for a session. */
export const useDbWeather = (season: number, round: number, session = "R") =>
  useQuery({
    queryKey: ["dbWeather", season, round, session],
    queryFn: () => getWeather(season, round, session),
    enabled: !!season && !!round,
    staleTime: HOUR,
  });

/** FastF1-computed overtakes for a race. */
export const useDbOvertakes = (season: number, round: number, session = "R") =>
  useQuery({
    queryKey: ["dbOvertakes", season, round, session],
    queryFn: () => getOvertakes(season, round, session),
    enabled: !!season && !!round,
    staleTime: HOUR,
  });

/** FastF1 race-control messages for a session. */
export const useDbRaceControl = (season: number, round: number, session = "R") =>
  useQuery({
    queryKey: ["dbRaceControl", season, round, session],
    queryFn: () => getRaceControl(season, round, session),
    enabled: !!season && !!round,
    staleTime: HOUR,
  });

/** Canonical session list (dedup, correct names) for the race-analysis picker. */
export const useDbSessions = (season: number, round?: number) =>
  useQuery({
    queryKey: ["dbSessions", season, round ?? null],
    queryFn: () => getSessionsDb(season, round),
    enabled: !!season,
    staleTime: HOUR,
  });

/** Per-session laps (position + lap time) from the warehouse. */
export const useDbLaps = (season: number, round: number, session = "R") =>
  useQuery({
    queryKey: ["dbLaps", season, round, session],
    queryFn: () => getLapsDb(season, round, session),
    enabled: !!season && !!round,
    staleTime: HOUR,
  });
