-- ============================================================================
-- BASELINE — auth-free schema squash (2026-10-10 opensource revamp).
-- ============================================================================
-- Squashes the pre-revamp migration history into one fresh-DB file. Composed
-- from kept content only (decomposed, never replayed on prod):
--   extensions -> update_updated_at_column() -> entity registry + views ->
--   warehouse tables -> serving RPCs -> api_cache/api_metrics -> telemetry
--   index -> circuit detail/sessions -> FastF1 RPCs -> geometry -> replays ->
--   driver season results -> f1_chart_requests (relaxed anon insert) ->
--   f1_telemetry_requests (new DDL, dashboard-created on prod) ->
--   circuit history -> site_supporters -> season results -> qualifying laps ->
--   provisional flag -> analysis_charts (final: theme+thumb) ->
--   CircleCI dispatch -> log-retention-daily + db_size_bytes().
--
-- DROPPED (gone from fresh DBs; prod drops them via the forward-drop
-- migration, never by running this file): the login-linked profile table +
-- new-user trigger, the push subscription table, the signup notifier +
-- webhook seeder, all prediction-game tables/RPCs/triggers/crons, the dead
-- f1-ingest cron path (warehouse sync / race poll / ingest entrypoints +
-- helpers), and the superseded GitHub dispatch function. Never drops the
-- managed login-users table; never touches the auth schema.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ---------------------------------------------------------------------------
-- Generic updated_at trigger function (referenced by api_cache, entity
-- registry, and the warehouse tables). search_path pinned per the
-- 20260620 hardening (the new-user-trigger half of that migration is
-- dropped with the login feature).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;
-- Phase R6: F1 entity registry — drivers, constructors, career records
-- Public read; writes via service-role scripts only.

-- ---------------------------------------------------------------------------
-- Core identity tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.f1_driver (
  ergast_id text PRIMARY KEY,
  given_name text NOT NULL,
  family_name text NOT NULL,
  code text,
  permanent_number text,
  nationality text,
  date_of_birth date,
  slug text UNIQUE NOT NULL,
  portrait_path text,
  headshot_url text,
  display_name_override text,
  active_season int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS f1_driver_slug_idx ON public.f1_driver (slug);
CREATE INDEX IF NOT EXISTS f1_driver_active_season_idx ON public.f1_driver (active_season);

CREATE TABLE IF NOT EXISTS public.f1_constructor (
  ergast_id text PRIMARY KEY,
  name text NOT NULL,
  nationality text,
  slug text UNIQUE NOT NULL,
  logo_path text,
  team_color_hex text,
  display_name_override text,
  active_season int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS f1_constructor_slug_idx ON public.f1_constructor (slug);
CREATE INDEX IF NOT EXISTS f1_constructor_active_season_idx ON public.f1_constructor (active_season);

-- ---------------------------------------------------------------------------
-- Career totals (scraped + verified offline)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.f1_driver_career (
  ergast_id text PRIMARY KEY REFERENCES public.f1_driver (ergast_id) ON DELETE CASCADE,
  championships int NOT NULL DEFAULT 0,
  championship_years int[] DEFAULT '{}',
  race_starts int,
  race_wins int,
  podiums int,
  pole_positions int,
  fastest_laps int,
  first_gp_year int,
  last_gp_year int,
  best_championship_position int,
  career_points numeric,
  bio_short text,
  notable_records jsonb DEFAULT '[]'::jsonb,
  source_revision text,
  scraped_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.f1_constructor_career (
  ergast_id text PRIMARY KEY REFERENCES public.f1_constructor (ergast_id) ON DELETE CASCADE,
  championships int NOT NULL DEFAULT 0,
  championship_years int[] DEFAULT '{}',
  race_wins int,
  podiums int,
  pole_positions int,
  first_season int,
  last_season int,
  bio_short text,
  notable_records jsonb DEFAULT '[]'::jsonb,
  source_revision text,
  scraped_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers (reuse shared function)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'f1_driver_updated_at') THEN
    CREATE TRIGGER f1_driver_updated_at
      BEFORE UPDATE ON public.f1_driver
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'f1_constructor_updated_at') THEN
    CREATE TRIGGER f1_constructor_updated_at
      BEFORE UPDATE ON public.f1_constructor
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'f1_driver_career_updated_at') THEN
    CREATE TRIGGER f1_driver_career_updated_at
      BEFORE UPDATE ON public.f1_driver_career
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'f1_constructor_career_updated_at') THEN
    CREATE TRIGGER f1_constructor_career_updated_at
      BEFORE UPDATE ON public.f1_constructor_career
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Row level security — public read
-- ---------------------------------------------------------------------------

ALTER TABLE public.f1_driver ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.f1_constructor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.f1_driver_career ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.f1_constructor_career ENABLE ROW LEVEL SECURITY;

CREATE POLICY f1_driver_public_read
  ON public.f1_driver
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY f1_constructor_public_read
  ON public.f1_constructor
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY f1_driver_career_public_read
  ON public.f1_driver_career
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY f1_constructor_career_public_read
  ON public.f1_constructor_career
  FOR SELECT
  TO anon, authenticated
  USING (true);
-- Phase R6: profile views joining identity + career tables

CREATE OR REPLACE VIEW public.f1_driver_profile AS
SELECT
  d.ergast_id,
  d.given_name,
  d.family_name,
  d.code,
  d.permanent_number,
  d.nationality,
  d.date_of_birth,
  d.slug,
  d.portrait_path,
  d.headshot_url,
  COALESCE(d.display_name_override, d.given_name || ' ' || d.family_name) AS display_name,
  d.active_season,
  c.championships,
  c.championship_years,
  c.race_starts,
  c.race_wins,
  c.podiums,
  c.pole_positions,
  c.fastest_laps,
  c.first_gp_year,
  c.last_gp_year,
  c.best_championship_position,
  c.career_points,
  c.bio_short,
  c.notable_records,
  c.scraped_at,
  d.created_at,
  d.updated_at
FROM public.f1_driver d
LEFT JOIN public.f1_driver_career c ON c.ergast_id = d.ergast_id;

CREATE OR REPLACE VIEW public.f1_constructor_profile AS
SELECT
  cstr.ergast_id,
  cstr.name,
  cstr.nationality,
  cstr.slug,
  cstr.logo_path,
  cstr.team_color_hex,
  COALESCE(cstr.display_name_override, cstr.name) AS display_name,
  cstr.active_season,
  c.championships,
  c.championship_years,
  c.race_wins,
  c.podiums,
  c.pole_positions,
  c.first_season,
  c.last_season,
  c.bio_short,
  c.notable_records,
  c.scraped_at,
  cstr.created_at,
  cstr.updated_at
FROM public.f1_constructor cstr
LEFT JOIN public.f1_constructor_career c ON c.ergast_id = cstr.ergast_id;

-- Views inherit underlying table RLS when security_invoker is default;
-- grant SELECT explicitly for anon/authenticated.
GRANT SELECT ON public.f1_driver_profile TO anon, authenticated;
GRANT SELECT ON public.f1_constructor_profile TO anon, authenticated;
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

-- Season schedule -> MRData.RaceTable.Races[] (kept half of the serving
-- block inlined in 20260624120000_f1_warehouse.sql; the sibling get_laps /
-- get_race_results drafts there are superseded by the serving layer below,
-- and the inline cron block is dropped as dead).
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
-- ============================================================================
-- F1 DATA WAREHOUSE — SERVING LAYER (views + RPCs)
-- Companion to 20260624120000_f1_warehouse.sql (canonical tables).
-- Reassembles BYTE-FAITHFUL Ergast envelopes from the normalized tables so the
-- existing service mappers (f1Service.ts) need ZERO shape changes.
--
-- All functions are SECURITY INVOKER + STABLE and GRANTed to anon/authenticated.
-- They read public-RLS warehouse tables only. Every RPC returns the SAME jsonb
-- sub-shape the matching `MRData.*` path exposes today, so the frontend can
-- drop the result straight into its existing parsers.
--
-- Apply to LOCAL stack only (supabase db reset). User ships to prod.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. IDENTITY HELPERS — defined FIRST because the RPCs below call them inside
--    their SQL bodies (check_function_bodies validates references at CREATE).
-- ----------------------------------------------------------------------------

-- Helper: Ergast Driver sub-object from f1_driver identity.
CREATE OR REPLACE FUNCTION public._f1_driver_obj(p_driver_id text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
           'driverId',        d.ergast_id,
           'permanentNumber', d.permanent_number,
           'code',            d.code,
           'givenName',       d.given_name,
           'familyName',      d.family_name,
           'dateOfBirth',     to_char(d.date_of_birth, 'YYYY-MM-DD'),
           'nationality',     d.nationality))
  FROM public.f1_driver d WHERE d.ergast_id = p_driver_id;
$$;

-- Helper: Ergast Constructor sub-object from f1_constructor identity.
CREATE OR REPLACE FUNCTION public._f1_constructor_obj(p_constructor_id text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
           'constructorId', cstr.ergast_id,
           'name',          cstr.name,
           'nationality',   cstr.nationality))
  FROM public.f1_constructor cstr WHERE cstr.ergast_id = p_constructor_id;
$$;

-- Helper: rebuild a single Ergast Results[] element from typed columns when no
-- raw jsonb was stored. Joins identity for Driver/Constructor sub-objects.
CREATE OR REPLACE FUNCTION public._f1_result_obj(rr public.f1_race_result)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'number',       rr.car_number::text,
    'position',     rr.position::text,
    'positionText', rr.position_text,
    'points',       rr.points::text,
    'Driver',       public._f1_driver_obj(rr.driver_id),
    'Constructor',  public._f1_constructor_obj(rr.constructor_id),
    'grid',         rr.grid::text,
    'laps',         rr.laps::text,
    'status',       rr.status,
    'Time',         CASE WHEN rr.time_text IS NOT NULL
                     THEN jsonb_strip_nulls(jsonb_build_object(
                            'millis', rr.time_millis::text,
                            'time',   rr.time_text)) END,
    'FastestLap',   CASE WHEN rr.fastest_lap_number IS NOT NULL
                     THEN jsonb_strip_nulls(jsonb_build_object(
                            'rank', rr.fastest_lap_rank::text,
                            'lap',  rr.fastest_lap_number::text,
                            'Time', jsonb_build_object('time', rr.fastest_lap_time),
                            'AverageSpeed', jsonb_strip_nulls(jsonb_build_object(
                              'units', rr.fastest_lap_speed_units,
                              'speed', rr.fastest_lap_avg_speed::text)))) END
  ));
$$;

-- SECURITY INVOKER RPCs below run AS THE CALLER, so anon/authenticated must be
-- able to EXECUTE the internal helper functions they call.
GRANT EXECUTE ON FUNCTION public._f1_result_obj(public.f1_race_result) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public._f1_driver_obj(text)      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public._f1_constructor_obj(text) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 1. SCHEDULE — get_schedule(p_season) -> RaceTable.Races[]
--    Mirrors json.MRData.RaceTable.Races consumed by getRaceSchedule().
--    Each race carries the Ergast-shaped Circuit + per-session sub-objects
--    (FirstPractice/SecondPractice/ThirdPractice/Qualifying/Sprint/
--     SprintQualifying) reconstructed from f1_session rows.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_schedule(p_season int)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT COALESCE(
    jsonb_agg(race ORDER BY (race->>'round')::int),
    '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
             'season',   r.season::text,
             'round',    r.round::text,
             'url',      r.url,
             'raceName', r.race_name,
             'Circuit',  jsonb_build_object(
               'circuitId',   c.circuit_id,
               'url',         c.url,
               'circuitName', c.name,
               'Location',    jsonb_strip_nulls(jsonb_build_object(
                 'lat',      c.lat::text,
                 'long',     c.lng::text,
                 'locality', c.locality,
                 'country',  c.country))),
             'date', to_char(r.date, 'YYYY-MM-DD'),
             'time', r.time
           )
           -- merge the session sub-objects (Ergast keys) when present
           || COALESCE((
                SELECT jsonb_object_agg(ergast_key, payload)
                FROM (
                  SELECT
                    CASE s.session_type
                      WHEN 'FP1' THEN 'FirstPractice'
                      WHEN 'FP2' THEN 'SecondPractice'
                      WHEN 'FP3' THEN 'ThirdPractice'
                      WHEN 'Q'   THEN 'Qualifying'
                      WHEN 'SQ'  THEN 'SprintQualifying'
                      WHEN 'SS'  THEN 'SprintShootout'
                      WHEN 'S'   THEN 'Sprint'
                      ELSE NULL
                    END AS ergast_key,
                    jsonb_strip_nulls(jsonb_build_object(
                      'date', to_char(s.scheduled_date, 'YYYY-MM-DD'),
                      'time', s.scheduled_time)) AS payload
                  FROM public.f1_session s
                  WHERE s.race_id = r.id
                    AND s.session_type <> 'R'
                ) sess
                WHERE ergast_key IS NOT NULL
              ), '{}'::jsonb) AS race
    FROM public.f1_race r
    LEFT JOIN public.f1_circuit c ON c.circuit_id = r.circuit_id
    WHERE r.season = p_season
  ) races;
$$;
GRANT EXECUTE ON FUNCTION public.get_schedule(int) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. RACE RESULTS — get_race_results(p_season, p_round) -> Races[0] object
--    Mirrors json.MRData.RaceTable.Races[0] consumed by getRaceResults()
--    (the mapper reads `.Results`, `.raceName`, `.Circuit`, `.round`, `.date`).
--    Prefers stored `raw` per result for byte-faithful Results[]; rebuilds the
--    enclosing race header from the spine. Returns {} (NULL) when round absent.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_race_results(p_season int, p_round int)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
           'season',   r.season::text,
           'round',    r.round::text,
           'url',      r.url,
           'raceName', r.race_name,
           'Circuit',  jsonb_build_object(
             'circuitId',   c.circuit_id,
             'url',         c.url,
             'circuitName', c.name,
             'Location',    jsonb_strip_nulls(jsonb_build_object(
               'lat', c.lat::text, 'long', c.lng::text,
               'locality', c.locality, 'country', c.country))),
           'date', to_char(r.date, 'YYYY-MM-DD'),
           'time', r.time,
           'Results', COALESCE((
             SELECT jsonb_agg(
                      -- byte-faithful raw when present, else rebuilt row
                      COALESCE(rr.raw, public._f1_result_obj(rr))
                      ORDER BY rr.position NULLS LAST, rr.position_text)
             FROM public.f1_race_result rr
             WHERE rr.season = p_season AND rr.round = p_round
           ), '[]'::jsonb)
         ))
  FROM public.f1_race r
  LEFT JOIN public.f1_circuit c ON c.circuit_id = r.circuit_id
  WHERE r.season = p_season AND r.round = p_round;
$$;
GRANT EXECUTE ON FUNCTION public.get_race_results(int,int) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. QUALIFYING — get_qualifying(p_season, p_round) -> Races[0] object
--    Mirrors json.MRData.RaceTable.Races[0] consumed by getRaceQualifying()
--    (mapper reads `.QualifyingResults`).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_qualifying(p_season int, p_round int)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
           'season',   r.season::text,
           'round',    r.round::text,
           'raceName', r.race_name,
           'date',     to_char(r.date, 'YYYY-MM-DD'),
           'QualifyingResults', COALESCE((
             SELECT jsonb_agg(
                      COALESCE(qr.raw, jsonb_strip_nulls(jsonb_build_object(
                        'number',      qr.car_number::text,
                        'position',    qr.position::text,
                        'Driver',      public._f1_driver_obj(qr.driver_id),
                        'Constructor', public._f1_constructor_obj(qr.constructor_id),
                        'Q1', qr.q1, 'Q2', qr.q2, 'Q3', qr.q3)))
                      ORDER BY qr.position NULLS LAST)
             FROM public.f1_qualifying_result qr
             WHERE qr.season = p_season AND qr.round = p_round
           ), '[]'::jsonb)
         ))
  FROM public.f1_race r
  WHERE r.season = p_season AND r.round = p_round;
$$;
GRANT EXECUTE ON FUNCTION public.get_qualifying(int,int) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. SPRINT — get_sprint(p_season, p_round) -> Races[0] object
--    Mirrors json.MRData.RaceTable.Races[0] consumed by getSprintResults()
--    (mapper reads `.SprintResults`).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_sprint(p_season int, p_round int)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
           'season',   r.season::text,
           'round',    r.round::text,
           'raceName', r.race_name,
           'date',     to_char(r.date, 'YYYY-MM-DD'),
           'SprintResults', COALESCE((
             SELECT jsonb_agg(
                      COALESCE(sr.raw, jsonb_strip_nulls(jsonb_build_object(
                        'number',       sr.car_number::text,
                        'position',     sr.position::text,
                        'positionText', sr.position_text,
                        'points',       sr.points::text,
                        'Driver',       public._f1_driver_obj(sr.driver_id),
                        'Constructor',  public._f1_constructor_obj(sr.constructor_id),
                        'grid',         sr.grid::text,
                        'laps',         sr.laps::text,
                        'status',       sr.status,
                        'Time', CASE WHEN sr.time_text IS NOT NULL
                          THEN jsonb_strip_nulls(jsonb_build_object(
                            'millis', sr.time_millis::text, 'time', sr.time_text)) END,
                        'FastestLap', CASE WHEN sr.fastest_lap_number IS NOT NULL
                          THEN jsonb_build_object(
                            'lap', sr.fastest_lap_number::text,
                            'Time', jsonb_build_object('time', sr.fastest_lap_time)) END)))
                      ORDER BY sr.position NULLS LAST)
             FROM public.f1_sprint_result sr
             WHERE sr.season = p_season AND sr.round = p_round
           ), '[]'::jsonb)
         ))
  FROM public.f1_race r
  WHERE r.season = p_season AND r.round = p_round;
$$;
GRANT EXECUTE ON FUNCTION public.get_sprint(int,int) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. PIT STOPS — get_pitstops(p_season, p_round) -> RaceTable object
--    Mirrors json.MRData.RaceTable consumed by getPitStops()
--    (mapper keeps the whole RaceTable; UI reads Races[0].PitStops).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_pitstops(p_season int, p_round int)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT jsonb_build_object(
    'season', p_season::text,
    'round',  p_round::text,
    'Races',  jsonb_build_array(
      jsonb_strip_nulls(jsonb_build_object(
        'season',   r.season::text,
        'round',    r.round::text,
        'raceName', r.race_name,
        'date',     to_char(r.date, 'YYYY-MM-DD'),
        'PitStops', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
                   'driverId', ps.driver_id,
                   'stop',     ps.stop::text,
                   'lap',      ps.lap::text,
                   'time',     ps.time_local,
                   'duration', ps.duration_seconds::text)
                 ORDER BY ps.lap NULLS LAST, ps.stop)
          FROM public.f1_pit_stop ps
          WHERE ps.season = p_season AND ps.round = p_round
        ), '[]'::jsonb)
      )))
  )
  FROM public.f1_race r
  WHERE r.season = p_season AND r.round = p_round;
$$;
GRANT EXECUTE ON FUNCTION public.get_pitstops(int,int) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. DRIVER STANDINGS — get_driver_standings(p_season[, p_round])
--    Returns the StandingsLists[0].DriverStandings[] array consumed by
--    getDriverStandings(). NULL round => latest round captured for the season.
--    Each element carries Driver + Constructors[] (Ergast plural array; the
--    last element is the driver's current team, mirroring getPrimaryConstructor).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_driver_standings(p_season int, p_round int DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$
  WITH eff AS (
    SELECT COALESCE(p_round, (
      SELECT max(round) FROM public.f1_driver_standing WHERE season = p_season
    )) AS round
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'position',     ds.position::text,
        'positionText', ds.position_text,
        'points',       ds.points::text,
        'wins',         ds.wins::text,
        'Driver',       public._f1_driver_obj(ds.driver_id),
        'Constructors', jsonb_build_array(public._f1_constructor_obj(ds.constructor_id))))
      ORDER BY ds.position NULLS LAST),
    '[]'::jsonb)
  FROM public.f1_driver_standing ds, eff
  WHERE ds.season = p_season AND ds.round = eff.round;
$$;
GRANT EXECUTE ON FUNCTION public.get_driver_standings(int,int) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7. CONSTRUCTOR STANDINGS — get_constructor_standings(p_season[, p_round])
--    Returns StandingsLists[0].ConstructorStandings[] consumed by
--    getConstructorStandings(). NULL round => latest captured round.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_constructor_standings(p_season int, p_round int DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$
  WITH eff AS (
    SELECT COALESCE(p_round, (
      SELECT max(round) FROM public.f1_constructor_standing WHERE season = p_season
    )) AS round
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'position',     cs.position::text,
        'positionText', cs.position_text,
        'points',       cs.points::text,
        'wins',         cs.wins::text,
        'Constructor',  public._f1_constructor_obj(cs.constructor_id)))
      ORDER BY cs.position NULLS LAST),
    '[]'::jsonb)
  FROM public.f1_constructor_standing cs, eff
  WHERE cs.season = p_season AND cs.round = eff.round;
$$;
GRANT EXECUTE ON FUNCTION public.get_constructor_standings(int,int) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 8. COVERAGE GUARD — f1_has_coverage(domain, season[, round])
--    Lets the serving router ask "is this (domain,season,round) complete in the
--    warehouse?" in one call before choosing DB-first vs proxy. Reads
--    f1_sync_state (service-role only table) via SECURITY DEFINER so anon can
--    call it WITHOUT exposing operational rows. Returns true only for
--    status='complete' (durable) — anything else falls through to the proxy.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.f1_has_coverage(
  p_domain text, p_season int, p_round int DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.f1_sync_state ss
    WHERE ss.domain = p_domain
      AND ss.season = p_season
      AND (p_round IS NULL OR ss.round = p_round)
      AND ss.status = 'complete'
  );
$$;
GRANT EXECUTE ON FUNCTION public.f1_has_coverage(text,int,int) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 9. HARDEN search_path (matches 20260620000000_harden_function_search_path.sql)
--    Pins search_path on every serving function so the Supabase security
--    advisor (mutable search_path) stays clean.
-- ----------------------------------------------------------------------------
ALTER FUNCTION public.get_schedule(int)                       SET search_path = public, pg_temp;
ALTER FUNCTION public.get_race_results(int,int)               SET search_path = public, pg_temp;
ALTER FUNCTION public.get_qualifying(int,int)                 SET search_path = public, pg_temp;
ALTER FUNCTION public.get_sprint(int,int)                     SET search_path = public, pg_temp;
ALTER FUNCTION public.get_pitstops(int,int)                   SET search_path = public, pg_temp;
ALTER FUNCTION public.get_driver_standings(int,int)           SET search_path = public, pg_temp;
ALTER FUNCTION public.get_constructor_standings(int,int)      SET search_path = public, pg_temp;
ALTER FUNCTION public._f1_result_obj(public.f1_race_result)   SET search_path = public, pg_temp;
ALTER FUNCTION public._f1_driver_obj(text)                    SET search_path = public, pg_temp;
ALTER FUNCTION public._f1_constructor_obj(text)               SET search_path = public, pg_temp;
-- f1_has_coverage already pins search_path inline (SECURITY DEFINER).

-- ============================================================================
-- END — apply LOCAL only; user ships to prod.
-- ============================================================================
-- Address Supabase advisor "Security Definer View" on the f1 reference views.
-- SECURITY DEFINER views run with the owner's privileges and bypass the caller's
-- RLS. These views expose public reference data only, and every underlying f1_*
-- table carries a public_read SELECT policy (roles {anon, authenticated}, using
-- true), so running them as the querying user (security_invoker) is safe and
-- closes the advisor finding.
alter view public.f1_v_schedule set (security_invoker = on);
alter view public.f1_driver_profile set (security_invoker = on);
alter view public.f1_constructor_profile set (security_invoker = on);
-- Phase 4.1 / 4.5: server-side F1 API cache + request metrics

CREATE TABLE IF NOT EXISTS public.api_cache (
  cache_key text PRIMARY KEY,
  source text NOT NULL CHECK (source IN ('ergast', 'openf1')),
  data jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_cache_expires_at_idx ON public.api_cache (expires_at);
CREATE INDEX IF NOT EXISTS api_cache_source_idx ON public.api_cache (source);

ALTER TABLE public.api_cache ENABLE ROW LEVEL SECURITY;

-- Public read of non-expired rows (debugging / optional direct reads)
CREATE POLICY api_cache_public_read
  ON public.api_cache
  FOR SELECT
  TO anon, authenticated
  USING (expires_at > now());

-- Writes are service-role only (edge functions bypass RLS)

CREATE TABLE IF NOT EXISTS public.api_metrics (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source text NOT NULL,
  cache_key text,
  cache_hit boolean NOT NULL,
  status_code integer,
  is_rate_limit boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_metrics_created_at_idx ON public.api_metrics (created_at DESC);
CREATE INDEX IF NOT EXISTS api_metrics_source_idx ON public.api_metrics (source);

ALTER TABLE public.api_metrics ENABLE ROW LEVEL SECURITY;
-- No public policies — metrics are service-role only
-- Discovery index for FastF1 telemetry blobs stored in the `telemetry` bucket.
-- One row per exported driver-lap; the heavy channel data lives in Storage JSON,
-- not Postgres. Public-read, matching the other f1_* reference tables.
create table if not exists public.f1_telemetry_index (
  id bigint generated always as identity primary key,
  season int not null,
  round int not null,
  session text not null,
  driver_id text,
  driver_code text not null,
  lap_number int not null,
  lap_type text not null default 'fastest',
  storage_path text not null,
  public_url text not null,
  top_speed numeric,
  source text not null default 'fastf1',
  created_at timestamptz not null default now(),
  unique (season, round, session, driver_code, lap_number)
);

create index if not exists f1_telemetry_index_lookup
  on public.f1_telemetry_index (season, round, session);

alter table public.f1_telemetry_index enable row level security;

drop policy if exists f1_telemetry_index_public_read on public.f1_telemetry_index;
create policy f1_telemetry_index_public_read
  on public.f1_telemetry_index for select
  to anon, authenticated using (true);

-- List available telemetry laps for a session (React calls this to discover
-- which drivers/laps exist, then fetches each public_url blob directly).
create or replace function public.get_telemetry_index(
  p_season int, p_round int, p_session text default 'R'
) returns setof public.f1_telemetry_index
language sql stable security invoker
as $$
  select * from public.f1_telemetry_index
  where season = p_season and round = p_round and session = p_session
  order by top_speed desc nulls last, driver_code;
$$;

-- Public bucket for the telemetry JSON blobs (created out-of-band via the
-- Storage API; recorded here for completeness / fresh-project bootstrap).
insert into storage.buckets (id, name, public)
values ('telemetry', 'telemetry', true)
on conflict (id) do update set public = true;
-- Circuit detail: profile + fastest race lap (record) + holder + stats.
-- Lap times are zero-padded "M:SS.mmm", so lexical MIN == fastest lap.
create or replace function public.get_circuit_detail(p_circuit_id text)
returns table (
  circuit_id text, name text, locality text, country text,
  lat numeric, lng numeric, url text,
  record_driver_id text, record_driver_name text, record_driver_code text,
  record_time text, record_season int, record_round int,
  races_in_db int, first_season int, last_season int
)
language sql stable security invoker
as $$
  with rec as (
    select l.driver_id, l.time_text, l.season, l.round
    from public.f1_lap l
    join public.f1_race r on r.season = l.season and r.round = l.round
    where r.circuit_id = p_circuit_id and l.time_text is not null
    order by l.time_text asc
    limit 1
  ),
  stats as (
    select count(distinct (season, round))::int as races,
           min(season) as fs, max(season) as ls
    from public.f1_race where circuit_id = p_circuit_id
  )
  select c.circuit_id, c.name, c.locality, c.country, c.lat, c.lng, c.url,
         rec.driver_id,
         nullif(trim(coalesce(d.given_name,'') || ' ' || coalesce(d.family_name,'')), ''),
         d.code, rec.time_text, rec.season, rec.round,
         stats.races, stats.fs, stats.ls
  from public.f1_circuit c
  left join rec on true
  left join stats on true
  left join public.f1_driver d on d.ergast_id = rec.driver_id
  where c.circuit_id = p_circuit_id;
$$;
-- f1_session.race_id is not populated by the ingester, so the previous
-- get_schedule join (`s.race_id = r.id`) dropped every practice/qualifying/
-- sprint session from the schedule — the frontend session selector only saw
-- the race. Join on (season, round) instead, which is always populated and
-- survives re-ingests. Embeds Ergast-shaped FirstPractice/SecondPractice/
-- ThirdPractice/Qualifying/Sprint/SprintQualifying objects per race.
create or replace function public.get_schedule(p_season integer)
returns jsonb
language sql stable
set search_path to 'public', 'pg_temp'
as $function$
  SELECT COALESCE(
    jsonb_agg(race ORDER BY (race->>'round')::int),
    '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
             'season',   r.season::text,
             'round',    r.round::text,
             'url',      r.url,
             'raceName', r.race_name,
             'Circuit',  jsonb_build_object(
               'circuitId',   c.circuit_id,
               'url',         c.url,
               'circuitName', c.name,
               'Location',    jsonb_strip_nulls(jsonb_build_object(
                 'lat',      c.lat::text,
                 'long',     c.lng::text,
                 'locality', c.locality,
                 'country',  c.country))),
             'date', to_char(r.date, 'YYYY-MM-DD'),
             'time', r.time
           )
           || COALESCE((
                SELECT jsonb_object_agg(ergast_key, payload)
                FROM (
                  SELECT
                    CASE s.session_type
                      WHEN 'FP1' THEN 'FirstPractice'
                      WHEN 'FP2' THEN 'SecondPractice'
                      WHEN 'FP3' THEN 'ThirdPractice'
                      WHEN 'Q'   THEN 'Qualifying'
                      WHEN 'SQ'  THEN 'SprintQualifying'
                      WHEN 'SS'  THEN 'SprintShootout'
                      WHEN 'S'   THEN 'Sprint'
                      ELSE NULL
                    END AS ergast_key,
                    jsonb_strip_nulls(jsonb_build_object(
                      'date', to_char(s.scheduled_date, 'YYYY-MM-DD'),
                      'time', s.scheduled_time)) AS payload
                  FROM public.f1_session s
                  WHERE s.season = r.season AND s.round = r.round
                    AND s.session_type <> 'R'
                ) sess
                WHERE ergast_key IS NOT NULL
              ), '{}'::jsonb) AS race
    FROM public.f1_race r
    LEFT JOIN public.f1_circuit c ON c.circuit_id = r.circuit_id
    WHERE r.season = p_season
  ) races;
$function$;-- ============================================================================
-- Phase 1 — FastF1-only migration. Enrichment tables + serving RPCs.
-- (Applied live via MCP during development; this file is the repo-of-record so
--  `supabase db reset` reproduces the schema.)
-- ============================================================================

-- ── FastF1-native enrichment tables (re-keyed from OpenF1 to season/round) ──
drop table if exists public.f1_weather cascade;
create table public.f1_weather (
  id bigint generated always as identity primary key,
  season int not null, round int not null, session_type text not null,
  time_seconds numeric, air_temp numeric, track_temp numeric, humidity numeric,
  pressure numeric, wind_speed numeric, wind_direction int, rainfall boolean,
  source text not null default 'fastf1', created_at timestamptz not null default now(),
  unique (season, round, session_type, time_seconds)
);

drop table if exists public.f1_overtake cascade;
create table public.f1_overtake (
  id bigint generated always as identity primary key,
  season int not null, round int not null, session_type text not null default 'R',
  lap_number int not null,
  overtaking_driver_id text not null, overtaken_driver_id text not null,
  position int, source text not null default 'fastf1',
  created_at timestamptz not null default now(),
  unique (season, round, session_type, lap_number, overtaking_driver_id, overtaken_driver_id)
);

drop table if exists public.f1_race_control cascade;
create table public.f1_race_control (
  id bigint generated always as identity primary key,
  season int not null, round int not null, session_type text not null default 'R',
  time_utc timestamptz, lap_number int, category text, message text,
  flag text, scope text, sector int, driver_number int,
  source text not null default 'fastf1', created_at timestamptz not null default now(),
  unique (season, round, session_type, time_utc, message)
);

alter table public.f1_weather enable row level security;
alter table public.f1_overtake enable row level security;
alter table public.f1_race_control enable row level security;
create policy "public read" on public.f1_weather for select using (true);
create policy "public read" on public.f1_overtake for select using (true);
create policy "public read" on public.f1_race_control for select using (true);
grant select on public.f1_weather, public.f1_overtake, public.f1_race_control to anon, authenticated;

-- ── Per-session laps ────────────────────────────────────────────────────────
alter table public.f1_lap add column if not exists session_type text not null default 'R';
alter table public.f1_lap drop constraint if exists f1_lap_natural_key;
create unique index if not exists f1_lap_session_key
  on public.f1_lap (season, round, session_type, driver_id, lap_number);

-- ── Serving RPCs ────────────────────────────────────────────────────────────
create or replace function public.get_weather(p_season int, p_round int, p_session text default 'R')
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(w) order by w.time_seconds), '[]'::jsonb) from (
    select time_seconds, air_temp, track_temp, humidity, pressure, wind_speed, wind_direction, rainfall
    from public.f1_weather where season=p_season and round=p_round and session_type=p_session) w;
$$;

create or replace function public.get_overtakes(p_season int, p_round int, p_session text default 'R')
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(o) order by o.lap_number, o.position), '[]'::jsonb) from (
    select lap_number, overtaking_driver_id, overtaken_driver_id, position
    from public.f1_overtake where season=p_season and round=p_round and session_type=p_session) o;
$$;

create or replace function public.get_race_control(p_season int, p_round int, p_session text default 'R')
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(r) order by r.time_utc), '[]'::jsonb) from (
    select time_utc, lap_number, category, message, flag, scope, sector, driver_number
    from public.f1_race_control where season=p_season and round=p_round and session_type=p_session) r;
$$;

create or replace function public.get_sessions(p_season int, p_round int default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(s) order by s.round, s.date_start), '[]'::jsonb) from (
    select season, round, session_type, session_name, date_start, date_end
    from public.f1_session where season=p_season and (p_round is null or round=p_round)) s;
$$;

-- Ergast-nested laps (for the lap-time / position charts). Full m:ss.mmm times.
drop function if exists public.get_laps(integer, integer);
create or replace function public.get_laps(p_season int, p_round int, p_session text default 'R')
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('Races', jsonb_build_array(jsonb_build_object(
    'season', p_season::text, 'round', p_round::text,
    'Laps', coalesce((
      select jsonb_agg(lap_obj order by lap_num) from (
        select l.lap_number as lap_num, jsonb_build_object(
          'number', l.lap_number::text,
          'Timings', jsonb_agg(jsonb_build_object(
            'driverId', l.driver_id, 'position', l.position::text, 'time', l.time_text
          ) order by l.position)) as lap_obj
        from public.f1_lap l
        where l.season=p_season and l.round=p_round and l.session_type=p_session
        group by l.lap_number) x), '[]'::jsonb))));
$$;

-- Flat per-lap positions (for the overtakes component).
create or replace function public.get_lap_positions(p_season int, p_round int, p_session text default 'R')
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(l) order by l.lap_number, l.position), '[]'::jsonb) from (
    select lap_number, driver_id, position, time_text, time_millis
    from public.f1_lap where season=p_season and round=p_round and session_type=p_session) l;
$$;

grant execute on function
  public.get_weather(int,int,text), public.get_overtakes(int,int,text),
  public.get_race_control(int,int,text), public.get_sessions(int,int),
  public.get_laps(int,int,text), public.get_lap_positions(int,int,text)
  to anon, authenticated;

-- Entity slugs collide across FastF1/Ergast constructor lineages (Force India →
-- Racing Point → Aston Martin, etc.); routing resolves by ergast_id, so drop
-- the slug unique constraints.
alter table public.f1_constructor drop constraint if exists f1_constructor_slug_key;
alter table public.f1_driver drop constraint if exists f1_driver_slug_key;

-- get_schedule: fill the Ergast-shaped session blocks (FirstPractice/…/Qualifying)
-- from f1_session.date_start (what FastF1 ingest writes). The old body read the
-- dead OpenF1-era scheduled_date/scheduled_time columns (always NULL under FastF1),
-- so every practice/quali block serialized empty → UI showed "-".
create or replace function public.get_schedule(p_season integer)
returns jsonb language sql stable set search_path to 'public','pg_temp' as $function$
  select coalesce(jsonb_agg(race order by (race->>'round')::int), '[]'::jsonb)
  from (
    select jsonb_build_object(
             'season',   r.season::text,
             'round',    r.round::text,
             'url',      r.url,
             'raceName', r.race_name,
             'Circuit',  jsonb_build_object(
               'circuitId',   c.circuit_id,
               'url',         c.url,
               'circuitName', c.name,
               'Location',    jsonb_strip_nulls(jsonb_build_object(
                 'lat',      c.lat::text,
                 'long',     c.lng::text,
                 'locality', c.locality,
                 'country',  c.country))),
             'date', to_char(r.date, 'YYYY-MM-DD'),
             'time', r.time
           )
           || coalesce((
                select jsonb_object_agg(ergast_key, payload)
                from (
                  select
                    case s.session_type
                      when 'FP1' then 'FirstPractice'
                      when 'FP2' then 'SecondPractice'
                      when 'FP3' then 'ThirdPractice'
                      when 'Q'   then 'Qualifying'
                      when 'SQ'  then 'SprintQualifying'
                      when 'SS'  then 'SprintShootout'
                      when 'S'   then 'Sprint'
                      else null
                    end as ergast_key,
                    jsonb_strip_nulls(jsonb_build_object(
                      'date', to_char(
                                coalesce(s.scheduled_date, (s.date_start at time zone 'UTC')::date),
                                'YYYY-MM-DD'),
                      'time', coalesce(
                                s.scheduled_time,
                                to_char(s.date_start at time zone 'UTC', 'HH24:MI:SS') || 'Z')
                    )) as payload
                  from public.f1_session s
                  where s.season = r.season and s.round = r.round
                    and s.session_type <> 'R'
                ) sess
                where ergast_key is not null
              ), '{}'::jsonb) as race
    from public.f1_race r
    left join public.f1_circuit c on c.circuit_id = r.circuit_id
    where r.season = p_season
  ) races;
$function$;
-- Circuit geometry: track outline + numbered corners + straight segments, derived
-- from FastF1 fastest-lap position data and get_circuit_info(). One blob per circuit
-- per season (2026 regs change layouts, and circuits are re-profiled year to year),
-- so the natural key is (season, circuit_id). The heavy point arrays live in Storage
-- (bucket `circuits`); this table is the discovery index. Mirrors f1_telemetry_index.
--
-- NOTE: 2026 dropped DRS, so there are NO DRS zones here by design. "Straights" are
-- computed from full-throttle stretches of the fastest lap, not from FIA zone data.
create table if not exists public.f1_circuit_geometry (
  id bigint generated always as identity primary key,
  season int not null,
  round int not null,
  circuit_id text not null,
  circuit_name text,
  storage_path text not null,
  public_url text not null,
  corner_count int,
  straight_count int,
  rotation numeric,
  source text not null default 'fastf1',
  created_at timestamptz not null default now(),
  unique (season, circuit_id)
);

-- One race per round per season, so (season, round) is unique too — lets the race
-- pages look geometry up by round without knowing the Ergast circuit_id.
create unique index if not exists f1_circuit_geometry_season_round
  on public.f1_circuit_geometry (season, round);

alter table public.f1_circuit_geometry enable row level security;

drop policy if exists f1_circuit_geometry_public_read on public.f1_circuit_geometry;
create policy f1_circuit_geometry_public_read
  on public.f1_circuit_geometry for select
  to anon, authenticated using (true);

-- Race pages know (season, round).
create or replace function public.get_circuit_geometry(p_season int, p_round int)
returns setof public.f1_circuit_geometry
language sql stable security invoker
as $$
  select * from public.f1_circuit_geometry
  where season = p_season and round = p_round
  limit 1;
$$;

-- Circuit detail pages know the circuit_id but not always a season — return the
-- most recent season's geometry (optionally pinned to one season).
create or replace function public.get_circuit_geometry_by_circuit(
  p_circuit_id text, p_season int default null
)
returns setof public.f1_circuit_geometry
language sql stable security invoker
as $$
  select * from public.f1_circuit_geometry
  where circuit_id = p_circuit_id
    and (p_season is null or season = p_season)
  order by season desc
  limit 1;
$$;

-- Public bucket for the geometry JSON blobs (created out-of-band via the Storage
-- API in the exporter; recorded here for completeness / fresh-project bootstrap).
insert into storage.buckets (id, name, public)
values ('circuits', 'circuits', true)
on conflict (id) do update set public = true;
-- Full-race position replay: per-driver X/Y traces on a shared time grid, exported
-- from FastF1 (analysis/race_replay_export.py) into Storage bucket `replays`. This
-- table is the discovery index; the heavy frame arrays live in the blob. Post-race
-- / historical (batch) — NOT a live feed. Mirrors f1_circuit_geometry.
create table if not exists public.f1_race_replay (
  id bigint generated always as identity primary key,
  season int not null,
  round int not null,
  circuit_id text not null,
  circuit_name text,
  storage_path text not null,
  public_url text not null,
  driver_count int,
  frames int,
  duration_s numeric,
  rotation numeric,
  source text not null default 'fastf1',
  created_at timestamptz not null default now(),
  unique (season, circuit_id)
);

create unique index if not exists f1_race_replay_season_round
  on public.f1_race_replay (season, round);

alter table public.f1_race_replay enable row level security;

drop policy if exists f1_race_replay_public_read on public.f1_race_replay;
create policy f1_race_replay_public_read
  on public.f1_race_replay for select
  to anon, authenticated using (true);

create or replace function public.get_race_replay(p_season int, p_round int)
returns setof public.f1_race_replay
language sql stable security invoker
as $$
  select * from public.f1_race_replay
  where season = p_season and round = p_round
  limit 1;
$$;

insert into storage.buckets (id, name, public)
values ('replays', 'replays', true)
on conflict (id) do update set public = true;
-- Session-aware race replays: add a `session` dimension so Qualifying / Sprint /
-- Race (and practice) each get their own replay blob + timing tower. Existing rows
-- are the Race ('R'). The blob storage path gains a `_Q` / `_S` suffix for non-race
-- sessions (race stays `{circuit}.json` for backward compat).
alter table public.f1_race_replay add column if not exists session text not null default 'R';

-- Replace the single-per-circuit / single-per-round uniques with session-aware ones.
alter table public.f1_race_replay drop constraint if exists f1_race_replay_season_circuit_id_key;
drop index if exists public.f1_race_replay_season_round;

create unique index if not exists f1_race_replay_season_circuit_session
  on public.f1_race_replay (season, circuit_id, session);
create unique index if not exists f1_race_replay_season_round_session
  on public.f1_race_replay (season, round, session);

-- Drop the old 2-arg signature so the 3-arg (with default) isn't ambiguous.
drop function if exists public.get_race_replay(int, int);

create or replace function public.get_race_replay(p_season int, p_round int, p_session text default 'R')
returns setof public.f1_race_replay
language sql stable security invoker
as $$
  select * from public.f1_race_replay
  where season = p_season and round = p_round and session = p_session
  limit 1;
$$;
-- Per-driver, whole-season race results from the warehouse (FastF1-fed),
-- so the driver page stays current instead of lagging on the Jolpica proxy
-- (which trails recent rounds of the live season).
create or replace function public.get_driver_season_results(p_season int, p_driver_id text)
returns table (
  round int,
  race_name text,
  date date,
  country text,
  circuit text,
  "position" text,
  status text,
  is_dnf boolean,
  points numeric,
  constructor text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.round,
    ra.race_name,
    ra.date,
    ci.country,
    ci.name as circuit,
    r.position_text as "position",
    r.status,
    r.is_dnf,
    r.points,
    coalesce(co.display_name_override, co.name) as constructor
  from f1_race_result r
  join f1_race ra on ra.id = r.race_id
  left join f1_circuit ci on ci.circuit_id = ra.circuit_id
  left join f1_constructor co on co.ergast_id = r.constructor_id
  where r.season = p_season and r.driver_id = p_driver_id
  order by r.round;
$$;

grant execute on function public.get_driver_season_results(int, text) to anon, authenticated, service_role;
-- Add grid + qualifying position to the per-driver season results RPC
-- (powers the driver page's results list). Return type changed → drop + recreate.
drop function if exists public.get_driver_season_results(int, text);
create or replace function public.get_driver_season_results(p_season int, p_driver_id text)
returns table (
  round int,
  race_name text,
  date date,
  country text,
  circuit text,
  "position" text,
  grid int,
  quali_position int,
  status text,
  is_dnf boolean,
  points numeric,
  constructor text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.round,
    ra.race_name,
    ra.date,
    ci.country,
    ci.name as circuit,
    r.position_text as "position",
    r.grid,
    q.position as quali_position,
    r.status,
    r.is_dnf,
    r.points,
    coalesce(co.display_name_override, co.name) as constructor
  from f1_race_result r
  join f1_race ra on ra.id = r.race_id
  left join f1_circuit ci on ci.circuit_id = ra.circuit_id
  left join f1_constructor co on co.ergast_id = r.constructor_id
  left join f1_qualifying_result q on q.season = r.season and q.round = r.round and q.driver_id = r.driver_id
  where r.season = p_season and r.driver_id = p_driver_id
  order by r.round;
$$;

grant execute on function public.get_driver_season_results(int, text) to anon, authenticated, service_role;
-- ---------------------------------------------------------------------------
-- On-demand custom chart requests (Deep Dive "pick your drivers"). Drained by
-- CircleCI (process_chart_requests.py); per-request dispatch via
-- dispatch_ci_request below. Deduped by the variant key so the same driver
-- set never regenerates.
--
-- OPEN-SOURCE CHANGE vs 20260714120000: the insert policy no longer requires
-- the caller's login id to equal requested_by — anonymous requests must keep
-- working with zero login. requested_by stays as a nullable informational column.
-- Folded in: format/theme variant columns + variant unique key (20260909 R2).
-- ---------------------------------------------------------------------------
create table if not exists public.f1_chart_requests (
  id uuid primary key default gen_random_uuid(),
  season int not null,
  round int not null,
  session text not null default 'R',
  chart text not null,
  driver_key text not null,
  drivers text[] not null default '{}',
  format text not null default 'landscape',
  theme text not null default 'dark',
  status text not null default 'pending',
  public_url text,
  error text,
  requested_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint f1_chart_requests_variant_key
    unique (season, round, session, chart, driver_key, format, theme)
);

create index if not exists f1_chart_requests_status_idx
  on public.f1_chart_requests (status, created_at);

alter table public.f1_chart_requests enable row level security;

drop policy if exists "chart_requests_read" on public.f1_chart_requests;
drop policy if exists "chart_requests_insert" on public.f1_chart_requests;
create policy "chart_requests_read" on public.f1_chart_requests for select using (true);
create policy "chart_requests_insert" on public.f1_chart_requests
  for insert to anon, authenticated with check (true);
-- ---------------------------------------------------------------------------
-- On-demand any-lap telemetry requests (Pit Wall). This table was created via
-- the dashboard on prod (no CREATE TABLE in migration history); DDL derived
-- from its consumers — analysis/process_telemetry_requests.py (reads
-- id/season/round/session/driver/lap_number, patches status/public_url/error/
-- updated_at; lifecycle pending -> processing -> done/error) and
-- web/src/services/telemetryRequestService.ts (inserts season/round/session/
-- driver/lap_number/requested_by/status; polls status/error; relies on 23505
-- dedup on the lap key).
--
-- OPEN-SOURCE: anonymous insert allowed (no login-uid gate); requested_by is
-- a nullable informational column.
-- ---------------------------------------------------------------------------
create table if not exists public.f1_telemetry_requests (
  id uuid primary key default gen_random_uuid(),
  season int not null,
  round int not null,
  session text not null default 'R',
  driver text not null,
  lap_number int not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'done', 'error')),
  public_url text,
  error text,
  requested_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint f1_telemetry_requests_lap_key
    unique (season, round, session, driver, lap_number)
);

create index if not exists f1_telemetry_requests_status_idx
  on public.f1_telemetry_requests (status, created_at);

alter table public.f1_telemetry_requests enable row level security;

drop policy if exists "telemetry_requests_read" on public.f1_telemetry_requests;
drop policy if exists "telemetry_requests_insert" on public.f1_telemetry_requests;
create policy "telemetry_requests_read" on public.f1_telemetry_requests for select using (true);
create policy "telemetry_requests_insert" on public.f1_telemetry_requests
  for insert to anon, authenticated with check (true);
-- get_circuit_history(p_season, p_round)
-- Every edition of the circuit run at (p_season, p_round), most recent first,
-- with each year's race winner (code/name/team) and pole-sitter. Powers the
-- `circuit_history` analysis poster. Applied to prod via MCP on 2026-07-15.
create or replace function public.get_circuit_history(p_season int, p_round int)
returns jsonb language sql stable security invoker as $$
  with circ as (
    select circuit_id from public.f1_race where season = p_season and round = p_round limit 1
  ),
  ed as (
    select ra.season, ra.round, ra.race_name
    from public.f1_race ra join circ on ra.circuit_id = circ.circuit_id
    where ra.season <= p_season
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'season', ed.season,
      'round', ed.round,
      'race_name', ed.race_name,
      'winner', wd.code, 'winner_name', wd.family_name, 'winner_team', wc.name,
      'pole', pd.code
    ) order by ed.season desc), '[]'::jsonb)
  from ed
  left join public.f1_race_result w
    on w.season = ed.season and w.round = ed.round and w.position = 1
  left join public.f1_driver wd on wd.ergast_id = w.driver_id
  left join public.f1_constructor wc on wc.ergast_id = w.constructor_id
  left join public.f1_qualifying_result q
    on q.season = ed.season and q.round = ed.round and q.position = 1
  left join public.f1_driver pd on pd.ergast_id = q.driver_id;
$$;
grant execute on function public.get_circuit_history(int,int) to anon, authenticated, service_role;
-- get_circuit_history_by_circuit(p_circuit_id)
-- Every edition of a circuit (keyed by ergast circuit_id), most recent first, with
-- each year's winner (code/name/id/team) and pole-sitter. Powers the on-platform
-- CircuitHistoryCard on the circuit detail page. Applied to prod via MCP 2026-07-15.
create or replace function public.get_circuit_history_by_circuit(p_circuit_id text)
returns jsonb language sql stable security invoker as $$
  with ed as (
    select ra.season, ra.round, ra.race_name
    from public.f1_race ra where ra.circuit_id = p_circuit_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'season', ed.season, 'round', ed.round, 'race_name', ed.race_name,
      'winner', wd.code, 'winner_name', wd.family_name, 'winner_id', wd.ergast_id,
      'winner_team', wc.name, 'winner_team_id', wc.ergast_id,
      'pole', pd.code) order by ed.season desc), '[]'::jsonb)
  from ed
  left join public.f1_race_result w on w.season = ed.season and w.round = ed.round and w.position = 1
  left join public.f1_driver wd on wd.ergast_id = w.driver_id
  left join public.f1_constructor wc on wc.ergast_id = w.constructor_id
  left join public.f1_qualifying_result q on q.season = ed.season and q.round = ed.round and q.position = 1
  left join public.f1_driver pd on pd.ergast_id = q.driver_id;
$$;
grant execute on function public.get_circuit_history_by_circuit(text) to anon, authenticated, service_role;
-- Live "Buy me a PitStop" supporter count, kept current by the BuyMeACoffee
-- webhook (edge function `bmc-webhook`). The frontend reads it (anon) and falls
-- back to the hardcoded config number if unavailable.

create table if not exists public.site_supporters (
  id         int primary key default 1,
  count      int not null default 0,
  updated_at timestamptz not null default now(),
  constraint site_supporters_singleton check (id = 1)
);
-- seed with the current manual number so the count never regresses
insert into public.site_supporters (id, count) values (1, 2)
  on conflict (id) do nothing;

alter table public.site_supporters enable row level security;
drop policy if exists site_supporters_read on public.site_supporters;
create policy site_supporters_read on public.site_supporters
  for select to anon, authenticated using (true);
-- writes are service-role only (the edge function); no anon/auth write policy.

-- Idempotency: BuyMeACoffee retries webhooks, so each event is processed once.
create table if not exists public.bmc_webhook_event (
  event_id    text primary key,
  received_at timestamptz not null default now()
);
alter table public.bmc_webhook_event enable row level security;
-- no policies → only the service-role edge function can read/write it.

-- Atomic +1 (avoids a read-then-write race on concurrent webhooks).
create or replace function public.bmc_increment_supporters()
returns integer language sql security definer set search_path = public as $$
  update public.site_supporters set count = count + 1, updated_at = now()
  where id = 1 returning count;
$$;
revoke all on function public.bmc_increment_supporters() from public, anon, authenticated;
-- Whole-season results matrix (all drivers × all rounds) from the warehouse —
-- complete + correct is_dnf, unlike the lagging Jolpica aggregate. Powers the
-- Reliability tab. Anon-readable (public F1 data).
drop function if exists public.get_season_results(integer);
create or replace function public.get_season_results(p_season integer)
returns table (
  round integer, race_name text, driver_id text, code text, driver_name text,
  constructor_id text, constructor text, country text,
  "position" text, is_dnf boolean, status text, points numeric
)
language sql stable security definer set search_path = public as $$
  select
    r.round, ra.race_name, r.driver_id, d.code,
    coalesce(d.display_name_override,
             nullif(trim(coalesce(d.given_name,'') || ' ' || coalesce(d.family_name,'')), ''),
             r.driver_id),
    r.constructor_id, coalesce(co.display_name_override, co.name),
    ci.country, r.position_text, r.is_dnf, r.status, r.points
  from f1_race_result r
  join f1_race ra on ra.id = r.race_id
  left join f1_driver d on d.ergast_id = r.driver_id
  left join f1_circuit ci on ci.circuit_id = ra.circuit_id
  left join f1_constructor co on co.ergast_id = r.constructor_id
  where r.season = p_season
  order by r.round, r.position nulls last;
$$;
grant execute on function public.get_season_results(integer) to anon, authenticated;
-- Lap counts per driver for a qualifying session.
--
-- The F1-style qualifying classification table shows a LAPS column, but Ergast's
-- qualifying payload has no lap count — get_qualifying can't supply it. The counts do
-- exist in f1_lap (session_type = 'Q'), so expose them as a small side lookup the
-- classification table joins on driver_id, rather than reshaping get_qualifying and
-- churning every existing consumer.
--
-- Returns {driver_id: laps}, or {} when the session's laps haven't been ingested yet —
-- the table renders "—" for the column in that case.

create or replace function public.get_qualifying_laps(p_season integer, p_round integer)
returns jsonb
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(jsonb_object_agg(driver_id, laps), '{}'::jsonb)
  from (
    select driver_id, count(*)::int as laps
    from public.f1_lap
    where season = p_season
      and round = p_round
      and session_type = 'Q'
    group by driver_id
  ) t;
$function$;

grant execute on function public.get_qualifying_laps(integer, integer) to anon, authenticated, service_role;
-- Mark results that were ingested before Ergast published the round.
--
-- FastF1 fills DriverId, TeamId, GridPosition, Status, Points and Laps only from Ergast,
-- which lags a race by hours. The ingester now derives those from live timing so a
-- finished race is usable within minutes, but the derived values are approximations:
-- status is a plain Finished/Retired instead of Ergast's "+1 Lap"/"Accident"/…, points
-- assume full race distance, and race time is absent entirely.
--
-- Without a marker there is no way to tell a derived row from an authoritative one, and
-- _round_done() treats any round with results as finished — so the cron would skip it
-- forever and the provisional values would never be replaced. This flag lets the
-- reconcile keep retrying a round until Ergast lands, then settle.

alter table public.f1_race_result
  add column if not exists provisional boolean not null default false;

alter table public.f1_sprint_result
  add column if not exists provisional boolean not null default false;

comment on column public.f1_race_result.provisional is
  'True when the row was derived from live timing because Ergast had not published the round yet. Reconcile re-ingests provisional rounds until authoritative data replaces them.';

-- Backfill: 2026 R10 (Spa) was ingested from live timing while Ergast was still silent.
update public.f1_race_result
set provisional = true
where season = 2026 and round = 10;
-- ---------------------------------------------------------------------------
-- Deep Dive pre-rendered charts (analysis/generate.py). Discovery index; heavy
-- PNGs live in R2, thumbs as WebP.
-- Decomposed KEEP half of 20260708194100_remote_schema.sql (DDL + public-read
-- policy + grants; push/login halves dropped), folded
-- with theme axis (20260724) and thumb_path (20260909 R2) so the final unique
-- key is (season, round, session, chart_type, theme) directly.
-- ---------------------------------------------------------------------------
create table if not exists public.analysis_charts (
  id uuid not null default gen_random_uuid(),
  season integer not null,
  round integer not null,
  session text not null default 'R',
  chart_type text not null,
  title text not null,
  description text,
  storage_path text not null,
  public_url text not null,
  drivers text[],
  theme text not null default 'dark',
  thumb_path text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint analysis_charts_pkey primary key (id),
  constraint analysis_charts_season_round_session_chart_type_theme_key
    unique (season, round, session, chart_type, theme)
);

create index if not exists idx_analysis_charts_race
  on public.analysis_charts (season, round, session);

alter table public.analysis_charts enable row level security;

drop policy if exists analysis_charts_public_read on public.analysis_charts;
create policy analysis_charts_public_read
  on public.analysis_charts as permissive for select to public using (true);

grant select, insert, update, delete, truncate, references, trigger
  on public.analysis_charts to anon, authenticated, service_role;

comment on column public.analysis_charts.theme is
  'Colour theme this render targets: dark | light | glass. The frontend picks it from the viewer''s theme (glass and dark both come from the app''s dark base).';

-- Public reads of the charts Storage bucket (kept half of remote_schema).
drop policy if exists charts_public_read on storage.objects;
create policy charts_public_read
  on storage.objects as permissive for select to public using ((bucket_id = 'charts'::text));
-- Repoint the request bridge from GitHub Actions to CircleCI.
--
-- Why: the whole pipeline moved to CircleCI on 2026-09-13 after the GitHub account's
-- shared 3,000 included Actions minutes ran out mid-race-weekend and .github was deleted.
-- These triggers still POSTed to api.github.com/repos/…/dispatches, which now has nothing
-- to trigger, so a Deep Dive custom-chart request or a Pit Wall any-lap request would sit
-- pending forever.
--
-- What changes: the same trigger semantics (fire when a row ENTERS 'pending', on insert
-- or on a retry update) now POST to CircleCI's v2 pipeline endpoint with the run_job
-- pipeline parameter that .circleci/config.yml declares.
--
-- The GitHub version passed the row's id/season/round/session as client_payload. CircleCI
-- pipeline parameters must be declared in config, and the processors do not need them
-- anyway: process_chart_requests.py and process_telemetry_requests.py claim and drain
-- every pending row themselves. So only run_job is sent.
--
-- PREREQUISITE — store a CircleCI token that can TRIGGER pipelines:
--   select vault.create_secret('<circleci personal API token>', 'circleci_token');
--   -- optional, defaults to gh/ibrahimroshdy/f1datastop:
--   select vault.create_secret('gh/ibrahimroshdy/f1datastop', 'circleci_project');
--
-- A project *Status* token is NOT enough — status tokens answer 404 on the pipeline
-- endpoint. The function no-ops with a warning when the secret is missing, so applying
-- this before the secret exists is safe.

create extension if not exists pg_net;

create or replace function public.dispatch_ci_request()
returns trigger
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  cci_token   text;
  cci_project text;
  ev          text;
begin
  -- Only the transition INTO pending is a new job: ordinary updates (status ->
  -- processing/done/error, updated_at touches) must not re-fire the pipeline.
  if tg_op = 'UPDATE' and old.status is not distinct from 'pending' then
    return new;
  end if;

  ev := case tg_table_name
          when 'f1_chart_requests'     then 'chart_request'
          when 'f1_telemetry_requests' then 'telemetry_request'
          else null
        end;
  if ev is null then
    return new;
  end if;

  select decrypted_secret into cci_token
    from vault.decrypted_secrets where name = 'circleci_token' limit 1;
  select decrypted_secret into cci_project
    from vault.decrypted_secrets where name = 'circleci_project' limit 1;

  if cci_token is null then
    raise warning 'dispatch_ci_request: missing vault secret circleci_token — skipping dispatch';
    return new;
  end if;
  cci_project := coalesce(cci_project, 'gh/ibrahimroshdy/f1datastop');

  perform net.http_post(
    url := 'https://circleci.com/api/v2/project/' || cci_project || '/pipeline',
    headers := jsonb_build_object(
      'Circle-Token', cci_token,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'branch', 'main',
      'parameters', jsonb_build_object('run_job', ev)
    )
  );
  return new;
end;
$$;

-- Repoint both triggers, then retire the GitHub function.
drop trigger if exists trg_dispatch_chart_request on public.f1_chart_requests;
create trigger trg_dispatch_chart_request
  after insert or update on public.f1_chart_requests
  for each row when (new.status = 'pending')
  execute function public.dispatch_ci_request();

drop trigger if exists trg_dispatch_telemetry_request on public.f1_telemetry_requests;
create trigger trg_dispatch_telemetry_request
  after insert or update on public.f1_telemetry_requests
  for each row when (new.status = 'pending')
  execute function public.dispatch_ci_request();

drop function if exists public.dispatch_github_request();
-- 3) Bounded log/cache tables (api_metrics is now sampled at the edge function too).
select cron.schedule(
  'log-retention-daily',
  '41 4 * * *',
  $cron$
    delete from public.api_metrics where created_at < now() - interval '14 days';
    delete from public.api_cache where expires_at < now() - interval '1 day';
  $cron$
);

-- 4) DB size probe for the free-tier digest (service role only).
create or replace function public.db_size_bytes()
returns bigint language sql security definer set search_path = public, pg_temp as
$$ select pg_database_size(current_database()) $$;
revoke all on function public.db_size_bytes() from public, anon, authenticated;
grant execute on function public.db_size_bytes() to service_role;

-- END BASELINE.
