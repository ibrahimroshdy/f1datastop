-- ============================================================================
-- Re-pin search_path on get_schedule() (lost by the 20261011145915 backport).
-- The backport's CREATE OR REPLACE reset the ALTER ... SET search_path from
-- the baseline §9 hardening; prod's pg_proc.proconfig is NULL today, which
-- trips the Supabase function_search_path_mutable linter. Idempotent.
-- Apply with `supabase db push` (or paste into the dashboard SQL
-- editor). Fresh DBs are covered by the ALTER appended to the backport file.
-- ============================================================================

ALTER FUNCTION public.get_schedule(int) SET search_path = public, pg_temp;
