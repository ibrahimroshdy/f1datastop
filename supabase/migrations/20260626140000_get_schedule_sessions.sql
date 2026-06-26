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
$function$;