/** Notable career record entry stored in Supabase jsonb columns. */
export interface EntityNotableRecord {
  label: string;
  value: string;
}

/** Driver identity + career joined via f1_driver_profile view. */
export interface F1DriverProfile {
  ergast_id: string;
  given_name: string;
  family_name: string;
  code: string | null;
  permanent_number: string | null;
  nationality: string | null;
  date_of_birth: string | null;
  slug: string;
  portrait_path: string | null;
  headshot_url: string | null;
  display_name: string;
  active_season: number | null;
  championships: number | null;
  championship_years: number[] | null;
  race_starts: number | null;
  race_wins: number | null;
  podiums: number | null;
  pole_positions: number | null;
  fastest_laps: number | null;
  first_gp_year: number | null;
  last_gp_year: number | null;
  best_championship_position: number | null;
  career_points: number | null;
  bio_short: string | null;
  notable_records: EntityNotableRecord[] | null;
  scraped_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Constructor identity + heritage joined via f1_constructor_profile view. */
export interface F1ConstructorProfile {
  ergast_id: string;
  name: string;
  nationality: string | null;
  slug: string;
  logo_path: string | null;
  team_color_hex: string | null;
  display_name: string;
  active_season: number | null;
  championships: number | null;
  championship_years: number[] | null;
  race_wins: number | null;
  podiums: number | null;
  pole_positions: number | null;
  first_season: number | null;
  last_season: number | null;
  bio_short: string | null;
  notable_records: EntityNotableRecord[] | null;
  scraped_at: string | null;
  created_at: string;
  updated_at: string;
}

export type EntityLookup =
  | { slug: string; ergastId?: never }
  | { ergastId: string; slug?: never };
