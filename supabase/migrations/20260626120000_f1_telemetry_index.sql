-- Discovery index for FastF1 telemetry blobs stored in the `telemetry` bucket.
-- One row per exported driver-lap; the heavy channel data lives in Storage JSON,
-- not Postgres. Public-read, matching the other f1_* reference tables.
create table if not exists public.f1_telemetry_index (
  id bigint generated always as identity primary key,
  season int not null,
  round int not null,
  session text not null,
  driver_id text,
  driver_code text not null,
  lap_number int not null,
  lap_type text not null default 'fastest',
  storage_path text not null,
  public_url text not null,
  top_speed numeric,
  source text not null default 'fastf1',
  created_at timestamptz not null default now(),
  unique (season, round, session, driver_code, lap_number)
);

create index if not exists f1_telemetry_index_lookup
  on public.f1_telemetry_index (season, round, session);

alter table public.f1_telemetry_index enable row level security;

drop policy if exists f1_telemetry_index_public_read on public.f1_telemetry_index;
create policy f1_telemetry_index_public_read
  on public.f1_telemetry_index for select
  to anon, authenticated using (true);

-- List available telemetry laps for a session (React calls this to discover
-- which drivers/laps exist, then fetches each public_url blob directly).
create or replace function public.get_telemetry_index(
  p_season int, p_round int, p_session text default 'R'
) returns setof public.f1_telemetry_index
language sql stable security invoker
as $$
  select * from public.f1_telemetry_index
  where season = p_season and round = p_round and session = p_session
  order by top_speed desc nulls last, driver_code;
$$;

-- Public bucket for the telemetry JSON blobs (created out-of-band via the
-- Storage API; recorded here for completeness / fresh-project bootstrap).
insert into storage.buckets (id, name, public)
values ('telemetry', 'telemetry', true)
on conflict (id) do update set public = true;
