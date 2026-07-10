-- F1 Prediction Game — Phase 1 — admin gate + per-season config.

-- Admin gate: only admin@f1datastop.com. Used across game RLS + audit.
create or replace function public.is_game_admin()
returns boolean language sql stable
set search_path = public, pg_temp as $$
  select coalesce((auth.jwt() ->> 'email') = 'admin@f1datastop.com', false)
$$;

-- One row per F1 season the game runs. Isolates scoring per season.
create table if not exists public.game_season (
  season               int primary key references public.f1_season(year),
  name                 text not null,
  status               text not null default 'upcoming'
                         check (status in ('upcoming','active','complete')),
  scoring_rules        jsonb not null default jsonb_build_object(
                         'version', 1,
                         'points', jsonb_build_object(
                           'Q', jsonb_build_array(25,18,15,12,10,8,6,4,2,1),
                           'R', jsonb_build_array(25,18,15,12,10,8,6,4,2,1),
                           'S', jsonb_build_array(8,7,6,5,4,3,2,1)),
                         'half_factor', 0.5,
                         'champion', jsonb_build_object('wdc',25,'wcc',25)),
  champion_lock_round  int,
  globally_locked      boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.game_season enable row level security;

create policy game_season_read on public.game_season
  for select to authenticated using (true);
create policy game_season_admin_write on public.game_season
  for all to authenticated using (public.is_game_admin()) with check (public.is_game_admin());

-- Seed the 2026 season as active.
insert into public.game_season (season, name, status)
values (2026, '2026 F1 League', 'active')
on conflict (season) do nothing;
