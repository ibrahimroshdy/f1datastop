
import { toast } from "sonner";

const BASE_URL = "https://jolpica-f1-node-c7d9d12a46ee.herokuapp.com/api";

// Fetch driver standings
export const getDriverStandings = async () => {
  try {
    const response = await fetch(`${BASE_URL}/driver-standings/2024`);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    return { data: data.data || [], error: null };
  } catch (error) {
    console.error("Failed to fetch driver standings:", error);
    toast.error("Failed to load driver standings. Please try again later.");
    return { data: [], error };
  }
};

// Fetch constructor standings
export const getConstructorStandings = async () => {
  try {
    const response = await fetch(`${BASE_URL}/team-standings/2024`);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    return { data: data.data || [], error: null };
  } catch (error) {
    console.error("Failed to fetch constructor standings:", error);
    toast.error("Failed to load constructor standings. Please try again later.");
    return { data: [], error };
  }
};

// Fetch race schedule
export const getRaceSchedule = async () => {
  try {
    const response = await fetch(`${BASE_URL}/race-schedule/2024`);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    return { data: data.data || [], error: null };
  } catch (error) {
    console.error("Failed to fetch race schedule:", error);
    toast.error("Failed to load race schedule. Please try again later.");
    return { data: [], error };
  }
};

// Fetch last race results
export const getLastRaceResults = async () => {
  try {
    const scheduleResponse = await fetch(`${BASE_URL}/race-schedule/2024`);
    
    if (!scheduleResponse.ok) {
      throw new Error(`API request failed with status ${scheduleResponse.status}`);
    }
    
    const scheduleData = await scheduleResponse.json();
    const races = scheduleData.data || [];
    
    // Find the last completed race
    const now = new Date();
    const completedRaces = races.filter(race => new Date(race.date) < now);
    
    if (completedRaces.length === 0) {
      return { 
        data: { 
          raceName: null, 
          results: [] 
        }, 
        error: null 
      };
    }
    
    const lastRace = completedRaces[completedRaces.length - 1];
    
    // Get results for the last race
    const resultsResponse = await fetch(`${BASE_URL}/race-results/${lastRace.year}/${lastRace.round}`);
    
    if (!resultsResponse.ok) {
      throw new Error(`API request failed with status ${resultsResponse.status}`);
    }
    
    const resultsData = await resultsResponse.json();
    
    return { 
      data: {
        raceName: lastRace.name,
        results: resultsData.data || []
      }, 
      error: null 
    };
  } catch (error) {
    console.error("Failed to fetch race results:", error);
    toast.error("Failed to load race results. Please try again later.");
    return { data: { raceName: null, results: [] }, error };
  }
};

// Get next race data
export const getNextRace = async () => {
  try {
    const response = await fetch(`${BASE_URL}/race-schedule/2024`);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    const races = data.data || [];
    
    // Find the next upcoming race
    const now = new Date();
    const upcomingRaces = races.filter(race => new Date(race.date) > now);
    
    if (upcomingRaces.length === 0) {
      return { data: [], error: null };
    }
    
    const nextRace = upcomingRaces[0];
    
    // Transform data to match component expectations
    const transformedData = [{
      meeting_name: nextRace.name,
      location: `${nextRace.Circuit.location}, ${nextRace.Circuit.country}`,
      session_status: "Upcoming",
      session_name: nextRace.name,
      session_type: "Race",
      total_laps: nextRace.laps || "Unknown",
    }];
    
    return { data: transformedData, error: null };
  } catch (error) {
    console.error("Failed to fetch next race:", error);
    toast.error("Failed to load next race data. Please try again later.");
    return { data: [], error };
  }
};

// Race status data
export const getRaceStatus = async (sessionId?: string) => {
  try {
    // Since we don't have live race status from the API, return mock data
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

// Driver info data
export const getDriverInfo = async (sessionId?: string) => {
  try {
    const response = await fetch(`${BASE_URL}/driver-standings/2024`);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    const drivers = data.data || [];
    
    // Transform data to match component expectations
    const mockData = drivers.slice(0, 10).map((driver: any, index: number) => ({
      driver_number: driver.permanentNumber || driver.driverNumber || `${index + 1}`,
      full_name: driver.name || `Driver ${index + 1}`,
      team_name: driver.team?.name || "Unknown Team",
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

// Weather data
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

// F1 News data
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
