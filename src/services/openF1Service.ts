import { toast } from "sonner";

// Use different base URLs for development vs production
const BASE_URL = import.meta.env.PROD 
  ? "https://api.openf1.org/v1" 
  : "/api/openf1";

// Helper function for throttled fetching
async function throttledFetch(url: string, retryDelay = 2000, maxRetries = 3): Promise<Response> {
  let retries = 0;
  
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
        
        // Calculate exponential backoff with jitter
        const delay = retryDelay * (2 ** retries) * (0.8 + Math.random() * 0.4);
        console.log(`Rate limit hit. Retry ${retries}/${maxRetries} after ${Math.round(delay)}ms delay`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      return response;
    } catch (error) {
      if (retries < maxRetries) {
        retries++;
        
        const delay = retryDelay * (2 ** retries);
        console.log(`Network error. Retry ${retries}/${maxRetries} after ${delay}ms delay`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}

// Helper function to check response format
async function validateJsonResponse(response: Response, context: string): Promise<any> {
  // First check if the response content-type is json
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    // Get the response as text to provide better error details
    const textResponse = await response.text();
    
    // Check if it's an HTML response
    if (textResponse.trim().startsWith('<!DOCTYPE') || textResponse.trim().startsWith('<html')) {
      console.error(`Server returned HTML instead of JSON for ${context}. First 100 chars:`, textResponse.substring(0, 100));
      throw new Error(`Server returned HTML instead of JSON for ${context}`);
    }
    
    // Try to parse as JSON anyway, in case the content-type header is wrong
    try {
      return JSON.parse(textResponse);
    } catch (e) {
      console.error(`Invalid response format for ${context}. Expected JSON, got:`, textResponse.substring(0, 200));
      throw new Error(`API returned non-JSON response with content-type: ${contentType}`);
    }
  }
  
  // If content-type is json, parse it normally
  return await response.json();
}

// Get session key from meeting key and session type
export const getSession = async (meeting_key: number, session_type?: string) => {
  try {
    let url = `${BASE_URL}/sessions?meeting_key=${meeting_key}`;
    if (session_type) {
      url += `&session_type=${session_type}`;
    }
    
    const response = await throttledFetch(url);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const contextInfo = session_type 
      ? `sessions for meeting ${meeting_key} and type ${session_type}`
      : `sessions for meeting ${meeting_key}`;
    const data = await validateJsonResponse(response, contextInfo);
    return { 
      data, 
      error: null 
    };
  } catch (error) {
    console.error("Failed to fetch session:", error);
    return { data: [], error };
  }
};

// Get the latest session
export const getLatestSession = async () => {
  try {
    const response = await throttledFetch(`${BASE_URL}/sessions?session_key=latest`);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await validateJsonResponse(response, "latest session");
    return { 
      data: data[0] || {}, 
      error: null 
    };
  } catch (error) {
    console.error("Failed to fetch latest session:", error);
    return { data: {}, error };
  }
};

// Get all sessions for a year
export const getSessionsByYear = async (year: number) => {
  try {
    const response = await throttledFetch(`${BASE_URL}/sessions?date_start>=${year}-01-01&date_end<=${year}-12-31`);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await validateJsonResponse(response, `sessions for year ${year}`);
    return { 
      data, 
      error: null 
    };
  } catch (error) {
    console.error(`Failed to fetch sessions for year ${year}:`, error);
    
    // Check if it's the current year or future year
    const currentYear = new Date().getFullYear();
    if (year >= currentYear) {
      toast.error(`The ${year} season data may not be available yet in the OpenF1 API`);
    } else {
      toast.error(`Failed to fetch ${year} season data`);
    }
    
    return { data: [], error };
  }
};

// Get lap data for a session
export const getLapData = async (session_key: number, driver_number?: number) => {
  try {
    let url = `${BASE_URL}/laps?session_key=${session_key}`;
    if (driver_number) {
      url += `&driver_number=${driver_number}`;
    }
    
    const response = await throttledFetch(url);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const context = driver_number ? `lap data for driver ${driver_number}` : `lap data for session ${session_key}`;
    const data = await validateJsonResponse(response, context);
    return { 
      data, 
      error: null 
    };
  } catch (error) {
    console.error(`Failed to fetch lap data for session ${session_key}:`, error);
    return { data: [], error };
  }
};

// Get car telemetry data
export const getCarData = async (session_key: number, driver_number?: number) => {
  try {
    let url = `${BASE_URL}/car_data?session_key=${session_key}`;
    if (driver_number) {
      url += `&driver_number=${driver_number}`;
    }
    
    // Note: we explicitly avoid adding limit parameter as it causes issues with the API
    
    const response = await throttledFetch(url);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    // Use the context-aware validation function
    const context = driver_number ? `driver ${driver_number}` : `session ${session_key}`;
    const data = await validateJsonResponse(response, context);
    
    return { 
      data, 
      error: null 
    };
  } catch (error: any) {
    console.error(`Failed to fetch car data for session ${session_key}${driver_number ? `, driver ${driver_number}` : ''}:`, error);
    return { data: [], error };
  }
};

// Get weather data for a session
export const getWeatherData = async (session_key: number) => {
  try {
    const response = await throttledFetch(`${BASE_URL}/weather?session_key=${session_key}`);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await validateJsonResponse(response, `weather data for session ${session_key}`);
    return { 
      data, 
      error: null 
    };
  } catch (error) {
    console.error(`Failed to fetch weather data for session ${session_key}:`, error);
    return { data: [], error };
  }
};

// Get driver info for a session
export const getDrivers = async (session_key: number, driver_number?: number) => {
  try {
    let url = `${BASE_URL}/drivers?session_key=${session_key}`;
    if (driver_number) {
      url += `&driver_number=${driver_number}`;
    }
    
    const response = await throttledFetch(url);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const context = driver_number ? `driver info for driver ${driver_number}` : `driver info for session ${session_key}`;
    const data = await validateJsonResponse(response, context);
    return { 
      data, 
      error: null 
    };
  } catch (error) {
    console.error(`Failed to fetch driver info for session ${session_key}:`, error);
    return { data: [], error };
  }
};

// Get team radio for a session
export const getTeamRadio = async (session_key: number, driver_number?: number) => {
  try {
    let url = `${BASE_URL}/team_radio?session_key=${session_key}`;
    if (driver_number) {
      url += `&driver_number=${driver_number}`;
    }
    
    const response = await throttledFetch(url);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const context = driver_number ? `team radio for driver ${driver_number}` : `team radio for session ${session_key}`;
    const data = await validateJsonResponse(response, context);
    return { 
      data, 
      error: null 
    };
  } catch (error) {
    console.error(`Failed to fetch team radio for session ${session_key}:`, error);
    return { data: [], error };
  }
};

// Get position data for a session
export const getPositionData = async (session_key: number, driver_number?: number) => {
  try {
    let url = `${BASE_URL}/position?session_key=${session_key}`;
    if (driver_number) {
      url += `&driver_number=${driver_number}`;
    }
    
    const response = await throttledFetch(url);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const context = driver_number ? `position data for driver ${driver_number}` : `position data for session ${session_key}`;
    const data = await validateJsonResponse(response, context);
    return { 
      data, 
      error: null 
    };
  } catch (error) {
    console.error(`Failed to fetch position data for session ${session_key}:`, error);
    return { data: [], error };
  }
};

// Get overtakes data for a session
export const getOvertakes = async (session_key: number, overtaking_driver_number?: number, overtaken_driver_number?: number, position?: number) => {
  try {
    let url = `${BASE_URL}/overtakes?session_key=${session_key}`;
    if (overtaking_driver_number) {
      url += `&overtaking_driver_number=${overtaking_driver_number}`;
    }
    if (overtaken_driver_number) {
      url += `&overtaken_driver_number=${overtaken_driver_number}`;
    }
    if (position) {
      url += `&position=${position}`;
    }
    
    const response = await throttledFetch(url);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const context = `overtakes data for session ${session_key}`;
    const data = await validateJsonResponse(response, context);
    return { 
      data, 
      error: null 
    };
  } catch (error) {
    console.error(`Failed to fetch overtakes data for session ${session_key}:`, error);
    return { data: [], error };
  }
}; 