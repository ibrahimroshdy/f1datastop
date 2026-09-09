-- Cost hygiene after the R2 move: cheaper crons, bounded log tables, a size probe for alerts.

-- 1) Game recalc: was every 30 min unconditionally (2,900 calls x 260 ms/month) although the
--    post-ingest hook already regrades on new results. Hourly, and only when a result row
--    for that season changed in the last 90 minutes (covers the cron gap).
select cron.unschedule('game-recalc-active-seasons');
select cron.schedule(
  'game-recalc-active-seasons',
  '7 * * * *',
  $cron$
    select public.recalc_game_scores(s.season)
    from public.game_season s
    where s.status = 'active'
      and (exists (select 1 from public.f1_race_result r
                   where r.season = s.season and r.updated_at > now() - interval '90 minutes')
        or exists (select 1 from public.f1_sprint_result r
                   where r.season = s.season and r.updated_at > now() - interval '90 minutes'))
  $cron$
);

-- 2) Push tick: deadline reminders fire within a 2 h window, so hourly still catches every
--    one; 15-minute ticks were 5,800 calls/month for nothing.
select cron.unschedule('game-push-tick');
select cron.schedule('game-push-tick', '23 * * * *', $cron$ select public.game_push_tick() $cron$);

-- 3) Bounded log/cache tables (api_metrics is now sampled at the edge function too).
select cron.schedule(
  'log-retention-daily',
  '41 4 * * *',
  $cron$
    delete from public.api_metrics where created_at < now() - interval '14 days';
    delete from public.api_cache where expires_at < now() - interval '1 day';
  $cron$
);

-- 4) DB size probe for the free-tier digest (service role only).
create or replace function public.db_size_bytes()
returns bigint language sql security definer set search_path = public, pg_temp as
$$ select pg_database_size(current_database()) $$;
revoke all on function public.db_size_bytes() from public, anon, authenticated;
grant execute on function public.db_size_bytes() to service_role;
