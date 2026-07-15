import { supabase } from "@/integrations/supabase/client";
import type {
  EntityLookup,
  EntityNotableRecord,
  F1ConstructorProfile,
  F1DriverProfile,
} from "@/lib/entity/types";

/** True when Supabase env vars are present (entity reads are available). */
export function isEntityDbConfigured(): boolean {
  return (
    !!import.meta.env.VITE_SUPABASE_URL &&
    !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  );
}

function parseNotableRecords(value: unknown): EntityNotableRecord[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter(
    (item): item is EntityNotableRecord =>
      typeof item === "object" &&
      item !== null &&
      "label" in item &&
      "value" in item &&
      typeof (item as EntityNotableRecord).label === "string" &&
      typeof (item as EntityNotableRecord).value === "string",
  );
}

function mapDriverProfile(row: Record<string, unknown>): F1DriverProfile {
  return {
    ergast_id: row.ergast_id as string,
    given_name: row.given_name as string,
    family_name: row.family_name as string,
    code: (row.code as string | null) ?? null,
    permanent_number: (row.permanent_number as string | null) ?? null,
    nationality: (row.nationality as string | null) ?? null,
    date_of_birth: (row.date_of_birth as string | null) ?? null,
    slug: row.slug as string,
    portrait_path: (row.portrait_path as string | null) ?? null,
    headshot_url: (row.headshot_url as string | null) ?? null,
    display_name: row.display_name as string,
    active_season: (row.active_season as number | null) ?? null,
    championships: (row.championships as number | null) ?? null,
    championship_years: (row.championship_years as number[] | null) ?? null,
    race_starts: (row.race_starts as number | null) ?? null,
    race_wins: (row.race_wins as number | null) ?? null,
    podiums: (row.podiums as number | null) ?? null,
    pole_positions: (row.pole_positions as number | null) ?? null,
    fastest_laps: (row.fastest_laps as number | null) ?? null,
    first_gp_year: (row.first_gp_year as number | null) ?? null,
    last_gp_year: (row.last_gp_year as number | null) ?? null,
    best_championship_position:
      (row.best_championship_position as number | null) ?? null,
    career_points:
      row.career_points != null ? Number(row.career_points) : null,
    bio_short: (row.bio_short as string | null) ?? null,
    notable_records: parseNotableRecords(row.notable_records),
    scraped_at: (row.scraped_at as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function mapConstructorProfile(row: Record<string, unknown>): F1ConstructorProfile {
  return {
    ergast_id: row.ergast_id as string,
    name: row.name as string,
    nationality: (row.nationality as string | null) ?? null,
    slug: row.slug as string,
    logo_path: (row.logo_path as string | null) ?? null,
    team_color_hex: (row.team_color_hex as string | null) ?? null,
    display_name: row.display_name as string,
    active_season: (row.active_season as number | null) ?? null,
    championships: (row.championships as number | null) ?? null,
    championship_years: (row.championship_years as number[] | null) ?? null,
    race_wins: (row.race_wins as number | null) ?? null,
    podiums: (row.podiums as number | null) ?? null,
    pole_positions: (row.pole_positions as number | null) ?? null,
    first_season: (row.first_season as number | null) ?? null,
    last_season: (row.last_season as number | null) ?? null,
    bio_short: (row.bio_short as string | null) ?? null,
    notable_records: parseNotableRecords(row.notable_records),
    scraped_at: (row.scraped_at as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

type DriverLookup = EntityLookup | { slug?: string; ergastId?: string };

function resolveDriverFilter(lookup: DriverLookup): {
  column: "slug" | "ergast_id";
  value: string;
} | null {
  if ("slug" in lookup && lookup.slug) {
    return { column: "slug", value: lookup.slug };
  }
  if ("ergastId" in lookup && lookup.ergastId) {
    return { column: "ergast_id", value: lookup.ergastId };
  }
  return null;
}

/** Choose the best row when a slug/ergast_id lookup returns duplicates. Prefers
 *  an exact ergast_id match, then any row with a real ergast_id — this guards
 *  against dirty warehouse duplicates like `ergast_id="nan"` (which otherwise
 *  make .maybeSingle() throw on >1 row and 404 the whole page). */
function pickProfileRow<T extends Record<string, unknown>>(
  rows: T[] | null | undefined,
  value: string,
): T | null {
  if (!rows || rows.length === 0) return null;
  const isReal = (r: T) =>
    typeof r.ergast_id === "string" && r.ergast_id !== "" && r.ergast_id !== "nan";
  return rows.find((r) => r.ergast_id === value) ?? rows.find(isReal) ?? rows[0];
}

/** Fetch a driver profile by slug or Ergast id. Returns null when DB is unavailable or not found. */
export async function getDriverProfile(
  lookup: DriverLookup,
): Promise<F1DriverProfile | null> {
  if (!isEntityDbConfigured()) return null;

  const filter = resolveDriverFilter(lookup);
  if (!filter) return null;

  // Match slug OR ergast_id. The warehouse can hold >1 row for a slug (a dirty
  // `ergast_id="nan"` duplicate exists for Carlos Sainz), so do NOT use
  // .maybeSingle() — it throws on multiple rows and the page 404s. Fetch the
  // candidates and pick the best real one.
  const { data, error } = await supabase
    .from("f1_driver_profile")
    .select("*")
    .or(`slug.eq.${filter.value},ergast_id.eq.${filter.value}`)
    .limit(20);

  if (error) {
    console.warn("[entityService] getDriverProfile failed:", error.message);
    return null;
  }

  const row = pickProfileRow(data as Record<string, unknown>[] | null, filter.value);
  return row ? mapDriverProfile(row) : null;
}

/** Fetch a constructor profile by slug or Ergast id. Returns null when DB is unavailable or not found. */
export async function getConstructorProfile(
  lookup: DriverLookup,
): Promise<F1ConstructorProfile | null> {
  if (!isEntityDbConfigured()) return null;

  const filter = resolveDriverFilter(lookup);
  if (!filter) return null;

  const { data, error } = await supabase
    .from("f1_constructor_profile")
    .select("*")
    .or(`slug.eq.${filter.value},ergast_id.eq.${filter.value}`)
    .limit(20);

  if (error) {
    console.warn(
      "[entityService] getConstructorProfile failed:",
      error.message,
    );
    return null;
  }

  const row = pickProfileRow(data as Record<string, unknown>[] | null, filter.value);
  return row ? mapConstructorProfile(row) : null;
}
