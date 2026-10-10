-- =====================================================================
-- f1datastop — REVIEW-ONLY consolidated DB + auth-adjacent SQL migration
-- Produced by the 2026-07-10 audit swarm. Combines every db-schema +
-- rls-auth finding that has an SQL remedy.
--
-- STATUS: NOT APPLIED. For human review. Do NOT run as one transaction —
--   several statements (CREATE INDEX CONCURRENTLY) MUST run outside any
--   BEGIN/COMMIT block. Run the blocks in the order given. When approved,
--   move the chosen blocks into a real migration under supabase/migrations/.
--
-- OUT OF SCOPE HERE (Dashboard config / platform only — no SQL possible):
--   * Enable Auth leaked-password protection (HaveIBeenPwned).
--   * Reduce Auth OTP / email-link expiry to <= 3600s (e.g. 900).
--   * Upgrade Postgres (15.8.1.054 has outstanding security patches).
-- =====================================================================


-- ---------------------------------------------------------------------
-- BLOCK 1 — f1_sync_state: dedupe, then rebuild the NULL-defeated key.
-- RISK: the natural-key unique index currently enforces NOTHING (all 3975
--   rows have session_type IS NULL, so Postgres treats them all as distinct).
--   Dedupe delete is negligible on 3975 rows. If real logical duplicates
--   differ in payload, the keep-rule (latest updated_at) picks one
--   arbitrarily — REVIEW before running. NULLS NOT DISTINCT is chosen over
--   NOT NULL sentinels so the ingester needs no change.
-- NOTE: the CREATE INDEX CONCURRENTLY below MUST NOT be inside a txn block.
-- ---------------------------------------------------------------------

-- 1a) Deduplicate, keeping the most-recently-updated row per logical key.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY domain, season, COALESCE(round, -1), COALESCE(session_type, '')
           ORDER BY updated_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM public.f1_sync_state
)
DELETE FROM public.f1_sync_state s
USING ranked r
WHERE s.id = r.id AND r.rn > 1;

-- 1b) Rebuild the unique index so NULLs are treated as EQUAL (Postgres 15+).
DROP INDEX IF EXISTS public.f1_sync_state_natural_key;
CREATE UNIQUE INDEX CONCURRENTLY f1_sync_state_natural_key
  ON public.f1_sync_state (domain, season, round, session_type) NULLS NOT DISTINCT;


-- ---------------------------------------------------------------------
-- BLOCK 2 — Pin search_path on the two RPCs flagged mutable.
-- RISK: NONE. Metadata-only, instantaneous, no lock/downtime. Both are
--   SECURITY INVOKER STABLE SQL that already fully schema-qualify their
--   table references, so pinning is non-behavioral. get_circuit_detail is
--   anon/frontend-reachable — verify it still returns data after apply.
-- ---------------------------------------------------------------------
ALTER FUNCTION public.get_telemetry_index(integer, integer, text)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.get_circuit_detail(text)
  SET search_path = public, pg_temp;


-- ---------------------------------------------------------------------
-- BLOCK 3 — Document intent on RLS-on / no-policy backend tables.
--   Both are ingester / observability tables written via service_role
--   (which bypasses RLS); the implicit deny-all to anon/authenticated is
--   CORRECT and intentional.
-- RISK: LOW. service_role already bypasses RLS, so these policies change no
--   access — they only make intent explicit and silence the advisor. DO NOT
--   add a permissive anon policy: f1_sync_state.last_error and api_metrics
--   carry internal operational detail. VERIFY no anon/edge read path first.
-- ---------------------------------------------------------------------
CREATE POLICY "service_role_all_api_metrics" ON public.api_metrics
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_f1_sync_state" ON public.f1_sync_state
  FOR ALL TO service_role USING (true) WITH CHECK (true);
-- Optional documentation:
-- COMMENT ON TABLE public.api_metrics   IS 'internal metrics; RLS deny-all by design, written via service_role only';
-- COMMENT ON TABLE public.f1_sync_state IS 'ingestion state; RLS deny-all by design, written via service_role only';


-- ---------------------------------------------------------------------
-- BLOCK 4 — Storage: drop the broad listing policy on public bucket 'charts'.
-- RISK: LOW but VERIFY. The bucket is public, so direct getPublicUrl fetches
--   keep working WITHOUT this SELECT policy. Dropping it only removes the
--   ability to LIST/enumerate all object keys. BEFORE running: grep the
--   frontend for .storage.from('charts').list — if any code lists this
--   bucket it will stop returning rows. storage.objects is Supabase-managed;
--   apply as the owner via the SQL editor or the Storage policies UI.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS charts_public_read ON storage.objects;


-- ---------------------------------------------------------------------
-- BLOCK 5 — Add missing FK indexes (unindexed foreign keys).
-- RISK: Plain CREATE INDEX takes an ACCESS EXCLUSIVE lock (blocks writes).
--   f1_lap has 266,568 rows and is an ON DELETE CASCADE target, so its two
--   indexes MUST use CONCURRENTLY and MUST run OUTSIDE any transaction block.
--   The remaining tables are small (<7k rows) and lock only momentarily.
-- ---------------------------------------------------------------------

-- 5a) LARGE table — run each standalone, NOT inside a transaction:
CREATE INDEX CONCURRENTLY IF NOT EXISTS f1_lap_race_id_idx   ON public.f1_lap (race_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS f1_lap_driver_id_idx ON public.f1_lap (driver_id);

-- 5b) Small / medium tables — plain CREATE INDEX is fine (brief lock):
CREATE INDEX IF NOT EXISTS f1_pit_stop_race_id_idx                 ON public.f1_pit_stop (race_id);
CREATE INDEX IF NOT EXISTS f1_pit_stop_driver_id_idx               ON public.f1_pit_stop (driver_id);
CREATE INDEX IF NOT EXISTS f1_race_result_race_id_idx              ON public.f1_race_result (race_id);
CREATE INDEX IF NOT EXISTS f1_qualifying_result_race_id_idx        ON public.f1_qualifying_result (race_id);
CREATE INDEX IF NOT EXISTS f1_qualifying_result_driver_id_idx      ON public.f1_qualifying_result (driver_id);
CREATE INDEX IF NOT EXISTS f1_qualifying_result_constructor_id_idx ON public.f1_qualifying_result (constructor_id);
CREATE INDEX IF NOT EXISTS f1_sprint_result_race_id_idx            ON public.f1_sprint_result (race_id);
CREATE INDEX IF NOT EXISTS f1_sprint_result_driver_id_idx          ON public.f1_sprint_result (driver_id);
CREATE INDEX IF NOT EXISTS f1_sprint_result_constructor_id_idx     ON public.f1_sprint_result (constructor_id);
CREATE INDEX IF NOT EXISTS f1_session_race_id_idx                  ON public.f1_session (race_id);
CREATE INDEX IF NOT EXISTS f1_race_circuit_id_idx                  ON public.f1_race (circuit_id);
CREATE INDEX IF NOT EXISTS f1_driver_standing_driver_id_idx        ON public.f1_driver_standing (driver_id);
CREATE INDEX IF NOT EXISTS f1_driver_standing_constructor_id_idx   ON public.f1_driver_standing (constructor_id);
CREATE INDEX IF NOT EXISTS f1_constructor_standing_constructor_id_idx ON public.f1_constructor_standing (constructor_id);
CREATE INDEX IF NOT EXISTS f1_session_driver_ergast_driver_id_idx  ON public.f1_session_driver (ergast_driver_id);


-- ---------------------------------------------------------------------
-- BLOCK 6 — Relocate pg_net out of the public schema.
-- RISK: MANUAL REVIEW REQUIRED before running. ALTER EXTENSION SET SCHEMA
--   briefly locks the extension's objects, and ANY code/cron calling
--   net.http_get / net.http_post by UNQUALIFIED name will BREAK until
--   search_path or the call sites are updated. On Supabase, moving pg_net
--   can also interfere with realtime/webhooks if they depend on it.
--   AUDIT CALLERS FIRST, then decide.
-- ---------------------------------------------------------------------
-- SELECT jobname, command FROM cron.job WHERE command ILIKE '%net.http%';
-- CREATE SCHEMA IF NOT EXISTS extensions;
-- ALTER EXTENSION pg_net SET SCHEMA extensions;   -- run ONLY after caller audit


-- =====================================================================
-- End of consolidated review migration. Nothing above has been executed.
-- =====================================================================
