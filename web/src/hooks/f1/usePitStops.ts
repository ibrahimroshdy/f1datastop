import { useQuery } from "@tanstack/react-query";
import * as f1Service from "@/services/f1Service";
import { f1Keys } from "@/lib/f1/queryKeys";
import { defaultRetryConfig } from "./retryConfig";
import { useRaceSchedule, useLastRaceResults } from "./useSchedule";

export const usePitStops = (year: number, round: string) => {
  return useQuery({
    queryKey: f1Keys.pitStops(year, round),
    queryFn: () => f1Service.getPitStops(year, round),
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!year && !!round,
    ...defaultRetryConfig,
  });
};

export const useLastRacePitStops = (year?: number) => {
  // First get the race schedule to find the last completed race
  const { data: raceScheduleData } = useRaceSchedule(year);
  const { data: lastRaceData } = useLastRaceResults(year);
  
  return useQuery({
    queryKey: f1Keys.lastRacePitStops(year),
    queryFn: async () => {
      if (!raceScheduleData?.data || !lastRaceData?.data) {
        return { data: { Races: [] }, error: "No race data available" };
      }
      
      // Find the last completed race from the schedule
      const races = raceScheduleData.data;
      const now = new Date();
      const completedRaces = races.filter((race: any) => new Date(race.date) < now);
      
      if (completedRaces.length === 0) {
        return { data: { Races: [] }, error: "No completed races found" };
      }
      
      // Get the last completed race
      const lastRace = completedRaces[completedRaces.length - 1];
      
      // Now we have the season and round information
      if (lastRace.season && lastRace.round) {
        return f1Service.getPitStops(
          parseInt(lastRace.season), 
          lastRace.round
        );
      }
      
      return { data: { Races: [] }, error: "Could not determine race information" };
    },
    enabled: !!raceScheduleData?.data && !!lastRaceData?.data,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
