import { useQuery } from "@tanstack/react-query";
import * as f1Service from "@/services/f1Service";
import { optimizeLapData } from "@/utils/dataLoadingUtils";
import { toast } from "sonner";
import { useState } from "react";
import { F1_API } from "@/constants/apiConfig";
import { createRetryConfig } from "@/lib/api/throttledFetch";

// Default retry config with moderate settings
const defaultRetryConfig = createRetryConfig(2000, 5, { toastIdPrefix: "retry" });

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
  
  // Map race results (which include grid positions)
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
      gridPosition: parseInt(result.grid), // Add grid position from race results
      teamName: result.Constructor.name,
      status: status,
      isDNF: isDNF
    };
  });
  
  // Create links between qualifying, grid, and race results
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
  
  // Create links for each driver (qualifying -> grid -> race)
  driverMap.forEach((driver) => {
    if (driver.qualifyingPosition !== undefined && driver.gridPosition !== undefined && driver.racePosition !== undefined) {
      // Link from qualifying to grid
      links.push({
        source: driver.code + "_quali",
        target: driver.code + "_grid",
        value: 1, // Required for d3-sankey
        code: driver.code,
        name: driver.name,
        team: driver.team,
        teamName: driver.teamName,
        qualifyingPosition: driver.qualifyingPosition,
        gridPosition: driver.gridPosition,
        racePosition: driver.racePosition,
        positionChange: driver.qualifyingPosition - driver.gridPosition,
        status: driver.status || "",
        isDNF: driver.isDNF || false
      });
      
      // Link from grid to race
      links.push({
        source: driver.code + "_grid",
        target: driver.code + "_race",
        value: 1, // Required for d3-sankey
        code: driver.code,
        name: driver.name,
        team: driver.team,
        teamName: driver.teamName,
        qualifyingPosition: driver.qualifyingPosition,
        gridPosition: driver.gridPosition,
        racePosition: driver.racePosition,
        positionChange: driver.gridPosition - driver.racePosition,
        status: driver.status || "",
        isDNF: driver.isDNF || false
      });
    }
  });
  
  // Create nodes array
  const qualifyingNodes = [];
  const gridNodes = [];
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
  
  // Add grid nodes
  raceResultsMapped.forEach((driver: any) => {
    gridNodes.push({
      id: driver.code + "_grid",
      name: driver.code,
      team: driver.team,
      position: driver.gridPosition,
      type: "grid",
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
  gridNodes.sort((a, b) => a.position - b.position);
  raceNodes.sort((a, b) => a.position - b.position);
  
  // Combine sorted nodes
  const nodes = [...qualifyingNodes, ...gridNodes, ...raceNodes];
  
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

        // Optional: if no qualifying data, we can still build from race results using grid-as-quali
        const hasQualifying = qualifying.length > 0;
        
        // Create nodes for qualifying, grid, and race positions
        const nodes = [];
        const links = [];
        
        const qualifyingIdPrefix = "Q";
        const gridIdPrefix = "G";
        const raceIdPrefix = "R";

        // Build a lookup from driverId -> qualifying position (from API)
        const qualiByDriverId = new Map<string, number>();
        if (hasQualifying) {
          qualifying.forEach((driver: any) => {
            if (driver.position) {
              qualiByDriverId.set(driver.Driver.driverId, parseInt(driver.position));
            }
          });
        }

        // Find max qualifying position so we can assign synthetic grid positions (20, 21, ...) for drivers without quali/grid
        const maxQualiPosition = hasQualifying
          ? Math.max(...Array.from(qualiByDriverId.values()), 0)
          : 0;
        let nextSyntheticGrid = Math.max(maxQualiPosition + 1, 20);
        
        // Process every race result: ensure each driver has grid position (API, quali fallback, or synthetic)
        raceResults.forEach((driver: any) => {
          if (!driver.position) return;
          
          const racePosition = parseInt(driver.position);
          const driverCode = driver.Driver.code;
          const driverName = `${driver.Driver.givenName} ${driver.Driver.familyName}`;
          const team = driver.Constructor.constructorId;
          const teamName = driver.Constructor.name;
          const points = parseFloat(driver.points) || 0;
          const status = driver.status;
          const isDNF = status !== "Finished" && !status.includes("+");

          const qualiPos = qualiByDriverId.get(driver.Driver.driverId) ?? null;
          let gridPosition: number;
          if (driver.grid != null && driver.grid !== "" && !isNaN(parseInt(driver.grid))) {
            gridPosition = parseInt(driver.grid);
          } else if (qualiPos != null) {
            gridPosition = qualiPos;
          } else {
            gridPosition = nextSyntheticGrid++;
          }

          // Qualifying position for chart: use actual quali if available, else grid (so they appear in Qualifying column)
          const qualifyingPosition = qualiPos ?? gridPosition;

          // Grid node
          nodes.push({
            id: `${gridIdPrefix}${gridPosition}`,
            name: driverCode,
            fullName: driverName,
            team,
            teamName,
            position: gridPosition,
            type: 'grid'
          });
          
          // Race node
          nodes.push({
            id: `${raceIdPrefix}${racePosition}`,
            name: driverCode,
            fullName: driverName,
            team,
            teamName,
            position: racePosition,
            type: 'race',
            status,
            isDNF,
            points
          });

          // Quali -> Grid link for every driver (use grid as "quali" when no quali result)
          links.push({
            source: `${qualifyingIdPrefix}${qualifyingPosition}`,
            target: `${gridIdPrefix}${gridPosition}`,
            value: 1,
            name: driverCode,
            code: driverCode,
            fullName: driverName,
            team,
            teamName,
            qualifyingPosition,
            gridPosition,
            racePosition,
            positionChange: qualifyingPosition - gridPosition,
            status,
            isDNF,
            points: 0
          });
          
          links.push({
            source: `${gridIdPrefix}${gridPosition}`,
            target: `${raceIdPrefix}${racePosition}`,
            value: 1,
            name: driverCode,
            code: driverCode,
            fullName: driverName,
            team,
            teamName,
            qualifyingPosition,
            gridPosition,
            racePosition,
            positionChange: gridPosition - racePosition,
            status,
            isDNF,
            points
          });
        });

        // Build qualifying nodes: from API for drivers who qualified, and synthetic for the rest (from link driver info)
        const qualiNodeByPosition = new Map<number, { id: string; name: string; fullName: string; team: string; teamName: string; position: number }>();
        
        if (hasQualifying) {
          qualifying.forEach((driver: any) => {
            if (!driver.position) return;
            const position = parseInt(driver.position);
            qualiNodeByPosition.set(position, {
              id: `${qualifyingIdPrefix}${position}`,
              name: driver.Driver.code,
              fullName: `${driver.Driver.givenName} ${driver.Driver.familyName}`,
              team: driver.Constructor.constructorId,
              teamName: driver.Constructor.name,
              position
            });
          });
        }

        // Add qualifying node for every position used as link source (from API or synthetic from link)
        const qualifyingPositionsUsed = new Set<number>();
        links.forEach((link: any) => {
          if (link.source.startsWith(qualifyingIdPrefix)) {
            const pos = parseInt(link.source.slice(1), 10);
            if (!isNaN(pos)) qualifyingPositionsUsed.add(pos);
          }
        });

        qualifyingPositionsUsed.forEach((position) => {
          if (qualiNodeByPosition.has(position)) {
            const n = qualiNodeByPosition.get(position)!;
            nodes.push({
              id: n.id,
              name: n.name,
              fullName: n.fullName,
              team: n.team,
              teamName: n.teamName,
              position: n.position,
              type: 'qualifying'
            });
            return;
          }
          // Synthetic: use driver info from the link that has this quali position as source
          const link = links.find((l: any) => l.source === `${qualifyingIdPrefix}${position}`);
          if (link) {
            nodes.push({
              id: `${qualifyingIdPrefix}${position}`,
              name: link.name,
              fullName: link.fullName,
              team: link.team,
              teamName: link.teamName,
              position,
              type: 'qualifying'
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

// Driver results by season (points per race). `enabled` lets callers disable the
// per-driver fetch when the data is supplied from the batched season query below.
export const useDriverResultsBySeason = (year: number, driverId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ["driverResultsBySeason", year, driverId],
    queryFn: () => f1Service.getDriverResultsBySeason(year, driverId),
    staleTime: 1000 * 60 * 60, // 1h — season results change slowly; fewer Jolpica bursts when scrolling drivers
    enabled: enabled && !!year && !!driverId,
    ...defaultRetryConfig,
  });
};

// All drivers' season results in ONE request, grouped by driverId.
// Use on the Drivers grid to avoid the per-card N+1 (was ~1 request per driver).
export const useAllDriverResultsBySeason = (year: number) => {
  return useQuery({
    queryKey: ["allDriverResultsBySeason", year],
    queryFn: () => f1Service.getAllDriverResultsBySeason(year),
    staleTime: 1000 * 60 * 60, // 1h
    enabled: !!year,
    ...defaultRetryConfig,
  });
};
