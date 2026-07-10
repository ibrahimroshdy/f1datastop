import { supabase } from "@/integrations/supabase/client";

/** The season the game defaults to. */
export const ACTIVE_GAME_SEASON = 2026;

export type GameEntry = { id: string; season: number; created_at: string };

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

/** "Join the F1 League" — creates the caller's entry + joins the global league. Returns entry id. */
export async function activatePlayer(season = ACTIVE_GAME_SEASON): Promise<string> {
  const { data, error } = await db.rpc("activate_player", { p_season: season });
  if (error) throw new Error(error.message);
  return data as string;
}

/** The caller's entry for a season, or null if not activated. */
export async function getMyEntry(season = ACTIVE_GAME_SEASON): Promise<GameEntry | null> {
  const { data, error } = await db
    .from("game_entry")
    .select("id, season, created_at")
    .eq("season", season)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as GameEntry) ?? null;
}
