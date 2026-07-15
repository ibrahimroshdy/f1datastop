-- Persistent in-app announcements for the League ("Race Control" feed).
-- `admin_broadcast` fires Web Push only + an admin-only audit row — there was no
-- durable, in-app-readable feed. This adds one: a table + an anon-safe ordered
-- read RPC (surfaced on the hub + public landing) + an admin composer RPC.
-- Push stays a separate admin_broadcast call, so the composer can do both.

create table if not exists public.game_announcement (
  id           uuid primary key default gen_random_uuid(),
  season       integer references public.game_season(season) on delete set null,
  title        text not null,
  body         text not null,
  url          text,
  kind         text not null default 'control' check (kind in ('radio','control','news')),
  audience     text not null default 'all'     check (audience in ('all','players')),
  pinned       boolean not null default false,
  published_at timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists game_announcement_feed_idx
  on public.game_announcement (pinned desc, published_at desc);

alter table public.game_announcement enable row level security;

-- Reads: anon sees public ('all') announcements; authenticated sees everything.
drop policy if exists game_announcement_read_anon on public.game_announcement;
create policy game_announcement_read_anon on public.game_announcement
  for select to anon using (audience = 'all');

drop policy if exists game_announcement_read_auth on public.game_announcement;
create policy game_announcement_read_auth on public.game_announcement
  for select to authenticated using (true);

-- Writes: game admins only (email-gated via is_game_admin()).
drop policy if exists game_announcement_admin_write on public.game_announcement;
create policy game_announcement_admin_write on public.game_announcement
  for all to authenticated
  using (public.is_game_admin()) with check (public.is_game_admin());

-- Ordered read feed (pinned first, then newest). Anon-safe: 'players'-only
-- announcements are hidden from signed-out visitors.
create or replace function public.get_announcements(p_limit integer default 10)
returns setof public.game_announcement
language sql stable security definer set search_path = public as $$
  select *
  from public.game_announcement
  where published_at <= now()
    and (audience = 'all' or auth.uid() is not null)
  order by pinned desc, published_at desc
  limit greatest(1, least(coalesce(p_limit, 10), 50));
$$;
grant execute on function public.get_announcements(integer) to anon, authenticated;

-- Admin: post an announcement (in-app feed). Guarded internally; push is a
-- separate admin_broadcast call the composer can fire alongside this.
create or replace function public.admin_post_announcement(
  p_title    text,
  p_body     text,
  p_url      text     default null,
  p_kind     text     default 'control',
  p_audience text     default 'all',
  p_pinned   boolean  default false,
  p_season   integer  default null
) returns public.game_announcement
language plpgsql security definer set search_path = public as $$
declare a public.game_announcement;
begin
  if not public.is_game_admin() then
    raise exception 'not authorized';
  end if;
  insert into public.game_announcement (season, title, body, url, kind, audience, pinned, created_by)
    values (p_season, p_title, p_body, nullif(p_url, ''), p_kind, p_audience, p_pinned, auth.uid())
    returning * into a;
  insert into public.game_audit_log (actor, action, detail)
    values (auth.uid(), 'announcement', jsonb_build_object('id', a.id, 'title', p_title));
  return a;
end $$;
grant execute on function public.admin_post_announcement(text,text,text,text,text,boolean,integer) to authenticated;

-- Admin: remove an announcement.
create or replace function public.admin_delete_announcement(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_game_admin() then
    raise exception 'not authorized';
  end if;
  delete from public.game_announcement where id = p_id;
end $$;
grant execute on function public.admin_delete_announcement(uuid) to authenticated;
