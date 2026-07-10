-- F1 Prediction Game — Phase 2 — safety-net cron: regrade active seasons every 30 min.
-- Primary trigger is the Modal post-ingest hook (calls recalc_game_scores after writing results);
-- this catches any missed hook. Idempotent, cheap (small data).
select cron.schedule(
  'game-recalc-active-seasons',
  '*/30 * * * *',
  $cron$
    select public.recalc_game_scores(s.season)
    from public.game_season s
    where s.status = 'active'
  $cron$
);
