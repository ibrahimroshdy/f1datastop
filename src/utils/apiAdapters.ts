import { formatTime } from "@/utils/lapTimeUtils";

/**
 * Utility functions to convert between Ergast API and OpenF1 API data formats
 * This helps with maintaining compatibility when switching between APIs
 */

// Map OpenF1 driver object to Ergast-style driver object
export const mapOpenF1DriverToErgast = (driver: any) => {
  return {
    driverId: driver.driver_number.toString(),
    code: driver.name_acronym || driver.last_name.substring(0, 3).toUpperCase(),
    permanentNumber: driver.driver_number.toString(),
    givenName: driver.first_name,
    familyName: driver.last_name,
    dateOfBirth: "", // OpenF1 doesn't provide this
    nationality: driver.country_code,
    Constructor: {
      constructorId: driver.team_name?.toLowerCase().replace(/\s+/g, "-") || "unknown",
      name: driver.team_name || "Unknown Team",
      nationality: "" // OpenF1 doesn't provide team nationality
    }
  };
};

// Map OpenF1 lap data to Ergast-style lap data
export const mapOpenF1LapsToErgast = (laps: any[], drivers: any[]) => {
  // Group laps by lap number
  const lapsByNumber: { [key: string]: any } = {};
  
  laps.forEach(lap => {
    const lapNumber = lap.lap_number.toString();
    if (!lapsByNumber[lapNumber]) {
      lapsByNumber[lapNumber] = {
        number: lapNumber,
        Timings: []
      };
    }
    
    // Find the driver for this lap
    const driver = drivers.find(d => d.driver_number === lap.driver_number);
    
    // Add timing entry
    lapsByNumber[lapNumber].Timings.push({
      driverId: lap.driver_number.toString(),
      position: lap.position?.toString() || "",
      time: formatOpenF1LapTime(lap.lap_time),
      // Additional OpenF1 specific data we keep for enriched analysis
      sector_1_time: lap.sector_1_time,
      sector_2_time: lap.sector_2_time,
      sector_3_time: lap.sector_3_time,
      is_personal_best: lap.is_personal_best,
      driver_number: lap.driver_number,
      lap_time_milliseconds: lap.lap_time_milliseconds
    });
  });
  
  // Convert to array and sort by lap number
  return Object.values(lapsByNumber).sort((a, b) => parseInt(a.number) - parseInt(b.number));
};

// Helper to format OpenF1 lap time to match Ergast format
export const formatOpenF1LapTime = (lapTimeMilliseconds: number): string => {
  if (!lapTimeMilliseconds) return "";
  
  const totalSeconds = lapTimeMilliseconds / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  return minutes > 0 
    ? `${minutes}:${seconds.toFixed(3).padStart(6, '0')}` 
    : seconds.toFixed(3);
};

// Map OpenF1 session to Ergast race format
export const mapOpenF1SessionToErgastRace = (session: any, circuitInfo?: any) => {
  // Extract date and time
  const sessionDate = new Date(session.date_start);
  const year = sessionDate.getFullYear();
  const month = String(sessionDate.getMonth() + 1).padStart(2, '0');
  const day = String(sessionDate.getDate()).padStart(2, '0');
  const hours = String(sessionDate.getHours()).padStart(2, '0');
  const minutes = String(sessionDate.getMinutes()).padStart(2, '0');
  const seconds = String(sessionDate.getSeconds()).padStart(2, '0');
  
  return {
    season: year.toString(),
    round: session.meeting_key.toString(),
    raceName: session.meeting_name || session.session_name || "Unknown Race",
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}:${seconds}Z`,
    Circuit: {
      circuitId: circuitInfo?.circuitId || session.location?.toLowerCase().replace(/\s+/g, "-") || "unknown",
      circuitName: session.location || "Unknown Circuit",
      Location: {
        locality: session.location || "",
        country: session.country_name || ""
      }
    },
    // Additional OpenF1 specific data
    meeting_key: session.meeting_key,
    session_key: session.session_key,
    session_type: session.session_type,
    session_name: session.session_name
  };
};

// Map OpenF1 car data to a format useful for telemetry charts
export const processOpenF1CarData = (carData: any[]) => {
  // Performance optimization for large datasets
  if (!carData || carData.length === 0) {
    return [];
  }
  
  try {
    // Additional validation - make sure we're working with valid data
    const validData = carData.filter(item => 
      item && 
      typeof item.date === 'string' &&
      !isNaN(new Date(item.date).getTime())
    );
    
    if (validData.length === 0) {
      console.error('No valid data points found in car data');
      return [];
    }
    
    // Skip sorting if already sorted (which is usually the case)
    // Check first few entries to see if they're already in order
    const checkSize = Math.min(10, validData.length - 1);
    let isSorted = true;
    
    for (let i = 0; i < checkSize; i++) {
      if (new Date(validData[i].date).getTime() > new Date(validData[i+1].date).getTime()) {
        isSorted = false;
        break;
      }
    }
    
    // Only sort if needed
    const dataToProcess = isSorted ? validData : [...validData].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    // Pre-allocate array for better performance
    const result = new Array(dataToProcess.length);
    
    // Use a more direct mapping approach for better performance
    for (let i = 0; i < dataToProcess.length; i++) {
      const data = dataToProcess[i];
      
      // Force data into proper types to prevent rendering issues
      result[i] = {
        time: new Date(data.date).getTime(),
        speed: typeof data.speed === 'number' ? data.speed : 0,
        rpm: typeof data.rpm === 'number' ? data.rpm : 0,
        throttle: typeof data.throttle === 'number' ? data.throttle : 0,
        brake: typeof data.brake === 'number' ? data.brake : 0,
        gear: typeof data.n_gear === 'number' ? data.n_gear : 0,
        drs: typeof data.drs === 'number' ? data.drs : 0,
        driver_number: data.driver_number
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error processing car data:', error);
    return [];
  }
};

// Map OpenF1 weather data to a unified format
export const processOpenF1WeatherData = (weatherData: any[]) => {
  // Sort by date to ensure chronological order
  const sortedData = [...weatherData].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  return sortedData.map(data => ({
    time: new Date(data.date).getTime(),
    air_temperature: data.air_temperature,
    track_temperature: data.track_temperature,
    humidity: data.humidity,
    pressure: data.pressure,
    wind_speed: data.wind_speed,
    wind_direction: data.wind_direction,
    rainfall: data.rainfall
  }));
};

// Helper function to find relevant session from OpenF1 data using Ergast year/round
export const findMatchingOpenF1Session = (sessions: any[], ergastYear: number, ergastRound: string, sessionType?: string) => {
  // First check if we have any sessions at all
  if (!sessions || sessions.length === 0) {
    console.warn(`No OpenF1 sessions available for year ${ergastYear}`);
    return null;
  }
  
  // Filter sessions for the given year
  const yearSessions = sessions.filter(session => {
    const sessionDate = new Date(session.date_start);
    return sessionDate.getFullYear() === ergastYear;
  });
  
  if (yearSessions.length === 0) {
    console.warn(`No OpenF1 sessions found for year ${ergastYear}`);
    
    // For current or future years, use the most recent session as fallback only if specifically requested
    const currentYear = new Date().getFullYear();
    if (ergastYear >= currentYear) {
      console.warn(`Requested year ${ergastYear} is current or future year, data may be limited`);
      
      // Only provide fallback data when the year matches but no sessions are found
      // This prevents future years from always getting the most recent session when a specific round is selected
      const latestSession = [...sessions].sort((a, b) => 
        new Date(b.date_start).getTime() - new Date(a.date_start).getTime()
      )[0];
      
      if (latestSession) {
        console.info(`Using latest available session from OpenF1 as fallback: session_key=${latestSession.session_key}`);
        return latestSession;
      }
    }
    
    return null;
  }
  
  // CHECK IF ROUND IS A MEETING_KEY (direct OpenF1 selection)
  // This happens when the user selects a race directly from the dropdown that's populated from OpenF1 API
  const meetingKey = parseInt(ergastRound);
  if (!isNaN(meetingKey) && meetingKey > 1000) { // OpenF1 meeting_keys are typically 4-digit numbers > 1000
    console.info(`Using direct meeting_key selection: ${meetingKey}`);
    
    // Get all sessions for this meeting
    const meetingSessions = yearSessions.filter(session => session.meeting_key === meetingKey);
    
    if (meetingSessions.length > 0) {
      let matchingSession;
      
      // If session type specified, filter by it
      if (sessionType) {
        matchingSession = meetingSessions.find(s => s.session_type === sessionType);
      }
      
      // Otherwise get the race session if available, or the last session of the weekend
      if (!matchingSession) {
        matchingSession = meetingSessions.find(s => s.session_type === "Race") || 
                          meetingSessions[meetingSessions.length - 1];
      }
      
      if (matchingSession) {
        console.info(`Found session with session_key=${matchingSession.session_key} for meeting_key=${meetingKey}`);
        return matchingSession;
      }
    }
  }
  
  // Special cases like "last" or "next"
  if (ergastRound === "last") {
    // Get the most recent completed session
    const now = new Date();
    const completedSessions = yearSessions.filter(s => new Date(s.date_end) < now);
    
    if (completedSessions.length > 0) {
      // Group by meeting_key
      const meetingGroups: { [key: string]: any[] } = {};
      completedSessions.forEach(session => {
        const key = session.meeting_key.toString();
        if (!meetingGroups[key]) {
          meetingGroups[key] = [];
        }
        meetingGroups[key].push(session);
      });
      
      // Sort meetings by date (latest first)
      const sortedMeetings = Object.values(meetingGroups)
        .map(sessions => sessions[0])
        .sort((a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime());
      
      if (sortedMeetings.length > 0) {
        const latestMeeting = sortedMeetings[0];
        const meetingSessions = meetingGroups[latestMeeting.meeting_key.toString()];
        
        // Get race session if available or the last session of the weekend
        const matchingSession = meetingSessions.find(s => s.session_type === sessionType) ||
                               meetingSessions.find(s => s.session_type === "Race") || 
                               meetingSessions[meetingSessions.length - 1];
                               
        if (matchingSession) {
          console.info(`Found 'last' session with session_key=${matchingSession.session_key}`);
          return matchingSession;
        }
      }
    }
  } else if (ergastRound === "next") {
    // Get the next upcoming session
    const now = new Date();
    const upcomingSessions = yearSessions.filter(s => new Date(s.date_start) > now);
    
    if (upcomingSessions.length > 0) {
      // Group by meeting_key
      const meetingGroups: { [key: string]: any[] } = {};
      upcomingSessions.forEach(session => {
        const key = session.meeting_key.toString();
        if (!meetingGroups[key]) {
          meetingGroups[key] = [];
        }
        meetingGroups[key].push(session);
      });
      
      // Sort meetings by date (earliest first)
      const sortedMeetings = Object.values(meetingGroups)
        .map(sessions => sessions[0])
        .sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime());
      
      if (sortedMeetings.length > 0) {
        const nextMeeting = sortedMeetings[0];
        const meetingSessions = meetingGroups[nextMeeting.meeting_key.toString()];
        
        // Get race session if available or the first session of the weekend
        const matchingSession = meetingSessions.find(s => s.session_type === sessionType) ||
                               meetingSessions.find(s => s.session_type === "Race") || 
                               meetingSessions[0];
                               
        if (matchingSession) {
          console.info(`Found 'next' session with session_key=${matchingSession.session_key}`);
          return matchingSession;
        }
      }
    }
  }
  
  // If we still don't have a match, try legacy Ergast round number matching
  const roundNumber = parseInt(ergastRound);
  if (!isNaN(roundNumber) && roundNumber > 0) {
    // First try: find session with matching meeting_number
    let matchingSession = yearSessions.find(session => 
      session.meeting_number === roundNumber &&
      (!sessionType || session.session_type === sessionType)
    );
    
    // Second try: take the nth unique meeting of the year
    if (!matchingSession) {
      // Group by meeting_key to find unique race weekends
      const meetingGroups: { [key: string]: any[] } = {};
      yearSessions.forEach(session => {
        const key = session.meeting_key.toString();
        if (!meetingGroups[key]) {
          meetingGroups[key] = [];
        }
        meetingGroups[key].push(session);
      });
      
      // Sort meetings by date
      const sortedMeetings = Object.values(meetingGroups)
        .map(sessions => sessions[0])
        .sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime());
      
      // Get the nth meeting
      if (roundNumber <= sortedMeetings.length) {
        const targetMeeting = sortedMeetings[roundNumber - 1];
        if (targetMeeting) {
          // Get all sessions for this meeting
          const meetingSessions = meetingGroups[targetMeeting.meeting_key.toString()];
          
          // If session type specified, filter by it
          if (sessionType) {
            matchingSession = meetingSessions.find(s => s.session_type === sessionType);
          }
          
          // Otherwise get the race session if available, or the last session of the weekend
          if (!matchingSession) {
            matchingSession = meetingSessions.find(s => s.session_type === "Race") || 
                              meetingSessions[meetingSessions.length - 1];
          }
        }
      }
    }
    
    if (matchingSession) {
      console.info(`Mapped legacy round=${ergastRound} to OpenF1 session_key=${matchingSession.session_key}`);
      return matchingSession;
    }
  }
  
  // Last resort: just use the most recent session of the year
  console.warn(`Could not find exact match for year=${ergastYear}, round=${ergastRound}, using fallback logic`);
  
  const recentSessions = [...yearSessions].sort((a, b) => 
    new Date(b.date_start).getTime() - new Date(a.date_start).getTime()
  );
  
  if (sessionType) {
    const typedSession = recentSessions.find(s => s.session_type === sessionType);
    if (typedSession) {
      console.info(`Using fallback session with session_key=${typedSession.session_key}`);
      return typedSession;
    }
  }
  
  if (recentSessions.length > 0) {
    console.info(`Using fallback session with session_key=${recentSessions[0].session_key}`);
    return recentSessions[0];
  }
  
  console.warn(`Could not map year=${ergastYear}, round=${ergastRound} to any OpenF1 session`);
  return null;
}; 