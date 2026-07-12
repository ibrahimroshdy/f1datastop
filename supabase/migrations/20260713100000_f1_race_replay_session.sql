-- Session-aware race replays: add a `session` dimension so Qualifying / Sprint /
-- Race (and practice) each get their own replay blob + timing tower. Existing rows
-- are the Race ('R'). The blob storage path gains a `_Q` / `_S` suffix for non-race
-- sessions (race stays `{circuit}.json` for backward compat).
alter table public.f1_race_replay add column if not exists session text not null default 'R';

-- Replace the single-per-circuit / single-per-round uniques with session-aware ones.
alter table public.f1_race_replay drop constraint if exists f1_race_replay_season_circuit_id_key;
drop index if exists public.f1_race_replay_season_round;

create unique index if not exists f1_race_replay_season_circuit_session
  on public.f1_race_replay (season, circuit_id, session);
create unique index if not exists f1_race_replay_season_round_session
  on public.f1_race_replay (season, round, session);

-- Drop the old 2-arg signature so the 3-arg (with default) isn't ambiguous.
drop function if exists public.get_race_replay(int, int);

create or replace function public.get_race_replay(p_season int, p_round int, p_session text default 'R')
returns setof public.f1_race_replay
language sql stable security invoker
as $$
  select * from public.f1_race_replay
  where season = p_season and round = p_round and session = p_session
  limit 1;
$$;
