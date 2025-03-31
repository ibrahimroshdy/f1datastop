
import { toast } from "sonner";

const BASE_URL = "https://jolpica-f1-node-c7d9d12a46ee.herokuapp.com/api";

// Mock data for when API is unavailable
const mockDriverStandings = [
  { position: "1", Driver: { givenName: "Max", familyName: "Verstappen", code: "VER" }, Constructors: [{ name: "Red Bull Racing", constructorId: "red_bull" }], points: "150" },
  { position: "2", Driver: { givenName: "Sergio", familyName: "Perez", code: "PER" }, Constructors: [{ name: "Red Bull Racing", constructorId: "red_bull" }], points: "102" },
  { position: "3", Driver: { givenName: "Charles", familyName: "Leclerc", code: "LEC" }, Constructors: [{ name: "Ferrari", constructorId: "ferrari" }], points: "98" },
  { position: "4", Driver: { givenName: "Lando", familyName: "Norris", code: "NOR" }, Constructors: [{ name: "McLaren", constructorId: "mclaren" }], points: "87" },
  { position: "5", Driver: { givenName: "Carlos", familyName: "Sainz", code: "SAI" }, Constructors: [{ name: "Ferrari", constructorId: "ferrari" }], points: "86" },
  { position: "6", Driver: { givenName: "Lewis", familyName: "Hamilton", code: "HAM" }, Constructors: [{ name: "Mercedes", constructorId: "mercedes" }], points: "63" },
  { position: "7", Driver: { givenName: "Fernando", familyName: "Alonso", code: "ALO" }, Constructors: [{ name: "Aston Martin", constructorId: "aston_martin" }], points: "55" },
  { position: "8", Driver: { givenName: "George", familyName: "Russell", code: "RUS" }, Constructors: [{ name: "Mercedes", constructorId: "mercedes" }], points: "42" },
  { position: "9", Driver: { givenName: "Oscar", familyName: "Piastri", code: "PIA" }, Constructors: [{ name: "McLaren", constructorId: "mclaren" }], points: "40" },
  { position: "10", Driver: { givenName: "Lance", familyName: "Stroll", code: "STR" }, Constructors: [{ name: "Aston Martin", constructorId: "aston_martin" }], points: "17" }
];

const mockConstructorStandings = [
  { position: "1", Constructor: { name: "Red Bull Racing", constructorId: "red_bull" }, points: "252" },
  { position: "2", Constructor: { name: "Ferrari", constructorId: "ferrari" }, points: "184" },
  { position: "3", Constructor: { name: "McLaren", constructorId: "mclaren" }, points: "127" },
  { position: "4", Constructor: { name: "Mercedes", constructorId: "mercedes" }, points: "105" },
  { position: "5", Constructor: { name: "Aston Martin", constructorId: "aston_martin" }, points: "72" },
  { position: "6", Constructor: { name: "Racing Bulls", constructorId: "alphatauri" }, points: "16" },
  { position: "7", Constructor: { name: "Haas F1 Team", constructorId: "haas" }, points: "5" },
  { position: "8", Constructor: { name: "Alpine", constructorId: "alpine" }, points: "3" },
  { position: "9", Constructor: { name: "Williams", constructorId: "williams" }, points: "0" },
  { position: "10", Constructor: { name: "Kick Sauber", constructorId: "alfa" }, points: "0" }
];

const mockRaceSchedule = [
  {
    round: "1",
    raceName: "Bahrain Grand Prix",
    Circuit: {
      circuitName: "Bahrain International Circuit",
      Location: { country: "Bahrain" }
    },
    date: "2024-03-02",
    time: "15:00:00Z",
    laps: 57
  },
  {
    round: "2",
    raceName: "Saudi Arabian Grand Prix",
    Circuit: {
      circuitName: "Jeddah Corniche Circuit",
      Location: { country: "Saudi Arabia" }
    },
    date: "2024-03-09",
    time: "17:00:00Z",
    laps: 50
  },
  {
    round: "3",
    raceName: "Australian Grand Prix",
    Circuit: {
      circuitName: "Albert Park Circuit",
      Location: { country: "Australia" }
    },
    date: "2024-03-24",
    time: "05:00:00Z",
    laps: 58
  },
  {
    round: "4",
    raceName: "Japanese Grand Prix",
    Circuit: {
      circuitName: "Suzuka Circuit",
      Location: { country: "Japan" }
    },
    date: "2024-04-07",
    time: "06:00:00Z",
    laps: 53
  },
  {
    round: "5",
    raceName: "Chinese Grand Prix",
    Circuit: {
      circuitName: "Shanghai International Circuit",
      Location: { country: "China" }
    },
    date: "2024-04-21",
    time: "07:00:00Z",
    laps: 56
  },
  {
    round: "6",
    raceName: "Miami Grand Prix",
    Circuit: {
      circuitName: "Miami International Autodrome",
      Location: { country: "USA" }
    },
    date: "2024-05-05",
    time: "20:00:00Z",
    laps: 57
  }
];

const mockLastRaceResults = [
  { position: "1", Driver: { givenName: "Max", familyName: "Verstappen", code: "VER" }, Constructor: { constructorId: "red_bull" }, Time: { time: "1:29:25.110" }, status: "Finished", points: "25" },
  { position: "2", Driver: { givenName: "Lando", familyName: "Norris", code: "NOR" }, Constructor: { constructorId: "mclaren" }, Time: { time: "+20.023s" }, status: "Finished", points: "18" },
  { position: "3", Driver: { givenName: "Charles", familyName: "Leclerc", code: "LEC" }, Constructor: { constructorId: "ferrari" }, Time: { time: "+21.032s" }, status: "Finished", points: "15" },
  { position: "4", Driver: { givenName: "Carlos", familyName: "Sainz", code: "SAI" }, Constructor: { constructorId: "ferrari" }, Time: { time: "+24.918s" }, status: "Finished", points: "12" },
  { position: "5", Driver: { givenName: "Lewis", familyName: "Hamilton", code: "HAM" }, Constructor: { constructorId: "mercedes" }, Time: { time: "+44.120s" }, status: "Finished", points: "10" }
];

// Fetch driver standings
export const getDriverStandings = async () => {
  try {
    const response = await fetch(`${BASE_URL}/driver-standings/2024`, {
      mode: 'cors',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    return { data: data.data || [], error: null };
  } catch (error) {
    console.error("Failed to fetch driver standings:", error);
    toast.error("Using offline data for driver standings.");
    return { data: mockDriverStandings, error };
  }
};

// Fetch constructor standings
export const getConstructorStandings = async () => {
  try {
    const response = await fetch(`${BASE_URL}/team-standings/2024`, {
      mode: 'cors',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    return { data: data.data || [], error: null };
  } catch (error) {
    console.error("Failed to fetch constructor standings:", error);
    toast.error("Using offline data for constructor standings.");
    return { data: mockConstructorStandings, error };
  }
};

// Fetch race schedule
export const getRaceSchedule = async () => {
  try {
    const response = await fetch(`${BASE_URL}/race-schedule/2024`, {
      mode: 'cors',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    return { data: data.data || [], error: null };
  } catch (error) {
    console.error("Failed to fetch race schedule:", error);
    toast.error("Using offline data for race schedule.");
    return { data: mockRaceSchedule, error };
  }
};

// Fetch last race results
export const getLastRaceResults = async () => {
  try {
    const scheduleResponse = await fetch(`${BASE_URL}/race-schedule/2024`, {
      mode: 'cors',
      headers: {
        'Accept': 'application/json'
      }
    });
    
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
          raceName: "Chinese Grand Prix", 
          results: mockLastRaceResults 
        }, 
        error: null 
      };
    }
    
    const lastRace = completedRaces[completedRaces.length - 1];
    
    // Get results for the last race
    const resultsResponse = await fetch(`${BASE_URL}/race-results/${lastRace.year}/${lastRace.round}`, {
      mode: 'cors',
      headers: {
        'Accept': 'application/json'
      }
    });
    
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
    toast.error("Using offline data for race results.");
    return { 
      data: { 
        raceName: "Chinese Grand Prix", 
        results: mockLastRaceResults 
      }, 
      error 
    };
  }
};

// Get next race data
export const getNextRace = async () => {
  try {
    const response = await fetch(`${BASE_URL}/race-schedule/2024`, {
      mode: 'cors',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    const races = data.data || [];
    
    // Find the next upcoming race
    const now = new Date();
    const upcomingRaces = races.filter(race => new Date(race.date) > now);
    
    if (upcomingRaces.length === 0) {
      // Fallback to mock data if no upcoming races
      const mockNext = {
        data: [{
          meeting_name: "Miami Grand Prix",
          location: "Miami, USA",
          session_status: "Upcoming",
          session_name: "Miami Grand Prix",
          session_type: "Race",
          total_laps: "57",
        }],
        error: null
      };
      return mockNext;
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
    toast.error("Using offline data for next race.");
    
    const mockNext = {
      data: [{
        meeting_name: "Miami Grand Prix",
        location: "Miami, USA",
        session_status: "Upcoming",
        session_name: "Miami Grand Prix",
        session_type: "Race",
        total_laps: "57",
      }],
      error: null
    };
    return mockNext;
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
    const response = await fetch(`${BASE_URL}/driver-standings/2024`, {
      mode: 'cors',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    const drivers = data.data || [];
    
    // Transform data to match component expectations
    const mockData = drivers.slice(0, 10).map((driver: any, index: number) => ({
      driver_number: driver.permanentNumber || driver.driverNumber || `${index + 1}`,
      full_name: driver.name || `${driver.Driver.givenName} ${driver.Driver.familyName}`,
      team_name: driver.team?.name || driver.Constructors[0].name || "Unknown Team",
      position: index + 1,
      gap_to_leader: index === 0 ? "0.0" : (Math.random() * 30).toFixed(1),
    }));
    
    return { data: mockData, error: null };
  } catch (error) {
    console.error("Failed to fetch driver info:", error);
    toast.error("Using offline data for driver information.");
    
    // Fallback to mock data
    const mockData = [
      { driver_number: "1", full_name: "Max Verstappen", team_name: "Red Bull Racing", position: 1, gap_to_leader: "0.0" },
      { driver_number: "11", full_name: "Sergio Perez", team_name: "Red Bull Racing", position: 2, gap_to_leader: "5.6" },
      { driver_number: "16", full_name: "Charles Leclerc", team_name: "Ferrari", position: 3, gap_to_leader: "8.2" },
      { driver_number: "55", full_name: "Carlos Sainz", team_name: "Ferrari", position: 4, gap_to_leader: "12.7" },
      { driver_number: "4", full_name: "Lando Norris", team_name: "McLaren", position: 5, gap_to_leader: "15.4" },
      { driver_number: "44", full_name: "Lewis Hamilton", team_name: "Mercedes", position: 6, gap_to_leader: "19.8" },
      { driver_number: "63", full_name: "George Russell", team_name: "Mercedes", position: 7, gap_to_leader: "22.1" },
      { driver_number: "14", full_name: "Fernando Alonso", team_name: "Aston Martin", position: 8, gap_to_leader: "25.5" },
      { driver_number: "81", full_name: "Oscar Piastri", team_name: "McLaren", position: 9, gap_to_leader: "28.3" },
      { driver_number: "18", full_name: "Lance Stroll", team_name: "Aston Martin", position: 10, gap_to_leader: "32.7" }
    ];
    
    return { data: mockData, error };
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
