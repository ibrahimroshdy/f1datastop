
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
