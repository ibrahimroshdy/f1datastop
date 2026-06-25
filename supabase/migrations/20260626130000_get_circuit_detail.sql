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
