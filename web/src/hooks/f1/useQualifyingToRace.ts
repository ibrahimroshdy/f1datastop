import { useQuery } from "@tanstack/react-query";
import * as f1Service from "@/services/f1Service";
import { F1_API } from "@/constants/apiConfig";
import { f1Keys } from "@/lib/f1/queryKeys";
import { processDataForSankey, buildSankeyFromRoundResults } from "@/lib/f1/sankey";

// Integrated from useQualifyingToRaceData.ts
export const useQualifyingToRaceData = (year?: number) => {
  return useQuery({
    queryKey: f1Keys.qualifyingToRace(year),
    queryFn: async () => {
      try {
        // Get race schedule first to find completed races
        const raceScheduleData = await f1Service.getRaceSchedule(year);
        
        if (!raceScheduleData?.data || raceScheduleData.data.length === 0) {
          return { 
            qualifyingData: null, 
            raceData: null, 
            error: "No race schedule available" 
          };
        }
        
        // Find races with completed qualifying
        const races = raceScheduleData.data;
        const now = new Date();
        
        // Process races to determine if qualifying has occurred
        const racesWithQualifyingStatus = races.map((race: any) => {
          const raceDate = new Date(race.date);
          // Estimate qualifying date as 1 day before race
          const qualifyingDate = new Date(raceDate);
          qualifyingDate.setDate(raceDate.getDate() - 1);
          
          return {
            ...race,
            qualifyingDate,
            hasQualifyingOccurred: qualifyingDate < now,
            hasRaceOccurred: raceDate < now
          };
        });
        
        // Filter races where both qualifying and race have occurred
        const completedRaces = racesWithQualifyingStatus.filter(
          (race: any) => race.hasQualifyingOccurred && race.hasRaceOccurred
        );
        
        if (completedRaces.length === 0) {
          return { 
            qualifyingData: null, 
            raceData: null, 
            error: "No completed race weekends found" 
          };
        }
        
        // Get the most recent completed race weekend
        const lastRace = completedRaces[completedRaces.length - 1];
        
        // Get qualifying data for the race
        const season = parseInt(lastRace.season);
        const round = lastRace.round;
        
        // Get all race weekend data
        const [qualifyingData, raceData, raceScheduleDetail] = await Promise.all([
          f1Service.getRaceQualifying(season, round),
          f1Service.getRaceResults(season, round),
          f1Service.getRaceSchedule(season) // Get full race schedule for session data
        ]);
        
        if (!qualifyingData?.data?.QualifyingResults || !raceData?.data?.Results) {
          return {
            qualifyingData: qualifyingData?.data || null,
            raceData: raceData?.data || null,
            error: "Incomplete race weekend data"
          };
        }
        
        // Find the complete race data from schedule including practice sessions
        const fullRaceData = raceScheduleDetail?.data?.find((r: any) => 
          r.round === round && r.season === season.toString()
        );
        
        // Get the complete race data similar to how QualifyingResultsCard does it
        const completeRaceData = {
          ...raceData.data,
          ...fullRaceData, // Add all fields from full race data
          results: raceData.data.Results || [],
          // Ensure these fields exist
          FirstPractice: fullRaceData?.FirstPractice || raceData.data.FirstPractice,
          SecondPractice: fullRaceData?.SecondPractice || raceData.data.SecondPractice,
          ThirdPractice: fullRaceData?.ThirdPractice || raceData.data.ThirdPractice,
          Qualifying: fullRaceData?.Qualifying || raceData.data.Qualifying,
          Sprint: fullRaceData?.Sprint || raceData.data.Sprint,
          SprintQualifying: fullRaceData?.SprintQualifying || raceData.data.SprintQualifying,
          // Add date for qualifying similar to QualifyingResultsCard
          qualifyingDate: fullRaceData?.Qualifying?.date || raceData.data.Qualifying?.date || (() => {
            const raceDate = new Date(raceData.data.date);
            const qualifyingDate = new Date(raceDate);
            qualifyingDate.setDate(raceDate.getDate() - 1);
            return qualifyingDate.toISOString().split('T')[0];
          })()
        };
        
        // Process data for the Sankey chart
        try {
          const processedData = processDataForSankey(qualifyingData.data, completeRaceData);
          
          if (!processedData || !processedData.nodes || !processedData.links || 
              processedData.nodes.length === 0 || processedData.links.length === 0) {
            return {
              qualifyingData: qualifyingData.data,
              raceData: completeRaceData,
              error: "Unable to process race data for visualization"
            };
          }
          
          return {
            qualifyingData: qualifyingData.data,
            raceData: completeRaceData,
            processedData,
            error: null
          };
        } catch (processingError) {
          return {
            qualifyingData: qualifyingData.data,
            raceData: completeRaceData,
            processedData: null,
            error: "Error processing data: " + (processingError as Error).message
          };
        }
      } catch (error) {
        return { qualifyingData: null, raceData: null, processedData: null, error: "Failed to load race data" };
      }
    },
    staleTime: 60 * 60 * 1000, // 1 hour - data won't change frequently
    gcTime: 3 * 60 * 60 * 1000, // 3 hours cache time
    retry: 1, // Only retry once to avoid excessive API calls
  });
};

export function useQualifyingToRaceDataByRound(year: number, round: string) {
  return useQuery({
    queryKey: f1Keys.qualifyingToRaceRound(year, round),
    queryFn: async () => {
      try {
        // Race results are required; qualifying is optional (if missing/fails, we use grid position as "quali" for all)
        let qualifyingData: any = { MRData: { RaceTable: { Races: [] } } };
        try {
          const qualifyingResponse = await fetch(`${F1_API.ERGAST}/${year}/${round}/qualifying.json`);
          if (qualifyingResponse.ok) {
            qualifyingData = await qualifyingResponse.json();
          }
        } catch (_) {
          // Qualifying fetch failed (e.g. CORS); continue with race-only data
        }

        const raceResponse = await fetch(`${F1_API.ERGAST}/${year}/${round}/results.json`);
        if (!raceResponse.ok) {
          throw new Error('Failed to fetch race results');
        }
        const raceData = await raceResponse.json();
        
        // Get race data for info
        const raceInfo = raceData.MRData.RaceTable.Races[0] || null;
        
        // Process the data for the Sankey diagram (race results required; qualifying optional)
        if (!raceData.MRData?.RaceTable?.Races?.length) {
          return {
            processedData: null,
            raceData: raceInfo,
            error: "No race data available"
          };
        }
        
        const qualifying = qualifyingData?.MRData?.RaceTable?.Races?.[0]?.QualifyingResults || [];
        const raceResults = raceData.MRData.RaceTable.Races[0].Results || [];
        
        if (!raceResults.length) {
          return {
            processedData: null,
            raceData: raceInfo,
            error: "No race results"
          };
        }

        const processedData = buildSankeyFromRoundResults(qualifying, raceResults);
        
        return {
          processedData,
          raceData: raceInfo,
          error: null
        };
      } catch (error) {
        console.error("Error fetching qualifying and race data:", error);
        return {
          processedData: null,
          raceData: null,
          error: "Failed to load data. Please try again later."
        };
      }
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: 1,
    refetchOnWindowFocus: false
  });
}
