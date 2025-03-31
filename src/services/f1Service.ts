
import { toast } from "sonner";

const BASE_URL = "https://ergast.com/api/f1";

// Fetch current season data
export const getCurrentSeason = async () => {
  try {
    const response = await fetch(`${BASE_URL}/current.json`);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    return { data: data.MRData, error: null };
  } catch (error) {
    console.error("Failed to fetch F1 season data:", error);
    toast.error("Failed to load F1 season data. Please try again later.");
    return { data: null, error };
  }
};

// Fetch driver standings for current season
export const getDriverStandings = async () => {
  try {
    const currentYear = new Date().getFullYear();
    const response = await fetch(`${BASE_URL}/${currentYear}/driverStandings.json`);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    return { data: data.MRData.StandingsTable.StandingsLists[0]?.DriverStandings || [], error: null };
  } catch (error) {
    console.error("Failed to fetch driver standings:", error);
    toast.error("Failed to load driver standings. Please try again later.");
    return { data: [], error };
  }
};

// Fetch constructor standings for current season
export const getConstructorStandings = async () => {
  try {
    const currentYear = new Date().getFullYear();
    const response = await fetch(`${BASE_URL}/${currentYear}/constructorStandings.json`);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    return { data: data.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings || [], error: null };
  } catch (error) {
    console.error("Failed to fetch constructor standings:", error);
    toast.error("Failed to load constructor standings. Please try again later.");
    return { data: [], error };
  }
};

// Fetch upcoming race schedule
export const getRaceSchedule = async () => {
  try {
    const currentYear = new Date().getFullYear();
    const response = await fetch(`${BASE_URL}/${currentYear}.json`);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    return { data: data.MRData.RaceTable.Races, error: null };
  } catch (error) {
    console.error("Failed to fetch race schedule:", error);
    toast.error("Failed to load race schedule. Please try again later.");
    return { data: [], error };
  }
};

// Fetch last race results
export const getLastRaceResults = async () => {
  try {
    const currentYear = new Date().getFullYear();
    const response = await fetch(`${BASE_URL}/${currentYear}/last/results.json`);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    return { 
      data: {
        raceName: data.MRData.RaceTable.Races[0]?.raceName,
        results: data.MRData.RaceTable.Races[0]?.Results || []
      }, 
      error: null 
    };
  } catch (error) {
    console.error("Failed to fetch race results:", error);
    toast.error("Failed to load race results. Please try again later.");
    return { data: { raceName: null, results: [] }, error };
  }
};

// New functions to match the hooks

// Get next race data
export const getNextRace = async () => {
  try {
    const currentYear = new Date().getFullYear();
    const response = await fetch(`${BASE_URL}/${currentYear}/next.json`);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    
    // Transform data to match component expectations
    const transformedData = data.MRData.RaceTable.Races.map((race: any) => ({
      meeting_name: race.raceName,
      location: `${race.Circuit.Location.locality}, ${race.Circuit.Location.country}`,
      session_status: new Date(race.date + "T" + (race.time || "00:00:00Z")) > new Date() ? "Upcoming" : "Ongoing",
      session_name: race.raceName,
      session_type: "Race",
      total_laps: "78", // Default value as API doesn't provide this
    }));
    
    return { data: transformedData, error: null };
  } catch (error) {
    console.error("Failed to fetch next race:", error);
    toast.error("Failed to load next race data. Please try again later.");
    return { data: [], error };
  }
};

// Race status data (mock data as Ergast doesn't provide live race data)
export const getRaceStatus = async (sessionId?: string) => {
  try {
    // Since Ergast doesn't provide live race status, return mock data
    const mockData = [{
      lap_number: "42",
      // Add more fields as needed by the components
    }];
    
    return { data: mockData, error: null };
  } catch (error) {
    console.error("Failed to fetch race status:", error);
    toast.error("Failed to load race status. Please try again later.");
    return { data: [], error };
  }
};

// Driver info data (mock data as Ergast doesn't provide this format)
export const getDriverInfo = async (sessionId?: string) => {
  try {
    // Get current drivers from standings to use in mock data
    const driversResponse = await fetch(`${BASE_URL}/current/driverStandings.json`);
    
    if (!driversResponse.ok) {
      throw new Error(`API request failed with status ${driversResponse.status}`);
    }
    
    const driversData = await driversResponse.json();
    const drivers = driversData.MRData.StandingsTable.StandingsLists[0]?.DriverStandings || [];
    
    // Create mock data based on real drivers
    const mockData = drivers.slice(0, 10).map((driver: any, index: number) => ({
      driver_number: driver.Driver.permanentNumber,
      full_name: `${driver.Driver.givenName} ${driver.Driver.familyName}`,
      team_name: driver.Constructors[0].name,
      position: index + 1,
      gap_to_leader: index === 0 ? "0.0" : (Math.random() * 30).toFixed(1),
    }));
    
    return { data: mockData, error: null };
  } catch (error) {
    console.error("Failed to fetch driver info:", error);
    toast.error("Failed to load driver information. Please try again later.");
    return { data: [], error };
  }
};

// Weather data (mock data as Ergast doesn't provide this)
export const getWeatherData = async (sessionId?: string) => {
  try {
    // Return mock weather data
    const mockData = [{
      air_temperature: 25,
      track_temperature: 30,
      humidity: 65,
      condition: "Partly Cloudy",
    }];
    
    return { data: mockData, error: null };
  } catch (error) {
    console.error("Failed to fetch weather data:", error);
    toast.error("Failed to load weather data. Please try again later.");
    return { data: [], error };
  }
};

// F1 News data (mock data as we don't have a news API integrated)
export const getF1News = async () => {
  try {
    // Return mock news data
    const mockData = {
      data: [
        {
          title: "Hamilton secures pole position for the Monaco Grand Prix",
          url: "https://www.formula1.com/",
          urlToImage: "https://placehold.co/600x400?text=F1+News+Image",
          source: { name: "Formula1.com" },
          publishedAt: new Date().toISOString(),
        },
        {
          title: "Verstappen leads championship after Barcelona victory",
          url: "https://www.formula1.com/",
          urlToImage: "https://placehold.co/600x400?text=F1+News+Image",
          source: { name: "Formula1.com" },
          publishedAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        },
        {
          title: "Ferrari reveals upgrades for upcoming races",
          url: "https://www.formula1.com/",
          urlToImage: "https://placehold.co/600x400?text=F1+News+Image",
          source: { name: "Formula1.com" },
          publishedAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
        },
        {
          title: "McLaren showing strong pace in recent tests",
          url: "https://www.formula1.com/",
          urlToImage: "https://placehold.co/600x400?text=F1+News+Image",
          source: { name: "SkySports F1" },
          publishedAt: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
        },
        {
          title: "Alonso: 'Aston Martin has potential for podiums'",
          url: "https://www.formula1.com/",
          urlToImage: "https://placehold.co/600x400?text=F1+News+Image",
          source: { name: "Twitter" },
          publishedAt: new Date(Date.now() - 345600000).toISOString(), // 4 days ago
        },
        {
          title: "F1 announces new race in Madrid starting from 2026",
          url: "https://www.formula1.com/",
          urlToImage: "https://placehold.co/600x400?text=F1+News+Image",
          source: { name: "Formula1.com" },
          publishedAt: new Date(Date.now() - 432000000).toISOString(), // 5 days ago
        }
      ]
    };
    
    return mockData;
  } catch (error) {
    console.error("Failed to fetch F1 news:", error);
    toast.error("Failed to load F1 news. Please try again later.");
    return { data: [], error };
  }
};
