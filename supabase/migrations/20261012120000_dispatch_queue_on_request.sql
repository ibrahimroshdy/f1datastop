-- Start the Queue workflow from the database as soon as a request becomes pending.
-- GitHub's cron is best-effort (it fired about once in 13 hours), so each pending request
-- calls GitHub's "Create a workflow dispatch event" endpoint through pg_net:
--   POST https://api.github.com/repos/{owner}/{repo}/actions/workflows/queue.yml/dispatches
--   https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event
-- Dispatch is best-effort: no token, a pg_net error or GitHub being down never fails an
-- insert/update on the request tables; the */5 cron in queue.yml stays as a backstop.
--
-- Owner setup (the token is never stored in this repo), in the Supabase SQL editor:
--   select vault.create_secret('<fine-grained PAT, this repo, Actions: Read and write>',
--                              'github_actions_dispatch_token');
-- Optional, for forks:
--   select vault.create_secret('<owner>/<repo>', 'github_actions_dispatch_repo');
-- Without the token secret the dispatcher is a no-op. Idempotent; one transaction.

-- 1. pg_net (async HTTP). The catch-up migration dropped it while it was unused. ----
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Dispatcher ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f1_dispatch_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net, vault, pg_temp
AS $$
DECLARE
  v_token text;
  v_repo  text;
BEGIN
  SELECT decrypted_secret INTO v_token
    FROM vault.decrypted_secrets
   WHERE name = 'github_actions_dispatch_token'
   LIMIT 1;
  IF v_token IS NULL OR v_token = '' THEN
    RAISE LOG 'f1_dispatch_queue: no github_actions_dispatch_token in Vault; skipping';
    RETURN;
  END IF;

  SELECT decrypted_secret INTO v_repo
    FROM vault.decrypted_secrets
   WHERE name = 'github_actions_dispatch_repo'
   LIMIT 1;
  v_repo := coalesce(nullif(btrim(v_repo), ''), 'ibrahimroshdy/f1datastop');
  IF v_repo !~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$' THEN
    RAISE WARNING 'f1_dispatch_queue: github_actions_dispatch_repo is not owner/repo; skipping';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := 'https://api.github.com/repos/' || v_repo || '/actions/workflows/queue.yml/dispatches',
    body    := jsonb_build_object('ref', 'main'),
    headers := jsonb_build_object(
      'Accept',               'application/vnd.github+json',
      'Authorization',        'Bearer ' || v_token,
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent',           'f1datastop-queue-dispatch',
      'Content-Type',         'application/json'
    ),
    timeout_milliseconds := 5000
  );
EXCEPTION WHEN OTHERS THEN
  -- Never let dispatch break the caller. The message cannot contain the token.
  RAISE WARNING 'f1_dispatch_queue failed: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.f1_dispatch_queue() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.f1_dispatch_queue() TO service_role;

-- 3. Trigger function (SECURITY DEFINER: anon inserts fire it, anon cannot call the dispatcher)
CREATE OR REPLACE FUNCTION public.f1_dispatch_queue_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  BEGIN
    PERFORM public.f1_dispatch_queue();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'f1_dispatch_queue_trg failed: %', SQLERRM;
  END;
  RETURN NULL;
END;
$$;

-- A trigger fires without EXECUTE on its function, so nobody needs the grant.
REVOKE ALL ON FUNCTION public.f1_dispatch_queue_trg() FROM PUBLIC, anon, authenticated, service_role;

-- 4. Triggers: a new pending row, and the anon retry path (error -> pending) ----------
-- The BEFORE INSERT guard triggers (trg_f1_*_requests_guard) are untouched.
DROP TRIGGER IF EXISTS trg_f1_chart_requests_dispatch_ins ON public.f1_chart_requests;
CREATE TRIGGER trg_f1_chart_requests_dispatch_ins
  AFTER INSERT ON public.f1_chart_requests
  FOR EACH ROW WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION public.f1_dispatch_queue_trg();

DROP TRIGGER IF EXISTS trg_f1_chart_requests_dispatch_upd ON public.f1_chart_requests;
CREATE TRIGGER trg_f1_chart_requests_dispatch_upd
  AFTER UPDATE OF status ON public.f1_chart_requests
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'pending')
  EXECUTE FUNCTION public.f1_dispatch_queue_trg();

DROP TRIGGER IF EXISTS trg_f1_telemetry_requests_dispatch_ins ON public.f1_telemetry_requests;
CREATE TRIGGER trg_f1_telemetry_requests_dispatch_ins
  AFTER INSERT ON public.f1_telemetry_requests
  FOR EACH ROW WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION public.f1_dispatch_queue_trg();

DROP TRIGGER IF EXISTS trg_f1_telemetry_requests_dispatch_upd ON public.f1_telemetry_requests;
CREATE TRIGGER trg_f1_telemetry_requests_dispatch_upd
  AFTER UPDATE OF status ON public.f1_telemetry_requests
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'pending')
  EXECUTE FUNCTION public.f1_dispatch_queue_trg();
