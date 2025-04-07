import { toast } from "sonner";

const BACKEND_URL = "http://localhost:8000/api"; // Change this to match your backend URL

// Helper function to handle API responses
const handleResponse = async (response: Response) => {
  if (!response.ok) {
    // Parse error details if available
    let errorDetail;
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail || 'An unknown error occurred';
    } catch (e) {
      errorDetail = `HTTP error ${response.status}`;
    }
    
    throw new Error(errorDetail);
  }
  
  return response.json();
};

// Fetch driver standings
export const getDriverStandings = async (year?: number) => {
  try {
    const seasonYear = year || new Date().getFullYear();
    const response = await fetch(`${BACKEND_URL}/driver-standings/${seasonYear}`, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    const data = await handleResponse(response);
    return { 
      data: data.data || [], 
      error: null 
    };
  } catch (error) {
    console.error("Failed to fetch driver standings:", error);
    toast.error("Failed to fetch driver standings");
    return { data: [], error };
  }
};

// Fetch constructor standings
export const getConstructorStandings = async (year?: number) => {
  try {
    const seasonYear = year || new Date().getFullYear();
    const response = await fetch(`${BACKEND_URL}/constructor-standings/${seasonYear}`, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    const data = await handleResponse(response);
    return { 
      data: data.data || [], 
      error: null 
    };
  } catch (error) {
    console.error("Failed to fetch constructor standings:", error);
    toast.error("Failed to fetch constructor standings");
    return { data: [], error };
  }
};

// Fetch race schedule
export const getRaceSchedule = async (year?: number) => {
  try {
    const seasonYear = year || new Date().getFullYear();
    const response = await fetch(`${BACKEND_URL}/schedule/${seasonYear}`, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    const data = await handleResponse(response);
    return { 
      data: data.data || [], 
      error: null 
    };
  } catch (error) {
    console.error("Failed to fetch race schedule:", error);
    toast.error("Failed to fetch race schedule");
    return { data: [], error };
  }
};

// Fetch specific race results
export const getRaceResults = async (year: number, round: string) => {
  try {
    const response = await fetch(`${BACKEND_URL}/results/${year}/${round}`, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    const data = await handleResponse(response);
    return { 
      data: data.data || {}, 
      error: null 
    };
  } catch (error) {
    console.error(`Failed to fetch results for round ${round}:`, error);
    toast.error(`Failed to fetch results for ${round}`);
    return { data: {}, error };
  }
};

// Fetch qualifying results
export const getRaceQualifying = async (year: number, round: string) => {
  try {
    const response = await fetch(`${BACKEND_URL}/qualifying/${year}/${round}`, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    const data = await handleResponse(response);
    return { 
      data: data.data || {}, 
      error: null 
    };
  } catch (error) {
    console.error(`Failed to fetch qualifying for round ${round}:`, error);
    toast.error(`Failed to fetch qualifying for ${round}`);
    return { data: {}, error };
  }
};

// Fetch lap times for a specific race
export const getLapTimes = async (year: number, round: string, firstDriverOnly?: string) => {
  try {
    let url = `${BACKEND_URL}/lap-times/${year}/${round}`;
    
    if (firstDriverOnly) {
      url += `?driver_filter=${firstDriverOnly}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    const data = await handleResponse(response);
    return { 
      data: data.data || {}, 
      error: null 
    };
  } catch (error: any) {
    console.error(`Failed to fetch lap times for round ${round}:`, error);
    toast.error(`Failed to fetch lap times for ${round}`);
    return { 
      data: {}, 
      error: error.message || "Failed to fetch lap times",
      status: error.status || 500
    };
  }
};

// Fetch last race results
export const getLastRaceResults = async () => {
  try {
    const response = await fetch(`${BACKEND_URL}/last-race-results`, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    const data = await handleResponse(response);
    return { 
      data: data.data, 
      error: null 
    };
  } catch (error) {
    console.error("Failed to fetch last race results:", error);
    toast.error("Failed to fetch last race results");
    return { data: null, error };
  }
};

// Get next race data
export const getNextRace = async () => {
  try {
    const response = await fetch(`${BACKEND_URL}/next-race`, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    const data = await handleResponse(response);
    return { 
      data: data.data, 
      error: null 
    };
  } catch (error) {
    console.error("Failed to fetch next race:", error);
    toast.error("Failed to fetch next race");
    return { data: null, error };
  }
};

// Get F1 News
export const getF1News = async () => {
  try {
    // In a real implementation, this would call the backend API
    // For now, we're using mock data in the useF1News hook
    return { 
      data: [], 
      error: null 
    };
  } catch (error) {
    console.error("Failed to fetch F1 news:", error);
    toast.error("Failed to fetch F1 news");
    return { data: [], error };
  }
};
