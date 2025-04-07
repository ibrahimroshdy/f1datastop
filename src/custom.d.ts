
// Custom type definitions for the project

interface LapTimesOptions {
  loadFullData?: boolean;
}

// OpenF1 API Types
interface OpenF1Driver {
  broadcast_name?: string;
  country_code?: string;
  driver_number: number;
  first_name?: string;
  full_name: string;
  headshot_url?: string;
  last_name?: string;
  meeting_key?: number;
  name_acronym: string; // This is the three-letter code
  session_key?: number;
  team_colour?: string;
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
  team_colour?: string;
}

interface OpenF1Session {
  circuit_key: number;
  circuit_short_name: string;
  country_code: string;
  country_key: number;
  country_name: string;
  date_end: string;
  date_start: string;
  gmt_offset: string;
  location: string;
  meeting_key: number;
  session_key: number;
  session_name: string;
  session_type: string;
  year: number;
}
