-- ============================================================================
-- Back-port the production get_schedule() definition into the repo.
-- Prod drifted ahead of the baseline: it joins sessions by (season, round)
-- instead of race_id and falls back to date_start (official FastF1 feed
-- times) when scheduled_date/scheduled_time are NULL. Without this file a
-- fresh database serves different schedule payloads than production.
-- ============================================================================

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
                      'date', to_char(
                                COALESCE(s.scheduled_date, (s.date_start AT TIME ZONE 'UTC')::date),
                                'YYYY-MM-DD'),
                      'time', COALESCE(
                                s.scheduled_time,
                                to_char(s.date_start AT TIME ZONE 'UTC', 'HH24:MI:SS') || 'Z')
                    )) AS payload
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
$$;
GRANT EXECUTE ON FUNCTION public.get_schedule(int) TO anon, authenticated;
-- Keep the 20260620 search_path hardening: CREATE OR REPLACE above resets any
-- prior ALTER ... SET search_path, so re-pin here (matches baseline §9).
ALTER FUNCTION public.get_schedule(int) SET search_path = public, pg_temp;
