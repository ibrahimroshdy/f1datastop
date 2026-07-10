-- F1 Prediction Game — Phase 5 — push notifications (sending side).
-- Frontend subscription flow already exists (lib/push.ts + public/sw.js + NotificationToggle).
-- This adds the server side: config, a notify helper (calls the send-push edge fn via pg_net),
-- an admin broadcast RPC, and a cron tick that fires deadline + graded notifications (deduped).

-- Config: send-push URL + gateway apikey (anon, public) + admin token. Secrets seeded out-of-band
-- (NOT in this migration). Admin-only.
create table if not exists public.game_push_config (
  id            int primary key default 1 check (id = 1),
  send_push_url text not null,
  apikey        text not null,
  admin_token   text not null,
  updated_at    timestamptz not null default now()
);
alter table public.game_push_config enable row level security;
create policy game_push_config_admin on public.game_push_config
  for all to authenticated using (public.is_game_admin()) with check (public.is_game_admin());

-- Dedupe log so each (kind, season, round) fires once.
create table if not exists public.game_notification_log (
  kind    text not null check (kind in ('deadline','graded','broadcast')),
  season  int,
  round   int,
  sent_at timestamptz not null default now(),
  primary key (kind, season, round)
);
alter table public.game_notification_log enable row level security;
create policy game_notif_log_admin on public.game_notification_log
  for select to authenticated using (public.is_game_admin());

-- Low-level: broadcast a push to all subscribers via the send-push edge function.
create or replace function public.game_notify(p_title text, p_body text, p_url text default '/game')
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare cfg public.game_push_config;
begin
  select * into cfg from public.game_push_config where id = 1;
  if cfg.send_push_url is null then return; end if; -- push not configured → no-op
  perform net.http_post(
    url := cfg.send_push_url,
    body := jsonb_build_object('title', p_title, 'body', p_body, 'url', coalesce(p_url, '/game')),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-admin-token', cfg.admin_token,
      'Authorization', 'Bearer ' || cfg.apikey)
  );
end $$;

-- Admin broadcast (wired to /game/admin).
create or replace function public.admin_broadcast(p_title text, p_body text, p_url text default '/game')
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_game_admin() then raise exception 'admin only'; end if;
  if length(trim(coalesce(p_title,''))) = 0 then raise exception 'title required'; end if;
  perform public.game_notify(p_title, p_body, p_url);
  perform public._game_audit('broadcast', jsonb_build_object('title', p_title, 'body', p_body));
end $$;
grant execute on function public.admin_broadcast(text, text, text) to authenticated;

-- Cron tick: deadline reminders (<=2h out) + graded alerts, deduped via the log.
create or replace function public.game_push_tick()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare s int; r record;
begin
  for s in select season from public.game_season where status = 'active' loop
    for r in
      select gr.round, gr.race_name
      from public.get_game_schedule(s) gr
      where gr.deadline is not null and gr.deadline > now() and gr.deadline <= now() + interval '2 hours'
        and not exists (select 1 from public.game_notification_log l
                        where l.kind='deadline' and l.season=s and l.round=gr.round)
    loop
      perform public.game_notify('Picks lock soon',
        'Round ' || r.round || ' — ' || r.race_name || ' picks lock within 2 hours. Get your predictions in!',
        '/game/predict/' || r.round);
      insert into public.game_notification_log(kind, season, round) values ('deadline', s, r.round)
        on conflict do nothing;
    end loop;

    for r in
      select gr.round, gr.race_name
      from public.get_game_schedule(s) gr
      where gr.has_results
        and not exists (select 1 from public.game_notification_log l
                        where l.kind='graded' and l.season=s and l.round=gr.round)
    loop
      perform public.game_notify('Results in',
        'Round ' || r.round || ' — ' || r.race_name || ' is graded. Check your points!',
        '/game/history');
      insert into public.game_notification_log(kind, season, round) values ('graded', s, r.round)
        on conflict do nothing;
    end loop;
  end loop;
end $$;

select cron.schedule('game-push-tick', '*/15 * * * *', $cron$ select public.game_push_tick() $cron$);
