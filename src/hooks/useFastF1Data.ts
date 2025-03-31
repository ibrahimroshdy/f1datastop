
import { useQuery } from "@tanstack/react-query";

// Function to get the current year
const getCurrentYear = () => new Date().getFullYear();

// Get lap times for a specific race
export const useLapTimes = (raceId: string) => {
  return useQuery({
    queryKey: ["lapTimes", raceId],
    queryFn: async () => {
      try {
        // This would actually fetch from FastF1 API in a real implementation
        // For now, we'll return simulated data
        const currentYear = getCurrentYear();
        return {
          data: generateLapTimeData(raceId, currentYear),
          year: currentYear,
        };
      } catch (error) {
        console.error("Error fetching lap times:", error);
        throw error;
      }
    },
    staleTime: 1000 * 60 * 15, // 15 minutes
  });
};

// Get tire strategies for a specific race
export const useTireStrategies = (raceId: string) => {
  return useQuery({
    queryKey: ["tireStrategies", raceId],
    queryFn: async () => {
      try {
        // Simulate FastF1 API call
        const currentYear = getCurrentYear();
        return {
          data: generateTireStrategyData(raceId, currentYear),
          year: currentYear,
        };
      } catch (error) {
        console.error("Error fetching tire strategies:", error);
        throw error;
      }
    },
    staleTime: 1000 * 60 * 15, // 15 minutes
  });
};

// Get telemetry data
export const useTelemetryData = (raceId: string, driverId: string) => {
  return useQuery({
    queryKey: ["telemetry", raceId, driverId],
    queryFn: async () => {
      try {
        // Simulate FastF1 API call
        const currentYear = getCurrentYear();
        return {
          data: generateTelemetryData(driverId, currentYear),
          year: currentYear,
        };
      } catch (error) {
        console.error("Error fetching telemetry data:", error);
        throw error;
      }
    },
    staleTime: 1000 * 60 * 15, // 15 minutes
    enabled: !!raceId && !!driverId,
  });
};

// Get fastest laps for each driver
export const useFastestLaps = () => {
  return useQuery({
    queryKey: ["fastestLaps"],
    queryFn: async () => {
      try {
        // Simulate FastF1 API call
        const currentYear = getCurrentYear();
        return {
          data: generateFastestLapsData(currentYear),
          year: currentYear,
        };
      } catch (error) {
        console.error("Error fetching fastest laps:", error);
        throw error;
      }
    },
    staleTime: 1000 * 60 * 15, // 15 minutes
  });
};

// Get top speeds for each driver
export const useTopSpeeds = () => {
  return useQuery({
    queryKey: ["topSpeeds"],
    queryFn: async () => {
      try {
        // Simulate FastF1 API call
        const currentYear = getCurrentYear();
        return {
          data: generateTopSpeedsData(currentYear),
          year: currentYear,
        };
      } catch (error) {
        console.error("Error fetching top speeds:", error);
        throw error;
      }
    },
    staleTime: 1000 * 60 * 15, // 15 minutes
  });
};

// Data generation helper functions
const generateLapTimeData = (raceId: string, year: number) => {
  const drivers = ["VER", "HAM", "LEC", "SAI", "PER", "RUS", "NOR", "PIA", "ALO", "STR"];
  const laps = Array.from({ length: 50 }, (_, i) => i + 1);
  
  return drivers.map(driver => ({
    driver,
    laps: laps.map(lap => ({
      lap,
      time: 85 + Math.random() * 5,
    }))
  }));
};

const generateTireStrategyData = (raceId: string, year: number) => {
  const drivers = ["VER", "HAM", "LEC", "SAI", "PER", "RUS", "NOR", "PIA", "ALO", "STR"];
  const tireTypes = ["SOFT", "MEDIUM", "HARD"];
  
  return drivers.map(driver => ({
    driver,
    strategy: Array.from({ length: 2 + Math.floor(Math.random() * 2) }, (_, i) => ({
      stint: i + 1,
      tire: tireTypes[Math.floor(Math.random() * tireTypes.length)],
      laps: 15 + Math.floor(Math.random() * 20),
    }))
  }));
};

const generateTelemetryData = (driverId: string, year: number) => {
  // Generate random telemetry data points
  const dataPoints = Array.from({ length: 100 }, (_, i) => ({
    distance: i * 100,
    speed: 100 + Math.random() * 220,
    throttle: 20 + Math.random() * 80,
    brake: Math.random() * 60,
    gear: 1 + Math.floor(Math.random() * 8),
  }));
  
  return {
    driverId,
    dataPoints,
  };
};

const generateFastestLapsData = (year: number) => {
  const drivers = ["VER", "HAM", "LEC", "SAI", "PER", "RUS", "ALO", "STR", "NOR", "PIA", "GAS", "TSU", "BOT", "ZHO", "HUL", "MAG", "OCO", "ALB", "SAR", "RIC"];
  
  return drivers.map(driver => ({
    driver,
    fastestLap: 83 + Math.random() * 7,
    race: ["Bahrain", "Saudi Arabia", "Australia", "Japan", "China", "Miami", "Imola", "Monaco", "Barcelona", "Austria"][Math.floor(Math.random() * 10)],
  })).sort((a, b) => a.fastestLap - b.fastestLap);
};

const generateTopSpeedsData = (year: number) => {
  const drivers = ["VER", "HAM", "LEC", "SAI", "PER", "RUS", "ALO", "STR", "NOR", "PIA", "GAS", "TSU", "BOT", "ZHO", "HUL", "MAG", "OCO", "ALB", "SAR", "RIC"];
  
  return drivers.map(driver => ({
    driver,
    topSpeed: 310 + Math.random() * 40,
    race: ["Monza", "Spa", "Baku", "Mexico", "Saudi Arabia", "Las Vegas"][Math.floor(Math.random() * 6)],
  })).sort((a, b) => b.topSpeed - a.topSpeed);
};
