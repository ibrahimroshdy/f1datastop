import { toast } from "sonner";
import { getCountryFlag, addFlagToRaceName } from "@/utils/countryUtils";

const BASE_URL = "https://api.jolpi.ca/ergast";

// Get the current F1 season year
const getCurrentSeason = () => new Date().getFullYear();

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
    const response = await fetch(`${BASE_URL}/f1/${seasonYear}/driverStandings.json`, {
      mode: 'cors',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    return { 
      data: data.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [], 
      error: null 
    };
  } catch (error) {
    console.error("Failed to fetch driver standings:", error);
    return { data: [], error };
  }
};

// Fetch constructor standings
export const getConstructorStandings = async (year?: number) => {
  try {
    const seasonYear = year || getCurrentSeason();
    const response = await fetch(`${BASE_URL}/f1/${seasonYear}/constructorStandings.json`, {
      mode: 'cors',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    return { 
      data: data.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings || [], 
      error: null 
    };
  } catch (error) {
    console.error("Failed to fetch constructor standings:", error);
    return { data: [], error };
  }
};

// Fetch race schedule
export const getRaceSchedule = async (year?: number) => {
  try {
    const seasonYear = year || getCurrentSeason();
    const response = await fetch(`${BASE_URL}/f1/${seasonYear}.json`, {
      mode: 'cors',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    const races = data.MRData?.RaceTable?.Races || [];
    const processedRaces = processRaceData(races);
    
    return { 
      data: processedRaces, 
      error: null 
    };
  } catch (error) {
    console.error("Failed to fetch race schedule:", error);
    return { data: [], error };
  }
};

// Fetch specific race results
export const getRaceResults = async (year: number, round: string) => {
  try {
    const response = await fetch(`${BASE_URL}/f1/${year}/${round}/results.json`, {
      mode: 'cors',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    return { 
      data: data.MRData?.RaceTable?.Races?.[0] || {}, 
      error: null 
    };
  } catch (error) {
    console.error(`Failed to fetch results for round ${round}:`, error);
    return { data: {}, error };
  }
};

// Fetch qualifying results
export const getRaceQualifying = async (year: number, round: string) => {
  try {
    const response = await fetch(`${BASE_URL}/f1/${year}/${round}/qualifying.json`, {
      mode: 'cors',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    return { 
      data: data.MRData?.RaceTable?.Races?.[0] || {}, 
      error: null 
    };
  } catch (error) {
    console.error(`Failed to fetch qualifying for round ${round}:`, error);
    return { data: {}, error };
  }
};

// Fetch pit stops for a specific race
export const getPitStops = async (year: number, round: string) => {
  try {
    const response = await fetch(`${BASE_URL}/f1/${year}/${round}/pitstops.json`, {
      mode: 'cors',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    return { 
      data: data.MRData?.RaceTable || {}, 
      error: null 
    };
  } catch (error) {
    console.error(`Failed to fetch pit stops for round ${round}:`, error);
    return { data: {}, error };
  }
};

// Fetch lap times for a specific race with pagination support
export const getLapTimes = async (year: number, round: string, firstDriverOnly?: string) => {
  try {
    let baseUrl = `${BASE_URL}/f1/${year}/${round}/laps`;
    
    const initialResponse = await fetch(`${baseUrl}.json?limit=30&offset=0`, {
      mode: 'cors',
      headers: {
        'Accept': 'application/json'
      }
    });
    
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
      console.log(`Fetching all ${total} laps for race ${year}/${round} with pagination`);
      
      let allLaps = initialData.MRData?.RaceTable?.Races?.[0]?.Laps || [];
      
      const requestsNeeded = Math.ceil((total - 30) / limit);
      const fetchPromises = [];
      
      for (let i = 0; i < requestsNeeded; i++) {
        const offset = 30 + (i * limit);
        const url = `${baseUrl}.json?limit=${limit}&offset=${offset}`;
        
        fetchPromises.push(
          new Promise(async (resolve, reject) => {
            await new Promise(r => setTimeout(r, i * 200));
            
            try {
              const response = await fetch(url, {
                mode: 'cors',
                headers: {
                  'Accept': 'application/json'
                }
              });
              
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
              resolve(data.MRData?.RaceTable?.Races?.[0]?.Laps || []);
            } catch (error) {
              reject(error);
            }
          })
        );
      }
      
      try {
        const additionalLapsArrays = await Promise.all(fetchPromises);
        
        additionalLapsArrays.forEach(laps => {
          allLaps = [...allLaps, ...laps];
        });
        
        allLaps.sort((a: any, b: any) => parseInt(a.number) - parseInt(b.number));
        
        const completeData = {
          ...initialData.MRData,
          RaceTable: {
            ...initialData.MRData.RaceTable,
            Races: [{
              ...initialData.MRData.RaceTable.Races[0],
              Laps: allLaps
            }]
          }
        };
        
        return { 
          data: { Races: completeData.RaceTable.Races }, 
          error: null 
        };
      } catch (error: any) {
        console.error(`Failed to fetch all lap times for round ${round}:`, error);
        if (allLaps.length > 0) {
          return { 
            data: { 
              Races: [{ 
                ...initialData.MRData.RaceTable.Races[0],
                Laps: allLaps,
                incomplete: true
              }] 
            }, 
            error: "Incomplete data due to API rate limits",
            status: error.status || 500
          };
        }
        throw error;
      }
    }
    
    return { 
      data: initialData.MRData?.RaceTable || {}, 
      error: null 
    };
  } catch (error: any) {
    console.error(`Failed to fetch lap times for round ${round}:`, error);
    return { 
      data: {}, 
      error: error.message || "Failed to fetch lap times",
      status: error.status || 500
    };
  }
};

// Fetch last race results
export const getLastRaceResults = async (year?: number) => {
  try {
    const seasonYear = year || getCurrentSeason();
    const scheduleResponse = await fetch(`${BASE_URL}/f1/${seasonYear}.json`, {
      mode: 'cors',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!scheduleResponse.ok) {
      throw new Error(`API request failed with status ${scheduleResponse.status}`);
    }
    
    const scheduleData = await scheduleResponse.json();
    const races = scheduleData.MRData?.RaceTable?.Races || [];
    
    const now = new Date();
    const completedRaces = races.filter(race => new Date(race.date) < now);
    
    if (completedRaces.length === 0) {
      return { 
        data: null, 
        error: "No completed races found for this season" 
      };
    }
    
    const lastRace = completedRaces[completedRaces.length - 1];
    
    const resultsResponse = await fetch(`${BASE_URL}/f1/${lastRace.season}/${lastRace.round}/results.json`, {
      mode: 'cors',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!resultsResponse.ok) {
      throw new Error(`API request failed with status ${resultsResponse.status}`);
    }
    
    const resultsData = await resultsResponse.json();
    
    return { 
      data: {
        raceName: lastRace.raceName,
        results: resultsData.MRData?.RaceTable?.Races?.[0]?.Results || []
      }, 
      error: null 
    };
  } catch (error) {
    console.error("Failed to fetch race results:", error);
    return { data: null, error };
  }
};

// Get next race data
export const getNextRace = async (year?: number) => {
  try {
    const seasonYear = year || getCurrentSeason();
    const response = await fetch(`${BASE_URL}/f1/${seasonYear}.json`, {
      mode: 'cors',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    const races = data.MRData?.RaceTable?.Races || [];
    
    const now = new Date();
    const upcomingRaces = races.filter(race => new Date(race.date) > now);
    
    if (upcomingRaces.length === 0) {
      return { data: null, error: "No upcoming races found for this season" };
    }
    
    const nextRace = upcomingRaces[0];
    
    return { data: nextRace, error: null };
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
    const response = await fetch(`${BASE_URL}/f1/${seasonYear}/driverStandings.json`, {
      mode: 'cors',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    const drivers = data.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [];
    
    return { data: drivers, error: null };
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
    const response = await fetch(`${BASE_URL}/f1/circuits.json`, {
      mode: 'cors',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    return { 
      data: data.MRData?.CircuitTable?.Circuits || [],
      error: null 
    };
  } catch (error) {
    console.error("Failed to fetch circuits:", error);
    return { data: [], error };
  }
};
