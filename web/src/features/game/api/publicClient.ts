import { supabase } from "@/integrations/supabase/client";

export type LeaguePreviewRow = {
  rank: number;
  username: string;
  avatar_url: string | null;
  total_points: number;
  exact_hits: number;
};

// Anon-readable game reads for the public landing. Untyped cast (game RPCs
// aren't in the curated types.ts) — same convention as gameClient.ts.
const db = supabase as unknown as {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

/** Global-league top-N (privacy-safe: handle + avatar + points). Anon-safe. */
export async function getPublicLeaguePreview(
  season = 2026,
  limit = 10,
): Promise<LeaguePreviewRow[]> {
  const { data, error } = await db.rpc("get_public_league_preview", {
    p_season: season,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return (data as LeaguePreviewRow[]) ?? [];
}
