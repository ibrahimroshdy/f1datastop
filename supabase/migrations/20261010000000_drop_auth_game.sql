-- ============================================================================
-- Prod cleanup for the 2026-10-10 opensource revamp: drop auth/game/push.
-- ============================================================================
-- NEVER run 00000000000000_baseline.sql on prod. This migration brings prod
-- to the same auth-free schema the baseline gives fresh DBs:
--   * unschedules the game crons (recalc + push tick)
--   * drops the auth.users triggers (signup Slack ping, profile seeder)
--   * drops profiles, push_subscriptions, and all 18 game_* tables (CASCADE
--     takes their policies, indexes, and game triggers with them)
--   * drops handle_new_user(), notify_slack_signup(), store_signup_webhook()
--     and every game RPC/trigger helper (signature-proof name-based drops)
--
-- Fully idempotent (DROP ... IF EXISTS + guarded unschedules): also applies
-- cleanly on fresh DBs where the baseline never created these objects.
-- After this, prod history is repaired with:
--   supabase migration repair --status applied 00000000000000
-- (verify the version string with `supabase migration list` first).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Game crons (guarded for missing jobs).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  PERFORM cron.unschedule('game-recalc-active-seasons')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'game-recalc-active-seasons');
  PERFORM cron.unschedule('game-push-tick')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'game-push-tick');
END $$;

-- ---------------------------------------------------------------------------
-- 2) Triggers on auth.users (the auth schema itself is never dropped).
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_notify_slack_signup ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- ---------------------------------------------------------------------------
-- 3) Tables: profiles, push_subscriptions, all 18 game_* tables.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.push_subscriptions CASCADE;
DROP TABLE IF EXISTS public.game_announcement CASCADE;
DROP TABLE IF EXISTS public.game_audit_log CASCADE;
DROP TABLE IF EXISTS public.game_bonus_score CASCADE;
DROP TABLE IF EXISTS public.game_champion_pick CASCADE;
DROP TABLE IF EXISTS public.game_entry CASCADE;
DROP TABLE IF EXISTS public.game_entry_total CASCADE;
DROP TABLE IF EXISTS public.game_joker CASCADE;
DROP TABLE IF EXISTS public.game_league CASCADE;
DROP TABLE IF EXISTS public.game_league_event CASCADE;
DROP TABLE IF EXISTS public.game_league_join_attempt CASCADE;
DROP TABLE IF EXISTS public.game_league_member CASCADE;
DROP TABLE IF EXISTS public.game_notification_log CASCADE;
DROP TABLE IF EXISTS public.game_pick_score CASCADE;
DROP TABLE IF EXISTS public.game_push_config CASCADE;
DROP TABLE IF EXISTS public.game_race_award CASCADE;
DROP TABLE IF EXISTS public.game_race_pick CASCADE;
DROP TABLE IF EXISTS public.game_rank_snapshot CASCADE;
DROP TABLE IF EXISTS public.game_season CASCADE;

-- ---------------------------------------------------------------------------
-- 4) Functions: auth helpers + every game RPC/trigger helper.
-- Name-based (regprocedure) so overloads and multi-line signatures all go;
-- the auth.users triggers above are already gone, so CASCADE cannot reach
-- outside public.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'handle_new_user',
        'notify_slack_signup',
        'store_signup_webhook',
        '_game_audit',
        '_game_check_join_rate',
        '_game_league_member_event',
        '_game_race_award_event',
        'activate_player',
        'admin_broadcast',
        'admin_delete_announcement',
        'admin_game_stats',
        'admin_list_leagues',
        'admin_list_players',
        'admin_post_announcement',
        'admin_regrade',
        'admin_update_season',
        'can_view_league',
        'create_league',
        'game_champion_is_editable',
        'game_notify',
        'game_pick_is_editable',
        'game_push_tick',
        'get_announcements',
        'get_game_schedule',
        'get_global_percentile',
        'get_h2h',
        'get_league_activity',
        'get_league_alltime',
        'get_league_invite_preview',
        'get_league_members',
        'get_league_rank_history',
        'get_league_round_awards',
        'get_league_standings',
        'get_league_stats',
        'get_my_joker',
        'get_my_leagues',
        'get_player_badges',
        'get_public_league_preview',
        'get_public_profiles',
        'get_round_reveal',
        'get_season_drivers',
        'is_game_admin',
        'is_league_captain',
        'join_league_by_code',
        'join_public_league',
        'leave_league',
        'list_public_leagues',
        'open_season',
        'recalc_game_scores',
        'refresh_league_snapshots_and_awards',
        'remove_league_member',
        'rotate_invite_code',
        'save_champion_pick',
        'save_race_pick',
        'set_joker',
        'update_league',
        'update_league_identity',
        'weekend_deadline'
      )
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 5) Request queues go anonymous (Deep-Dive chart/telemetry requests must
-- keep working with zero login).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "chart_requests_insert" ON public.f1_chart_requests;
CREATE POLICY "chart_requests_insert" ON public.f1_chart_requests
  FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "telemetry_requests_insert" ON public.f1_telemetry_requests;
CREATE POLICY "telemetry_requests_insert" ON public.f1_telemetry_requests
  FOR INSERT TO anon, authenticated WITH CHECK (true);
