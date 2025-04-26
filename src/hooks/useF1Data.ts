import { useQuery } from "@tanstack/react-query";
import * as f1Service from "@/services/f1Service";
import { optimizeLapData } from "@/utils/dataLoadingUtils";
import { toast } from "sonner";
import { useState } from "react";
import { F1_API } from "@/constants/apiConfig";

// Helper function to create exponential backoff retry logic with jitter
const createRetryConfig = (retryDelayBase = 2000, maxRetryAttempts = 5) => ({
  retry: maxRetryAttempts,
  retryDelay: (attemptIndex: number) => {
    // Enhanced exponential backoff with jitter to avoid thundering herd
    // Add random jitter (80-120% of the base value) to prevent all clients retrying at the same time
    const delay = Math.min(retryDelayBase * (2 ** attemptIndex) * (0.8 + Math.random() * 0.4), 60000);
    
    if (attemptIndex > 0) {
      toast.info(`Rate limit reached. Retrying in ${Math.round(delay/1000)} seconds...`, {
        id: `retry-toast-${attemptIndex}`,
        duration: delay,
      });
      console.log(`Rate limit retry attempt ${attemptIndex + 1} in ${Math.round(delay/1000)} seconds`);
    }
    
    return delay;
  }
});

// Default retry config with moderate settings
const defaultRetryConfig = createRetryConfig(2000, 5);

// Specialized retry config for lap times with higher delay and more attempts
const lapTimesRetryConfig = createRetryConfig(5000, 10);

export const useDriverStandings = (year?: number) => {
  return useQuery({
    queryKey: ["driverStandings", year],
    queryFn: () => f1Service.getDriverStandings(year),
    staleTime: 1000 * 60 * 5, // 5 minutes
    ...defaultRetryConfig,
  });
};

export const useConstructorStandings = (year?: number) => {
  return useQuery({
    queryKey: ["constructorStandings", year],
    queryFn: () => f1Service.getConstructorStandings(year),
    staleTime: 1000 * 60 * 5, // 5 minutes
    ...defaultRetryConfig,
  });
};

export const useRaceSchedule = (year?: number) => {
  return useQuery({
    queryKey: ["raceSchedule", year],
    queryFn: () => f1Service.getRaceSchedule(year),
    staleTime: 1000 * 60 * 60, // 1 hour
    ...defaultRetryConfig,
  });
};

export const useRaceResults = (year: number, round: string) => {
  return useQuery({
    queryKey: ["raceResults", year, round],
    queryFn: () => f1Service.getRaceResults(year, round),
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!year && !!round,
    ...defaultRetryConfig,
  });
};

export const useRaceQualifying = (year: number, round: string) => {
  return useQuery({
    queryKey: ["qualifying", year, round],
    queryFn: () => f1Service.getRaceQualifying(year, round),
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!year && !!round,
    ...defaultRetryConfig,
  });
};

export const useLapTimes = (year: number, round: string, firstDriverOnly: boolean = false) => {
  const [loadingState, setLoadingState] = useState({
    pagesLoaded: 0,
    totalPages: 0,
    progress: 0,
    retryAttempts: {}
  });

  return useQuery({
    queryKey: ["lapTimes", year, round, firstDriverOnly ? "firstDriverOnly" : "allDrivers"],
    queryFn: async () => {
      try {
        // Add a small delay before making the request to avoid immediate rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Instead of passing 'false' as a string, we should either pass a valid driver ID or omit it completely
        // to get all drivers' lap times
        const data = await f1Service.getLapTimes(year, round, firstDriverOnly ? "true" : undefined, 
          // Add progress callback to update loading state
          (progress, pagesLoaded, totalPages, retryInfo) => {
            setLoadingState({
              pagesLoaded,
              totalPages,
              progress: Math.round(progress * 100),
              retryAttempts: retryInfo
            });
          }
        );
        
        // Mark as fully loaded when complete
        setLoadingState(prev => ({
          ...prev,
          progress: 100,
          pagesLoaded: prev.totalPages
        }));
        
        return {
          ...data,
          loadingState // Include loading state in the return
        };
      } catch (error: any) {
        if (error?.status === 429) {
          toast.error("Rate limit exceeded. System will retry automatically.", {
            description: "The F1 API has strict rate limits. Waiting before retry...",
            duration: 5000,
          });
        }
        throw error; // Re-throw the error to let React Query handle retries
      }
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!year && !!round,
    ...lapTimesRetryConfig,
    gcTime: 1000 * 60 * 60 * 2, // 2 hours
    meta: {
      loadingState // Expose loading state in meta
    }
  });
};

export const usePitStops = (year: number, round: string) => {
  return useQuery({
    queryKey: ["pitStops", year, round],
    queryFn: () => f1Service.getPitStops(year, round),
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!year && !!round,
    ...defaultRetryConfig,
  });
};

export const useLastRaceResults = (year?: number) => {
  return useQuery({
    queryKey: ["lastRaceResults", year],
    queryFn: () => f1Service.getLastRaceResults(year),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useLastRacePitStops = (year?: number) => {
  // First get the race schedule to find the last completed race
  const { data: raceScheduleData } = useRaceSchedule(year);
  const { data: lastRaceData } = useLastRaceResults(year);
  
  return useQuery({
    queryKey: ["lastRacePitStops", year],
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

export const useNextRace = (year?: number) => {
  return useQuery({
    queryKey: ["nextRace", year],
    queryFn: () => f1Service.getNextRace(year),
    staleTime: 1000 * 60 * 5, // 5 minutes
    ...defaultRetryConfig,
  });
};

export const useRaceStatus = (sessionId?: string) => {
  return useQuery({
    queryKey: ["raceStatus", sessionId],
    queryFn: () => f1Service.getRaceStatus(sessionId),
    staleTime: 1000 * 60, // 1 minute
    enabled: !!sessionId,
    ...defaultRetryConfig,
  });
};

export const useDriverInfo = (year?: number) => {
  return useQuery({
    queryKey: ["driverInfo", year],
    queryFn: () => f1Service.getDriverInfo(year),
    staleTime: 1000 * 30, // 30 seconds
    ...defaultRetryConfig,
  });
};

export const useWeatherData = (sessionId?: string) => {
  return useQuery({
    queryKey: ["weatherData", sessionId],
    queryFn: () => f1Service.getWeatherData(sessionId),
    staleTime: 1000 * 60 * 2, // 2 minutes
    enabled: !!sessionId,
    ...defaultRetryConfig,
  });
};

export const useF1News = () => {
  return useQuery({
    queryKey: ["f1News"],
    queryFn: f1Service.getF1News,
    staleTime: 1000 * 60 * 15, // 15 minutes
    ...defaultRetryConfig,
  });
};

export const useF1Circuits = () => {
  return useQuery({
    queryKey: ["f1Circuits"],
    queryFn: f1Service.getF1Circuits,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours (this rarely changes)
    ...defaultRetryConfig,
  });
};

// Integrated from useQualifyingToRaceData.ts
export const useQualifyingToRaceData = (year?: number) => {
  return useQuery({
    queryKey: ["qualifyingToRaceData", year],
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
        let completeRaceData = {
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

// Process data for Sankey chart
const processDataForSankey = (qualifyingData: any, raceData: any) => {
  // Accept both "Results" (API standard) and "results" (our normalized format)
  const qualifyingResults = qualifyingData?.QualifyingResults;
  const raceResults = raceData?.results || raceData?.Results;
  
  if (!qualifyingResults || !raceResults) {
    return null;
  }
  
  // Create nodes (drivers)
  const drivers = new Set<string>();
  
  // Map qualifying results
  const qualifyingResultsMapped = qualifyingResults.map((result: any) => {
    const driverCode = result.Driver.code || result.Driver.familyName.substring(0, 3).toUpperCase();
    drivers.add(driverCode);
    
    return {
      code: driverCode,
      name: `${result.Driver.givenName} ${result.Driver.familyName}`,
      team: result.Constructor.constructorId,
      qualifyingPosition: parseInt(result.position),
      teamName: result.Constructor.name
    };
  });
  
  // Map race results
  const raceResultsMapped = raceResults.map((result: any) => {
    const driverCode = result.Driver.code || result.Driver.familyName.substring(0, 3).toUpperCase();
    drivers.add(driverCode);
    
    // Determine driver status
    const status = result.status || "";
    const isDNF = status !== "Finished" && !status.startsWith("+");
    
    return {
      code: driverCode,
      name: `${result.Driver.givenName} ${result.Driver.familyName}`,
      team: result.Constructor.constructorId,
      racePosition: parseInt(result.position),
      teamName: result.Constructor.name,
      status: status,
      isDNF: isDNF
    };
  });
  
  // Create links between qualifying and race results
  const links = [];
  const driverMap = new Map();
  
  // Create a map of driver codes to their data
  qualifyingResultsMapped.forEach((quali: any) => {
    if (!driverMap.has(quali.code)) {
      driverMap.set(quali.code, { ...quali });
    } else {
      driverMap.set(quali.code, { ...driverMap.get(quali.code), ...quali });
    }
  });
  
  raceResultsMapped.forEach((race: any) => {
    if (!driverMap.has(race.code)) {
      driverMap.set(race.code, { ...race });
    } else {
      driverMap.set(race.code, { ...driverMap.get(race.code), ...race });
    }
  });
  
  // Create links for each driver
  driverMap.forEach((driver) => {
    if (driver.qualifyingPosition !== undefined && driver.racePosition !== undefined) {
      links.push({
        source: driver.code + "_quali",
        target: driver.code + "_race",
        value: 1, // Required for d3-sankey
        code: driver.code,
        name: driver.name,
        team: driver.team,
        teamName: driver.teamName,
        qualifyingPosition: driver.qualifyingPosition,
        racePosition: driver.racePosition,
        positionChange: driver.qualifyingPosition - driver.racePosition,
        status: driver.status || "",
        isDNF: driver.isDNF || false
      });
    }
  });
  
  // Create nodes array
  const qualifyingNodes = [];
  const raceNodes = [];
  
  // Add qualifying nodes
  qualifyingResultsMapped.forEach((driver: any) => {
    qualifyingNodes.push({
      id: driver.code + "_quali",
      name: driver.code,
      team: driver.team,
      position: driver.qualifyingPosition,
      type: "qualifying",
      teamName: driver.teamName,
      fullName: driver.name
    });
  });
  
  // Add race nodes
  raceResultsMapped.forEach((driver: any) => {
    raceNodes.push({
      id: driver.code + "_race",
      name: driver.code,
      team: driver.team,
      position: driver.racePosition,
      type: "race",
      teamName: driver.teamName,
      fullName: driver.name,
      status: driver.status || "",
      isDNF: driver.isDNF || false
    });
  });
  
  // Sort nodes by position within their groups
  qualifyingNodes.sort((a, b) => a.position - b.position);
  raceNodes.sort((a, b) => a.position - b.position);
  
  // Combine sorted nodes
  const nodes = [...qualifyingNodes, ...raceNodes];
  
  return {
    nodes,
    links,
    race: {
      name: raceData.raceName,
      circuit: raceData.Circuit?.circuitName,
      country: raceData.Circuit?.Location?.country,
      date: raceData.date
    }
  };
};

export function useQualifyingToRaceDataByRound(year: number, round: string) {
  return useQuery({
    queryKey: ['qualifyingToRaceData', year, round],
    queryFn: async () => {
      try {
        // First get qualifying data
        const qualifyingResponse = await fetch(`${F1_API.ERGAST}/${year}/${round}/qualifying.json`);
        if (!qualifyingResponse.ok) {
          throw new Error('Failed to fetch qualifying data');
        }
        const qualifyingData = await qualifyingResponse.json();
        
        // Then get race results
        const raceResponse = await fetch(`${F1_API.ERGAST}/${year}/${round}/results.json`);
        if (!raceResponse.ok) {
          throw new Error('Failed to fetch race results');
        }
        const raceData = await raceResponse.json();
        
        // Get race data for info
        const raceInfo = raceData.MRData.RaceTable.Races[0] || null;
        
        // Process the data for the Sankey diagram
        if (!qualifyingData.MRData.RaceTable?.Races?.length || !raceData.MRData.RaceTable?.Races?.length) {
          return {
            processedData: null,
            raceData: raceInfo,
            error: "No qualifying or race data available for this race"
          };
        }
        
        const qualifying = qualifyingData.MRData.RaceTable.Races[0].QualifyingResults || [];
        const raceResults = raceData.MRData.RaceTable.Races[0].Results || [];
        
        if (!qualifying.length || !raceResults.length) {
          return {
            processedData: null,
            raceData: raceInfo,
            error: "Incomplete qualifying or race data"
          };
        }
        
        // Create nodes for qualifying and race positions
        const nodes = [];
        const links = [];
        
        // Create unique IDs for nodes
        const qualifyingIdPrefix = "Q";
        const raceIdPrefix = "R";
        
        // Process qualifying nodes
        qualifying.forEach((driver, index) => {
          if (!driver.position) return;
          
          const position = parseInt(driver.position);
          
          const driverCode = driver.Driver.code;
          const driverName = `${driver.Driver.givenName} ${driver.Driver.familyName}`;
          const team = driver.Constructor.constructorId;
          const teamName = driver.Constructor.name;
          
          nodes.push({
            id: `${qualifyingIdPrefix}${position}`,
            name: driverCode,
            fullName: driverName,
            team,
            teamName,
            position,
            type: 'qualifying'
          });
        });
        
        // Process race nodes and create links
        raceResults.forEach((driver, index) => {
          if (!driver.position) return;
          
          const position = parseInt(driver.position);
          const driverCode = driver.Driver.code;
          const driverName = `${driver.Driver.givenName} ${driver.Driver.familyName}`;
          const team = driver.Constructor.constructorId;
          const teamName = driver.Constructor.name;
          
          // Handle DNFs
          const status = driver.status;
          const isDNF = status !== "Finished" && !status.includes("+");
          
          nodes.push({
            id: `${raceIdPrefix}${position}`,
            name: driverCode,
            fullName: driverName,
            team,
            teamName,
            position,
            type: 'race',
            status,
            isDNF
          });
          
          // Find matching qualifying result for this driver
          const qualifyingResult = qualifying.find(q => 
            q.Driver.driverId === driver.Driver.driverId
          );
          
          if (qualifyingResult) {
            const qualifyingPosition = parseInt(qualifyingResult.position);
            
            links.push({
              source: `${qualifyingIdPrefix}${qualifyingPosition}`,
              target: `${raceIdPrefix}${position}`,
              value: 1, // Uniform value for consistent link width
              name: driverCode,
              code: driverCode,
              fullName: driverName,
              team,
              teamName,
              qualifyingPosition,
              racePosition: position,
              positionChange: qualifyingPosition - position,
              status,
              isDNF
            });
          }
        });
        
        return {
          processedData: { nodes, links },
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

// Hook for fetching sprint results
export const useSprintResults = (year: number, round: string) => {
  return useQuery({
    queryKey: ['sprintResults', year, round],
    queryFn: () => f1Service.getSprintResults(year, round),
    retry: 1,
    retryDelay: 1000,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: !!year && !!round
  });
};
