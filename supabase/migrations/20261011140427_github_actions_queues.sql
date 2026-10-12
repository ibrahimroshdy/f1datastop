-- ============================================================================
-- GitHub Actions request queues: drop CircleCI dispatch, narrow retry policy.
-- ============================================================================
-- Fresh DBs get this via the baseline + this file. Prod applies this file
-- only (never the baseline).
--
--   * Drops the CircleCI per-request dispatch triggers + dispatch_ci_request()
--     (pipeline moved to GitHub Actions; analysis/process_*_requests.py drain
--     the queues on a 5-minute cron in .github/workflows/pr-ci.yml).
--   * Adds a narrow anon/authenticated UPDATE policy on each request table so
--     the web client can retry a failed row (error -> pending) without a
--     login and without broad update rights.
--   * Tightens analysis_charts to SELECT-only for anon/authenticated
--     (writes are service-role only via the queue processors).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Drop CircleCI dispatch.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_dispatch_chart_request ON public.f1_chart_requests;
DROP TRIGGER IF EXISTS trg_dispatch_telemetry_request ON public.f1_telemetry_requests;
DROP FUNCTION IF EXISTS public.dispatch_ci_request();

-- ---------------------------------------------------------------------------
-- 2) Narrow retry policy: anon/authenticated may only flip error -> pending.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS f1_chart_requests_retry ON public.f1_chart_requests;
CREATE POLICY f1_chart_requests_retry ON public.f1_chart_requests FOR UPDATE TO anon, authenticated USING (status = 'error') WITH CHECK (status = 'pending');

DROP POLICY IF EXISTS f1_telemetry_requests_retry ON public.f1_telemetry_requests;
CREATE POLICY f1_telemetry_requests_retry ON public.f1_telemetry_requests FOR UPDATE TO anon, authenticated USING (status = 'error') WITH CHECK (status = 'pending');

-- ---------------------------------------------------------------------------
-- 3) Tighten analysis_charts: public read, service-role writes.
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.analysis_charts FROM anon, authenticated;
GRANT SELECT ON public.analysis_charts TO anon, authenticated;
