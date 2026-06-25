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
