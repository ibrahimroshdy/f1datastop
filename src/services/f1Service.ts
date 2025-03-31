export const FALLBACK_DRIVER_STANDINGS = [
  { position: 1, points: 0, wins: 0, Driver: { givenName: "N/A", familyName: "N/A" }, Constructors: [{ name: "N/A" }] },
];

export const FALLBACK_CONSTRUCTOR_STANDINGS = [
  { position: 1, points: 0, wins: 0, Constructor: { name: "N/A" } },
];

export const FALLBACK_RACE_SCHEDULE = [
  { season: "N/A", round: 1, raceName: "N/A", date: "N/A", time: "N/A", Circuit: { circuitName: "N/A", Location: { country: "N/A" } } },
];

export const FALLBACK_LAST_RACE = {
  season: "N/A",
  round: 1,
  raceName: "N/A",
  Results: [
    {
      position: 1,
      Driver: {
        givenName: "N/A",
        familyName: "N/A",
        code: "N/A",
      },
      Constructor: {
        name: "N/A",
      },
      Time: {
        time: "N/A",
      },
      status: "N/A",
    },
  ],
};

export const getDriverStandings = async (year = new Date().getFullYear().toString()) => {
  try {
    const response = await fetch(`https://api.jolpi.ca/ergast/${year}/driverStandings`);
    const data = await response.json();
    return { data: data.MRData.StandingsTable.StandingsLists[0].DriverStandings };
  } catch (error) {
    console.error("Error fetching driver standings:", error);
    // Fallback data
    return { error: true, data: FALLBACK_DRIVER_STANDINGS };
  }
};

export const getConstructorStandings = async (year = new Date().getFullYear().toString()) => {
  try {
    const response = await fetch(`https://api.jolpi.ca/ergast/${year}/constructorStandings`);
    const data = await response.json();
    return { data: data.MRData.StandingsTable.StandingsLists[0].ConstructorStandings };
  } catch (error) {
    console.error("Error fetching constructor standings:", error);
    // Fallback data
    return { error: true, data: FALLBACK_CONSTRUCTOR_STANDINGS };
  }
};

export const getRaceSchedule = async (year = new Date().getFullYear().toString()) => {
  try {
    const response = await fetch(`https://api.jolpi.ca/ergast/${year}/races`);
    const data = await response.json();
    return { data: data.MRData.RaceTable.Races };
  } catch (error) {
    console.error("Error fetching race schedule:", error);
    // Fallback data
    return { error: true, data: FALLBACK_RACE_SCHEDULE };
  }
};

export const getLastRaceResults = async (year = new Date().getFullYear().toString()) => {
  try {
    const response = await fetch(`https://api.jolpi.ca/ergast/${year}/last/results`);
    const data = await response.json();
    const lastRace = data.MRData.RaceTable.Races[0];
    return { data: lastRace };
  } catch (error) {
    console.error("Error fetching last race results:", error);
    // Fallback data
    return { error: true, data: FALLBACK_LAST_RACE };
  }
};

const API_BASE_URL = "https://api.openf1.org/v1";

export const getNextRace = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/next_race`);
    const data = await response.json();
    return { data };
  } catch (error) {
    console.error("Error fetching next race:", error);
    return { error: true, data: [] };
  }
};

export const getRaceStatus = async (sessionId?: string) => {
  if (!sessionId) {
    console.warn("No session ID provided for race status.");
    return { data: [] };
  }
  try {
    const response = await fetch(`${API_BASE_URL}/session-status?session_id=${sessionId}`);
    const data = await response.json();
    return { data };
  } catch (error) {
    console.error("Error fetching race status:", error);
    return { error: true, data: [] };
  }
};

export const getDriverInfo = async (sessionId?: string) => {
  if (!sessionId) {
    console.warn("No session ID provided for driver info.");
    return { data: [] };
  }
  try {
    const response = await fetch(`${API_BASE_URL}/drivers?session_id=${sessionId}`);
    const data = await response.json();

    // Augment driver data with full name and gap to leader
    const enhancedData = data.map((driver: any) => {
      const fullName = `${driver.first_name} ${driver.last_name}`;
      return {
        ...driver,
        full_name: fullName,
      };
    });

    return { data: enhancedData };
  } catch (error) {
    console.error("Error fetching driver info:", error);
    return { error: true, data: [] };
  }
};

export const getWeatherData = async (sessionId?: string) => {
  if (!sessionId) {
    console.warn("No session ID provided for weather data.");
    return { data: [] };
  }
  try {
    const response = await fetch(`${API_BASE_URL}/weather?session_id=${sessionId}`);
    const data = await response.json();
    return { data };
  } catch (error) {
    console.error("Error fetching weather data:", error);
    return { error: true, data: [] };
  }
};

export const getF1News = async () => {
  try {
    // Replace with a call to a real news API if available
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { data: [{ title: "Sample News", link: "#" }] };
  } catch (error) {
    console.error("Error fetching F1 news:", error);
    return { error: true, data: [] };
  }
};

// New function to get current ongoing race
export const getCurrentRace = async () => {
  try {
    // In a real app, this would connect to a live data source
    // Here we're simulating the current race by checking the upcoming races
    const currentYear = new Date().getFullYear().toString();
    const response = await fetch(`https://api.jolpi.ca/ergast/${currentYear}/races`);
    const data = await response.json();
    const races = data.MRData.RaceTable.Races;
    
    // Find the next race
    const now = new Date();
    const nextRace = races.find((race: any) => {
      const raceDate = new Date(race.date + "T" + (race.time || "00:00:00Z"));
      return raceDate > now;
    });
    
    // For demonstration purposes, we'll pretend the next race is ongoing
    // In a real app, you would check a live status API
    if (nextRace) {
      const raceInfo = {
        session_id: `${currentYear}_${nextRace.round}_race`,
        meeting_name: nextRace.raceName.replace(" Grand Prix", ""),
        session_name: "Race",
        session_type: "Race",
        session_status: "Ongoing", // Simulating live race
        lap_number: Math.floor(Math.random() * 50) + 1, // Random lap between 1-50
        total_laps: nextRace.Circuit.circuitName.includes("Monaco") ? 78 : 60, // Monaco has 78 laps, others 60 (simplified)
        location: nextRace.Circuit.Location.locality
      };
      
      return { data: [raceInfo] };
    }
    
    // If no next race found, return the last race as completed
    return { data: [] };
  } catch (error) {
    console.error("Error fetching current race:", error);
    return { error: true, data: [] };
  }
};
