
// Custom type definitions for the project

interface LapTimesOptions {
  loadFullData?: boolean;
}

// OpenF1 API Types
interface OpenF1Driver {
  abbreviation: string;
  country: string;
  driver_number: number;
  full_name: string;
  meeting_key?: number;
  session_key?: number;
  team_color?: string;
  team_name?: string;
}

interface OpenF1Constructor {
  constructor_key?: number;
  country?: string;
  name: string;
  constructorId?: string;
  driver_number?: number;
  meeting_key?: number;
  session_key?: number;
  team_color?: string;
}

