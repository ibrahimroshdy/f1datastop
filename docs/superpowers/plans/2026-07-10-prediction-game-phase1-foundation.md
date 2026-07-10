# F1 Prediction Game — Phase 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Stand up the data layer, security, activation, and app scaffolding for the F1 prediction game so a logged-in user can "Join the F1 League" and land on a (still empty) game hub.

**Architecture:** New `game_*` tables in the existing Supabase Postgres (project `envqfquhkcbnitwlzepx`), all RLS'd, admin-gated by an email check. Migrations authored as files in `supabase/migrations/` (repo = source of truth) and applied to the DB via the Supabase MCP `apply_migration` (same name), verified with a SQL read. Frontend adds a `/game` route + nav entry + activation screen, reusing existing auth (`AuthContext`, `ProtectedRoute`) and design primitives (`F1Card`, `BackLink`, layout helpers).

**Tech Stack:** Postgres/Supabase (RLS, SECURITY DEFINER fns, MCP apply_migration), React 18 + Vite + TS + Tailwind + shadcn, react-router-dom, TanStack Query.

**Reference:** spec at `docs/superpowers/specs/2026-07-10-f1-prediction-game-design.md`. fifa-league at `../fifa-league` for patterns.

**Verification convention:** DB migrations have no unit tests; the "test" for each is a `SELECT` via MCP `execute_sql` asserting the object exists / behaves. Frontend "test" is `npx tsc -p tsconfig.app.json --noEmit` + a preview render.

---

## File Structure

**New migration files** (`supabase/migrations/`):
- `20260711100000_game_admin_and_season.sql` — `is_game_admin()`, `game_season` table + RLS + seed 2026.
- `20260711100100_game_entry_and_picks.sql` — `game_entry`, `game_race_pick`, `game_champion_pick` + RLS.
- `20260711100200_game_leagues.sql` — `game_league`, `game_league_member`, `game_league_join_attempt` + RLS + global league seed.
- `20260711100300_game_scores.sql` — `game_pick_score`, `game_bonus_score`, `game_entry_total`, `game_rank_snapshot`, `game_race_award` + RLS.
- `20260711100400_game_profile_columns.sql` — extend `profiles` + `game_public_profile` view.
- `20260711100500_game_activation_rpcs.sql` — `weekend_deadline`, `game_pick_is_editable`, `game_champion_is_editable`, `activate_player`, `open_season`.

**New frontend files** (`web/src/`):
- `features/game/routes/GameHub.tsx` — hub page (activation CTA or dashboard shell).
- `features/game/hooks/useGameActivation.ts` — reads/creates the user's entry for the active season.
- `features/game/api/gameClient.ts` — thin Supabase RPC wrappers for the game.
- `features/game/lib/isGameAdmin.ts` — `admin@f1datastop.com` frontend check.

**Modified frontend files:**
- `web/src/App.tsx` — register `/game` route inside MainLayout, behind `ProtectedRoute`.
- `web/src/config/navigation.ts` — add "Predictions" nav item (EXPLORE group).

---

## Task 1: `is_game_admin()` + `game_season` table

**Files:**
- Create: `supabase/migrations/20260711100000_game_admin_and_season.sql`

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Apply via MCP**

Apply with `apply_migration` (project_id `envqfquhkcbnitwlzepx`, name `game_admin_and_season`, the SQL above).

- [ ] **Step 3: Verify**

Run via `execute_sql`:
```sql
select
  (select count(*) from game_season where season=2026) as season_rows,
  (select proname from pg_proc where proname='is_game_admin') as fn;
```
Expected: `season_rows = 1`, `fn = is_game_admin`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260711100000_game_admin_and_season.sql
git commit -m "feat(game): is_game_admin + game_season config table"
```

---

## Task 2: Entry + picks tables

**Files:**
- Create: `supabase/migrations/20260711100100_game_entry_and_picks.sql`

- [ ] **Step 1: Write the migration**

```sql
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

-- entry: owner reads/writes own; admin all.
create policy game_entry_own on public.game_entry
  for select to authenticated using (user_id = auth.uid() or public.is_game_admin());
create policy game_entry_insert_own on public.game_entry
  for insert to authenticated with check (user_id = auth.uid());
create policy game_entry_admin on public.game_entry
  for all to authenticated using (public.is_game_admin()) with check (public.is_game_admin());

-- picks: owner reads own; admin all. (Reveal-to-others added in Leagues phase.)
create policy game_race_pick_own on public.game_race_pick
  for select to authenticated using (
    exists (select 1 from public.game_entry e where e.id = entry_id
            and (e.user_id = auth.uid() or public.is_game_admin())));
create policy game_champion_pick_own on public.game_champion_pick
  for select to authenticated using (
    exists (select 1 from public.game_entry e where e.id = entry_id
            and (e.user_id = auth.uid() or public.is_game_admin())));
-- (write policies for picks are added in Phase 2 alongside game_pick_is_editable)
```

- [ ] **Step 2: Apply via MCP** (`apply_migration`, name `game_entry_and_picks`).

- [ ] **Step 3: Verify**
```sql
select count(*) from information_schema.tables
where table_schema='public' and table_name in ('game_entry','game_race_pick','game_champion_pick');
```
Expected: `3`.

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/20260711100100_game_entry_and_picks.sql
git commit -m "feat(game): entry + race/champion pick tables + RLS"
```

---

## Task 3: League tables + global league

**Files:**
- Create: `supabase/migrations/20260711100200_game_leagues.sql`

- [ ] **Step 1: Write the migration**

```sql
create table if not exists public.game_league (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  slug                  text unique,
  invite_code           text unique,
  is_public             boolean not null default false,
  max_members           int,
  pick_reveal_policy    text not null default 'after_lock'
                          check (pick_reveal_policy in ('after_lock','never')),
  created_by            uuid references auth.users(id) on delete set null,
  invite_code_rotated_at timestamptz,
  created_at            timestamptz not null default now()
);

create table if not exists public.game_league_member (
  league_id uuid not null references public.game_league(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      text not null default 'member' check (role in ('member','captain')),
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);
create index if not exists game_league_member_user_idx on public.game_league_member(user_id);

create table if not exists public.game_league_join_attempt (
  id           bigserial primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);

alter table public.game_league enable row level security;
alter table public.game_league_member enable row level security;
alter table public.game_league_join_attempt enable row level security;

-- league visible if public, or you created it, or you're a member, or admin.
create policy game_league_read on public.game_league
  for select to authenticated using (
    is_public
    or created_by = auth.uid()
    or exists (select 1 from public.game_league_member m
               where m.league_id = id and m.user_id = auth.uid())
    or public.is_game_admin());
create policy game_league_admin on public.game_league
  for all to authenticated using (public.is_game_admin()) with check (public.is_game_admin());

create policy game_member_read on public.game_league_member
  for select to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.game_league_member m2
               where m2.league_id = league_id and m2.user_id = auth.uid())
    or public.is_game_admin());
create policy game_member_admin on public.game_league_member
  for all to authenticated using (public.is_game_admin()) with check (public.is_game_admin());

create policy game_join_attempt_own on public.game_league_join_attempt
  for select to authenticated using (user_id = auth.uid() or public.is_game_admin());

-- Global league (persistent, public, no captain). One canonical row.
insert into public.game_league (name, slug, is_public, pick_reveal_policy)
values ('Global League', 'global', true, 'never')
on conflict (slug) do nothing;
```

- [ ] **Step 2: Apply via MCP** (`apply_migration`, name `game_leagues`).

- [ ] **Step 3: Verify**
```sql
select (select count(*) from game_league where slug='global') as global_rows,
       (select count(*) from information_schema.tables where table_schema='public'
        and table_name in ('game_league','game_league_member','game_league_join_attempt')) as tables;
```
Expected: `global_rows=1`, `tables=3`.

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/20260711100200_game_leagues.sql
git commit -m "feat(game): league + membership tables, RLS, global league seed"
```

---

## Task 4: Scoring-output tables

**Files:**
- Create: `supabase/migrations/20260711100300_game_scores.sql`

- [ ] **Step 1: Write the migration**

```sql
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

-- Scores: readable by owner or admin (reveal widened in Leagues phase). Writes: service role
-- only, which bypasses RLS — so NO write policy is created (deny-all to anon/auth is correct).
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
```

- [ ] **Step 2: Apply via MCP** (`apply_migration`, name `game_scores`).

- [ ] **Step 3: Verify**
```sql
select count(*) from information_schema.tables where table_schema='public'
and table_name in ('game_pick_score','game_bonus_score','game_entry_total','game_rank_snapshot','game_race_award');
```
Expected: `5`.

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/20260711100300_game_scores.sql
git commit -m "feat(game): scoring-output tables (scores, totals, snapshots, awards) + RLS"
```

---

## Task 5: Profile columns + public-profile view

**Files:**
- Create: `supabase/migrations/20260711100400_game_profile_columns.sql`

- [ ] **Step 1: Write the migration**

```sql
alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists bio text,
  add column if not exists favorite_driver_id text references public.f1_driver(ergast_id),
  add column if not exists favorite_constructor_id text references public.f1_constructor(ergast_id),
  add column if not exists country text;

-- Limited public read of display fields for league member reveals (no PII).
create or replace view public.game_public_profile
with (security_invoker = true) as
  select id as user_id, username, avatar_url, favorite_driver_id, favorite_constructor_id, country
  from public.profiles;

-- Allow authenticated users to read display fields of any profile ONLY through this view's
-- purpose: add a policy so co-members are visible. (profiles currently is own-row only.)
create policy if not exists profiles_public_display_read on public.profiles
  for select to authenticated using (true);
```

Note: `profiles_public_display_read` grants authenticated SELECT on `profiles`. If the team
prefers not to widen `profiles`, drop that policy and instead expose only via a SECURITY DEFINER
RPC `get_member_profiles(user_ids uuid[])`. Decide at execution; default = the policy above
(usernames/avatars are non-sensitive; `first_name/last_name` remain but are low-risk). If stricter
privacy is wanted, use the RPC variant.

- [ ] **Step 2: Apply via MCP** (`apply_migration`, name `game_profile_columns`).

- [ ] **Step 3: Verify**
```sql
select count(*) from information_schema.columns where table_schema='public' and table_name='profiles'
and column_name in ('avatar_url','bio','favorite_driver_id','favorite_constructor_id','country');
```
Expected: `5`.

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/20260711100400_game_profile_columns.sql
git commit -m "feat(game): profile customization columns + public-profile view"
```

---

## Task 6: Deadline / editability / activation RPCs

**Files:**
- Create: `supabase/migrations/20260711100500_game_activation_rpcs.sql`

- [ ] **Step 1: Write the migration**

```sql
-- First competitive session start of a weekend = the single weekend deadline.
create or replace function public.weekend_deadline(p_season int, p_round int)
returns timestamptz language sql stable
set search_path = public, pg_temp as $$
  select min(s.date_start)
  from public.f1_session s
  where s.season = p_season and s.round = p_round
    and s.session_type in ('SQ','S','Q','R')
$$;

create or replace function public.game_pick_is_editable(p_entry_id uuid, p_round int)
returns boolean language sql stable
set search_path = public, pg_temp as $$
  select coalesce(
    (select not gs.globally_locked
       and (public.weekend_deadline(e.season, p_round) is null
            or now() < public.weekend_deadline(e.season, p_round))
     from public.game_entry e
     join public.game_season gs on gs.season = e.season
     where e.id = p_entry_id),
    false)
$$;

create or replace function public.game_champion_is_editable(p_entry_id uuid)
returns boolean language sql stable
set search_path = public, pg_temp as $$
  select coalesce(
    (select not gs.globally_locked
       and (gs.champion_lock_round is null
            or public.weekend_deadline(e.season, gs.champion_lock_round) is null
            or now() < public.weekend_deadline(e.season, gs.champion_lock_round))
     from public.game_entry e
     join public.game_season gs on gs.season = e.season
     where e.id = p_entry_id),
    false)
$$;

-- "Join the F1 League": create the caller's entry for a season + join the global league. Idempotent.
create or replace function public.activate_player(p_season int)
returns uuid language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_entry uuid; v_global uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.game_season where season = p_season and status <> 'complete') then
    raise exception 'season % not open', p_season;
  end if;
  insert into public.game_entry (user_id, season) values (v_uid, p_season)
    on conflict (user_id, season) do update set updated_at = now()
    returning id into v_entry;
  select id into v_global from public.game_league where slug = 'global';
  insert into public.game_league_member (league_id, user_id)
    values (v_global, v_uid) on conflict do nothing;
  return v_entry;
end $$;
grant execute on function public.activate_player(int) to authenticated;

-- Admin: open a new season + auto-create entries for all existing global-league members.
create or replace function public.open_season(p_season int, p_name text)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if not public.is_game_admin() then raise exception 'admin only'; end if;
  insert into public.game_season (season, name, status) values (p_season, p_name, 'active')
    on conflict (season) do update set status = 'active';
  insert into public.game_entry (user_id, season)
    select distinct m.user_id, p_season
    from public.game_league_member m
    on conflict (user_id, season) do nothing;
end $$;
grant execute on function public.open_season(int, text) to authenticated;
```

- [ ] **Step 2: Apply via MCP** (`apply_migration`, name `game_activation_rpcs`).

- [ ] **Step 3: Verify** (function presence + a smoke call that is safe)
```sql
select proname from pg_proc where proname in
  ('weekend_deadline','game_pick_is_editable','game_champion_is_editable','activate_player','open_season')
order by proname;
```
Expected: 5 rows. (Do not call `activate_player` here — no auth context in MCP; it's exercised from the app in Task 9.)

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/20260711100500_game_activation_rpcs.sql
git commit -m "feat(game): deadline/editability + activate_player/open_season RPCs"
```

---

## Task 7: Regenerate Supabase TS types

**Files:**
- Modify: `web/src/integrations/supabase/types.ts` (or wherever generated types live — confirm path first)

- [ ] **Step 1: Locate the generated types file**

Run: `ls web/src/integrations/supabase/`
Expected: a `types.ts` (or `database.types.ts`).

- [ ] **Step 2: Regenerate** via MCP `generate_typescript_types` (project `envqfquhkcbnitwlzepx`) and write the result to that file.

- [ ] **Step 3: Verify**

Run: `cd web && npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**
```bash
git add web/src/integrations/supabase/types.ts
git commit -m "chore(game): regenerate supabase types for game_* tables"
```

---

## Task 8: Frontend — `isGameAdmin` helper + game API client

**Files:**
- Create: `web/src/features/game/lib/isGameAdmin.ts`
- Create: `web/src/features/game/api/gameClient.ts`

- [ ] **Step 1: Write `isGameAdmin.ts`**

```ts
import type { User } from "@supabase/supabase-js";

export const GAME_ADMIN_EMAIL = "admin@f1datastop.com";

/** Frontend admin gate — mirrors the DB `is_game_admin()`. Server RLS is the real guard. */
export function isGameAdmin(user: User | null | undefined): boolean {
  return !!user?.email && user.email.toLowerCase() === GAME_ADMIN_EMAIL;
}
```

- [ ] **Step 2: Write `gameClient.ts`**

```ts
import { supabase } from "@/integrations/supabase/client";

/** Active season for the game (the one the app defaults to). */
export const ACTIVE_GAME_SEASON = 2026;

/** "Join the F1 League" — creates the caller's entry + joins the global league. */
export async function activatePlayer(season = ACTIVE_GAME_SEASON): Promise<string> {
  const { data, error } = await supabase.rpc("activate_player", { p_season: season });
  if (error) throw error;
  return data as string; // entry id
}

/** The caller's entry for a season, or null if not activated. */
export async function getMyEntry(season = ACTIVE_GAME_SEASON) {
  const { data, error } = await supabase
    .from("game_entry")
    .select("id, season, created_at")
    .eq("season", season)
    .maybeSingle();
  if (error) throw error;
  return data;
}
```

- [ ] **Step 3: Verify**

Run: `cd web && npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors (RPC names typed from regenerated types).

- [ ] **Step 4: Commit**
```bash
git add web/src/features/game/lib/isGameAdmin.ts web/src/features/game/api/gameClient.ts
git commit -m "feat(game): admin-gate helper + game RPC client"
```

---

## Task 9: Frontend — activation hook + Game Hub page

**Files:**
- Create: `web/src/features/game/hooks/useGameActivation.ts`
- Create: `web/src/features/game/routes/GameHub.tsx`

- [ ] **Step 1: Write `useGameActivation.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { activatePlayer, getMyEntry, ACTIVE_GAME_SEASON } from "../api/gameClient";

export function useGameActivation(season = ACTIVE_GAME_SEASON) {
  const qc = useQueryClient();
  const entry = useQuery({
    queryKey: ["game", "entry", season],
    queryFn: () => getMyEntry(season),
  });
  const activate = useMutation({
    mutationFn: () => activatePlayer(season),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["game", "entry", season] }),
  });
  return {
    isActivated: !!entry.data,
    isLoading: entry.isLoading,
    activate: activate.mutate,
    activating: activate.isPending,
  };
}
```

- [ ] **Step 2: Write `GameHub.tsx`** (activation CTA when not activated; placeholder dashboard when activated)

```tsx
import { Trophy, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { F1Card, F1CardContent } from "@/components/f1";
import { pageShell, pageStack } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { useGameActivation } from "../hooks/useGameActivation";

export default function GameHub() {
  const { isActivated, isLoading, activate, activating } = useGameActivation();

  if (isLoading) {
    return <div className={cn(pageShell, pageStack)}><F1Card><F1CardContent>Loading…</F1CardContent></F1Card></div>;
  }

  if (!isActivated) {
    return (
      <div className={cn(pageShell, pageStack, "animate-fade-in")}>
        <div className="space-y-1.5">
          <div className="instrument-label flex items-center gap-1.5 text-primary">
            <Trophy className="h-3 w-3" /> Prediction Game
          </div>
          <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">
            Join the F1 League
          </h1>
          <p className="text-sm text-muted-foreground">
            Predict qualifying &amp; race top-10s every weekend, pick your champions, and climb your
            league. Activate to start playing the 2026 season.
          </p>
        </div>
        <F1Card>
          <F1CardContent className="flex flex-col items-start gap-3 py-6">
            <Button size="lg" className="min-h-11 gap-2" onClick={() => activate()} disabled={activating}>
              <Flag className="h-4 w-4" />
              {activating ? "Joining…" : "Join the F1 League"}
            </Button>
          </F1CardContent>
        </F1Card>
      </div>
    );
  }

  // Activated — placeholder hub; filled out in Phase 2.
  return (
    <div className={cn(pageShell, pageStack, "animate-fade-in")}>
      <h1 className="font-heading text-2xl font-bold tracking-tight md:text-3xl">Your F1 League</h1>
      <F1Card><F1CardContent className="py-6 text-sm text-muted-foreground">
        You're in for 2026. Predictions open here each race weekend.
      </F1CardContent></F1Card>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `cd web && npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors. (Confirm `pageShell`/`pageStack` exist in `web/src/lib/layout.ts`; if named differently, use the actual exports.)

- [ ] **Step 4: Commit**
```bash
git add web/src/features/game/hooks/useGameActivation.ts web/src/features/game/routes/GameHub.tsx
git commit -m "feat(game): activation hook + Game Hub with Join CTA"
```

---

## Task 10: Wire route + nav

**Files:**
- Modify: `web/src/App.tsx` (add `/game` route inside MainLayout, behind ProtectedRoute)
- Modify: `web/src/config/navigation.ts` (add Predictions nav item)

- [ ] **Step 1: Add the route**

In `App.tsx`, near the other MainLayout routes, add a lazy import + route. Match the file's
existing lazy pattern (confirm how other pages are imported):
```tsx
const GameHub = lazy(() => import("@/features/game/routes/GameHub"));
// ...inside the MainLayout <Routes>, wrap in the same ProtectedRoute the app uses for /profile:
<Route path="/game" element={<ProtectedRoute><GameHub /></ProtectedRoute>} />
```
(If the app's `ProtectedRoute` is used as a layout/wrapper element rather than a per-route wrapper,
follow that existing pattern instead — check how `/profile` is guarded.)

- [ ] **Step 2: Add the nav item**

In `navigation.ts`, add to the EXPLORE group (confirm the icon import style used):
```ts
{ label: "Predictions", href: "/game", icon: Trophy },
```
(Import `Trophy` from `lucide-react` alongside existing icons.)

- [ ] **Step 3: Verify**

Run: `cd web && npx tsc -p tsconfig.app.json --noEmit`
Then preview: start the dev server, log in, navigate to `/game`, confirm the "Join the F1 League"
screen renders and (as a logged-in user) clicking Join flips it to the activated hub. Use
`preview_screenshot` to capture. Also confirm "Predictions" appears in the sidebar nav.

- [ ] **Step 4: Commit**
```bash
git add web/src/App.tsx web/src/config/navigation.ts
git commit -m "feat(game): register /game route + Predictions nav entry"
```

---

## Self-review checklist (run before handoff)
- Every spec §5 table has a creating task (season, entry, picks, champion, scores, bonus, totals,
  snapshots, awards, leagues, members, join-attempts, audit). NOTE: `game_audit_log` is deferred to
  the Admin phase (Phase 4) — it has no Phase-1 consumer. Confirmed intentional.
- Admin gate (`is_game_admin`) created Task 1, used by every RLS policy.
- Activation ("Join the F1 League") = `activate_player` (Task 6) + UI (Task 9) + route (Task 10).
- Profile columns (Task 5) cover §5.6.
- Editability/deadline fns (Task 6) back Phase-2 write policies (pick write policies intentionally
  deferred to Phase 2 where the editor exists).
- No placeholders; all SQL and TSX is complete. Paths to confirm at execution: generated types
  filename (Task 7), `pageShell`/`pageStack` export names (Task 9), ProtectedRoute usage pattern
  and nav icon import (Task 10).
```
