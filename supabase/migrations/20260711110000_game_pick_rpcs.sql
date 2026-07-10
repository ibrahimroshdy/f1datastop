-- F1 Prediction Game — Phase 2 — pick save/read RPCs (writes go through SECURITY DEFINER
-- functions that enforce editability; game_race_pick/game_champion_pick have no direct write RLS).

-- Drivers available to pick for a season (current grid, from race results), with team colour info.
create or replace function public.get_season_drivers(p_season int)
returns table (driver_id text, code text, name text, constructor_id text, constructor_name text)
language sql stable set search_path = public, pg_temp as $$
  with latest as (
    select distinct on (rr.driver_id) rr.driver_id, rr.constructor_id
    from public.f1_race_result rr
    where rr.season = p_season
    order by rr.driver_id, rr.round desc
  )
  select d.ergast_id, d.code, (d.given_name || ' ' || d.family_name),
         l.constructor_id, c.name
  from latest l
  join public.f1_driver d on d.ergast_id = l.driver_id
  left join public.f1_constructor c on c.ergast_id = l.constructor_id
  order by d.family_name
$$;
grant execute on function public.get_season_drivers(int) to authenticated;

-- Save an ordered top-N pick for one session of one round. Replaces any existing picks.
create or replace function public.save_race_pick(
  p_season int, p_round int, p_session_type text, p_driver_ids text[])
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_entry uuid;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  if p_session_type not in ('Q','R','S') then raise exception 'bad session type'; end if;
  select id into v_entry from public.game_entry where user_id = v_uid and season = p_season;
  if v_entry is null then raise exception 'not activated for season %', p_season; end if;
  if not public.game_pick_is_editable(v_entry, p_round) then raise exception 'picks are locked'; end if;
  if array_length(p_driver_ids, 1) is not null
     and (select count(distinct d) from unnest(p_driver_ids) d) <> array_length(p_driver_ids, 1) then
    raise exception 'duplicate drivers in pick';
  end if;
  delete from public.game_race_pick
    where entry_id = v_entry and round = p_round and session_type = p_session_type;
  insert into public.game_race_pick (entry_id, round, session_type, position, driver_id)
    select v_entry, p_round, p_session_type, ord::smallint, did
    from unnest(p_driver_ids) with ordinality as t(did, ord)
    where did is not null;
end $$;
grant execute on function public.save_race_pick(int, int, text, text[]) to authenticated;

-- Save the season-long champion picks.
create or replace function public.save_champion_pick(p_season int, p_wdc text, p_wcc text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_entry uuid;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  select id into v_entry from public.game_entry where user_id = v_uid and season = p_season;
  if v_entry is null then raise exception 'not activated for season %', p_season; end if;
  if not public.game_champion_is_editable(v_entry) then raise exception 'champion picks are locked'; end if;
  insert into public.game_champion_pick (entry_id, wdc_driver_id, wcc_constructor_id, updated_at)
    values (v_entry, p_wdc, p_wcc, now())
    on conflict (entry_id) do update
      set wdc_driver_id = excluded.wdc_driver_id,
          wcc_constructor_id = excluded.wcc_constructor_id,
          updated_at = now();
end $$;
grant execute on function public.save_champion_pick(int, text, text) to authenticated;
