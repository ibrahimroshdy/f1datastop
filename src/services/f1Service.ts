
// Get the current year for default queries
const getCurrentYear = () => new Date().getFullYear();

// Mock data as fallback when API fails
const MOCK_DATA = {
  DRIVER_STANDINGS: [
    { position: "1", Driver: { givenName: "Max", familyName: "Verstappen" }, points: "400", Constructors: [{ name: "Red Bull" }] },
    { position: "2", Driver: { givenName: "Lewis", familyName: "Hamilton" }, points: "300", Constructors: [{ name: "Mercedes" }] },
    { position: "3", Driver: { givenName: "Charles", familyName: "Leclerc" }, points: "250", Constructors: [{ name: "Ferrari" }] }
  ],
  CONSTRUCTOR_STANDINGS: [
    { position: "1", Constructor: { name: "Red Bull" }, points: "500" },
    { position: "2", Constructor: { name: "Mercedes" }, points: "400" },
    { position: "3", Constructor: { name: "Ferrari" }, points: "350" }
  ],
  RACE_SCHEDULE: [
    { round: "1", raceName: "Bahrain Grand Prix", Circuit: { circuitName: "Bahrain International Circuit" }, date: "2023-03-05", time: "15:00:00Z" },
    { round: "2", raceName: "Saudi Arabian Grand Prix", Circuit: { circuitName: "Jeddah Corniche Circuit" }, date: "2023-03-19", time: "17:00:00Z" }
  ],
  LAST_RACE_RESULTS: {
    raceName: "Last Race Grand Prix",
    Circuit: { circuitName: "Sample Circuit" },
    date: "2023-08-01",
    time: "14:00:00Z",
    results: [
      { position: "1", Driver: { givenName: "Max", familyName: "Verstappen" }, Constructor: { name: "Red Bull" }, Time: { time: "1:30:05.123" } },
      { position: "2", Driver: { givenName: "Lewis", familyName: "Hamilton" }, Constructor: { name: "Mercedes" }, Time: { time: "1:30:10.456" } }
    ]
  },
  NEXT_RACE: {
    round: "10",
    raceName: "Next Race Grand Prix",
    Circuit: { circuitName: "Upcoming Circuit", Location: { locality: "City", country: "Country" } },
    date: "2023-12-31",
    time: "14:00:00Z",
    FirstPractice: { date: "2023-12-29", time: "10:00:00Z" },
    SecondPractice: { date: "2023-12-29", time: "14:00:00Z" },
    ThirdPractice: { date: "2023-12-30", time: "10:00:00Z" },
    Qualifying: { date: "2023-12-30", time: "14:00:00Z" }
  },
  RACE_STATUS: [
    { session_status: "Ongoing", lap_number: "45", total_laps: "70" }
  ],
  DRIVER_INFO: [
    { driver_number: "1", driver_id: "VER", name: "Max Verstappen", team: "Red Bull Racing" },
    { driver_number: "44", driver_id: "HAM", name: "Lewis Hamilton", team: "Mercedes" }
  ],
  WEATHER_DATA: [
    { air_temperature: 28.5, track_temperature: 45.2, humidity: 65, wind_speed: 10, conditions: "Clear" }
  ],
  F1_NEWS: [
    {
      title: "Hamilton signs new contract",
      description: "Lewis Hamilton has signed a new two-year contract with Mercedes.",
      url: "https://example.com/news/1",
      urlToImage: "https://example.com/images/hamilton.jpg",
      publishedAt: "2023-09-01T12:00:00Z",
      source: { id: "official-f1", name: "Formula1.com" }
    },
    {
      title: "Verstappen wins again",
      description: "Max Verstappen secured another dominant win at the latest Grand Prix.",
      url: "https://example.com/news/2",
      urlToImage: "https://example.com/images/verstappen.jpg",
      publishedAt: "2023-09-02T14:30:00Z",
      source: { id: "sky-sports", name: "Sky Sports F1" }
    }
  ]
};

// Example update for one of the functions that needs a year parameter
export const getDriverStandings = async () => {
  try {
    const year = getCurrentYear();
    const response = await fetch(`https://ergast.com/api/f1/${year}/driverStandings.json`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch driver standings: ${response.status}`);
    }
    
    const data = await response.json();
    return { 
      data: data.MRData.StandingsTable.StandingsLists[0]?.DriverStandings || [], 
      error: null 
    };
  } catch (error) {
    console.error("Error fetching driver standings:", error);
    return { 
      data: MOCK_DATA.DRIVER_STANDINGS, 
      error: "Failed to fetch driver standings" 
    };
  }
};

// Update the constructor standings to use current year
export const getConstructorStandings = async () => {
  try {
    const year = getCurrentYear();
    const response = await fetch(`https://ergast.com/api/f1/${year}/constructorStandings.json`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch constructor standings: ${response.status}`);
    }
    
    const data = await response.json();
    return { 
      data: data.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings || [], 
      error: null 
    };
  } catch (error) {
    console.error("Error fetching constructor standings:", error);
    return { 
      data: MOCK_DATA.CONSTRUCTOR_STANDINGS, 
      error: "Failed to fetch constructor standings" 
    };
  }
};

// Update the race schedule to use current year
export const getRaceSchedule = async () => {
  try {
    const year = getCurrentYear();
    const response = await fetch(`https://ergast.com/api/f1/${year}/races.json`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch race schedule: ${response.status}`);
    }
    
    const data = await response.json();
    return { 
      data: data.MRData.RaceTable.Races, 
      error: null 
    };
  } catch (error) {
    console.error("Error fetching race schedule:", error);
    return { 
      data: MOCK_DATA.RACE_SCHEDULE, 
      error: "Failed to fetch race schedule" 
    };
  }
};

// Update the last race results to use current year
export const getLastRaceResults = async () => {
  try {
    const year = getCurrentYear();
    const response = await fetch(`https://ergast.com/api/f1/${year}/last/results.json`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch last race results: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.MRData.RaceTable.Races.length) {
      throw new Error("No races found for the current season yet");
    }
    
    const lastRace = data.MRData.RaceTable.Races[0];
    return { 
      data: {
        ...lastRace,
        results: lastRace.Results
      }, 
      error: null 
    };
  } catch (error) {
    console.error("Error fetching last race results:", error);
    return { 
      data: MOCK_DATA.LAST_RACE_RESULTS, 
      error: "Failed to fetch last race results" 
    };
  }
};

// Update the next race function
export const getNextRace = async () => {
  try {
    const { data: races, error } = await getRaceSchedule();
    
    if (error || !races) {
      throw new Error("Failed to fetch race schedule");
    }
    
    const today = new Date();
    const nextRace = races.find(race => {
      try {
        const raceDate = new Date(race.date + "T" + (race.time || "00:00:00Z"));
        return raceDate > today;
      } catch (e) {
        return false;
      }
    });
    
    if (!nextRace) {
      throw new Error("No upcoming races found");
    }
    
    return { data: nextRace, error: null };
  } catch (error) {
    console.error("Error finding next race:", error);
    return { 
      data: MOCK_DATA.NEXT_RACE, 
      error: "Failed to fetch next race" 
    };
  }
};

// Add the missing functions that are referenced in useF1Data.ts
export const getRaceStatus = async (sessionId?: string) => {
  try {
    // In a real implementation, this would use the sessionId to fetch data
    // For now, we'll just return mock data
    return { data: MOCK_DATA.RACE_STATUS, error: null };
  } catch (error) {
    console.error("Error fetching race status:", error);
    return { data: MOCK_DATA.RACE_STATUS, error: "Failed to fetch race status" };
  }
};

export const getDriverInfo = async (sessionId?: string) => {
  try {
    // In a real implementation, this would use the sessionId to fetch data
    return { data: MOCK_DATA.DRIVER_INFO, error: null };
  } catch (error) {
    console.error("Error fetching driver info:", error);
    return { data: MOCK_DATA.DRIVER_INFO, error: "Failed to fetch driver info" };
  }
};

export const getWeatherData = async (sessionId?: string) => {
  try {
    // In a real implementation, this would use the sessionId to fetch data
    return { data: MOCK_DATA.WEATHER_DATA, error: null };
  } catch (error) {
    console.error("Error fetching weather data:", error);
    return { data: MOCK_DATA.WEATHER_DATA, error: "Failed to fetch weather data" };
  }
};

export const getF1News = async () => {
  try {
    // Here we would use a real news API, but for now we return mock data
    // News API call would go here in a real implementation
    return { data: MOCK_DATA.F1_NEWS, error: null };
  } catch (error) {
    console.error("Error fetching F1 news:", error);
    return { data: MOCK_DATA.F1_NEWS, error: "Failed to fetch F1 news" };
  }
};
