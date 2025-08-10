import { toast } from "sonner";
import { getCountryFlag, addFlagToRaceName } from "@/utils/countryUtils";
import { withCache, deleteCache, clearNamespace } from "@/utils/cache";

const BASE_URL = "https://api.jolpi.ca/ergast";

// Get the current F1 season year
const getCurrentSeason = () => new Date().getFullYear();

// Cache TTLs (ms) - differentiated by how frequently data changes
const ONE_HOUR = 60 * 60 * 1000;
const THREE_HOURS = 3 * 60 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;
const TTL = {
  standings: ONE_HOUR,        // Changes after each race
  schedule: ONE_DAY,          // Rarely changes during season
  circuits: ONE_DAY,          // Static data
  nextRace: THREE_HOURS,      // Changes as races approach
  lastRaceResults: THREE_HOURS, // Static after race ends
  driverInfo: ONE_HOUR        // Can change with driver swaps
};

// Process race data to add emojis
const processRaceData = (races: any[]) => {
  return races.map(race => {
    const countryName = race.Circuit?.Location?.country || "";
    return {
      ...race,
      raceName: addFlagToRaceName(race.raceName, countryName)
    };
  });
};

// Fetch driver standings
export const getDriverStandings = async (year?: number) => {
  try {
    const seasonYear = year || getCurrentSeason();
    const cacheKey = `driverStandings:${seasonYear}`;
    const data = await withCache(
      cacheKey,
      TTL.standings,
      async () => {
        const response = await fetch(`${BASE_URL}/f1/${seasonYear}/driverStandings.json`, {
          mode: 'cors',
          headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        const json = await response.json();
        return json.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [];
      },
      { namespace: 'ergast', staleWhileRevalidate: true }
    );
    return { data, error: null };
  } catch (error) {
    console.error("Failed to fetch driver standings:", error);
    return { data: [], error };
  }
};

// Fetch constructor standings
export const getConstructorStandings = async (year?: number) => {
  try {
    const seasonYear = year || getCurrentSeason();
    const cacheKey = `constructorStandings:${seasonYear}`;
    const data = await withCache(
      cacheKey,
      TTL.standings,
      async () => {
        const response = await fetch(`${BASE_URL}/f1/${seasonYear}/constructorStandings.json`, {
          mode: 'cors',
          headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        const json = await response.json();
        return json.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings || [];
      },
      { namespace: 'ergast', staleWhileRevalidate: true }
    );
    return { data, error: null };
  } catch (error) {
    console.error("Failed to fetch constructor standings:", error);
    return { data: [], error };
  }
};

// Fetch race schedule
export const getRaceSchedule = async (year?: number) => {
  try {
    const seasonYear = year || getCurrentSeason();
    const cacheKey = `raceSchedule:${seasonYear}`;
    const data = await withCache(
      cacheKey,
      TTL.schedule,
      async () => {
        const response = await fetch(`${BASE_URL}/f1/${seasonYear}.json`, {
          mode: 'cors',
          headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        const json = await response.json();
        const races = json.MRData?.RaceTable?.Races || [];
        return processRaceData(races);
      },
      { namespace: 'ergast', staleWhileRevalidate: true }
    );
    return { data, error: null };
  } catch (error) {
    console.error("Failed to fetch race schedule:", error);
    return { data: [], error };
  }
};

// Fetch specific race results with error logging
export const getRaceResults = async (year: number, round: string) => {
  try {
    const cacheKey = `raceResults:${year}:${round}`;
    const data = await withCache(
      cacheKey,
      TTL.lastRaceResults,
      async () => {
        const response = await fetch(`${BASE_URL}/f1/${year}/${round}/results.json`, {
          mode: 'cors',
          headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        const json = await response.json();
        return json.MRData?.RaceTable?.Races?.[0] || {};
      },
      { namespace: 'ergast', staleWhileRevalidate: true }
    );
    return { data, error: null };
  } catch (error) {
    console.error(`Failed to fetch results for round ${round}:`, error);
    return { data: {}, error };
  }
};

// Fetch qualifying results
export const getRaceQualifying = async (year: number, round: string) => {
  try {
    const cacheKey = `raceQualifying:${year}:${round}`;
    const data = await withCache(
      cacheKey,
      TTL.lastRaceResults,
      async () => {
        const response = await fetch(`${BASE_URL}/f1/${year}/${round}/qualifying.json`, {
          mode: 'cors',
          headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        const json = await response.json();
        return json.MRData?.RaceTable?.Races?.[0] || {};
      },
      { namespace: 'ergast', staleWhileRevalidate: true }
    );
    return { data, error: null };
  } catch (error) {
    console.error(`Failed to fetch qualifying for round ${round}:`, error);
    return { data: {}, error };
  }
};

// Fetch pit stops for a specific race
export const getPitStops = async (year: number, round: string) => {
  try {
    const cacheKey = `pitStops:${year}:${round}`;
    const data = await withCache(
      cacheKey,
      TTL.lastRaceResults,
      async () => {
        const response = await fetch(`${BASE_URL}/f1/${year}/${round}/pitstops.json`, {
          mode: 'cors',
          headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        const json = await response.json();
        return json.MRData?.RaceTable || {};
      },
      { namespace: 'ergast', staleWhileRevalidate: true }
    );
    return { data, error: null };
  } catch (error) {
    console.error(`Failed to fetch pit stops for round ${round}:`, error);
    return { data: {}, error };
  }
};

// Enhanced throttled fetch with more robust retry for handling 429 errors
async function throttledFetch(url: string, retryDelay = 2000, maxRetries = 3, attemptRef?: {[key: string]: number}): Promise<Response> {
  let retries = 0;
  const requestId = url.split('?')[0] + '_' + Math.random().toString(36).substring(2, 9);
  
  if (attemptRef) {
    attemptRef[requestId] = 0;
  }
  
  while (true) {
    try {
      const response = await fetch(url, {
        mode: 'cors',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      // If we get rate limited, wait and retry
      if (response.status === 429 && retries < maxRetries) {
        retries++;
        if (attemptRef) {
          attemptRef[requestId] = retries;
        }
        
        // Calculate exponential backoff with jitter
        const delay = retryDelay * (2 ** retries) * (0.8 + Math.random() * 0.4);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      return response;
    } catch (error) {
      if (retries < maxRetries) {
        retries++;
        if (attemptRef) {
          attemptRef[requestId] = retries;
        }
        
        const delay = retryDelay * (2 ** retries);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}

// Fetch lap times for a specific race with enhanced pagination and retry support
export const getLapTimes = async (
  year: number, 
  round: string, 
  firstDriverOnly?: string,
  onProgress?: (
    progress: number,  // 0-1 progress value
    pagesLoaded: number, 
    totalPages: number,
    retryAttempts: {[key: string]: number}
  ) => void
) => {
  // Cache key includes firstDriverOnly to differentiate cached results
  const cacheKey = `lapTimes:${year}:${round}:${firstDriverOnly || 'all'}`;
  
  // Check cache first for this expensive operation
  const cachedData = await withCache(
    cacheKey,
    TTL.lastRaceResults, // 3 hours TTL
    async () => {
      // Original lap times fetching logic
      return await fetchLapTimesUncached(year, round, firstDriverOnly, onProgress);
    },
    { namespace: 'ergast', staleWhileRevalidate: true }
  );
  
  return cachedData;
};

// Extract the original lap times logic to a separate function
async function fetchLapTimesUncached(
  year: number, 
  round: string, 
  firstDriverOnly?: string,
  onProgress?: (
    progress: number,
    pagesLoaded: number, 
    totalPages: number,
    retryAttempts: {[key: string]: number}
  ) => void
) {
  try {
    let baseUrl = `${BASE_URL}/f1/${year}/${round}/laps`;
    const retryAttempts: {[key: string]: number} = {};
    
    // Initial request with small page size to quickly get total count
    const initialResponse = await throttledFetch(`${baseUrl}.json?limit=30&offset=0`, 3000, 5, retryAttempts);
    
    if (!initialResponse.ok) {
      if (initialResponse.status === 429) {
        const error: any = new Error(`API request failed with status ${initialResponse.status}`);
        error.status = 429;
        throw error;
      }
      throw new Error(`API request failed with status ${initialResponse.status}`);
    }
    
    const initialData = await initialResponse.json();
    const total = parseInt(initialData.MRData?.total || "0");
    const limit = 100;
    
    if (total > 30) {
      if (onProgress) onProgress(0.05, 1, Math.ceil((total - 30) / limit) + 1, retryAttempts);
      
      let allLaps = initialData.MRData?.RaceTable?.Races?.[0]?.Laps || [];
      
      const requestsNeeded = Math.ceil((total - 30) / limit);
      const fetchPromises = [];
      
      // Stagger requests to avoid overwhelming the API
      for (let i = 0; i < requestsNeeded; i++) {
        const offset = 30 + (i * limit);
        
        fetchPromises.push(
          new Promise(async (resolve, reject) => {
            // Increasing delays between batch requests to reduce rate limiting
            const startDelay = i * 300; // Increased delay between requests
            await new Promise(r => setTimeout(r, startDelay));
            
            try {
              // Use throttled fetch for each pagination request
              const response = await throttledFetch(
                `${baseUrl}.json?limit=${limit}&offset=${offset}`, 
                5000, 
                7, // Increased retry attempts
                retryAttempts
              );
              
              if (!response.ok) {
                if (response.status === 429) {
                  const error: any = new Error(`API request failed with status ${response.status}`);
                  error.status = 429;
                  reject(error);
                  return;
                }
                throw new Error(`API request failed with status ${response.status}`);
              }
              
              const data = await response.json();
              
              // Update progress after each successful batch
              if (onProgress) {
                // Calculate progress: weight initial request at 5%, then distribute 95% among batches
                const batchProgress = 0.05 + (0.95 * ((i + 1) / requestsNeeded));
                onProgress(
                  batchProgress,
                  i + 2, // +2 because we already have the initial request
                  requestsNeeded + 1,
                  retryAttempts
                );
              }
              
              resolve(data.MRData?.RaceTable?.Races?.[0]?.Laps || []);
            } catch (error) {
              console.error(`Error fetching batch ${i+1}/${requestsNeeded}:`, error);
              reject(error);
            }
          })
        );
      }
      
      try {
        // Try Promise.allSettled with sequential fallback to maximize data retrieval
        const results = await Promise.allSettled(fetchPromises);
        
        let failedBatches = 0;
        
        // Process successful requests
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            allLaps = [...allLaps, ...result.value];
          } else {
            failedBatches++;
          }
        });
        
        // Sort laps by number to ensure correct order after parallel fetching
        allLaps.sort((a: any, b: any) => parseInt(a.number) - parseInt(b.number));
        
        // Check if we have partial data (some requests succeeded, some failed)
        const isPartialData = failedBatches > 0;
        
        const completeData = {
          ...initialData.MRData,
          RaceTable: {
            ...initialData.MRData.RaceTable,
            Races: [{
              ...initialData.MRData.RaceTable.Races[0],
              Laps: allLaps,
              isPartialData,
              totalBatches: requestsNeeded + 1,
              successfulBatches: requestsNeeded + 1 - failedBatches
            }]
          }
        };
        
        // Update final progress
        if (onProgress) {
          onProgress(
            1.0,
            requestsNeeded + 1 - failedBatches,
            requestsNeeded + 1,
            retryAttempts
          );
        }
        
        // If we have partial data but still enough to show something useful
        if (isPartialData && allLaps.length > 10) {
          toast.warning(`${failedBatches} of ${requestsNeeded} data batches failed to load`, {
            description: `Showing ${allLaps.length} laps of data. You may see gaps in the charts.`,
            duration: 5000,
          });
        } else if (!isPartialData) {
          toast.success(`All ${allLaps.length} laps loaded successfully!`, {
            duration: 3000,
          });
        }
        
        return { 
          data: { Races: completeData.RaceTable.Races },
          error: isPartialData ? "Partial data loaded due to API rate limits" : null,
          isPartialData,
          loadingStats: {
            totalBatches: requestsNeeded + 1,
            successfulBatches: requestsNeeded + 1 - failedBatches,
            lapsLoaded: allLaps.length,
            totalLaps: total,
            retryAttempts
          }
        };
      } catch (error: any) {
        console.error(`Failed to fetch all lap times for round ${round}:`, error);
        // Return partial data if we have some laps
        if (allLaps.length > 0) {
          toast.warning(`Loaded ${allLaps.length} of ${total} laps`, {
            description: "API rate limits prevented loading all laps. Showing what was available.",
            duration: 5000,
          });
          
          return { 
            data: { 
              Races: [{ 
                ...initialData.MRData.RaceTable.Races[0],
                Laps: allLaps,
                incomplete: true
              }] 
            }, 
            error: "Incomplete data due to API rate limits",
            status: error.status || 500,
            isPartialData: true,
            loadingStats: {
              lapsLoaded: allLaps.length,
              totalLaps: total,
              retryAttempts
            }
          };
        }
        throw error;
      }
    } else {
      // For small datasets with <= 30 laps
      if (onProgress) onProgress(1.0, 1, 1, retryAttempts);
      
      return { 
        data: initialData.MRData?.RaceTable || {}, 
        error: null,
        loadingStats: {
          totalBatches: 1,
          successfulBatches: 1,
          lapsLoaded: initialData.MRData?.RaceTable?.Races?.[0]?.Laps?.length || 0,
          totalLaps: total,
          retryAttempts
        }
      };
    }
  } catch (error: any) {
    console.error(`Failed to fetch lap times for round ${round}:`, error);
    return { 
      data: {}, 
      error: error.message || "Failed to fetch lap times",
      status: error.status || 500,
      loadingStats: {
        failed: true,
        errorMessage: error.message
      }
    };
  }
};

// Fetch last race results
export const getLastRaceResults = async (year?: number) => {
  try {
    const seasonYear = year || getCurrentSeason();
    const data = await withCache(
      `lastRaceResults:${seasonYear}`,
      TTL.lastRaceResults,
      async () => {
        const scheduleResponse = await fetch(`${BASE_URL}/f1/${seasonYear}.json`, {
          mode: 'cors',
          headers: { 'Accept': 'application/json' }
        });
        if (!scheduleResponse.ok) {
          throw new Error(`API request failed with status ${scheduleResponse.status}`);
        }
        const scheduleData = await scheduleResponse.json();
        const races = scheduleData.MRData?.RaceTable?.Races || [];
        const now = new Date();
        const completedRaces = races.filter((race: any) => new Date(race.date) < now);
        if (completedRaces.length === 0) {
          return null;
        }
        const lastRace = completedRaces[completedRaces.length - 1];
        const resultsResponse = await fetch(`${BASE_URL}/f1/${lastRace.season}/${lastRace.round}/results.json`, {
          mode: 'cors',
          headers: { 'Accept': 'application/json' }
        });
        if (!resultsResponse.ok) {
          throw new Error(`API request failed with status ${resultsResponse.status}`);
        }
        const resultsData = await resultsResponse.json();
        return {
          raceName: lastRace.raceName,
          results: resultsData.MRData?.RaceTable?.Races?.[0]?.Results || []
        };
      },
      { namespace: 'ergast', staleWhileRevalidate: true }
    );
    if (!data) {
      return { data: null, error: "No completed races found for this season" };
    }
    return { data, error: null };
  } catch (error) {
    console.error("Failed to fetch race results:", error);
    return { data: null, error };
  }
};

// Get next race data
export const getNextRace = async (year?: number) => {
  try {
    const seasonYear = year || getCurrentSeason();
    const cacheKey = `nextRace:${seasonYear}`;
    const data = await withCache(
      cacheKey,
      TTL.nextRace,
      async () => {
        const response = await fetch(`${BASE_URL}/f1/${seasonYear}.json`, {
          mode: 'cors',
          headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        const json = await response.json();
        const races = json.MRData?.RaceTable?.Races || [];
        const now = new Date();
        const upcomingRaces = races.filter((race: any) => new Date(race.date) > now);
        if (upcomingRaces.length === 0) {
          return null;
        }
        return upcomingRaces[0];
      },
      { namespace: 'ergast', staleWhileRevalidate: true }
    );
    if (!data) {
      return { data: null, error: "No upcoming races found for this season" };
    }
    return { data, error: null };
  } catch (error) {
    console.error("Failed to fetch next race:", error);
    return { data: null, error };
  }
};

// Race status data (simplified)
export const getRaceStatus = async (sessionId?: string) => {
  try {
    return { data: null, error: "Live timing data not available" };
  } catch (error) {
    console.error("Failed to fetch race status:", error);
    return { data: null, error };
  }
};

// Driver info data
export const getDriverInfo = async (year?: number) => {
  try {
    const seasonYear = year || getCurrentSeason();
    const cacheKey = `driverInfo:${seasonYear}`;
    const data = await withCache(
      cacheKey,
      TTL.driverInfo,
      async () => {
        const response = await fetch(`${BASE_URL}/f1/${seasonYear}/driverStandings.json`, {
          mode: 'cors',
          headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        const json = await response.json();
        return json.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [];
      },
      { namespace: 'ergast', staleWhileRevalidate: true }
    );
    return { data, error: null };
  } catch (error) {
    console.error("Failed to fetch driver info:", error);
    return { data: [], error };
  }
};

// Weather data (simplified)
export const getWeatherData = async (sessionId?: string) => {
  try {
    return { data: null, error: "Weather data not available" };
  } catch (error) {
    console.error("Failed to fetch weather data:", error);
    return { data: null, error };
  }
};

// F1 News data (simplified)
export const getF1News = async () => {
  try {
    return { data: [], error: "News data not available through this API" };
  } catch (error) {
    console.error("Failed to fetch F1 news:", error);
    return { data: [], error };
  }
};

// Fetch F1 circuits data
export const getF1Circuits = async () => {
  try {
    const cacheKey = `circuits:all`;
    const data = await withCache(
      cacheKey,
      TTL.circuits,
      async () => {
        const response = await fetch(`${BASE_URL}/f1/circuits.json`, {
          mode: 'cors',
          headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        const json = await response.json();
        return json.MRData?.CircuitTable?.Circuits || [];
      },
      { namespace: 'ergast', staleWhileRevalidate: true }
    );
    return { data, error: null };
  } catch (error) {
    console.error("Failed to fetch circuits:", error);
    return { data: [], error };
  }
};

// Fetch sprint results for a specific race
export const getSprintResults = async (year: number, round: string) => {
  try {
    const cacheKey = `sprintResults:${year}:${round}`;
    const data = await withCache(
      cacheKey,
      TTL.lastRaceResults,
      async () => {
        const response = await fetch(`${BASE_URL}/f1/${year}/${round}/sprint.json`, {
          mode: 'cors',
          headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        const json = await response.json();
        return json.MRData?.RaceTable?.Races?.[0] || {};
      },
      { namespace: 'ergast', staleWhileRevalidate: true }
    );
    return { data, error: null };
  } catch (error) {
    console.error(`Failed to fetch sprint results for round ${round}:`, error);
    return { data: {}, error };
  }
};

// Fetch all race results for a driver in a given season (points per race)
export const getDriverResultsBySeason = async (year: number, driverId: string) => {
  try {
    const url = `${BASE_URL}/f1/${year}/drivers/${encodeURIComponent(driverId)}/results.json?limit=1000`;
    const response = await fetch(url, {
      mode: 'cors',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    const races: any[] = data.MRData?.RaceTable?.Races || [];

    // Map to simplified per-race structure
    const pointsByRace = races.map((race: any) => {
      const result = (race.Results || [])[0] || {};
      return {
        round: race.round,
        raceName: race.raceName,
        date: race.date,
        circuit: race.Circuit?.circuitName,
        country: race.Circuit?.Location?.country,
        position: result.position,
        status: result.status,
        points: Number(result.points || 0),
        constructor: result.Constructor?.name,
      };
    }).filter(r => r.points > 0);

    // Sort by round numeric
    pointsByRace.sort((a, b) => parseInt(a.round) - parseInt(b.round));

    return { data: pointsByRace, error: null };
  } catch (error) {
    console.error(`Failed to fetch driver results for ${year}, driver ${driverId}:`, error);
    return { data: [], error };
  }
};

// Cache management utilities
export const cacheUtils = {
  // Clear all F1 data cache
  clearAll: () => {
    clearNamespace('ergast');
    clearNamespace('openf1');
    // Also clear image cache
    import('@/utils/imageCache').then(({ clearImageCache }) => clearImageCache());
  },
  
  // Clear specific data types
  clearStandings: (year?: number) => {
    const seasonYear = year || getCurrentSeason();
    deleteCache(`driverStandings:${seasonYear}`, 'ergast');
    deleteCache(`constructorStandings:${seasonYear}`, 'ergast');
    deleteCache(`driverInfo:${seasonYear}`, 'ergast');
  },
  
  clearRaceData: (year: number, round?: string) => {
    if (round) {
      deleteCache(`raceResults:${year}:${round}`, 'ergast');
      deleteCache(`raceQualifying:${year}:${round}`, 'ergast');
      deleteCache(`pitStops:${year}:${round}`, 'ergast');
      deleteCache(`sprintResults:${year}:${round}`, 'ergast');
      // Clear lap times cache (both all drivers and first driver only)
      deleteCache(`lapTimes:${year}:${round}:all`, 'ergast');
      deleteCache(`lapTimes:${year}:${round}:true`, 'ergast');
    }
    deleteCache(`lastRaceResults:${year}`, 'ergast');
    deleteCache(`nextRace:${year}`, 'ergast');
  },
  
  clearSchedule: (year?: number) => {
    const seasonYear = year || getCurrentSeason();
    deleteCache(`raceSchedule:${seasonYear}`, 'ergast');
  },
  
  // Clear image cache
  clearImages: () => {
    import('@/utils/imageCache').then(({ clearImageCache }) => clearImageCache());
  },
  
  // Clear OpenF1 cache
  clearOpenF1: () => {
    clearNamespace('openf1');
  }
};
