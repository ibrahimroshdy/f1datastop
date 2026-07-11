-- Circuit geometry: track outline + numbered corners + straight segments, derived
-- from FastF1 fastest-lap position data and get_circuit_info(). One blob per circuit
-- per season (2026 regs change layouts, and circuits are re-profiled year to year),
-- so the natural key is (season, circuit_id). The heavy point arrays live in Storage
-- (bucket `circuits`); this table is the discovery index. Mirrors f1_telemetry_index.
--
-- NOTE: 2026 dropped DRS, so there are NO DRS zones here by design. "Straights" are
-- computed from full-throttle stretches of the fastest lap, not from FIA zone data.
create table if not exists public.f1_circuit_geometry (
  id bigint generated always as identity primary key,
  season int not null,
  round int not null,
  circuit_id text not null,
  circuit_name text,
  storage_path text not null,
  public_url text not null,
  corner_count int,
  straight_count int,
  rotation numeric,
  source text not null default 'fastf1',
  created_at timestamptz not null default now(),
  unique (season, circuit_id)
);

-- One race per round per season, so (season, round) is unique too — lets the race
-- pages look geometry up by round without knowing the Ergast circuit_id.
create unique index if not exists f1_circuit_geometry_season_round
  on public.f1_circuit_geometry (season, round);

alter table public.f1_circuit_geometry enable row level security;

drop policy if exists f1_circuit_geometry_public_read on public.f1_circuit_geometry;
create policy f1_circuit_geometry_public_read
  on public.f1_circuit_geometry for select
  to anon, authenticated using (true);

-- Race pages know (season, round).
create or replace function public.get_circuit_geometry(p_season int, p_round int)
returns setof public.f1_circuit_geometry
language sql stable security invoker
as $$
  select * from public.f1_circuit_geometry
  where season = p_season and round = p_round
  limit 1;
$$;

-- Circuit detail pages know the circuit_id but not always a season — return the
-- most recent season's geometry (optionally pinned to one season).
create or replace function public.get_circuit_geometry_by_circuit(
  p_circuit_id text, p_season int default null
)
returns setof public.f1_circuit_geometry
language sql stable security invoker
as $$
  select * from public.f1_circuit_geometry
  where circuit_id = p_circuit_id
    and (p_season is null or season = p_season)
  order by season desc
  limit 1;
$$;

-- Public bucket for the geometry JSON blobs (created out-of-band via the Storage
-- API in the exporter; recorded here for completeness / fresh-project bootstrap).
insert into storage.buckets (id, name, public)
values ('circuits', 'circuits', true)
on conflict (id) do update set public = true;
