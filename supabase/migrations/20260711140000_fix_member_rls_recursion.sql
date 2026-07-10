-- Fix: infinite recursion in game_league_member SELECT policy.
-- The old policy did `exists (select 1 from game_league_member ...)`, which re-triggers the
-- same policy → recursion. Any read of game_league (whose read policy checks membership) also
-- recursed. Co-member visibility is served by SECURITY DEFINER RPCs (get_league_members,
-- get_league_standings, etc.), so the direct table policy only needs own-rows + admin.
drop policy if exists game_member_read on public.game_league_member;
create policy game_member_read on public.game_league_member
  for select to authenticated
  using (user_id = auth.uid() or public.is_game_admin());
