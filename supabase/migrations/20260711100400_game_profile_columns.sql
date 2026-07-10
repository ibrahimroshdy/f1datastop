-- F1 Prediction Game — Phase 1 — profile customization + safe public-display access.

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists bio text,
  add column if not exists favorite_driver_id text references public.f1_driver(ergast_id),
  add column if not exists favorite_constructor_id text references public.f1_constructor(ergast_id),
  add column if not exists country text;

-- Safe public display of co-members: returns ONLY non-sensitive fields (no first/last name),
-- via SECURITY DEFINER so profiles' own-row-only RLS is not widened.
create or replace function public.get_public_profiles(p_user_ids uuid[])
returns table (
  user_id uuid,
  username text,
  avatar_url text,
  favorite_driver_id text,
  favorite_constructor_id text,
  country text
) language sql stable security definer
set search_path = public, pg_temp as $$
  select p.id, p.username, p.avatar_url, p.favorite_driver_id, p.favorite_constructor_id, p.country
  from public.profiles p
  where p.id = any(p_user_ids)
$$;
grant execute on function public.get_public_profiles(uuid[]) to authenticated;
