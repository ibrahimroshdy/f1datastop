-- F1 Prediction Game — Phase 4 — admin dashboard + audit + all-time standings.

create table if not exists public.game_audit_log (
  id         uuid primary key default gen_random_uuid(),
  actor      uuid references auth.users(id) on delete set null,
  action     text not null,
  detail     jsonb,
  created_at timestamptz not null default now()
);
alter table public.game_audit_log enable row level security;
create policy game_audit_read on public.game_audit_log
  for select to authenticated using (public.is_game_admin());

create or replace function public._game_audit(p_action text, p_detail jsonb default null)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.game_audit_log (actor, action, detail) values (auth.uid(), p_action, p_detail);
$$;

-- Overview stats.
create or replace function public.admin_game_stats(p_season int)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_game_admin() then raise exception 'admin only'; end if;
  return jsonb_build_object(
    'players', (select count(*) from public.game_entry where season = p_season),
    'total_users', (select count(*) from auth.users),
    'leagues_total', (select count(*) from public.game_league where slug <> 'global'),
    'leagues_public', (select count(*) from public.game_league where is_public and slug <> 'global'),
    'leagues_private', (select count(*) from public.game_league where not is_public),
    'predictions_made', (select count(distinct rp.entry_id) from public.game_race_pick rp
                         join public.game_entry e on e.id = rp.entry_id where e.season = p_season),
    'pick_rows', (select count(*) from public.game_race_pick rp
                  join public.game_entry e on e.id = rp.entry_id where e.season = p_season),
    'graded_rounds', (select count(distinct ps.round) from public.game_pick_score ps
                      join public.game_entry e on e.id = ps.entry_id where e.season = p_season),
    'champion_picks', (select count(*) from public.game_champion_pick cp
                       join public.game_entry e on e.id = cp.entry_id where e.season = p_season)
  );
end $$;
grant execute on function public.admin_game_stats(int) to authenticated;

create or replace function public.admin_list_players(p_season int)
returns table (user_id uuid, username text, pick_rows int, total_points numeric, activated_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select e.user_id, pr.username,
    (select count(*)::int from public.game_race_pick rp where rp.entry_id = e.id),
    coalesce(et.total_points, 0),
    e.created_at
  from public.game_entry e
  left join public.profiles pr on pr.id = e.user_id
  left join public.game_entry_total et on et.entry_id = e.id
  where e.season = p_season and public.is_game_admin()
  order by coalesce(et.total_points, 0) desc
$$;
grant execute on function public.admin_list_players(int) to authenticated;

create or replace function public.admin_list_leagues()
returns table (id uuid, name text, slug text, is_public boolean, member_count int, created_by_name text, created_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select l.id, l.name, l.slug, l.is_public,
    (select count(*)::int from public.game_league_member m where m.league_id = l.id) as member_count,
    pr.username, l.created_at
  from public.game_league l
  left join public.profiles pr on pr.id = l.created_by
  where public.is_game_admin()
  order by member_count desc, l.created_at desc
$$;
grant execute on function public.admin_list_leagues() to authenticated;

create or replace function public.admin_regrade(p_season int)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_game_admin() then raise exception 'admin only'; end if;
  perform public.recalc_game_scores(p_season);
  perform public._game_audit('regrade', jsonb_build_object('season', p_season));
end $$;
grant execute on function public.admin_regrade(int) to authenticated;

create or replace function public.admin_update_season(
  p_season int, p_scoring_rules jsonb default null, p_status text default null,
  p_globally_locked boolean default null, p_champion_lock_round int default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_game_admin() then raise exception 'admin only'; end if;
  update public.game_season set
    scoring_rules = coalesce(p_scoring_rules, scoring_rules),
    status = coalesce(p_status, status),
    globally_locked = coalesce(p_globally_locked, globally_locked),
    champion_lock_round = coalesce(p_champion_lock_round, champion_lock_round),
    updated_at = now()
  where season = p_season;
  perform public._game_audit('update_season', jsonb_build_object(
    'season', p_season, 'status', p_status, 'locked', p_globally_locked, 'champ_lock', p_champion_lock_round));
end $$;
grant execute on function public.admin_update_season(int, jsonb, text, boolean, int) to authenticated;

-- All-time league standings (sum of every season's totals per member).
create or replace function public.get_league_alltime(p_league_id uuid)
returns table (user_id uuid, username text, total_points numeric, seasons_played int, rank int)
language sql stable security definer set search_path = public, pg_temp as $$
  with base as (
    select m.user_id,
      coalesce(sum(et.total_points), 0) tp,
      count(distinct et.season)::int sp
    from public.game_league_member m
    left join public.game_entry e on e.user_id = m.user_id
    left join public.game_entry_total et on et.entry_id = e.id
    where m.league_id = p_league_id and public.can_view_league(p_league_id)
    group by m.user_id
  )
  select b.user_id, pr.username, b.tp, b.sp,
    rank() over (order by b.tp desc, b.user_id)::int
  from base b left join public.profiles pr on pr.id = b.user_id
  order by rank
$$;
grant execute on function public.get_league_alltime(uuid) to authenticated;
