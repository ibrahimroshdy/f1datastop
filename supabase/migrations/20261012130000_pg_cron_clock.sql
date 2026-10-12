-- pg_cron becomes the clock for every scheduled GitHub workflow.
-- GitHub's `schedule` trigger is best-effort (the 5-minute queue fired about once in 13 hours),
-- so the schedules move into the database, which fires on time and costs nothing extra. Each
-- pg_cron entry calls public.f1_dispatch_workflow(), which POSTs GitHub's "Create a workflow
-- dispatch event" endpoint through pg_net:
--   POST https://api.github.com/repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches
--   https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event
--   body: {"ref": "main", "inputs": {<string values>}}
-- The `schedule:` blocks are removed from queue.yml / pipeline.yml, so there is one scheduler and
-- no double runs. Dispatch stays best-effort and never raises (no token = no-op).
--
-- Owner setup is unchanged from 20261012120000: the Vault secret
-- `github_actions_dispatch_token` (optional `github_actions_dispatch_repo` for forks).
-- Jobs are owned by the role that runs this migration (postgres on Supabase) and run with that
-- role's rights; it owns f1_dispatch_workflow and has EXECUTE on it.
-- Idempotent: cron.schedule() upserts by job name, so re-running updates the entries in place.
-- All schedules are UTC (pg_cron on Supabase runs on database time, which is UTC).
--
-- Pipeline inputs: `job` selects the job; `gate` ("true") makes reconcile ask reconcile_needed.py
-- before doing any work (the race-weekend 30-minute ticks); without it reconcile always runs
-- (the 6-hourly baseline).

-- 1. Generic dispatcher ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f1_dispatch_workflow(p_workflow text, p_inputs jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net, vault, pg_temp
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

-- 2. The request-trigger dispatcher becomes a thin wrapper (triggers keep working) -----
CREATE OR REPLACE FUNCTION public.f1_dispatch_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.f1_dispatch_workflow('queue.yml', '{}'::jsonb);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'f1_dispatch_queue failed: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.f1_dispatch_queue() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.f1_dispatch_queue() TO service_role;

-- 3. Schedules (UTC). One cron.schedule() per entry; names are f1ds-*. -----------------
SELECT cron.schedule('f1ds-queue', '*/5 * * * *',
  $cron$SELECT public.f1_dispatch_workflow('queue.yml')$cron$);

SELECT cron.schedule('f1ds-reconcile', '0 */6 * * *',
  $cron$SELECT public.f1_dispatch_workflow('pipeline.yml', '{"job":"reconcile"}')$cron$);

SELECT cron.schedule('f1ds-reconcile-race', '*/30 12,13,14,15,16,17,18,19,20,21 * * 5,6,0',
  $cron$SELECT public.f1_dispatch_workflow('pipeline.yml', '{"job":"reconcile","gate":"true"}')$cron$);

SELECT cron.schedule('f1ds-charts', '0 */2 * * 5,6,0',
  $cron$SELECT public.f1_dispatch_workflow('pipeline.yml', '{"job":"charts"}')$cron$);

SELECT cron.schedule('f1ds-assets', '0 6,12,18 * * 5,6,0',
  $cron$SELECT public.f1_dispatch_workflow('pipeline.yml', '{"job":"assets"}')$cron$);

SELECT cron.schedule('f1ds-digest', '17 7 * * *',
  $cron$SELECT public.f1_dispatch_workflow('pipeline.yml', '{"job":"digest"}')$cron$);
