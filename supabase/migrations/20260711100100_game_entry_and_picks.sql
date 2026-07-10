-- F1 Prediction Game — Phase 1 — player entry + picks.

-- One entry per (user, season). Existence == "activated for that season".
create table if not exists public.game_entry (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  season     int  not null references public.game_season(season),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, season)
);
create index if not exists game_entry_season_idx on public.game_entry(season);
create index if not exists game_entry_user_idx on public.game_entry(user_id);

-- Ordered top-N picks for one session of one round.
create table if not exists public.game_race_pick (
  entry_id     uuid not null references public.game_entry(id) on delete cascade,
  round        int not null,
  session_type text not null check (session_type in ('Q','R','S')),
  position     smallint not null check (position between 1 and 20),
  driver_id    text not null references public.f1_driver(ergast_id),
  primary key (entry_id, round, session_type, position)
);
create index if not exists game_race_pick_entry_idx on public.game_race_pick(entry_id);

-- Season-long champion picks.
create table if not exists public.game_champion_pick (
  entry_id           uuid primary key references public.game_entry(id) on delete cascade,
  wdc_driver_id      text references public.f1_driver(ergast_id),
  wcc_constructor_id text references public.f1_constructor(ergast_id),
  updated_at         timestamptz not null default now()
);

alter table public.game_entry enable row level security;
alter table public.game_race_pick enable row level security;
alter table public.game_champion_pick enable row level security;

create policy game_entry_own on public.game_entry
  for select to authenticated using (user_id = auth.uid() or public.is_game_admin());
create policy game_entry_insert_own on public.game_entry
  for insert to authenticated with check (user_id = auth.uid());
create policy game_entry_admin on public.game_entry
  for all to authenticated using (public.is_game_admin()) with check (public.is_game_admin());

create policy game_race_pick_own on public.game_race_pick
  for select to authenticated using (
    exists (select 1 from public.game_entry e where e.id = entry_id
            and (e.user_id = auth.uid() or public.is_game_admin())));
create policy game_champion_pick_own on public.game_champion_pick
  for select to authenticated using (
    exists (select 1 from public.game_entry e where e.id = entry_id
            and (e.user_id = auth.uid() or public.is_game_admin())));
-- pick WRITE policies are added in Phase 2 alongside game_pick_is_editable.
