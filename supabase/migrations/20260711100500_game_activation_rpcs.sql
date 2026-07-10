-- F1 Prediction Game — Phase 1 — deadline/editability + activation RPCs.

-- First competitive session start of a weekend = the single weekend deadline.
create or replace function public.weekend_deadline(p_season int, p_round int)
returns timestamptz language sql stable
set search_path = public, pg_temp as $$
  select min(s.date_start)
  from public.f1_session s
  where s.season = p_season and s.round = p_round
    and s.session_type in ('SQ','S','Q','R')
$$;

create or replace function public.game_pick_is_editable(p_entry_id uuid, p_round int)
returns boolean language sql stable
set search_path = public, pg_temp as $$
  select coalesce(
    (select not gs.globally_locked
       and (public.weekend_deadline(e.season, p_round) is null
            or now() < public.weekend_deadline(e.season, p_round))
     from public.game_entry e
     join public.game_season gs on gs.season = e.season
     where e.id = p_entry_id),
    false)
$$;

create or replace function public.game_champion_is_editable(p_entry_id uuid)
returns boolean language sql stable
set search_path = public, pg_temp as $$
  select coalesce(
    (select not gs.globally_locked
       and (gs.champion_lock_round is null
            or public.weekend_deadline(e.season, gs.champion_lock_round) is null
            or now() < public.weekend_deadline(e.season, gs.champion_lock_round))
     from public.game_entry e
     join public.game_season gs on gs.season = e.season
     where e.id = p_entry_id),
    false)
$$;

-- "Join the F1 League": create the caller's entry for a season + join the global league. Idempotent.
create or replace function public.activate_player(p_season int)
returns uuid language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_entry uuid; v_global uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.game_season where season = p_season and status <> 'complete') then
    raise exception 'season % not open', p_season;
  end if;
  insert into public.game_entry (user_id, season) values (v_uid, p_season)
    on conflict (user_id, season) do update set updated_at = now()
    returning id into v_entry;
  select id into v_global from public.game_league where slug = 'global';
  insert into public.game_league_member (league_id, user_id)
    values (v_global, v_uid) on conflict do nothing;
  return v_entry;
end $$;
grant execute on function public.activate_player(int) to authenticated;

-- Admin: open a new season + auto-create entries for all existing league members.
create or replace function public.open_season(p_season int, p_name text)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if not public.is_game_admin() then raise exception 'admin only'; end if;
  insert into public.game_season (season, name, status) values (p_season, p_name, 'active')
    on conflict (season) do update set status = 'active';
  insert into public.game_entry (user_id, season)
    select distinct m.user_id, p_season
    from public.game_league_member m
    on conflict (user_id, season) do nothing;
end $$;
grant execute on function public.open_season(int, text) to authenticated;
