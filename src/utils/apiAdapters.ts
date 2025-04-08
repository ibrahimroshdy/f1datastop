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
  // Sort by date to ensure chronological order
  const sortedData = [...carData].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  return sortedData.map(data => ({
    time: new Date(data.date).getTime(),
    speed: data.speed,
    rpm: data.rpm,
    throttle: data.throttle,
    brake: data.brake,
    gear: data.n_gear,
    drs: data.drs,
    driver_number: data.driver_number
  }));
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
  // Filter sessions for the given year
  const yearSessions = sessions.filter(session => {
    const sessionDate = new Date(session.date_start);
    return sessionDate.getFullYear() === ergastYear;
  });
  
  // Try to match by round number if possible
  // This is approximate since Ergast and OpenF1 use different keys
  const roundNumber = parseInt(ergastRound);
  
  // First try: find session with matching meeting_number 
  let matchingSession = yearSessions.find(session => 
    session.meeting_number === roundNumber &&
    (!sessionType || session.session_type === sessionType)
  );
  
  // Second try: just take the nth session of the year
  if (!matchingSession && roundNumber > 0 && roundNumber <= yearSessions.length) {
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
      .map(sessions => sessions[0]) // Take first session of each meeting
      .sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime());
    
    // Get the nth meeting
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
  
  return matchingSession;
}; 