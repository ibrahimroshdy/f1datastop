-- Clock robustness for the pg_cron -> GitHub Actions dispatcher (follows 20261012130000).
--  1. The 5-minute queue tick dispatches only when a request row needs work.
--  2. Distinct start minutes so the jobs never collide in a shared concurrency group.
--  3. f1_dispatch_workflow pins search_path to pg_catalog, pg_temp (every object it uses is
--     schema-qualified: vault.decrypted_secrets, net.http_post).
--  4. f1_dispatch_health(): lets the daily digest see failed dispatches (a dead token would
--     otherwise stop everything silently).
-- Idempotent: CREATE OR REPLACE, and cron.schedule() upserts by job name. UTC schedules.

-- 1. Generic dispatcher: same body, tighter search_path ---------------------------------
CREATE OR REPLACE FUNCTION public.f1_dispatch_workflow(p_workflow text, p_inputs jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_token text;
  v_repo  text;
  v_body  jsonb;
BEGIN
  IF p_workflow IS NULL OR p_workflow !~ '^[A-Za-z0-9_.-]+\.ya?ml$' THEN
    RAISE WARNING 'f1_dispatch_workflow: workflow must be a file name like queue.yml; skipping';
    RETURN;
  END IF;

  SELECT decrypted_secret INTO v_token
    FROM vault.decrypted_secrets
   WHERE name = 'github_actions_dispatch_token'
   LIMIT 1;
  IF v_token IS NULL OR v_token = '' THEN
    RAISE LOG 'f1_dispatch_workflow: no github_actions_dispatch_token in Vault; skipping';
    RETURN;
  END IF;

  SELECT decrypted_secret INTO v_repo
    FROM vault.decrypted_secrets
   WHERE name = 'github_actions_dispatch_repo'
   LIMIT 1;
  v_repo := coalesce(nullif(btrim(v_repo), ''), 'ibrahimroshdy/f1datastop');
  IF v_repo !~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$' THEN
    RAISE WARNING 'f1_dispatch_workflow: github_actions_dispatch_repo is not owner/repo; skipping';
    RETURN;
  END IF;

  v_body := jsonb_build_object('ref', 'main');
  IF p_inputs IS NOT NULL AND p_inputs <> '{}'::jsonb THEN
    v_body := v_body || jsonb_build_object('inputs', p_inputs);
  END IF;

  PERFORM net.http_post(
    url     := 'https://api.github.com/repos/' || v_repo || '/actions/workflows/' || p_workflow || '/dispatches',
    body    := v_body,
    headers := jsonb_build_object(
      'Accept',               'application/vnd.github+json',
      'Authorization',        'Bearer ' || v_token,
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent',           'f1datastop-workflow-dispatch',
      'Content-Type',         'application/json'
    ),
    timeout_milliseconds := 5000
  );
EXCEPTION WHEN OTHERS THEN
  -- Never let dispatch break the caller. The message cannot contain the token.
  RAISE WARNING 'f1_dispatch_workflow failed: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.f1_dispatch_workflow(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.f1_dispatch_workflow(text, jsonb) TO service_role;

-- 1b. The request-trigger path (20261012120000 / 20261012130000) gets the same pinned search_path.
-- Both bodies only call schema-qualified functions (public.f1_dispatch_workflow,
-- public.f1_dispatch_queue), so no body change is needed. ALTER is idempotent.
ALTER FUNCTION public.f1_dispatch_queue() SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION public.f1_dispatch_queue_trg() SET search_path = pg_catalog, pg_temp;

-- 2. Queue tick only when a request needs work -------------------------------------------
-- Needs work = a `pending` row, or a `processing` row not touched for 30 minutes (a stuck run).
CREATE OR REPLACE FUNCTION public.f1_dispatch_queue_if_needed()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF EXISTS (
       SELECT 1 FROM public.f1_chart_requests
        WHERE status = 'pending'
           OR (status = 'processing' AND updated_at < now() - interval '30 minutes')
     )
     OR EXISTS (
       SELECT 1 FROM public.f1_telemetry_requests
        WHERE status = 'pending'
           OR (status = 'processing' AND updated_at < now() - interval '30 minutes')
     )
  THEN
    PERFORM public.f1_dispatch_workflow('queue.yml', '{}'::jsonb);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'f1_dispatch_queue_if_needed failed: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.f1_dispatch_queue_if_needed() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.f1_dispatch_queue_if_needed() TO service_role;

-- 3. Dispatch health for the digest --------------------------------------------------------
-- pg_net keeps responses only for pg_net.ttl (6 hours on Supabase), so the response window is
-- least(p_hours, ttl) and is reported as window_hours. Only GitHub's responses are counted
-- (the `server: github.com` header; a timed-out request has no headers and is counted too).
-- Why a header: net._http_response has no URL column, and net.http_request_queue (which has
-- one) deletes a row once it is processed, so pg_net keeps no URL for a finished request.
-- If GitHub ever changed that header, its responses would stop matching: the Dispatch line then
-- shows 0 dispatches, which the digest turns into a warning when the last successful reconcile
-- is also stale, and the backup clock covers a dead clock. The header filter also keeps any
-- other pg_net caller's responses out of the count.
-- Failed cron runs come from cron.job_run_details, which keeps the full p_hours.
CREATE OR REPLACE FUNCTION public.f1_dispatch_health(p_hours int DEFAULT 24)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_ttl      interval := coalesce(nullif(current_setting('pg_net.ttl', true), '')::interval, interval '6 hours');
  v_window   interval := least(make_interval(hours => greatest(coalesce(p_hours, 24), 1)), v_ttl);
  v_total    int;
  v_bad      int;
  v_bad_code int;
  v_last_ok  timestamptz;
  v_cron_bad int;
BEGIN
  SELECT count(*),
         count(*) FILTER (WHERE NOT (status_code BETWEEN 200 AND 299) OR status_code IS NULL),
         max(created) FILTER (WHERE status_code BETWEEN 200 AND 299)
    INTO v_total, v_bad, v_last_ok
    FROM net._http_response
   WHERE created >= now() - v_window
     AND (headers IS NULL OR headers->>'server' = 'github.com');

  SELECT status_code INTO v_bad_code
    FROM net._http_response
   WHERE created >= now() - v_window
     AND (headers IS NULL OR headers->>'server' = 'github.com')
     AND (status_code IS NULL OR NOT (status_code BETWEEN 200 AND 299))
   ORDER BY created DESC
   LIMIT 1;

  SELECT count(*) INTO v_cron_bad
    FROM cron.job_run_details d
    JOIN cron.job j USING (jobid)
   WHERE j.jobname LIKE 'f1ds-%'
     AND d.status = 'failed'
     AND d.start_time >= now() - make_interval(hours => greatest(coalesce(p_hours, 24), 1));

  RETURN jsonb_build_object(
    'window_hours',       round(extract(epoch FROM v_window) / 3600.0, 2),
    'requested_hours',    greatest(coalesce(p_hours, 24), 1),
    'responses',          v_total,
    'non_2xx',            v_bad,
    'last_non_2xx_status', v_bad_code,
    'last_2xx_at',        v_last_ok,
    'failed_cron_runs',   v_cron_bad
  );
END;
$$;

REVOKE ALL ON FUNCTION public.f1_dispatch_health(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.f1_dispatch_health(int) TO service_role;

-- 4. Schedules (UTC). Distinct start minutes; cron.schedule() upserts by job name. ------------
SELECT cron.schedule('f1ds-queue', '*/5 * * * *',
  $cron$SELECT public.f1_dispatch_queue_if_needed()$cron$);

SELECT cron.schedule('f1ds-reconcile', '7 */6 * * *',
  $cron$SELECT public.f1_dispatch_workflow('pipeline.yml', '{"job":"reconcile"}')$cron$);

SELECT cron.schedule('f1ds-reconcile-race', '*/30 12,13,14,15,16,17,18,19,20,21 * * 5,6,0',
  $cron$SELECT public.f1_dispatch_workflow('pipeline.yml', '{"job":"reconcile","gate":"true"}')$cron$);

SELECT cron.schedule('f1ds-charts', '15 */2 * * 5,6,0',
  $cron$SELECT public.f1_dispatch_workflow('pipeline.yml', '{"job":"charts"}')$cron$);

SELECT cron.schedule('f1ds-assets', '25 6,12,18 * * 5,6,0',
  $cron$SELECT public.f1_dispatch_workflow('pipeline.yml', '{"job":"assets"}')$cron$);

SELECT cron.schedule('f1ds-digest', '17 7 * * *',
  $cron$SELECT public.f1_dispatch_workflow('pipeline.yml', '{"job":"digest"}')$cron$);
