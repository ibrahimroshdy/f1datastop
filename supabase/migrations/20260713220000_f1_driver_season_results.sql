-- Per-driver, whole-season race results from the warehouse (Modal/FastF1-fed),
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
