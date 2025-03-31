// I'll keep the existing imports and other code here, but update the functions to use the current year

// Get the current year for default queries
const getCurrentYear = () => new Date().getFullYear();

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

// Keep the rest of the functions unchanged
