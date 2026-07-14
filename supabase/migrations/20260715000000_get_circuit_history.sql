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
