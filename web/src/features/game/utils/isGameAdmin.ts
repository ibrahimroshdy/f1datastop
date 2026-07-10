import type { User } from "@supabase/supabase-js";

export const GAME_ADMIN_EMAIL = "admin@f1datastop.com";

/** Frontend admin gate — mirrors the DB `is_game_admin()`. Server RLS is the real guard;
 *  this only decides what UI to show. */
export function isGameAdmin(user: User | null | undefined): boolean {
  return !!user?.email && user.email.toLowerCase() === GAME_ADMIN_EMAIL;
}
