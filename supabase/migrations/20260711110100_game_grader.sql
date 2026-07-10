-- F1 Prediction Game — Phase 2 — the scoring engine (pure set-based SQL, idempotent).
-- Reads already-ingested f1_qualifying_result / f1_race_result / f1_sprint_result.

-- Per-league rank snapshots (cumulative-to-round) + per-race GOAT/flop awards.
create or replace function public.refresh_league_snapshots_and_awards(p_season int, p_round int default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare r record;
begin
  for r in
    select distinct l.id as league_id, ps.round
    from public.game_league l
    join public.game_league_member m on m.league_id = l.id
    join public.game_entry e on e.user_id = m.user_id and e.season = p_season
    join public.game_pick_score ps on ps.entry_id = e.id
    where (p_round is null or ps.round = p_round)
  loop
    -- Snapshot: rank by cumulative points through this round.
    delete from public.game_rank_snapshot
      where league_id = r.league_id and season = p_season and round = r.round;
    insert into public.game_rank_snapshot (league_id, season, user_id, round, rank, total_points, captured_at)
    select r.league_id, p_season, m.user_id, r.round,
           rank() over (order by ct.pts desc), ct.pts, now()
    from public.game_league_member m
    join lateral (
      select coalesce(sum(ps.points), 0) as pts
      from public.game_pick_score ps
      join public.game_entry e2 on e2.id = ps.entry_id
      where e2.user_id = m.user_id and e2.season = p_season and ps.round <= r.round
    ) ct on true
    where m.league_id = r.league_id;

    -- Award: this round's points per member; GOAT = max, flop = min (needs >=2 members, spread > 0).
    delete from public.game_race_award
      where league_id = r.league_id and season = p_season and round = r.round;
    insert into public.game_race_award (league_id, season, round, user_id, points, is_goat, is_flop)
    select r.league_id, p_season, r.round, x.user_id, x.pts,
           (mx.c >= 2 and mx.mp > mx.mn and x.pts = mx.mp),
           (mx.c >= 2 and mx.mp > mx.mn and x.pts = mx.mn)
    from (
      select m.user_id, coalesce(sum(ps.points), 0) as pts
      from public.game_league_member m
      join public.game_entry e on e.user_id = m.user_id and e.season = p_season
      left join public.game_pick_score ps on ps.entry_id = e.id and ps.round = r.round
      where m.league_id = r.league_id
      group by m.user_id
    ) x
    cross join (
      select count(*) c, max(pts) mp, min(pts) mn from (
        select coalesce(sum(ps.points), 0) pts
        from public.game_league_member m
        join public.game_entry e on e.user_id = m.user_id and e.season = p_season
        left join public.game_pick_score ps on ps.entry_id = e.id and ps.round = r.round
        where m.league_id = r.league_id
        group by m.user_id
      ) y
    ) mx;
  end loop;
end $$;
grant execute on function public.refresh_league_snapshots_and_awards(int, int) to authenticated;

-- Main grader.
create or replace function public.recalc_game_scores(p_season int, p_round int default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_pts jsonb; v_hf numeric; v_status text;
begin
  select scoring_rules -> 'points', (scoring_rules ->> 'half_factor')::numeric, status
    into v_pts, v_hf, v_status
  from public.game_season where season = p_season;
  if v_pts is null then return; end if;

  -- 1) Per-session pick scores from finished sessions.
  with actual as (
    select round, 'Q'::text st, driver_id, position from public.f1_qualifying_result
      where season = p_season and position is not null
    union all
    select round, 'R', driver_id, position from public.f1_race_result
      where season = p_season and position is not null
    union all
    select round, 'S', driver_id, position from public.f1_sprint_result
      where season = p_season and position is not null
  ),
  scored as (
    select p.entry_id, p.round, p.session_type,
      sum(case
            when a.position = p.position
              then coalesce((v_pts -> p.session_type ->> (p.position - 1))::numeric, 0)
            when a.position between 1 and jsonb_array_length(v_pts -> p.session_type)
              then v_hf * coalesce((v_pts -> p.session_type ->> (p.position - 1))::numeric, 0)
            else 0
          end) as points,
      count(*) filter (where a.position = p.position) as exact_hits
    from public.game_race_pick p
    join public.game_entry e on e.id = p.entry_id and e.season = p_season
    left join actual a on a.round = p.round and a.st = p.session_type and a.driver_id = p.driver_id
    where (p_round is null or p.round = p_round)
      and exists (select 1 from actual a2 where a2.round = p.round and a2.st = p.session_type)
    group by p.entry_id, p.round, p.session_type
  )
  insert into public.game_pick_score (entry_id, round, session_type, points, exact_hits, scored_at)
  select entry_id, round, session_type, coalesce(points, 0), coalesce(exact_hits, 0), now() from scored
  on conflict (entry_id, round, session_type) do update
    set points = excluded.points, exact_hits = excluded.exact_hits, scored_at = now();

  -- 2) Champion bonuses — only once the season is complete.
  if v_status = 'complete' then
    with fin as (select max(round) r from public.f1_driver_standing where season = p_season),
    wdc as (select s.driver_id from public.f1_driver_standing s, fin
            where s.season = p_season and s.round = fin.r and s.position = 1),
    wcc as (select s.constructor_id from public.f1_constructor_standing s, fin f
            where s.season = p_season and s.round = f.r and s.position = 1),
    champ as (
      select cp.entry_id,
        case when cp.wdc_driver_id = (select driver_id from wdc)
             then (v_pts is not null)::int * coalesce((select (scoring_rules -> 'champion' ->> 'wdc')::numeric
                                                       from public.game_season where season = p_season), 0)
             else 0 end as wdc_pts,
        case when cp.wcc_constructor_id = (select constructor_id from wcc)
             then coalesce((select (scoring_rules -> 'champion' ->> 'wcc')::numeric
                            from public.game_season where season = p_season), 0)
             else 0 end as wcc_pts
      from public.game_champion_pick cp
      join public.game_entry e on e.id = cp.entry_id and e.season = p_season
    )
    insert into public.game_bonus_score (entry_id, season, reason, points, scored_at)
    select entry_id, p_season, 'wdc', wdc_pts, now() from champ
    union all
    select entry_id, p_season, 'wcc', wcc_pts, now() from champ
    on conflict (entry_id, reason) do update set points = excluded.points, scored_at = now();
  end if;

  -- 3) Entry totals.
  insert into public.game_entry_total (entry_id, season, total_points, exact_hits, champions_correct, last_scored_at)
  select e.id, p_season,
    coalesce((select sum(points) from public.game_pick_score ps where ps.entry_id = e.id), 0)
      + coalesce((select sum(points) from public.game_bonus_score bs where bs.entry_id = e.id), 0),
    coalesce((select sum(exact_hits) from public.game_pick_score ps where ps.entry_id = e.id), 0),
    coalesce((select count(*) from public.game_bonus_score bs where bs.entry_id = e.id and bs.points > 0), 0),
    now()
  from public.game_entry e where e.season = p_season
  on conflict (entry_id) do update
    set total_points = excluded.total_points, exact_hits = excluded.exact_hits,
        champions_correct = excluded.champions_correct, last_scored_at = now();

  -- 4 + 5) League snapshots + race awards.
  perform public.refresh_league_snapshots_and_awards(p_season, p_round);
end $$;
grant execute on function public.recalc_game_scores(int, int) to authenticated;
