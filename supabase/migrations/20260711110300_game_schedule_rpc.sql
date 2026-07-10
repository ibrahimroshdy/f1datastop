-- F1 Prediction Game — Phase 2 — schedule view for the game (rounds + deadlines + lock/result state).
create or replace function public.get_game_schedule(p_season int)
returns table (
  round int,
  race_name text,
  country text,
  deadline timestamptz,
  is_sprint boolean,
  is_locked boolean,
  has_results boolean
) language sql stable set search_path = public, pg_temp as $$
  select r.round,
         r.race_name,
         c.country,
         public.weekend_deadline(r.season, r.round) as deadline,
         exists (select 1 from public.f1_session s
                 where s.season = r.season and s.round = r.round and s.session_type in ('S','SQ')) as is_sprint,
         (public.weekend_deadline(r.season, r.round) is not null
          and now() >= public.weekend_deadline(r.season, r.round)) as is_locked,
         exists (select 1 from public.f1_race_result rr
                 where rr.season = r.season and rr.round = r.round) as has_results
  from public.f1_race r
  left join public.f1_circuit c on c.circuit_id = r.circuit_id
  where r.season = p_season
  order by r.round
$$;
grant execute on function public.get_game_schedule(int) to authenticated;
