-- ============================================================================
-- f1datastop — SCHEDULING (pg_cron + pg_net)
-- ============================================================================
-- Drives the f1-ingest edge function on two cadences:
--   (A) steady-state new-data fetch  — every 6h, current-season sync
--   (B) post-session retry-until-available poll — every 15m, weekend-gated
--
-- This migration OWNS the cron jobs. It supersedes the minimal inline cron
-- block authored in 20260624120000_f1_warehouse.sql: it unschedules the old
-- jobnames (f1_warehouse_sync / f1_warehouse_race_poll) and the new ones, then
-- (re)schedules the canonical jobs below. Re-applying is fully idempotent.
--
-- Depends on (already created in 20260624120000_f1_warehouse.sql):
--   - extensions pg_cron + pg_net
--   - public.f1_sync_state  (the coverage/freshness ledger)
--   - public.f1_session     (date_start/date_end — used for weekend self-gating)
--   - an edge function `f1-ingest` deployed and reachable at functions_base
--
-- DB CONFIG REQUIRED (set once per environment, NOT committed; never against
-- prod by this agent). These two GUCs tell the SQL where the function lives and
-- how to authenticate. pg_cron jobs run as the table owner with no JWT, so we
-- pass the service-role key explicitly to f1-ingest (verify_jwt is true for it):
--
--   ALTER DATABASE postgres
--     SET app.settings.functions_base    = 'https://<ref>.functions.supabase.co';
--   ALTER DATABASE postgres
--     SET app.settings.service_role_key   = '<SERVICE_ROLE_JWT>';
--
-- For the LOCAL stack (supabase start), functions_base is typically
--   http://127.0.0.1:54321/functions/v1  and the local service-role key is
-- printed by `supabase status`. Apply this migration LOCAL only; the user ships
-- to prod and sets the GUCs there.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ---------------------------------------------------------------------------
-- Helper: resolve config with a safe fallback so the migration applies even
-- before the GUCs are set (the http_post will then no-op-fail loudly into
-- net._http_response rather than erroring the cron tick).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f1_cron_setting(p_key text, p_fallback text DEFAULT '')
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog
AS $$
  SELECT COALESCE(current_setting(p_key, true), p_fallback);
$$;
COMMENT ON FUNCTION public.f1_cron_setting(text, text) IS
  'Reads a DB GUC (e.g. app.settings.functions_base) with a missing-safe fallback for cron jobs.';

-- ---------------------------------------------------------------------------
-- Helper: are we inside (or near) a race-weekend window?
-- The poller self-gates to weekend windows so it is a no-op most of the week.
-- "Near a session" = any f1_session for the current season whose scheduled
-- start is within [-2h, +48h] of now (covers the multi-hour Jolpica lag after
-- a session ends). Uses date_start when known, else scheduled_date 00:00 UTC.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f1_in_weekend_window()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.f1_session s
    WHERE s.season = EXTRACT(YEAR FROM now())::int
      AND COALESCE(
            s.date_start,
            (s.scheduled_date::timestamptz)
          ) BETWEEN (now() - interval '2 hours')
                AND (now() + interval '48 hours')
  );
$$;
COMMENT ON FUNCTION public.f1_in_weekend_window() IS
  'True when any current-season session start is within [-2h,+48h] of now; gates the post-session poller.';

-- ---------------------------------------------------------------------------
-- Helper: is there outstanding poll work? (rows the poller would retry)
-- Avoids firing an HTTP request when there is nothing pending/partial due.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f1_has_pending_sync()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.f1_sync_state ss
    WHERE ss.season = EXTRACT(YEAR FROM now())::int
      AND ss.status IN ('pending','partial')
      AND (ss.next_retry_at IS NULL OR ss.next_retry_at <= now())
  );
$$;
COMMENT ON FUNCTION public.f1_has_pending_sync() IS
  'True when current-season sync_state has pending/partial rows due for retry.';

-- ---------------------------------------------------------------------------
-- The invocation primitive: POST f1-ingest with a JSON body, authenticated
-- with the service-role key. Returns the pg_net request id (fire-and-forget;
-- the response lands in net._http_response). SECURITY DEFINER so the cron
-- owner can read the service_role GUC; EXECUTE locked to the table owner.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f1_invoke_ingest(p_body jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_base text := public.f1_cron_setting('app.settings.functions_base');
  v_key  text := public.f1_cron_setting('app.settings.service_role_key');
  v_req  bigint;
BEGIN
  IF v_base = '' THEN
    RAISE WARNING 'f1_invoke_ingest: app.settings.functions_base not set; skipping ingest %', p_body;
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url     := v_base || '/f1-ingest',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || v_key
               ),
    body    := p_body,
    timeout_milliseconds := 55000
  ) INTO v_req;

  RETURN v_req;
END;
$$;
COMMENT ON FUNCTION public.f1_invoke_ingest(jsonb) IS
  'Fire-and-forget POST to the f1-ingest edge function with the service-role key; returns pg_net request id.';

REVOKE ALL ON FUNCTION public.f1_invoke_ingest(jsonb) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Job body (A): steady-state sync — refresh schedule + volatile standings +
-- any completed-but-not-'complete' rounds for the CURRENT season. Idempotent
-- on the f1-ingest side (complete durable rounds are skipped via sync_state).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f1_cron_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  PERFORM public.f1_invoke_ingest(
    jsonb_build_object(
      'mode',   'sync',
      'season', EXTRACT(YEAR FROM now())::int
    )
  );
END;
$$;
COMMENT ON FUNCTION public.f1_cron_sync() IS
  'Cron entrypoint (A): current-season steady-state sync via f1-ingest.';

-- ---------------------------------------------------------------------------
-- Job body (B): post-session poller — only fires HTTP when we are in a
-- weekend window AND there is pending/partial work due. This keeps the 15-min
-- tick a cheap in-DB no-op for the ~95% of the week with nothing to do.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f1_cron_race_poll()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT public.f1_in_weekend_window() THEN
    RETURN;  -- not a race weekend; no-op
  END IF;

  IF NOT public.f1_has_pending_sync() THEN
    RETURN;  -- weekend, but everything already complete/empty; no-op
  END IF;

  PERFORM public.f1_invoke_ingest(
    jsonb_build_object(
      'mode',   'poll',
      'season', EXTRACT(YEAR FROM now())::int
    )
  );
END;
$$;
COMMENT ON FUNCTION public.f1_cron_race_poll() IS
  'Cron entrypoint (B): weekend-gated retry-until-available poller via f1-ingest.';

-- ---------------------------------------------------------------------------
-- (Re)schedule — idempotent. Unschedule any prior jobnames (the inline
-- warehouse ones AND the canonical ones) before scheduling, so re-applying
-- this migration never duplicates jobs.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  j text;
BEGIN
  FOREACH j IN ARRAY ARRAY[
    'f1_warehouse_sync',        -- legacy inline (warehouse migration)
    'f1_warehouse_race_poll',   -- legacy inline (warehouse migration)
    'f1_ingest_sync',           -- canonical
    'f1_ingest_race_poll'       -- canonical
  ] LOOP
    PERFORM cron.unschedule(j) WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = j);
  END LOOP;
END $$;

-- (A) every 6 hours, on the hour
SELECT cron.schedule(
  'f1_ingest_sync',
  '0 */6 * * *',
  $cron$ SELECT public.f1_cron_sync(); $cron$
);

-- (B) every 15 minutes (self-gated to weekend windows inside the function)
SELECT cron.schedule(
  'f1_ingest_race_poll',
  '*/15 * * * *',
  $cron$ SELECT public.f1_cron_race_poll(); $cron$
);

-- ---------------------------------------------------------------------------
-- Convenience: inspect scheduled jobs + recent runs
--   SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
--   SELECT j.jobname, r.status, r.start_time, r.return_message
--     FROM cron.job_run_details r JOIN cron.job j USING (jobid)
--     WHERE j.jobname LIKE 'f1_ingest%' ORDER BY r.start_time DESC LIMIT 20;
-- Inspect the HTTP responses pg_net stored:
--   SELECT id, status_code, created FROM net._http_response ORDER BY created DESC LIMIT 20;
-- ---------------------------------------------------------------------------

-- ============================================================================
-- END — apply LOCAL only; user ships to prod + sets the two app.settings GUCs.
-- ============================================================================
