import { supabase } from "@/integrations/supabase/client";

/** The season the game defaults to. */
export const ACTIVE_GAME_SEASON = 2026;

export type GameEntry = { id: string; season: number; created_at: string };
export type SeasonDriver = {
  driver_id: string;
  code: string | null;
  name: string;
  constructor_id: string | null;
  constructor_name: string | null;
};
export type ScheduleRound = {
  round: number;
  race_name: string;
  country: string | null;
  deadline: string | null;
  is_sprint: boolean;
  is_locked: boolean;
  has_results: boolean;
};
export type SessionType = "Q" | "R" | "S";
export type RoundPicks = Record<SessionType, string[]>;
export type PickScore = {
  round: number;
  session_type: SessionType;
  points: number;
  exact_hits: number;
};

// game_* tables + RPCs aren't in the curated types.ts. Codebase convention for non-core
// tables is a local untyped cast (see services/analysisService.ts). Keep it contained here.
const db = supabase as unknown as {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped game tables
  from: (t: string) => any;
};

function throwIf(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** "Join the F1 League" — creates the caller's entry + joins the global league. Returns entry id. */
export async function activatePlayer(season = ACTIVE_GAME_SEASON): Promise<string> {
  const { data, error } = await db.rpc("activate_player", { p_season: season });
  throwIf(error);
  return data as string;
}

/** The caller's entry for a season, or null if not activated. Filters by the user's own id —
 *  admin RLS returns every entry, so season-only + maybeSingle would throw on multiple rows. */
export async function getMyEntry(season = ACTIVE_GAME_SEASON): Promise<GameEntry | null> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return null;
  const { data, error } = await db
    .from("game_entry")
    .select("id, season, created_at")
    .eq("season", season)
    .eq("user_id", uid)
    .maybeSingle();
  throwIf(error);
  return (data as GameEntry) ?? null;
}

export async function getSeasonDrivers(season = ACTIVE_GAME_SEASON): Promise<SeasonDriver[]> {
  const { data, error } = await db.rpc("get_season_drivers", { p_season: season });
  throwIf(error);
  return (data as SeasonDriver[]) ?? [];
}

export async function getGameSchedule(season = ACTIVE_GAME_SEASON): Promise<ScheduleRound[]> {
  const { data, error } = await db.rpc("get_game_schedule", { p_season: season });
  throwIf(error);
  return (data as ScheduleRound[]) ?? [];
}

/** The caller's picks for one round, grouped by session type (index 0 = P1). */
export async function getRoundPicks(entryId: string, round: number): Promise<RoundPicks> {
  const { data, error } = await db
    .from("game_race_pick")
    .select("session_type, position, driver_id")
    .eq("entry_id", entryId)
    .eq("round", round)
    .order("position");
  throwIf(error);
  const out: RoundPicks = { Q: [], R: [], S: [] };
  for (const row of (data as { session_type: SessionType; position: number; driver_id: string }[]) ?? []) {
    out[row.session_type][row.position - 1] = row.driver_id;
  }
  return out;
}

export async function isPickEditable(entryId: string, round: number): Promise<boolean> {
  const { data, error } = await db.rpc("game_pick_is_editable", {
    p_entry_id: entryId,
    p_round: round,
  });
  throwIf(error);
  return !!data;
}

export async function saveRacePick(
  round: number,
  sessionType: SessionType,
  driverIds: string[],
  season = ACTIVE_GAME_SEASON,
): Promise<void> {
  const { error } = await db.rpc("save_race_pick", {
    p_season: season,
    p_round: round,
    p_session_type: sessionType,
    p_driver_ids: driverIds,
  });
  throwIf(error);
}

export async function getMyHistory(entryId: string): Promise<PickScore[]> {
  const { data, error } = await db
    .from("game_pick_score")
    .select("round, session_type, points, exact_hits")
    .eq("entry_id", entryId)
    .order("round");
  throwIf(error);
  return (data as PickScore[]) ?? [];
}

export async function getMyTotal(entryId: string): Promise<{ total_points: number; exact_hits: number } | null> {
  const { data, error } = await db
    .from("game_entry_total")
    .select("total_points, exact_hits")
    .eq("entry_id", entryId)
    .maybeSingle();
  throwIf(error);
  return (data as { total_points: number; exact_hits: number }) ?? null;
}

// ── champions ────────────────────────────────────────────────────────────────
export type ChampionPick = { wdc_driver_id: string | null; wcc_constructor_id: string | null };

export async function getChampionPick(entryId: string): Promise<ChampionPick | null> {
  const { data, error } = await db
    .from("game_champion_pick")
    .select("wdc_driver_id, wcc_constructor_id")
    .eq("entry_id", entryId)
    .maybeSingle();
  throwIf(error);
  return (data as ChampionPick) ?? null;
}

export async function isChampionEditable(entryId: string): Promise<boolean> {
  const { data, error } = await db.rpc("game_champion_is_editable", { p_entry_id: entryId });
  throwIf(error);
  return !!data;
}

export async function saveChampionPick(
  wdc: string,
  wcc: string,
  season = ACTIVE_GAME_SEASON,
): Promise<void> {
  const { error } = await db.rpc("save_champion_pick", { p_season: season, p_wdc: wdc, p_wcc: wcc });
  throwIf(error);
}

export type Badge = { key: string; label: string; count: number };
export async function getPlayerBadges(userId: string, season = ACTIVE_GAME_SEASON): Promise<Badge[]> {
  const { data, error } = await db.rpc("get_player_badges", { p_season: season, p_user_id: userId });
  throwIf(error);
  return (data as Badge[]) ?? [];
}
export async function getGlobalPercentile(userId: string, season = ACTIVE_GAME_SEASON): Promise<number | null> {
  const { data, error } = await db.rpc("get_global_percentile", { p_season: season, p_user_id: userId });
  throwIf(error);
  return (data as number) ?? null;
}
export async function getMyJoker(season = ACTIVE_GAME_SEASON): Promise<number | null> {
  const { data, error } = await db.rpc("get_my_joker", { p_season: season });
  throwIf(error);
  return (data as number) ?? null;
}
export async function setJoker(round: number, season = ACTIVE_GAME_SEASON): Promise<void> {
  const { error } = await db.rpc("set_joker", { p_season: season, p_round: round });
  throwIf(error);
}

export type GameProfile = {
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  favorite_driver_id: string | null;
  favorite_constructor_id: string | null;
  country: string | null;
};

export async function getMyProfile(userId: string): Promise<GameProfile | null> {
  const { data, error } = await db
    .from("profiles")
    .select("username, avatar_url, bio, favorite_driver_id, favorite_constructor_id, country")
    .eq("id", userId)
    .maybeSingle();
  throwIf(error);
  return (data as GameProfile) ?? null;
}

export async function updateMyProfile(userId: string, patch: Partial<GameProfile>): Promise<void> {
  const { error } = await db.from("profiles").update(patch).eq("id", userId);
  throwIf(error);
}

export type GameSeasonRow = { season: number; name: string; status: string };
export async function getGameSeasons(): Promise<GameSeasonRow[]> {
  const { data, error } = await db
    .from("game_season")
    .select("season, name, status")
    .order("season", { ascending: false });
  throwIf(error);
  return (data as GameSeasonRow[]) ?? [];
}

export async function getSeasonConstructors(
  season = ACTIVE_GAME_SEASON,
): Promise<{ constructor_id: string; constructor_name: string | null }[]> {
  const drivers = await getSeasonDrivers(season);
  const map = new Map<string, string | null>();
  for (const d of drivers) if (d.constructor_id) map.set(d.constructor_id, d.constructor_name);
  return [...map].map(([constructor_id, constructor_name]) => ({ constructor_id, constructor_name }));
}
