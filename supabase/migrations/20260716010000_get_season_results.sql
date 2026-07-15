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
