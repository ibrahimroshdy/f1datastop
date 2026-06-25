-- ============================================================================
-- F1 DATA WAREHOUSE — canonical schema
-- Apply to LOCAL stack only (supabase db reset). User ships to prod.
-- Conventions: text/int natural keys, update_updated_at_column() trigger,
-- public-read RLS, service-role-only writes (edge functions bypass RLS).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ---------------------------------------------------------------------------
-- DIMENSIONS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.f1_season (
  year        int PRIMARY KEY,
  has_results boolean NOT NULL DEFAULT false,
  race_count  int,
  source      text NOT NULL DEFAULT 'ergast',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.f1_circuit (
  circuit_id          text PRIMARY KEY,            -- Ergast circuitId
  name                text NOT NULL,
  locality            text,
  country             text,
  lat                 numeric,
  lng                 numeric,
  openf1_circuit_key  int,                          -- OpenF1 crosswalk (nullable)
  url                 text,
  source              text NOT NULL DEFAULT 'ergast',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS f1_circuit_openf1_key_idx ON public.f1_circuit (openf1_circuit_key);

-- ---------------------------------------------------------------------------
-- EVENT / SESSION SPINE
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.f1_race (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  season              int  NOT NULL REFERENCES public.f1_season (year),
  round               int  NOT NULL,
  race_name           text NOT NULL,
  circuit_id          text REFERENCES public.f1_circuit (circuit_id),
  date                date,
  time                text,
  url                 text,
  openf1_meeting_key  int,
  sprint_weekend      boolean NOT NULL DEFAULT false,
  source              text NOT NULL DEFAULT 'ergast',
  raw                 jsonb,
  ingested_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT f1_race_season_round_key UNIQUE (season, round)
);
CREATE INDEX IF NOT EXISTS f1_race_season_idx ON public.f1_race (season);
CREATE INDEX IF NOT EXISTS f1_race_meeting_key_idx ON public.f1_race (openf1_meeting_key);

CREATE TABLE IF NOT EXISTS public.f1_session (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  race_id             bigint REFERENCES public.f1_race (id) ON DELETE CASCADE,
  season              int  NOT NULL,
  round               int  NOT NULL,
  session_type        text NOT NULL CHECK (session_type IN ('FP1','FP2','FP3','Q','SQ','SS','S','R')),
  session_name        text,
  scheduled_date      date,
  scheduled_time      text,
  date_start          timestamptz,
  date_end            timestamptz,
  openf1_session_key  int UNIQUE,
  openf1_meeting_key  int,
  source              text NOT NULL DEFAULT 'ergast',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT f1_session_natural_key UNIQUE (season, round, session_type)
);
CREATE INDEX IF NOT EXISTS f1_session_season_round_idx ON public.f1_session (season, round);
CREATE INDEX IF NOT EXISTS f1_session_openf1_key_idx ON public.f1_session (openf1_session_key);

-- ---------------------------------------------------------------------------
-- ERGAST FACTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.f1_race_result (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  race_id               bigint REFERENCES public.f1_race (id) ON DELETE CASCADE,
  season                int  NOT NULL,
  round                 int  NOT NULL,
  driver_id             text NOT NULL REFERENCES public.f1_driver (ergast_id),
  constructor_id        text REFERENCES public.f1_constructor (ergast_id),
  car_number            int,
  position              int,
  position_text         text,
  points                numeric,
  grid                  int,
  laps                  int,
  status                text,                    -- verbatim Ergast status
  is_dnf                boolean,                  -- derived at ingest
  time_millis           bigint,
  time_text             text,
  fastest_lap_rank      int,
  fastest_lap_number    int,
  fastest_lap_time      text,
  fastest_lap_avg_speed numeric,
  fastest_lap_speed_units text,
  source                text NOT NULL DEFAULT 'ergast',
  raw                   jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT f1_race_result_natural_key UNIQUE (season, round, driver_id)
);
CREATE INDEX IF NOT EXISTS f1_race_result_season_round_idx ON public.f1_race_result (season, round);
CREATE INDEX IF NOT EXISTS f1_race_result_driver_idx ON public.f1_race_result (driver_id);
CREATE INDEX IF NOT EXISTS f1_race_result_constructor_idx ON public.f1_race_result (constructor_id);

CREATE TABLE IF NOT EXISTS public.f1_qualifying_result (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  race_id         bigint REFERENCES public.f1_race (id) ON DELETE CASCADE,
  season          int  NOT NULL,
  round           int  NOT NULL,
  driver_id       text NOT NULL REFERENCES public.f1_driver (ergast_id),
  constructor_id  text REFERENCES public.f1_constructor (ergast_id),
  car_number      int,
  position        int,
  q1              text,
  q2              text,
  q3              text,
  source          text NOT NULL DEFAULT 'ergast',
  raw             jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT f1_qualifying_result_natural_key UNIQUE (season, round, driver_id)
);
CREATE INDEX IF NOT EXISTS f1_qualifying_season_round_idx ON public.f1_qualifying_result (season, round);

CREATE TABLE IF NOT EXISTS public.f1_sprint_result (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  race_id               bigint REFERENCES public.f1_race (id) ON DELETE CASCADE,
  season                int  NOT NULL,
  round                 int  NOT NULL,
  driver_id             text NOT NULL REFERENCES public.f1_driver (ergast_id),
  constructor_id        text REFERENCES public.f1_constructor (ergast_id),
  car_number            int,
  position              int,
  position_text         text,
  points                numeric,
  grid                  int,
  laps                  int,
  status                text,
  is_dnf                boolean,
  time_millis           bigint,
  time_text             text,
  fastest_lap_number    int,
  fastest_lap_time      text,
  source                text NOT NULL DEFAULT 'ergast',
  raw                   jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT f1_sprint_result_natural_key UNIQUE (season, round, driver_id)
);
CREATE INDEX IF NOT EXISTS f1_sprint_season_round_idx ON public.f1_sprint_result (season, round);

CREATE TABLE IF NOT EXISTS public.f1_pit_stop (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  race_id          bigint REFERENCES public.f1_race (id) ON DELETE CASCADE,
  season           int  NOT NULL,
  round            int  NOT NULL,
  driver_id        text NOT NULL REFERENCES public.f1_driver (ergast_id),
  stop             int  NOT NULL,
  lap              int,
  time_local       text,
  duration_seconds numeric,
  source           text NOT NULL DEFAULT 'ergast',
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT f1_pit_stop_natural_key UNIQUE (season, round, driver_id, stop)
);
CREATE INDEX IF NOT EXISTS f1_pit_stop_season_round_idx ON public.f1_pit_stop (season, round);

CREATE TABLE IF NOT EXISTS public.f1_lap (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  race_id     bigint REFERENCES public.f1_race (id) ON DELETE CASCADE,
  season      int  NOT NULL,
  round       int  NOT NULL,
  lap_number  int  NOT NULL,
  driver_id   text NOT NULL REFERENCES public.f1_driver (ergast_id),
  position    int,
  time_text   text,
  time_millis bigint,
  source      text NOT NULL DEFAULT 'ergast',
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT f1_lap_natural_key UNIQUE (season, round, lap_number, driver_id)
);
CREATE INDEX IF NOT EXISTS f1_lap_season_round_idx ON public.f1_lap (season, round);
CREATE INDEX IF NOT EXISTS f1_lap_season_round_lapno_idx ON public.f1_lap (season, round, lap_number);

CREATE TABLE IF NOT EXISTS public.f1_driver_standing (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  season         int  NOT NULL,
  round          int  NOT NULL,
  driver_id      text NOT NULL REFERENCES public.f1_driver (ergast_id),
  constructor_id text REFERENCES public.f1_constructor (ergast_id),
  position       int,
  position_text  text,
  points         numeric,
  wins           int,
  source         text NOT NULL DEFAULT 'ergast',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT f1_driver_standing_natural_key UNIQUE (season, round, driver_id)
);
CREATE INDEX IF NOT EXISTS f1_driver_standing_season_round_idx ON public.f1_driver_standing (season, round);

CREATE TABLE IF NOT EXISTS public.f1_constructor_standing (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  season         int  NOT NULL,
  round          int  NOT NULL,
  constructor_id text NOT NULL REFERENCES public.f1_constructor (ergast_id),
  position       int,
  position_text  text,
  points         numeric,
  wins           int,
  source         text NOT NULL DEFAULT 'ergast',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT f1_constructor_standing_natural_key UNIQUE (season, round, constructor_id)
);
CREATE INDEX IF NOT EXISTS f1_constructor_standing_season_round_idx ON public.f1_constructor_standing (season, round);

-- ---------------------------------------------------------------------------
-- OPENF1 FACTS (2023+; keyed by openf1_session_key + driver_number)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.f1_session_driver (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  openf1_session_key  int NOT NULL,
  driver_number       int NOT NULL,
  name_acronym        text,
  first_name          text,
  last_name           text,
  full_name           text,
  team_name           text,
  team_colour         text,
  headshot_url        text,
  country_code        text,
  ergast_driver_id    text REFERENCES public.f1_driver (ergast_id),
  source              text NOT NULL DEFAULT 'openf1',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT f1_session_driver_natural_key UNIQUE (openf1_session_key, driver_number)
);
CREATE INDEX IF NOT EXISTS f1_session_driver_session_idx ON public.f1_session_driver (openf1_session_key);

CREATE TABLE IF NOT EXISTS public.f1_weather (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  openf1_session_key int NOT NULL,
  date               timestamptz NOT NULL,
  air_temperature    numeric,
  track_temperature  numeric,
  humidity           numeric,
  pressure           numeric,
  wind_speed         numeric,
  wind_direction     int,
  rainfall           int,
  source             text NOT NULL DEFAULT 'openf1',
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT f1_weather_natural_key UNIQUE (openf1_session_key, date)
);
CREATE INDEX IF NOT EXISTS f1_weather_session_idx ON public.f1_weather (openf1_session_key);

CREATE TABLE IF NOT EXISTS public.f1_starting_grid (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  openf1_session_key int NOT NULL,
  position           int,
  driver_number      int NOT NULL,
  source             text NOT NULL DEFAULT 'openf1',
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT f1_starting_grid_natural_key UNIQUE (openf1_session_key, driver_number)
);

CREATE TABLE IF NOT EXISTS public.f1_overtake (
  id                        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  openf1_session_key        int NOT NULL,
  date                      timestamptz NOT NULL,
  overtaking_driver_number  int NOT NULL,
  overtaken_driver_number   int NOT NULL,
  position                  int,
  source                    text NOT NULL DEFAULT 'openf1',
  created_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT f1_overtake_natural_key UNIQUE (openf1_session_key, date, overtaking_driver_number, overtaken_driver_number)
);
CREATE INDEX IF NOT EXISTS f1_overtake_session_idx ON public.f1_overtake (openf1_session_key);

CREATE TABLE IF NOT EXISTS public.f1_team_radio (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  openf1_session_key int NOT NULL,
  driver_number      int NOT NULL,
  date               timestamptz NOT NULL,
  recording_url      text,
  source             text NOT NULL DEFAULT 'openf1',
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT f1_team_radio_natural_key UNIQUE (openf1_session_key, driver_number, date)
);
CREATE INDEX IF NOT EXISTS f1_team_radio_session_idx ON public.f1_team_radio (openf1_session_key);

CREATE TABLE IF NOT EXISTS public.f1_position (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  openf1_session_key int NOT NULL,
  driver_number      int NOT NULL,
  date               timestamptz NOT NULL,
  position           int,
  source             text NOT NULL DEFAULT 'openf1',
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT f1_position_natural_key UNIQUE (openf1_session_key, driver_number, date)
);
CREATE INDEX IF NOT EXISTS f1_position_session_idx ON public.f1_position (openf1_session_key);

-- ---------------------------------------------------------------------------
-- FASTF1 SUMMARY FACTS (driver_code crosswalks to f1_driver.code)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.f1_lap_summary (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  season       int  NOT NULL,
  round        int  NOT NULL,
  session_type text NOT NULL,
  driver_code  text NOT NULL,
  lap_number   int  NOT NULL,
  lap_time_ms  int,
  sector1_ms   int,
  sector2_ms   int,
  sector3_ms   int,
  compound     text,
  stint        int,
  tyre_life    int,
  position     int,
  is_pb        boolean,
  deleted      boolean,
  is_quicklap  boolean,
  speed_i1     numeric,
  speed_i2     numeric,
  speed_fl     numeric,
  speed_st     numeric,
  source       text NOT NULL DEFAULT 'fastf1',
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT f1_lap_summary_natural_key UNIQUE (season, round, session_type, driver_code, lap_number)
);
CREATE INDEX IF NOT EXISTS f1_lap_summary_session_idx ON public.f1_lap_summary (season, round, session_type);

CREATE TABLE IF NOT EXISTS public.f1_stint_summary (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  season        int  NOT NULL,
  round         int  NOT NULL,
  session_type  text NOT NULL,
  driver_code   text NOT NULL,
  stint         int  NOT NULL,
  compound      text,
  start_lap     int,
  end_lap       int,
  lap_count     int,
  avg_lap_ms    int,
  median_lap_ms int,
  source        text NOT NULL DEFAULT 'fastf1',
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT f1_stint_summary_natural_key UNIQUE (season, round, session_type, driver_code, stint)
);

CREATE TABLE IF NOT EXISTS public.f1_session_result_ff1 (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  season             int  NOT NULL,
  round              int  NOT NULL,
  session_type       text NOT NULL,
  driver_code        text NOT NULL,
  team               text,
  grid_position      int,
  finish_position    int,
  status             text,
  points             numeric,
  fastest_lap_ms     int,
  fastest_lap_number int,
  top_speed          numeric,
  source             text NOT NULL DEFAULT 'fastf1',
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT f1_session_result_ff1_natural_key UNIQUE (season, round, session_type, driver_code)
);

-- ---------------------------------------------------------------------------
-- INGESTION LEDGER / SYNC STATE
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.f1_sync_state (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  domain          text NOT NULL,
  season          int  NOT NULL,
  round           int,
  session_type    text,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','partial','complete','empty','error','not_applicable')),
  source          text,
  row_count       int  NOT NULL DEFAULT 0,
  expected_count  int,
  upstream_total  int,
  attempt_count   int  NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  next_retry_at   timestamptz,
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT f1_sync_state_natural_key UNIQUE (domain, season, round, session_type)
);
CREATE INDEX IF NOT EXISTS f1_sync_state_retry_idx  ON public.f1_sync_state (status, next_retry_at);
CREATE INDEX IF NOT EXISTS f1_sync_state_domain_idx ON public.f1_sync_state (domain, season);

-- ---------------------------------------------------------------------------
-- updated_at triggers (reuse shared public.update_updated_at_column())
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'f1_season','f1_circuit','f1_race','f1_session',
    'f1_race_result','f1_qualifying_result','f1_sprint_result',
    'f1_driver_standing','f1_constructor_standing',
    'f1_session_driver','f1_sync_state'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = t || '_updated_at') THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();',
        t || '_updated_at', t);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- RLS — public read on all warehouse tables; writes service-role only.
-- f1_sync_state is OPERATIONAL: no public policy (service-role only).
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'f1_season','f1_circuit','f1_race','f1_session',
    'f1_race_result','f1_qualifying_result','f1_sprint_result',
    'f1_pit_stop','f1_lap','f1_driver_standing','f1_constructor_standing',
    'f1_session_driver','f1_weather','f1_starting_grid','f1_overtake',
    'f1_team_radio','f1_position',
    'f1_lap_summary','f1_stint_summary','f1_session_result_ff1'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true);',
      t || '_public_read', t);
  END LOOP;
END $$;

ALTER TABLE public.f1_sync_state ENABLE ROW LEVEL SECURITY;
-- (no public policy on f1_sync_state — service-role only)

-- ============================================================================
-- SERVING VIEWS + RPCs (Ergast-envelope reassembly; SECURITY INVOKER)
-- ============================================================================

-- Season schedule -> MRData.RaceTable.Races[]
CREATE OR REPLACE VIEW public.f1_v_schedule AS
SELECT r.season,
       jsonb_agg(
         jsonb_build_object(
           'season', r.season::text,
           'round',  r.round::text,
           'raceName', r.race_name,
           'date',  to_char(r.date,'YYYY-MM-DD'),
           'time',  r.time,
           'Circuit', jsonb_build_object(
             'circuitId', c.circuit_id,
             'circuitName', c.name,
             'Location', jsonb_build_object(
               'lat', c.lat::text, 'long', c.lng::text,
               'locality', c.locality, 'country', c.country)),
           'sessions', (
             SELECT jsonb_object_agg(s.session_type,
               jsonb_build_object('date', to_char(s.scheduled_date,'YYYY-MM-DD'),
                                  'time', s.scheduled_time))
             FROM public.f1_session s WHERE s.race_id = r.id)
         ) ORDER BY r.round) AS races
FROM public.f1_race r
LEFT JOIN public.f1_circuit c ON c.circuit_id = r.circuit_id
GROUP BY r.season;
GRANT SELECT ON public.f1_v_schedule TO anon, authenticated;

-- get_laps(season,round) -> {Races:[{Laps:[{number,Timings[]}]}]}
CREATE OR REPLACE FUNCTION public.get_laps(p_season int, p_round int)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT jsonb_build_object('Races', jsonb_build_array(
    jsonb_build_object('season', p_season::text, 'round', p_round::text,
      'Laps', COALESCE((
        SELECT jsonb_agg(lap ORDER BY (lap->>'number')::int) FROM (
          SELECT jsonb_build_object(
            'number', l.lap_number::text,
            'Timings', jsonb_agg(
              jsonb_build_object('driverId', l.driver_id,
                                 'position', l.position::text,
                                 'time', l.time_text)
              ORDER BY l.position)
          ) AS lap
          FROM public.f1_lap l
          WHERE l.season = p_season AND l.round = p_round
          GROUP BY l.lap_number
        ) laps), '[]'::jsonb))));
$$;
GRANT EXECUTE ON FUNCTION public.get_laps(int,int) TO anon, authenticated;

-- get_race_results(season,round) -> Races[0].Results[] (raw-faithful when stored)
CREATE OR REPLACE FUNCTION public.get_race_results(p_season int, p_round int)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT COALESCE(jsonb_agg(rr.raw ORDER BY rr.position NULLS LAST), '[]'::jsonb)
  FROM public.f1_race_result rr
  WHERE rr.season = p_season AND rr.round = p_round AND rr.raw IS NOT NULL;
$$;
GRANT EXECUTE ON FUNCTION public.get_race_results(int,int) TO anon, authenticated;

-- NOTE: companion RPCs get_qualifying / get_sprint / get_pitstops /
-- get_driver_standings / get_constructor_standings follow the SAME
-- raw-faithful jsonb_agg pattern and are authored in the views migration.

-- ============================================================================
-- CRON (pg_cron + pg_net) — idempotent (re)schedule
-- ============================================================================
DO $$
BEGIN
  PERFORM cron.unschedule('f1_warehouse_sync')      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='f1_warehouse_sync');
  PERFORM cron.unschedule('f1_warehouse_race_poll') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='f1_warehouse_race_poll');
END $$;

-- Steady-state new-data fetch: every 6h, current-season sync.
SELECT cron.schedule('f1_warehouse_sync', '0 */6 * * *', $cron$
  SELECT net.http_post(
    url := current_setting('app.settings.functions_base') || '/f1-ingest',
    headers := jsonb_build_object('Content-Type','application/json',
                 'Authorization','Bearer ' || current_setting('app.settings.service_role_key')),
    body := jsonb_build_object('mode','sync','season', extract(year from now())::int));
$cron$);

-- Post-session poller: every 15m, retries pending/partial rows (self-gated to weekend windows).
SELECT cron.schedule('f1_warehouse_race_poll', '*/15 * * * *', $cron$
  SELECT net.http_post(
    url := current_setting('app.settings.functions_base') || '/f1-ingest',
    headers := jsonb_build_object('Content-Type','application/json',
                 'Authorization','Bearer ' || current_setting('app.settings.service_role_key')),
    body := jsonb_build_object('mode','poll','season', extract(year from now())::int));
$cron$);

-- ============================================================================
-- END — apply LOCAL only; user ships to prod.
-- ============================================================================
