
// Types for the F1 Race Map components
export interface Race {
  round: string;
  raceName: string;
  date: string;
  time?: string; // Added as optional
  season?: string; // Added as optional
  Circuit: {
    circuitName: string;
    url?: string; // Added as optional
    Location: {
      lat: string;
      long: string;
      locality: string;
      country: string;
    }
  };
  // Added all the optional race event props
  FirstPractice?: {
    date: string;
    time?: string;
  };
  SecondPractice?: {
    date: string;
    time?: string;
  };
  ThirdPractice?: {
    date: string;
    time?: string;
  };
  Qualifying?: {
    date: string;
    time?: string;
  };
  Sprint?: {
    date: string;
    time?: string;
  };
  SprintQualifying?: {
    date: string;
    time?: string;
  };
}

export type RaceStatus = "first" | "upcoming" | "completed";

export interface RaceMapProps {
  selectedYear: number;
  onYearChange: (year: number) => void;
}

// Added new interface for race path connection
export interface RaceConnection {
  fromRace: Race;
  toRace: Race;
  completed: boolean;
}

// Added detail level type
export type GlobeDetailLevel = 'low' | 'medium' | 'high';
