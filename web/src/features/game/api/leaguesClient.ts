import { supabase } from "@/integrations/supabase/client";
import { ACTIVE_GAME_SEASON } from "./gameClient";

const db = supabase as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped game tables
  from: (t: string) => any;
};
function throwIf(e: { message: string } | null) { if (e) throw new Error(e.message); }

export type MyLeague = {
  league_id: string; name: string; slug: string; is_public: boolean; role: string;
  member_count: number; my_rank: number | null; my_points: number;
};
export type PublicLeague = { id: string; name: string; slug: string; member_count: number };
export type StandingRow = {
  user_id: string; username: string | null; avatar_url: string | null;
  total_points: number; exact_hits: number; champions_correct: number; goat_count: number;
  rank: number; movement: number;
};
export type LeagueStatRow = {
  user_id: string; username: string | null; rounds_played: number;
  total_points: number; best_round: number; avg_round: number; exact_hits: number;
};
export type LeagueMember = { user_id: string; username: string | null; avatar_url: string | null; role: string; joined_at: string };
export type RankHistoryRow = { round: number; user_id: string; username: string | null; rank: number; total_points: number };
export type RoundAward = { round: number; user_id: string; username: string | null; points: number; is_goat: boolean; is_flop: boolean };
export type RevealRow = { user_id: string; username: string | null; session_type: string; pos: number; driver_id: string };
export type LeagueRow = {
  id: string; name: string; slug: string; is_public: boolean; invite_code: string | null;
  pick_reveal_policy: string; created_by: string | null;
};

export async function getMyLeagues(season = ACTIVE_GAME_SEASON): Promise<MyLeague[]> {
  const { data, error } = await db.rpc("get_my_leagues", { p_season: season });
  throwIf(error); return (data as MyLeague[]) ?? [];
}
export async function listPublicLeagues(): Promise<PublicLeague[]> {
  const { data, error } = await db.rpc("list_public_leagues"); throwIf(error); return (data as PublicLeague[]) ?? [];
}
export async function getLeagueInvitePreview(code: string): Promise<{ id: string; name: string; member_count: number } | null> {
  const { data, error } = await db.rpc("get_league_invite_preview", { p_code: code });
  throwIf(error); return ((data as { id: string; name: string; member_count: number }[]) ?? [])[0] ?? null;
}
export async function createLeague(name: string, isPublic: boolean): Promise<string> {
  const { data, error } = await db.rpc("create_league", { p_name: name, p_is_public: isPublic });
  throwIf(error); return data as string;
}
export async function joinPublicLeague(id: string): Promise<void> {
  const { error } = await db.rpc("join_public_league", { p_league_id: id }); throwIf(error);
}
export async function joinLeagueByCode(code: string): Promise<string> {
  const { data, error } = await db.rpc("join_league_by_code", { p_code: code }); throwIf(error); return data as string;
}
export async function leaveLeague(id: string): Promise<void> {
  const { error } = await db.rpc("leave_league", { p_league_id: id }); throwIf(error);
}
export async function removeMember(leagueId: string, userId: string): Promise<void> {
  const { error } = await db.rpc("remove_league_member", { p_league_id: leagueId, p_user_id: userId }); throwIf(error);
}
export async function updateLeague(
  leagueId: string, patch: { name?: string; isPublic?: boolean; reveal?: string }): Promise<void> {
  const { error } = await db.rpc("update_league", {
    p_league_id: leagueId, p_name: patch.name ?? null,
    p_is_public: patch.isPublic ?? null, p_reveal: patch.reveal ?? null,
  }); throwIf(error);
}
export async function rotateInvite(leagueId: string): Promise<string> {
  const { data, error } = await db.rpc("rotate_invite_code", { p_league_id: leagueId }); throwIf(error); return data as string;
}
export async function getLeague(id: string): Promise<LeagueRow | null> {
  const { data, error } = await db.from("game_league")
    .select("id, name, slug, is_public, invite_code, pick_reveal_policy, created_by")
    .eq("id", id).maybeSingle();
  throwIf(error); return (data as LeagueRow) ?? null;
}
export async function getLeagueStandings(leagueId: string, season = ACTIVE_GAME_SEASON): Promise<StandingRow[]> {
  const { data, error } = await db.rpc("get_league_standings", { p_league_id: leagueId, p_season: season });
  throwIf(error); return (data as StandingRow[]) ?? [];
}
export async function getLeagueMembers(leagueId: string): Promise<LeagueMember[]> {
  const { data, error } = await db.rpc("get_league_members", { p_league_id: leagueId });
  throwIf(error); return (data as LeagueMember[]) ?? [];
}
export async function getLeagueStats(leagueId: string, season = ACTIVE_GAME_SEASON): Promise<LeagueStatRow[]> {
  const { data, error } = await db.rpc("get_league_stats", { p_league_id: leagueId, p_season: season });
  throwIf(error); return (data as LeagueStatRow[]) ?? [];
}
export async function getLeagueRankHistory(leagueId: string, season = ACTIVE_GAME_SEASON): Promise<RankHistoryRow[]> {
  const { data, error } = await db.rpc("get_league_rank_history", { p_league_id: leagueId, p_season: season });
  throwIf(error); return (data as RankHistoryRow[]) ?? [];
}
export async function getLeagueRoundAwards(leagueId: string, season = ACTIVE_GAME_SEASON): Promise<RoundAward[]> {
  const { data, error } = await db.rpc("get_league_round_awards", { p_league_id: leagueId, p_season: season });
  throwIf(error); return (data as RoundAward[]) ?? [];
}
export async function getRoundReveal(leagueId: string, round: number, season = ACTIVE_GAME_SEASON): Promise<RevealRow[]> {
  const { data, error } = await db.rpc("get_round_reveal", { p_league_id: leagueId, p_season: season, p_round: round });
  throwIf(error); return (data as RevealRow[]) ?? [];
}

export type H2HRow = { round: number; a_points: number; b_points: number };
export async function getH2H(leagueId: string, a: string, b: string, season = ACTIVE_GAME_SEASON): Promise<H2HRow[]> {
  const { data, error } = await db.rpc("get_h2h", { p_league_id: leagueId, p_season: season, p_a: a, p_b: b });
  throwIf(error); return (data as H2HRow[]) ?? [];
}

export type AllTimeRow = { user_id: string; username: string | null; total_points: number; seasons_played: number; rank: number };
export async function getLeagueAlltime(leagueId: string): Promise<AllTimeRow[]> {
  const { data, error } = await db.rpc("get_league_alltime", { p_league_id: leagueId });
  throwIf(error); return (data as AllTimeRow[]) ?? [];
}
