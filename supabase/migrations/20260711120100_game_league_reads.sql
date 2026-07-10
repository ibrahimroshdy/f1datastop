-- F1 Prediction Game — Phase 3 — league read RPCs (standings, my leagues, history, awards, reveal).

create or replace function public.can_view_league(p_league_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.is_game_admin() or exists (
    select 1 from public.game_league l
    where l.id = p_league_id and (
      l.is_public or exists (
        select 1 from public.game_league_member m where m.league_id = l.id and m.user_id = auth.uid())))
$$;
grant execute on function public.can_view_league(uuid) to authenticated;

-- Per-season standings with the full tiebreak cascade:
-- total → exact hits → champions correct → GOAT count → stable user id.
create or replace function public.get_league_standings(p_league_id uuid, p_season int)
returns table (
  user_id uuid, username text, avatar_url text,
  total_points numeric, exact_hits int, champions_correct int, goat_count int, rank int)
language sql stable security definer set search_path = public, pg_temp as $$
  with allowed as (select public.can_view_league(p_league_id) ok),
  base as (
    select m.user_id,
      coalesce(et.total_points, 0) tp,
      coalesce(et.exact_hits, 0) eh,
      coalesce(et.champions_correct, 0) cc,
      coalesce((select count(*) from public.game_race_award a
                where a.league_id = p_league_id and a.season = p_season
                  and a.user_id = m.user_id and a.is_goat), 0)::int gc
    from public.game_league_member m
    left join public.game_entry e on e.user_id = m.user_id and e.season = p_season
    left join public.game_entry_total et on et.entry_id = e.id
    where m.league_id = p_league_id and (select ok from allowed)
  )
  select b.user_id, pr.username, pr.avatar_url, b.tp, b.eh, b.cc, b.gc,
    rank() over (order by b.tp desc, b.eh desc, b.cc desc, b.gc desc, b.user_id)::int
  from base b left join public.profiles pr on pr.id = b.user_id
  order by rank, b.user_id
$$;
grant execute on function public.get_league_standings(uuid, int) to authenticated;

create or replace function public.get_my_leagues(p_season int)
returns table (
  league_id uuid, name text, slug text, is_public boolean, role text,
  member_count int, my_rank int, my_points numeric)
language sql stable security definer set search_path = public, pg_temp as $$
  with mine as (select m.league_id, m.role from public.game_league_member m where m.user_id = auth.uid())
  select l.id, l.name, l.slug, l.is_public, mn.role,
    (select count(*)::int from public.game_league_member mm where mm.league_id = l.id),
    (select r.rnk from (
       select mem.user_id,
         rank() over (order by coalesce(et.total_points,0) desc, coalesce(et.exact_hits,0) desc, mem.user_id) rnk
       from public.game_league_member mem
       left join public.game_entry e on e.user_id = mem.user_id and e.season = p_season
       left join public.game_entry_total et on et.entry_id = e.id
       where mem.league_id = l.id
     ) r where r.user_id = auth.uid())::int,
    coalesce((select et.total_points from public.game_entry e
              join public.game_entry_total et on et.entry_id = e.id
              where e.user_id = auth.uid() and e.season = p_season), 0)
  from mine mn join public.game_league l on l.id = mn.league_id
  order by (l.slug = 'global') desc, l.name
$$;
grant execute on function public.get_my_leagues(int) to authenticated;

create or replace function public.get_league_members(p_league_id uuid)
returns table (user_id uuid, username text, avatar_url text, role text, joined_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select m.user_id, pr.username, pr.avatar_url, m.role, m.joined_at
  from public.game_league_member m
  left join public.profiles pr on pr.id = m.user_id
  where m.league_id = p_league_id and public.can_view_league(p_league_id)
  order by m.role desc, m.joined_at
$$;
grant execute on function public.get_league_members(uuid) to authenticated;

create or replace function public.get_league_rank_history(p_league_id uuid, p_season int)
returns table (round int, user_id uuid, username text, rank int, total_points numeric)
language sql stable security definer set search_path = public, pg_temp as $$
  select s.round, s.user_id, pr.username, s.rank, s.total_points
  from public.game_rank_snapshot s
  left join public.profiles pr on pr.id = s.user_id
  where s.league_id = p_league_id and s.season = p_season and public.can_view_league(p_league_id)
  order by s.round, s.rank
$$;
grant execute on function public.get_league_rank_history(uuid, int) to authenticated;

create or replace function public.get_league_round_awards(p_league_id uuid, p_season int)
returns table (round int, user_id uuid, username text, points numeric, is_goat boolean, is_flop boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select a.round, a.user_id, pr.username, a.points, a.is_goat, a.is_flop
  from public.game_race_award a
  left join public.profiles pr on pr.id = a.user_id
  where a.league_id = p_league_id and a.season = p_season and (a.is_goat or a.is_flop)
    and public.can_view_league(p_league_id)
  order by a.round
$$;
grant execute on function public.get_league_round_awards(uuid, int) to authenticated;

-- Reveal all members' picks for a round — only after the weekend lock and if policy allows.
create or replace function public.get_round_reveal(p_league_id uuid, p_season int, p_round int)
returns table (user_id uuid, username text, session_type text, position smallint, driver_id text)
language sql stable security definer set search_path = public, pg_temp as $$
  with ok as (
    select public.can_view_league(p_league_id)
       and (select pick_reveal_policy from public.game_league where id = p_league_id) = 'after_lock'
       and public.weekend_deadline(p_season, p_round) is not null
       and now() >= public.weekend_deadline(p_season, p_round) as show
  )
  select m.user_id, pr.username, rp.session_type, rp.position, rp.driver_id
  from public.game_league_member m
  join public.game_entry e on e.user_id = m.user_id and e.season = p_season
  join public.game_race_pick rp on rp.entry_id = e.id and rp.round = p_round
  left join public.profiles pr on pr.id = m.user_id
  where m.league_id = p_league_id and (select show from ok)
  order by m.user_id, rp.session_type, rp.position
$$;
grant execute on function public.get_round_reveal(uuid, int, int) to authenticated;
