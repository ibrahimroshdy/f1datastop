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
