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
