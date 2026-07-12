-- Full-race position replay: per-driver X/Y traces on a shared time grid, exported
-- from FastF1 (analysis/race_replay_export.py) into Storage bucket `replays`. This
-- table is the discovery index; the heavy frame arrays live in the blob. Post-race
-- / historical (batch) — NOT a live feed. Mirrors f1_circuit_geometry.
create table if not exists public.f1_race_replay (
  id bigint generated always as identity primary key,
  season int not null,
  round int not null,
  circuit_id text not null,
  circuit_name text,
  storage_path text not null,
  public_url text not null,
  driver_count int,
  frames int,
  duration_s numeric,
  rotation numeric,
  source text not null default 'fastf1',
  created_at timestamptz not null default now(),
  unique (season, circuit_id)
);

create unique index if not exists f1_race_replay_season_round
  on public.f1_race_replay (season, round);

alter table public.f1_race_replay enable row level security;

drop policy if exists f1_race_replay_public_read on public.f1_race_replay;
create policy f1_race_replay_public_read
  on public.f1_race_replay for select
  to anon, authenticated using (true);

create or replace function public.get_race_replay(p_season int, p_round int)
returns setof public.f1_race_replay
language sql stable security invoker
as $$
  select * from public.f1_race_replay
  where season = p_season and round = p_round
  limit 1;
$$;

insert into storage.buckets (id, name, public)
values ('replays', 'replays', true)
on conflict (id) do update set public = true;
