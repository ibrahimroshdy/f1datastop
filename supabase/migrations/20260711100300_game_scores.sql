-- F1 Prediction Game — Phase 1 — scoring-output tables (grader-written only).

create table if not exists public.game_pick_score (
  entry_id     uuid not null references public.game_entry(id) on delete cascade,
  round        int not null,
  session_type text not null check (session_type in ('Q','R','S')),
  points       numeric not null default 0,
  exact_hits   int not null default 0,
  breakdown    jsonb,
  scored_at    timestamptz not null default now(),
  primary key (entry_id, round, session_type)
);

create table if not exists public.game_bonus_score (
  id        uuid primary key default gen_random_uuid(),
  entry_id  uuid not null references public.game_entry(id) on delete cascade,
  season    int not null,
  reason    text not null check (reason in ('wdc','wcc')),
  points    numeric not null default 0,
  scored_at timestamptz not null default now(),
  unique (entry_id, reason)
);

create table if not exists public.game_entry_total (
  entry_id          uuid primary key references public.game_entry(id) on delete cascade,
  season            int not null,
  total_points      numeric not null default 0,
  exact_hits        int not null default 0,
  champions_correct int not null default 0,
  last_scored_at    timestamptz not null default now()
);
create index if not exists game_entry_total_season_idx on public.game_entry_total(season);

create table if not exists public.game_rank_snapshot (
  id           bigserial primary key,
  league_id    uuid not null references public.game_league(id) on delete cascade,
  season       int not null,
  user_id      uuid not null references auth.users(id) on delete cascade,
  round        int not null,
  rank         int not null,
  total_points numeric not null,
  captured_at  timestamptz not null default now()
);
create index if not exists game_rank_snapshot_league_idx on public.game_rank_snapshot(league_id, season, round);

create table if not exists public.game_race_award (
  league_id uuid not null references public.game_league(id) on delete cascade,
  season    int not null,
  round     int not null,
  user_id   uuid not null references auth.users(id) on delete cascade,
  points    numeric not null,
  is_goat   boolean not null default false,
  is_flop   boolean not null default false,
  primary key (league_id, season, round, user_id)
);

alter table public.game_pick_score enable row level security;
alter table public.game_bonus_score enable row level security;
alter table public.game_entry_total enable row level security;
alter table public.game_rank_snapshot enable row level security;
alter table public.game_race_award enable row level security;

-- Writes are service-role only (bypasses RLS) — no write policy = deny-all to anon/auth (correct).
create policy game_pick_score_read on public.game_pick_score
  for select to authenticated using (
    exists (select 1 from public.game_entry e where e.id = entry_id
            and (e.user_id = auth.uid() or public.is_game_admin())));
create policy game_bonus_score_read on public.game_bonus_score
  for select to authenticated using (
    exists (select 1 from public.game_entry e where e.id = entry_id
            and (e.user_id = auth.uid() or public.is_game_admin())));
create policy game_entry_total_read on public.game_entry_total
  for select to authenticated using (
    exists (select 1 from public.game_entry e where e.id = entry_id
            and (e.user_id = auth.uid() or public.is_game_admin())));
create policy game_rank_snapshot_read on public.game_rank_snapshot
  for select to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.game_league_member m
               where m.league_id = league_id and m.user_id = auth.uid())
    or public.is_game_admin());
create policy game_race_award_read on public.game_race_award
  for select to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.game_league_member m
               where m.league_id = league_id and m.user_id = auth.uid())
    or public.is_game_admin());
