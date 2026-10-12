-- Catch-up migration: bring the repo in line with production and harden the
-- public request queues. Idempotent; runs in one transaction (no CONCURRENTLY).

-- 1. FK-covering indexes that already exist in production --------------------
CREATE INDEX IF NOT EXISTS f1_circuit_geometry_circuit_id_idx   ON public.f1_circuit_geometry (circuit_id);
CREATE INDEX IF NOT EXISTS f1_lap_driver_id_idx                 ON public.f1_lap (driver_id);
CREATE INDEX IF NOT EXISTS f1_lap_race_id_idx                   ON public.f1_lap (race_id);
CREATE INDEX IF NOT EXISTS f1_overtake_overtaken_driver_id_idx  ON public.f1_overtake (overtaken_driver_id);
CREATE INDEX IF NOT EXISTS f1_overtake_overtaking_driver_id_idx ON public.f1_overtake (overtaking_driver_id);
CREATE INDEX IF NOT EXISTS f1_race_replay_circuit_id_idx        ON public.f1_race_replay (circuit_id);
CREATE INDEX IF NOT EXISTS f1_sync_state_season_idx             ON public.f1_sync_state (season);
CREATE INDEX IF NOT EXISTS f1_telemetry_index_driver_id_idx     ON public.f1_telemetry_index (driver_id);

-- 2. Baseline indexes that are not present in production ---------------------
DROP INDEX IF EXISTS public.f1_lap_season_round_idx;
DROP INDEX IF EXISTS public.f1_weather_session_idx;
DROP INDEX IF EXISTS public.f1_team_radio_session_idx;
DROP INDEX IF EXISTS public.f1_position_session_idx;

-- 3. Pin search_path on the remaining serving functions ----------------------
ALTER FUNCTION public.get_telemetry_index(integer, integer, text)  SET search_path = public, pg_temp;
ALTER FUNCTION public.get_circuit_detail(text)                     SET search_path = public, pg_temp;
ALTER FUNCTION public.get_race_replay(integer, integer, text)      SET search_path = public, pg_temp;
ALTER FUNCTION public.get_circuit_geometry(integer, integer)       SET search_path = public, pg_temp;
ALTER FUNCTION public.get_circuit_geometry_by_circuit(text, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_circuit_history(integer, integer)        SET search_path = public, pg_temp;
ALTER FUNCTION public.get_circuit_history_by_circuit(text)         SET search_path = public, pg_temp;

-- 4. pg_net is unused (no function, trigger or cron job calls net.http_*) ----
DROP EXTENSION IF EXISTS pg_net;

-- 5. Nobody but the service role may TRUNCATE ---------------------------------
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- 6. requested_by was an auth-era column; nothing reads or writes it ----------
ALTER TABLE public.f1_chart_requests     DROP COLUMN IF EXISTS requested_by;
ALTER TABLE public.f1_telemetry_requests DROP COLUMN IF EXISTS requested_by;

-- 7. Request-queue hardening ----------------------------------------------------
-- Mirrors analysis/process_chart_requests.py and analysis/process_telemetry_requests.py.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'f1_chart_requests_valid'
                 AND conrelid = 'public.f1_chart_requests'::regclass) THEN
    ALTER TABLE public.f1_chart_requests ADD CONSTRAINT f1_chart_requests_valid CHECK (
      season BETWEEN 1950 AND 2100
      AND round BETWEEN 1 AND 30
      AND session IN ('FP1','FP2','FP3','Q','SQ','SS','S','R')
      AND format IN ('landscape','twitter','instagram','story','both','all')
      AND theme IN ('dark','light','all')
    ) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'f1_telemetry_requests_valid'
                 AND conrelid = 'public.f1_telemetry_requests'::regclass) THEN
    ALTER TABLE public.f1_telemetry_requests ADD CONSTRAINT f1_telemetry_requests_valid CHECK (
      season BETWEEN 1950 AND 2100
      AND round BETWEEN 1 AND 30
      AND session IN ('FP1','FP2','FP3','Q','SQ','SS','S','R')
      AND driver ~ '^[A-Z]{3}$'
      AND lap_number BETWEEN 0 AND 200
    ) NOT VALID;
  END IF;
END $$;
ALTER TABLE public.f1_chart_requests     VALIDATE CONSTRAINT f1_chart_requests_valid;
ALTER TABLE public.f1_telemetry_requests VALIDATE CONSTRAINT f1_telemetry_requests_valid;

-- Bound abuse: refuse new rows while the queue already holds >= 500 pending.
CREATE OR REPLACE FUNCTION public.f1_request_queue_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  n bigint;
BEGIN
  EXECUTE format('SELECT count(*) FROM public.%I WHERE status = ''pending''', TG_TABLE_NAME) INTO n;
  IF n >= 500 THEN
    RAISE EXCEPTION 'request queue full (% pending)', n USING ERRCODE = '53400';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.f1_request_queue_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_f1_chart_requests_guard ON public.f1_chart_requests;
CREATE TRIGGER trg_f1_chart_requests_guard BEFORE INSERT ON public.f1_chart_requests
  FOR EACH ROW EXECUTE FUNCTION public.f1_request_queue_guard();
DROP TRIGGER IF EXISTS trg_f1_telemetry_requests_guard ON public.f1_telemetry_requests;
CREATE TRIGGER trg_f1_telemetry_requests_guard BEFORE INSERT ON public.f1_telemetry_requests
  FOR EACH ROW EXECUTE FUNCTION public.f1_request_queue_guard();

-- 8. Column-level UPDATE: clients only re-queue a failed row (status/error/updated_at) ----
REVOKE UPDATE ON public.f1_chart_requests, public.f1_telemetry_requests FROM anon, authenticated;
GRANT UPDATE (status, error, updated_at) ON public.f1_chart_requests     TO anon, authenticated;
GRANT UPDATE (status, error, updated_at) ON public.f1_telemetry_requests TO anon, authenticated;

-- 9. drivers[] validation, mirroring process_chart_requests.py: each non-blank element,
--    stripped and upper-cased, must match ^[A-Z]{3}$ (the worker has no count limit).
CREATE OR REPLACE FUNCTION public.f1_valid_driver_codes(codes text[])
RETURNS boolean LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM unnest(codes) AS d
    WHERE btrim(d) <> '' AND upper(btrim(d)) !~ '^[A-Z]{3}$'
  );
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'f1_chart_requests_drivers_valid'
                 AND conrelid = 'public.f1_chart_requests'::regclass) THEN
    ALTER TABLE public.f1_chart_requests ADD CONSTRAINT f1_chart_requests_drivers_valid
      CHECK (public.f1_valid_driver_codes(drivers)) NOT VALID;
  END IF;
END $$;
ALTER TABLE public.f1_chart_requests VALIDATE CONSTRAINT f1_chart_requests_drivers_valid;
