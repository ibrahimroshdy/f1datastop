import { toast } from "sonner";

const BASE_URL = "https://api.jolpi.ca/ergast";

// Get the current F1 season year
const getCurrentSeason = () => new Date().getFullYear();

// Map of country codes to emoji flags
const COUNTRY_EMOJIS: Record<string, string> = {
  australia: "🇦🇺",
  austria: "🇦🇹",
  azerbaijan: "🇦🇿",
  bahrain: "🇧🇭",
  belgium: "🇧🇪",
  brazil: "🇧🇷",
  canada: "🇨🇦",
  china: "🇨🇳",
  hungary: "🇭🇺",
  italy: "🇮🇹",
  japan: "🇯🇵",
  mexico: "🇲🇽",
  monaco: "🇲🇨",
  netherlands: "🇳🇱",
  portugal: "🇵🇹",
  qatar: "🇶🇦",
  saudi_arabia: "🇸🇦",
  singapore: "🇸🇬",
  spain: "🇪🇸",
  uae: "🇦🇪",
  uk: "🇬🇧",
  usa: "🇺🇸",
  miami: "🇺🇸",
  vegas: "🇺🇸",
  imola: "🇮🇹",
  emilia_romagna: "🇮🇹",
  abu_dhabi: "🇦🇪",
  styria: "🇦🇹",
  france: "🇫🇷",
  russia: "🇷🇺",
  turkey: "🇹🇷",
  germany: "🇩🇪",
};

// Helper to get country emoji from race name or circuit name
const getCountryEmoji = (raceName: string, circuitId: string): string => {
  // Try to extract country from race name
  const lowerRaceName = raceName.toLowerCase();
  
  for (const [country, emoji] of Object.entries(COUNTRY_EMOJIS)) {
    if (lowerRaceName.includes(country.replace('_', ' '))) {
      return emoji + " ";
    }
  }
  
  // Try with circuit ID
  const lowerCircuitId = circuitId.toLowerCase();
  for (const [country, emoji] of Object.entries(COUNTRY_EMOJIS)) {
    if (lowerCircuitId.includes(country.replace('_', ''))) {
      return emoji + " ";
    }
  }
  
  return "";
};

// Process race data to add emojis
const processRaceData = (races: any[]) => {
  return races.map(race => {
    const emoji = getCountryEmoji(race.raceName, race.Circuit.circuitId);
    return {
      ...race,
      raceName: `${emoji}${race.raceName}`
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
export const getLapTimes = async (year: number, round: string, driverId?: string) => {
  try {
    let baseUrl = `${BASE_URL}/f1/${year}/${round}/laps`;
    if (driverId) {
      baseUrl = `${BASE_URL}/f1/${year}/${round}/drivers/${driverId}/laps`;
    }
    
    // First request to get total number of laps
    const initialResponse = await fetch(`${baseUrl}.json?limit=30&offset=0`, {
      mode: 'cors',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!initialResponse.ok) {
      throw new Error(`API request failed with status ${initialResponse.status}`);
    }
    
    const initialData = await initialResponse.json();
    const total = parseInt(initialData.MRData?.total || "0");
    const limit = 100; // Increase the limit to reduce number of requests
    
    // If there are more laps than the initial limit, fetch all of them
    if (total > 30) {
      console.log(`Fetching all ${total} laps for race ${year}/${round} with pagination`);
      
      // Store the initial results
      let allLaps = initialData.MRData?.RaceTable?.Races?.[0]?.Laps || [];
      
      // Calculate how many additional requests we need
      const requestsNeeded = Math.ceil((total - 30) / limit);
      const fetchPromises = [];
      
      for (let i = 0; i < requestsNeeded; i++) {
        const offset = 30 + (i * limit);
        const url = `${baseUrl}.json?limit=${limit}&offset=${offset}`;
        
        fetchPromises.push(
          fetch(url, {
            mode: 'cors',
            headers: {
              'Accept': 'application/json'
            }
          })
          .then(response => {
            if (!response.ok) {
              throw new Error(`API request failed with status ${response.status}`);
            }
            return response.json();
          })
          .then(data => data.MRData?.RaceTable?.Races?.[0]?.Laps || [])
        );
      }
      
      // Wait for all requests to complete
      const additionalLapsArrays = await Promise.all(fetchPromises);
      
      // Combine all the laps from additional requests
      additionalLapsArrays.forEach(laps => {
        allLaps = [...allLaps, ...laps];
      });
      
      // Sort laps by lap number to ensure correct order
      allLaps.sort((a, b) => parseInt(a.number) - parseInt(b.number));
      
      // Reconstruct the response object with all laps
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
    }
    
    // If there are fewer than 30 laps, return the initial data
    return { 
      data: initialData.MRData?.RaceTable || {}, 
      error: null 
    };
  } catch (error) {
    console.error(`Failed to fetch lap times for round ${round}:`, error);
    return { data: {}, error };
  }
};

// Fetch last race results
export const getLastRaceResults = async (year?: number) => {
  try {
    const seasonYear = year || getCurrentSeason();
    // First, get the race schedule to find the last completed race
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
    
    // Find the last completed race
    const now = new Date();
    const completedRaces = races.filter(race => new Date(race.date) < now);
    
    if (completedRaces.length === 0) {
      return { 
        data: null, 
        error: "No completed races found for this season" 
      };
    }
    
    const lastRace = completedRaces[completedRaces.length - 1];
    
    // Get results for the last race
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
    
    // Find the next upcoming race
    const now = new Date();
    const upcomingRaces = races.filter(race => new Date(race.date) > now);
    
    if (upcomingRaces.length === 0) {
      return { data: null, error: "No upcoming races found for this season" };
    }
    
    const nextRace = upcomingRaces[0];
    
    // Transform data to match component expectations
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
    // External F1 news data is not available through the Ergast API
    return { data: [], error: "News data not available through this API" };
  } catch (error) {
    console.error("Failed to fetch F1 news:", error);
    return { data: [], error };
  }
};
