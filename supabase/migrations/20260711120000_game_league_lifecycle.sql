-- F1 Prediction Game — Phase 3 — league lifecycle RPCs (create/join/leave/manage).
-- All writes go through SECURITY DEFINER functions with explicit guards.

create or replace function public.create_league(p_name text, p_is_public boolean default false)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_id uuid; v_code text; v_slug text;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  if length(trim(coalesce(p_name,''))) < 2 then raise exception 'league name too short'; end if;
  v_code := upper(substr(md5(gen_random_uuid()::text), 1, 8));
  v_slug := lower(regexp_replace(trim(p_name), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || lower(substr(v_code, 1, 4));
  insert into public.game_league (name, slug, invite_code, is_public, created_by)
    values (trim(p_name), v_slug, v_code, p_is_public, v_uid)
    returning id into v_id;
  insert into public.game_league_member (league_id, user_id, role) values (v_id, v_uid, 'captain');
  return v_id;
end $$;
grant execute on function public.create_league(text, boolean) to authenticated;

-- Rate-limit helper: raise if > 10 join attempts in 15 min.
create or replace function public._game_check_join_rate(p_uid uuid)
returns void language plpgsql set search_path = public, pg_temp as $$
begin
  insert into public.game_league_join_attempt (user_id) values (p_uid);
  if (select count(*) from public.game_league_join_attempt
      where user_id = p_uid and attempted_at > now() - interval '15 minutes') > 10 then
    raise exception 'too many join attempts — slow down';
  end if;
end $$;

create or replace function public.join_public_league(p_league_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_pub boolean; v_max int; v_cnt int;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  perform public._game_check_join_rate(v_uid);
  select is_public, max_members into v_pub, v_max from public.game_league where id = p_league_id;
  if v_pub is null then raise exception 'league not found'; end if;
  if not v_pub then raise exception 'league is private — use an invite code'; end if;
  if v_max is not null then
    select count(*) into v_cnt from public.game_league_member where league_id = p_league_id;
    if v_cnt >= v_max then raise exception 'league is full'; end if;
  end if;
  insert into public.game_league_member (league_id, user_id) values (p_league_id, v_uid)
    on conflict do nothing;
end $$;
grant execute on function public.join_public_league(uuid) to authenticated;

create or replace function public.join_league_by_code(p_code text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_id uuid; v_max int; v_cnt int;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  perform public._game_check_join_rate(v_uid);
  select id, max_members into v_id, v_max from public.game_league where invite_code = upper(trim(p_code));
  if v_id is null then raise exception 'invalid invite code'; end if;
  if v_max is not null then
    select count(*) into v_cnt from public.game_league_member where league_id = v_id;
    if v_cnt >= v_max then raise exception 'league is full'; end if;
  end if;
  insert into public.game_league_member (league_id, user_id) values (v_id, v_uid) on conflict do nothing;
  return v_id;
end $$;
grant execute on function public.join_league_by_code(text) to authenticated;

create or replace function public.leave_league(p_league_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_slug text;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  select slug into v_slug from public.game_league where id = p_league_id;
  if v_slug = 'global' then raise exception 'cannot leave the global league'; end if;
  delete from public.game_league_member where league_id = p_league_id and user_id = v_uid;
end $$;
grant execute on function public.leave_league(uuid) to authenticated;

-- Captain check helper.
create or replace function public.is_league_captain(p_league_id uuid, p_uid uuid)
returns boolean language sql stable set search_path = public, pg_temp as $$
  select exists (select 1 from public.game_league_member
                 where league_id = p_league_id and user_id = p_uid and role = 'captain')
$$;

create or replace function public.remove_league_member(p_league_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if not (public.is_league_captain(p_league_id, v_uid) or public.is_game_admin()) then
    raise exception 'captain only'; end if;
  if p_user_id = v_uid then raise exception 'use leave_league to remove yourself'; end if;
  delete from public.game_league_member where league_id = p_league_id and user_id = p_user_id and role <> 'captain';
end $$;
grant execute on function public.remove_league_member(uuid, uuid) to authenticated;

create or replace function public.update_league(
  p_league_id uuid, p_name text default null, p_is_public boolean default null, p_reveal text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if not (public.is_league_captain(p_league_id, v_uid) or public.is_game_admin()) then
    raise exception 'captain only'; end if;
  update public.game_league set
    name = coalesce(nullif(trim(coalesce(p_name,'')),''), name),
    is_public = coalesce(p_is_public, is_public),
    pick_reveal_policy = coalesce(p_reveal, pick_reveal_policy)
  where id = p_league_id;
end $$;
grant execute on function public.update_league(uuid, text, boolean, text) to authenticated;

create or replace function public.rotate_invite_code(p_league_id uuid)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_code text;
begin
  if not (public.is_league_captain(p_league_id, v_uid) or public.is_game_admin()) then
    raise exception 'captain only'; end if;
  v_code := upper(substr(md5(gen_random_uuid()::text), 1, 8));
  update public.game_league set invite_code = v_code, invite_code_rotated_at = now() where id = p_league_id;
  return v_code;
end $$;
grant execute on function public.rotate_invite_code(uuid) to authenticated;

-- Discovery (public leagues) + invite preview (no membership needed).
create or replace function public.list_public_leagues()
returns table (id uuid, name text, slug text, member_count int)
language sql stable security definer set search_path = public, pg_temp as $$
  select l.id, l.name, l.slug,
    (select count(*)::int from public.game_league_member m where m.league_id = l.id) as member_count
  from public.game_league l
  where l.is_public and l.slug <> 'global'
  order by member_count desc, l.created_at desc
  limit 100
$$;
grant execute on function public.list_public_leagues() to authenticated;

create or replace function public.get_league_invite_preview(p_code text)
returns table (id uuid, name text, member_count int)
language sql stable security definer set search_path = public, pg_temp as $$
  select l.id, l.name,
    (select count(*)::int from public.game_league_member m where m.league_id = l.id) as member_count
  from public.game_league l
  where l.invite_code = upper(trim(p_code))
$$;
grant execute on function public.get_league_invite_preview(text) to authenticated;
