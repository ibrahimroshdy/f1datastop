import { supabase } from "@/integrations/supabase/client";

export type AnnouncementKind = "radio" | "control" | "news";

export type Announcement = {
  id: string;
  season: number | null;
  title: string;
  body: string;
  url: string | null;
  kind: AnnouncementKind;
  audience: "all" | "players";
  pinned: boolean;
  published_at: string;
  created_at: string;
};

// game_* RPCs aren't in the curated types.ts — local untyped cast (same
// convention as gameClient.ts / analysisService.ts).
const db = supabase as unknown as {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function throwIf(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** Ordered announcements feed (pinned first, then newest). Anon-safe. */
export async function getAnnouncements(limit = 10): Promise<Announcement[]> {
  const { data, error } = await db.rpc("get_announcements", { p_limit: limit });
  throwIf(error);
  return (data as Announcement[]) ?? [];
}

/** Admin: post an in-app announcement. Push is a separate admin_broadcast call. */
export async function postAnnouncement(input: {
  title: string;
  body: string;
  url?: string | null;
  kind?: AnnouncementKind;
  audience?: "all" | "players";
  pinned?: boolean;
  season?: number | null;
}): Promise<Announcement> {
  const { data, error } = await db.rpc("admin_post_announcement", {
    p_title: input.title,
    p_body: input.body,
    p_url: input.url ?? null,
    p_kind: input.kind ?? "control",
    p_audience: input.audience ?? "all",
    p_pinned: input.pinned ?? false,
    p_season: input.season ?? null,
  });
  throwIf(error);
  return data as Announcement;
}

/** Admin: remove an announcement. */
export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await db.rpc("admin_delete_announcement", { p_id: id });
  throwIf(error);
}
