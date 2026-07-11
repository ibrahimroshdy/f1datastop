-- F1 Prediction Game — Stage 1 polish — rank movement in standings + per-player stats.

drop function if exists public.get_league_standings(uuid, int);
drop function if exists public.get_league_stats(uuid, int);

-- Standings now include `movement` (rank climb since the previous graded round; + = up).
create or replace function public.get_league_standings(p_league_id uuid, p_season int)
returns table (
  user_id uuid, username text, avatar_url text,
  total_points numeric, exact_hits int, champions_correct int, goat_count int,
  rank int, movement int)
language sql stable security definer set search_path = public, pg_temp as $$
  with allowed as (select public.can_view_league(p_league_id) ok),
  two as (
    select round from public.game_rank_snapshot
    where league_id = p_league_id and season = p_season
    group by round order by round desc limit 2
  ),
  bounds as (select max(round) hi, min(round) lo from two),
  mv as (
    select cur.user_id, (prv.rank - cur.rank) as movement
    from public.game_rank_snapshot cur
    cross join bounds
    left join public.game_rank_snapshot prv
      on prv.league_id = p_league_id and prv.season = p_season
     and prv.user_id = cur.user_id and prv.round = bounds.lo and bounds.lo <> bounds.hi
    where cur.league_id = p_league_id and cur.season = p_season and cur.round = bounds.hi
  ),
  base as (
    select m.user_id,
      coalesce(et.total_points, 0) tp, coalesce(et.exact_hits, 0) eh,
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
    rank() over (order by b.tp desc, b.eh desc, b.cc desc, b.gc desc, b.user_id)::int,
    coalesce(mv.movement, 0)::int
  from base b
  left join public.profiles pr on pr.id = b.user_id
  left join mv on mv.user_id = b.user_id
  order by rank, b.user_id
$$;
grant execute on function public.get_league_standings(uuid, int) to authenticated;

-- Per-player accuracy stats for a league+season.
create or replace function public.get_league_stats(p_league_id uuid, p_season int)
returns table (
  user_id uuid, username text, rounds_played int,
  total_points numeric, best_round numeric, avg_round numeric, exact_hits int)
language sql stable security definer set search_path = public, pg_temp as $$
  with per_round as (
    select m.user_id, ps.round, sum(ps.points) pts, sum(ps.exact_hits) eh
    from public.game_league_member m
    join public.game_entry e on e.user_id = m.user_id and e.season = p_season
    join public.game_pick_score ps on ps.entry_id = e.id
    where m.league_id = p_league_id and public.can_view_league(p_league_id)
    group by m.user_id, ps.round
  )
  select pr2.user_id, prof.username,
    count(*)::int rounds_played,
    coalesce(sum(pr2.pts),0) total_points,
    coalesce(max(pr2.pts),0) best_round,
    round(coalesce(avg(pr2.pts),0), 1) avg_round,
    coalesce(sum(pr2.eh),0)::int exact_hits
  from per_round pr2
  left join public.profiles prof on prof.id = pr2.user_id
  group by pr2.user_id, prof.username
  order by total_points desc
$$;
grant execute on function public.get_league_stats(uuid, int) to authenticated;
