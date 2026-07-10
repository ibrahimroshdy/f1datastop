-- F1 Prediction Game — Phase 1 — persistent leagues + membership.

create table if not exists public.game_league (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  slug                   text unique,
  invite_code            text unique,
  is_public              boolean not null default false,
  max_members            int,
  pick_reveal_policy     text not null default 'after_lock'
                           check (pick_reveal_policy in ('after_lock','never')),
  created_by             uuid references auth.users(id) on delete set null,
  invite_code_rotated_at timestamptz,
  created_at             timestamptz not null default now()
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

-- Global league (persistent, public, no captain).
insert into public.game_league (name, slug, is_public, pick_reveal_policy)
values ('Global League', 'global', true, 'never')
on conflict (slug) do nothing;
