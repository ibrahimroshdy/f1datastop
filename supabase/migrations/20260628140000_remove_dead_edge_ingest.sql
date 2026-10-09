-- ============================================================================
-- f1datastop — REMOVE the dead edge-ingest pipeline (analysis/ingest is the sole ingester)
-- ============================================================================
-- The edge `f1-ingest` + pg_cron path (added in 20260624130000_f1_cron.sql) never
-- ingested anything in production: it requires two DB GUCs
-- (app.settings.functions_base, app.settings.service_role_key) that were never
-- set, so f1_invoke_ingest() returned NULL before issuing the HTTP POST. The
-- cron ticks "succeeded" but were no-ops.
--
-- Canonical ingestion is now analysis/backfill.py: Jolpica core +
-- FastF1 laps + telemetry, writing the f1_* tables directly. The f1-proxy edge
-- function remains as the live read-cache/fallback for the frontend ONLY — it
-- is not an ingester.
--
-- This migration unschedules the dead cron jobs and drops their helper
-- functions. Idempotent. (The deployed `f1-ingest` edge function is now dormant
-- — no caller — and can be deleted from the dashboard; nothing references it.)
-- ============================================================================
do $$
declare j text;
begin
  foreach j in array array['f1_ingest_sync','f1_ingest_race_poll',
                           'f1_warehouse_sync','f1_warehouse_race_poll'] loop
    perform cron.unschedule(j) where exists (select 1 from cron.job where jobname = j);
  end loop;
end $$;

drop function if exists public.f1_cron_sync();
drop function if exists public.f1_cron_race_poll();
drop function if exists public.f1_invoke_ingest(jsonb);
drop function if exists public.f1_in_weekend_window();
drop function if exists public.f1_has_pending_sync();
drop function if exists public.f1_cron_setting(text, text);
