-- F1 Prediction Game — Stage 2 — competitive layer: joker, H2H, badges, percentile.

-- ── Joker: pick ONE round per season to double its points ─────────────────────
create table if not exists public.game_joker (
  entry_id   uuid primary key references public.game_entry(id) on delete cascade,
  round      int not null,
  updated_at timestamptz not null default now()
);
alter table public.game_joker enable row level security;
create policy game_joker_read on public.game_joker
  for select to authenticated using (
    exists (select 1 from public.game_entry e where e.id = entry_id
            and (e.user_id = auth.uid() or public.is_game_admin())));

create or replace function public.set_joker(p_season int, p_round int)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_entry uuid;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  select id into v_entry from public.game_entry where user_id = v_uid and season = p_season;
  if v_entry is null then raise exception 'not activated'; end if;
  if not public.game_pick_is_editable(v_entry, p_round) then raise exception 'that round is locked'; end if;
  insert into public.game_joker (entry_id, round) values (v_entry, p_round)
    on conflict (entry_id) do update set round = excluded.round, updated_at = now();
end $$;
grant execute on function public.set_joker(int, int) to authenticated;

-- Grader now doubles the joker round's points in each entry total.
create or replace function public.recalc_game_scores(p_season int, p_round int default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_pts jsonb; v_hf numeric; v_status text;
begin
  select scoring_rules -> 'points', (scoring_rules ->> 'half_factor')::numeric, status
    into v_pts, v_hf, v_status
  from public.game_season where season = p_season;
  if v_pts is null then return; end if;

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

  if v_status = 'complete' then
    with fin as (select max(round) r from public.f1_driver_standing where season = p_season),
    wdc as (select s.driver_id from public.f1_driver_standing s, fin
            where s.season = p_season and s.round = fin.r and s.position = 1),
    wcc as (select s.constructor_id from public.f1_constructor_standing s, fin f
            where s.season = p_season and s.round = f.r and s.position = 1),
    champ as (
      select cp.entry_id,
        case when cp.wdc_driver_id = (select driver_id from wdc)
             then coalesce((select (scoring_rules -> 'champion' ->> 'wdc')::numeric
                            from public.game_season where season = p_season), 0) else 0 end as wdc_pts,
        case when cp.wcc_constructor_id = (select constructor_id from wcc)
             then coalesce((select (scoring_rules -> 'champion' ->> 'wcc')::numeric
                            from public.game_season where season = p_season), 0) else 0 end as wcc_pts
      from public.game_champion_pick cp
      join public.game_entry e on e.id = cp.entry_id and e.season = p_season
    )
    insert into public.game_bonus_score (entry_id, season, reason, points, scored_at)
    select entry_id, p_season, 'wdc', wdc_pts, now() from champ
    union all
    select entry_id, p_season, 'wcc', wcc_pts, now() from champ
    on conflict (entry_id, reason) do update set points = excluded.points, scored_at = now();
  end if;

  insert into public.game_entry_total (entry_id, season, total_points, exact_hits, champions_correct, last_scored_at)
  select e.id, p_season,
    coalesce((select sum(points) from public.game_pick_score ps where ps.entry_id = e.id), 0)
      + coalesce((select sum(points) from public.game_bonus_score bs where bs.entry_id = e.id), 0)
      + coalesce((select sum(ps.points) from public.game_pick_score ps
                  join public.game_joker j on j.entry_id = ps.entry_id and j.round = ps.round
                  where ps.entry_id = e.id), 0),  -- joker: double that round
    coalesce((select sum(exact_hits) from public.game_pick_score ps where ps.entry_id = e.id), 0),
    coalesce((select count(*) from public.game_bonus_score bs where bs.entry_id = e.id and bs.points > 0), 0),
    now()
  from public.game_entry e where e.season = p_season
  on conflict (entry_id) do update
    set total_points = excluded.total_points, exact_hits = excluded.exact_hits,
        champions_correct = excluded.champions_correct, last_scored_at = now();

  perform public.refresh_league_snapshots_and_awards(p_season, p_round);
end $$;
grant execute on function public.recalc_game_scores(int, int) to authenticated;

-- ── Head-to-head: per-round points for two players in a league ────────────────
create or replace function public.get_h2h(p_league_id uuid, p_season int, p_a uuid, p_b uuid)
returns table (round int, a_points numeric, b_points numeric)
language sql stable security definer set search_path = public, pg_temp as $$
  with rr as (select distinct round from public.game_pick_score ps
              join public.game_entry e on e.id = ps.entry_id
              where e.season = p_season and e.user_id in (p_a, p_b))
  select rr.round,
    coalesce((select sum(ps.points) from public.game_pick_score ps
              join public.game_entry e on e.id = ps.entry_id
              where e.user_id = p_a and e.season = p_season and ps.round = rr.round), 0) a_points,
    coalesce((select sum(ps.points) from public.game_pick_score ps
              join public.game_entry e on e.id = ps.entry_id
              where e.user_id = p_b and e.season = p_season and ps.round = rr.round), 0) b_points
  from rr
  where public.can_view_league(p_league_id)
  order by rr.round
$$;
grant execute on function public.get_h2h(uuid, int, uuid, uuid) to authenticated;

-- ── Badges: computed from picks vs results ────────────────────────────────────
create or replace function public.get_player_badges(p_season int, p_user_id uuid)
returns table (key text, label text, count int)
language sql stable security definer set search_path = public, pg_temp as $$
  with actual as (
    select round, 'Q'::text st, driver_id, position from public.f1_qualifying_result where season=p_season and position is not null
    union all select round,'R',driver_id,position from public.f1_race_result where season=p_season and position is not null
    union all select round,'S',driver_id,position from public.f1_sprint_result where season=p_season and position is not null
  ),
  picks as (
    select rp.round, rp.session_type st, rp.position, (a.position = rp.position) hit
    from public.game_entry e
    join public.game_race_pick rp on rp.entry_id = e.id
    left join actual a on a.round = rp.round and a.st = rp.session_type and a.driver_id = rp.driver_id
    where e.user_id = p_user_id and e.season = p_season
  )
  select * from (values
    ('pole', 'Nailed Pole',
      (select count(*)::int from picks where st='Q' and position=1 and hit)),
    ('winner', 'Called the Win',
      (select count(*)::int from picks where st='R' and position=1 and hit)),
    ('podium', 'Perfect Podium',
      (select count(*)::int from (select round from picks where st='R' and position<=3
        group by round having sum((hit)::int)=3 and count(*)=3) z)),
    ('bullseye', 'Bullseye (5+ exact)',
      (select count(*)::int from (select round, st from picks
        group by round, st having sum((hit)::int) >= 5) z)),
    ('fullhouse', 'Full House',
      (select count(*)::int from (select round, st from picks
        group by round, st having bool_and(hit) and count(*) >= 8) z))
  ) b(key, label, count)
  where b.count > 0
$$;
grant execute on function public.get_player_badges(int, uuid) to authenticated;

-- ── Global percentile among all season players ───────────────────────────────
-- "Top X%" — lower is better (rank position over field size).
create or replace function public.get_global_percentile(p_season int, p_user_id uuid)
returns int language sql stable security definer set search_path = public, pg_temp as $$
  with ranked as (
    select e.user_id,
      rank() over (order by coalesce(et.total_points,0) desc) rnk,
      count(*) over () n
    from public.game_entry e
    left join public.game_entry_total et on et.entry_id = e.id
    where e.season = p_season
  )
  select greatest(1, ceil(rnk::numeric / nullif(n,0) * 100))::int from ranked where user_id = p_user_id
$$;
grant execute on function public.get_global_percentile(int, uuid) to authenticated;

-- My joker for a season.
create or replace function public.get_my_joker(p_season int)
returns int language sql stable security definer set search_path = public, pg_temp as $$
  select j.round from public.game_joker j
  join public.game_entry e on e.id = j.entry_id
  where e.user_id = auth.uid() and e.season = p_season
$$;
grant execute on function public.get_my_joker(int) to authenticated;
