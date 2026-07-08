-- ============================================================================
-- Phase 1 — FastF1-only migration. Enrichment tables + serving RPCs.
-- (Applied live via MCP during development; this file is the repo-of-record so
--  `supabase db reset` reproduces the schema.)
-- ============================================================================

-- ── FastF1-native enrichment tables (re-keyed from OpenF1 to season/round) ──
drop table if exists public.f1_weather cascade;
create table public.f1_weather (
  id bigint generated always as identity primary key,
  season int not null, round int not null, session_type text not null,
  time_seconds numeric, air_temp numeric, track_temp numeric, humidity numeric,
  pressure numeric, wind_speed numeric, wind_direction int, rainfall boolean,
  source text not null default 'fastf1', created_at timestamptz not null default now(),
  unique (season, round, session_type, time_seconds)
);

drop table if exists public.f1_overtake cascade;
create table public.f1_overtake (
  id bigint generated always as identity primary key,
  season int not null, round int not null, session_type text not null default 'R',
  lap_number int not null,
  overtaking_driver_id text not null, overtaken_driver_id text not null,
  position int, source text not null default 'fastf1',
  created_at timestamptz not null default now(),
  unique (season, round, session_type, lap_number, overtaking_driver_id, overtaken_driver_id)
);

drop table if exists public.f1_race_control cascade;
create table public.f1_race_control (
  id bigint generated always as identity primary key,
  season int not null, round int not null, session_type text not null default 'R',
  time_utc timestamptz, lap_number int, category text, message text,
  flag text, scope text, sector int, driver_number int,
  source text not null default 'fastf1', created_at timestamptz not null default now(),
  unique (season, round, session_type, time_utc, message)
);

alter table public.f1_weather enable row level security;
alter table public.f1_overtake enable row level security;
alter table public.f1_race_control enable row level security;
create policy "public read" on public.f1_weather for select using (true);
create policy "public read" on public.f1_overtake for select using (true);
create policy "public read" on public.f1_race_control for select using (true);
grant select on public.f1_weather, public.f1_overtake, public.f1_race_control to anon, authenticated;

-- ── Per-session laps ────────────────────────────────────────────────────────
alter table public.f1_lap add column if not exists session_type text not null default 'R';
alter table public.f1_lap drop constraint if exists f1_lap_natural_key;
create unique index if not exists f1_lap_session_key
  on public.f1_lap (season, round, session_type, driver_id, lap_number);

-- ── Serving RPCs ────────────────────────────────────────────────────────────
create or replace function public.get_weather(p_season int, p_round int, p_session text default 'R')
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(w) order by w.time_seconds), '[]'::jsonb) from (
    select time_seconds, air_temp, track_temp, humidity, pressure, wind_speed, wind_direction, rainfall
    from public.f1_weather where season=p_season and round=p_round and session_type=p_session) w;
$$;

create or replace function public.get_overtakes(p_season int, p_round int, p_session text default 'R')
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(o) order by o.lap_number, o.position), '[]'::jsonb) from (
    select lap_number, overtaking_driver_id, overtaken_driver_id, position
    from public.f1_overtake where season=p_season and round=p_round and session_type=p_session) o;
$$;

create or replace function public.get_race_control(p_season int, p_round int, p_session text default 'R')
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(r) order by r.time_utc), '[]'::jsonb) from (
    select time_utc, lap_number, category, message, flag, scope, sector, driver_number
    from public.f1_race_control where season=p_season and round=p_round and session_type=p_session) r;
$$;

create or replace function public.get_sessions(p_season int, p_round int default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(s) order by s.round, s.date_start), '[]'::jsonb) from (
    select season, round, session_type, session_name, date_start, date_end
    from public.f1_session where season=p_season and (p_round is null or round=p_round)) s;
$$;

-- Ergast-nested laps (for the lap-time / position charts). Full m:ss.mmm times.
drop function if exists public.get_laps(integer, integer);
create or replace function public.get_laps(p_season int, p_round int, p_session text default 'R')
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('Races', jsonb_build_array(jsonb_build_object(
    'season', p_season::text, 'round', p_round::text,
    'Laps', coalesce((
      select jsonb_agg(lap_obj order by lap_num) from (
        select l.lap_number as lap_num, jsonb_build_object(
          'number', l.lap_number::text,
          'Timings', jsonb_agg(jsonb_build_object(
            'driverId', l.driver_id, 'position', l.position::text, 'time', l.time_text
          ) order by l.position)) as lap_obj
        from public.f1_lap l
        where l.season=p_season and l.round=p_round and l.session_type=p_session
        group by l.lap_number) x), '[]'::jsonb))));
$$;

-- Flat per-lap positions (for the overtakes component).
create or replace function public.get_lap_positions(p_season int, p_round int, p_session text default 'R')
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(l) order by l.lap_number, l.position), '[]'::jsonb) from (
    select lap_number, driver_id, position, time_text, time_millis
    from public.f1_lap where season=p_season and round=p_round and session_type=p_session) l;
$$;

grant execute on function
  public.get_weather(int,int,text), public.get_overtakes(int,int,text),
  public.get_race_control(int,int,text), public.get_sessions(int,int),
  public.get_laps(int,int,text), public.get_lap_positions(int,int,text)
  to anon, authenticated;

-- Entity slugs collide across FastF1/Ergast constructor lineages (Force India →
-- Racing Point → Aston Martin, etc.); routing resolves by ergast_id, so drop
-- the slug unique constraints.
alter table public.f1_constructor drop constraint if exists f1_constructor_slug_key;
alter table public.f1_driver drop constraint if exists f1_driver_slug_key;
