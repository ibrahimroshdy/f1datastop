-- League premium redesign — data layer for the public leaderboard preview
-- (Phase 1b) plus league identity + a live activity feed (Phase 2).

-- ── 1b: public global-league leaderboard preview (anon-readable) ─────────────
-- Privacy-safe: display handle + avatar + points only. Powers the landing tower.
create or replace function public.get_public_league_preview(
  p_season integer default 2026,
  p_limit  integer default 10
) returns table (
  rank         integer,
  username     text,
  avatar_url   text,
  total_points numeric,
  exact_hits   integer
)
language sql stable security definer set search_path = public as $$
  select
    row_number() over (order by t.total_points desc, t.exact_hits desc)::int,
    coalesce(nullif(p.username, ''), 'Player'),
    p.avatar_url,
    t.total_points,
    t.exact_hits
  from public.game_entry_total t
  join public.game_entry e on e.id = t.entry_id
  join public.game_league_member m on m.user_id = e.user_id
  join public.game_league g on g.id = m.league_id and g.slug = 'global'
  left join public.profiles p on p.id = e.user_id
  where t.season = p_season
  order by t.total_points desc, t.exact_hits desc
  limit greatest(1, least(coalesce(p_limit, 10), 25));
$$;
grant execute on function public.get_public_league_preview(integer, integer) to anon, authenticated;

-- ── Phase 2: league identity ────────────────────────────────────────────────
alter table public.game_league
  add column if not exists crest       text,   -- emoji / short seed
  add column if not exists accent      text,   -- hex, e.g. '#e10600'
  add column if not exists banner_url  text,
  add column if not exists description text;

create or replace function public.update_league_identity(
  p_league      uuid,
  p_crest       text default null,
  p_accent      text default null,
  p_banner_url  text default null,
  p_description text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_game_admin()
     and not exists (
       select 1 from public.game_league_member
       where league_id = p_league and user_id = auth.uid() and role = 'captain'
     ) then
    raise exception 'not authorized';
  end if;
  update public.game_league set
    crest       = coalesce(p_crest, crest),
    accent      = coalesce(p_accent, accent),
    banner_url  = coalesce(p_banner_url, banner_url),
    description = coalesce(p_description, description)
  where id = p_league;
end $$;
grant execute on function public.update_league_identity(uuid, text, text, text, text) to authenticated;

-- ── Phase 2: league activity feed ───────────────────────────────────────────
create table if not exists public.game_league_event (
  id           uuid primary key default gen_random_uuid(),
  league_id    uuid not null references public.game_league(id) on delete cascade,
  season       integer,
  kind         text not null check (kind in ('join','leave','round_result','goat','flop','lead_change','reveal')),
  actor_user   uuid,
  subject_user uuid,
  round        integer,
  detail       jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists game_league_event_feed_idx
  on public.game_league_event (league_id, created_at desc);

alter table public.game_league_event enable row level security;

drop policy if exists game_league_event_read on public.game_league_event;
create policy game_league_event_read on public.game_league_event
  for select to authenticated
  using (public.can_view_league(league_id));
-- No direct writes: only the triggers / definer functions below insert.

-- Join / leave, captured off membership changes so the lifecycle RPCs stay untouched.
create or replace function public._game_league_member_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.game_league_event (league_id, kind, actor_user)
      values (new.league_id, 'join', new.user_id);
  elsif tg_op = 'DELETE' then
    insert into public.game_league_event (league_id, kind, actor_user)
      values (old.league_id, 'leave', old.user_id);
  end if;
  return null;
end $$;
drop trigger if exists game_league_member_event on public.game_league_member;
create trigger game_league_member_event
  after insert or delete on public.game_league_member
  for each row execute function public._game_league_member_event();

-- GOAT / flop of the round, captured off award writes (only the notable ones).
create or replace function public._game_race_award_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_goat or new.is_flop then
    insert into public.game_league_event (league_id, season, kind, subject_user, round, detail)
      values (
        new.league_id, new.season,
        case when new.is_goat then 'goat' else 'flop' end,
        new.user_id, new.round,
        jsonb_build_object('points', new.points)
      );
  end if;
  return null;
end $$;
drop trigger if exists game_race_award_event on public.game_race_award;
create trigger game_race_award_event
  after insert on public.game_race_award
  for each row execute function public._game_race_award_event();

-- Read feed with display handles resolved.
create or replace function public.get_league_activity(
  p_league uuid,
  p_limit  integer default 20
) returns table (
  id           uuid,
  kind         text,
  actor_user   uuid,
  subject_user uuid,
  actor_name   text,
  subject_name text,
  round        integer,
  detail       jsonb,
  created_at   timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    e.id, e.kind, e.actor_user, e.subject_user,
    coalesce(nullif(pa.username, ''), 'Player'),
    coalesce(nullif(ps.username, ''), 'Player'),
    e.round, e.detail, e.created_at
  from public.game_league_event e
  left join public.profiles pa on pa.id = e.actor_user
  left join public.profiles ps on ps.id = e.subject_user
  where e.league_id = p_league and public.can_view_league(p_league)
  order by e.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;
grant execute on function public.get_league_activity(uuid, integer) to authenticated;
