
import { toast } from "sonner";

const BASE_URL = "https://api.openf1.org/v1";

interface ApiResponse<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
}

export const fetchWithErrorHandling = async <T>(
  endpoint: string,
  params: Record<string, string | number> = {}
): Promise<ApiResponse<T>> => {
  try {
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      queryParams.append(key, String(value));
    });
    
    const url = `${BASE_URL}${endpoint}?${queryParams.toString()}`;
    console.log("Fetching data from:", url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    return { data, error: null, isLoading: false };
  } catch (error) {
    console.error("API request failed:", error);
    toast.error("Failed to fetch F1 data. Please try again later.");
    return { data: null, error: error as Error, isLoading: false };
  }
};

export const getNextRace = async () => {
  const currentDate = new Date();
  // Ensure we're using the current year, not hardcoded to 2023
  const formattedDate = currentDate.toISOString().split('T')[0];
  console.log(`Current date for API request: ${formattedDate}`);
  
  return fetchWithErrorHandling('/sessions', {
    'session_date_gte': formattedDate
  });
};

export const getLiveTimingData = async (sessionId: number) => {
  return fetchWithErrorHandling('/laps', {
    'session_key': sessionId
  });
};

export const getDriverInfo = async (sessionId: number) => {
  return fetchWithErrorHandling('/drivers', {
    'session_key': sessionId
  });
};

export const getWeatherData = async (sessionId: number) => {
  return fetchWithErrorHandling('/weather', {
    'session_key': sessionId
  });
};

export const getRaceStatus = async (sessionId: number) => {
  return fetchWithErrorHandling('/session_status', {
    'session_key': sessionId
  });
};
