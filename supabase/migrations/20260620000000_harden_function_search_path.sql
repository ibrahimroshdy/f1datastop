-- Phase 0.7: fix Supabase security advisors on functions.
-- Pin search_path (was mutable) and stop anon/authenticated from invoking the
-- trigger-only function via RPC. Triggers still fire regardless of EXECUTE grant.
-- Applied to remote project envqfquhkcbnitwlzepx on 2026-06-20.
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
