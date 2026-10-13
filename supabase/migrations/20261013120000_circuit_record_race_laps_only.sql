-- BUG-010: the circuit "Lap record · Fastest race lap" read the fastest lap of ANY session
-- and sorted lap times as text. Singapore showed RUS 1:29.158 (2025 qualifying) instead of
-- the fastest race lap, HAM 1:33.808 (2025). Only Grand Prix laps count now, ordered by
-- time_millis.
CREATE OR REPLACE FUNCTION public.get_circuit_detail(p_circuit_id text)
 RETURNS TABLE(circuit_id text, name text, locality text, country text, lat numeric, lng numeric, url text, record_driver_id text, record_driver_name text, record_driver_code text, record_time text, record_season integer, record_round integer, races_in_db integer, first_season integer, last_season integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with rec as (
    select l.driver_id, l.time_text, l.season, l.round
    from public.f1_lap l
    join public.f1_race r on r.season = l.season and r.round = l.round
    where r.circuit_id = p_circuit_id
      and l.session_type = 'R'
      and l.time_millis is not null and l.time_millis > 0
    order by l.time_millis asc
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
$function$;
GRANT EXECUTE ON FUNCTION public.get_circuit_detail(text) TO anon, authenticated;
