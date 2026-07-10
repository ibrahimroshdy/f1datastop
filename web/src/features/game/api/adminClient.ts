import { supabase } from "@/integrations/supabase/client";
import { ACTIVE_GAME_SEASON } from "./gameClient";

const db = supabase as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped game tables
  from: (t: string) => any;
};
function throwIf(e: { message: string } | null) { if (e) throw new Error(e.message); }

export type AdminStats = {
  players: number; total_users: number; leagues_total: number; leagues_public: number;
  leagues_private: number; predictions_made: number; pick_rows: number; graded_rounds: number; champion_picks: number;
};
export type AdminPlayer = { user_id: string; username: string | null; pick_rows: number; total_points: number; activated_at: string };
export type AdminLeague = { id: string; name: string; slug: string; is_public: boolean; member_count: number; created_by_name: string | null; created_at: string };
export type AuditRow = { id: string; action: string; detail: unknown; created_at: string };

export async function adminStats(season = ACTIVE_GAME_SEASON): Promise<AdminStats> {
  const { data, error } = await db.rpc("admin_game_stats", { p_season: season });
  throwIf(error); return data as AdminStats;
}
export async function adminListPlayers(season = ACTIVE_GAME_SEASON): Promise<AdminPlayer[]> {
  const { data, error } = await db.rpc("admin_list_players", { p_season: season });
  throwIf(error); return (data as AdminPlayer[]) ?? [];
}
export async function adminListLeagues(): Promise<AdminLeague[]> {
  const { data, error } = await db.rpc("admin_list_leagues");
  throwIf(error); return (data as AdminLeague[]) ?? [];
}
export async function adminRegrade(season = ACTIVE_GAME_SEASON): Promise<void> {
  const { error } = await db.rpc("admin_regrade", { p_season: season }); throwIf(error);
}
export async function adminUpdateSeason(
  season: number,
  patch: { scoringRules?: unknown; status?: string; globallyLocked?: boolean; championLockRound?: number },
): Promise<void> {
  const { error } = await db.rpc("admin_update_season", {
    p_season: season,
    p_scoring_rules: patch.scoringRules ?? null,
    p_status: patch.status ?? null,
    p_globally_locked: patch.globallyLocked ?? null,
    p_champion_lock_round: patch.championLockRound ?? null,
  });
  throwIf(error);
}
export async function openSeason(season: number, name: string): Promise<void> {
  const { error } = await db.rpc("open_season", { p_season: season, p_name: name }); throwIf(error);
}
export async function adminBroadcast(title: string, body: string, url = "/game"): Promise<void> {
  const { error } = await db.rpc("admin_broadcast", { p_title: title, p_body: body, p_url: url });
  throwIf(error);
}
export async function getAuditLog(): Promise<AuditRow[]> {
  const { data, error } = await db
    .from("game_audit_log").select("id, action, detail, created_at").order("created_at", { ascending: false }).limit(100);
  throwIf(error); return (data as AuditRow[]) ?? [];
}
export async function getSeasonConfig(season = ACTIVE_GAME_SEASON) {
  const { data, error } = await db
    .from("game_season")
    .select("season, name, status, scoring_rules, champion_lock_round, globally_locked")
    .eq("season", season).maybeSingle();
  throwIf(error);
  return data as {
    season: number; name: string; status: string; scoring_rules: unknown;
    champion_lock_round: number | null; globally_locked: boolean;
  } | null;
}
