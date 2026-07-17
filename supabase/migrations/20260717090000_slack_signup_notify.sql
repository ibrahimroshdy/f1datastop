-- Server-side signup → Slack notifications.
--
-- Replaces the fragile client-side notify-slack invoke (which only fired for OAuth
-- signups that returned a session — ~79% of signups are email, and with "Confirm email"
-- ON those return session=null, so they NEVER notified; last real ping was ~Jun 14,
-- when the Jun 20-21 hardening added verify_jwt + the `if (data.session)` gate).
--
-- This fires from the DB for EVERY user the moment they become *confirmed* — INSERT with
-- email_confirmed_at already set (OAuth) OR the UPDATE that sets it (email confirm link).
-- One ping per real user, server-side, unskippable by the client.
--
-- PREREQUISITE (function no-ops with a warning until this exists, so applying early is safe):
--   Mint a Slack *incoming webhook* URL, then store it in Vault:
--     select vault.create_secret('https://hooks.slack.com/services/XXX/YYY/ZZZ', 'slack_signup_webhook');

create extension if not exists pg_net;

create or replace function public.notify_slack_signup()
returns trigger
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  webhook   text;
  v_provider text;
  v_email    text;
  v_name     text;
  v_username text;
  v_header   text;
begin
  -- Only fire on the transition to confirmed. On UPDATE, skip if it was already confirmed
  -- (e.g. ordinary logins that touch last_sign_in_at but not email_confirmed_at).
  if tg_op = 'UPDATE' and old.email_confirmed_at is not null then
    return new;
  end if;

  select decrypted_secret into webhook
    from vault.decrypted_secrets where name = 'slack_signup_webhook' limit 1;
  if webhook is null then
    raise warning 'notify_slack_signup: missing vault secret slack_signup_webhook — skipping';
    return new;
  end if;

  v_provider := coalesce(new.raw_app_meta_data->>'provider', 'email');
  v_email    := coalesce(new.email, new.raw_user_meta_data->>'email', 'unknown');
  v_name     := nullif(trim(concat_ws(' ',
                  new.raw_user_meta_data->>'first_name',
                  new.raw_user_meta_data->>'last_name')), '');
  v_name     := coalesce(v_name,
                  new.raw_user_meta_data->>'full_name',
                  new.raw_user_meta_data->>'name', 'Not provided');
  v_username := coalesce(
                  new.raw_user_meta_data->>'username',
                  new.raw_user_meta_data->>'user_name',
                  new.raw_user_meta_data->>'preferred_username', 'Not provided');
  v_header   := case v_provider
                  when 'twitter' then '🐦 New Twitter/X User Signup!'
                  when 'google'  then '🔍 New Google User Signup!'
                  when 'email'   then '✉️ New Email User Signup!'
                  else '🎉 New User Signup!'
                end;

  perform net.http_post(
    url := webhook,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('blocks', jsonb_build_array(
      jsonb_build_object('type','header',
        'text', jsonb_build_object('type','plain_text','text', v_header, 'emoji', true)),
      jsonb_build_object('type','section','fields', jsonb_build_array(
        jsonb_build_object('type','mrkdwn','text','*Name:*'||chr(10)||v_name),
        jsonb_build_object('type','mrkdwn','text','*Username:*'||chr(10)||v_username))),
      jsonb_build_object('type','section','fields', jsonb_build_array(
        jsonb_build_object('type','mrkdwn','text','*Email:*'||chr(10)||v_email),
        jsonb_build_object('type','mrkdwn','text','*Auth Provider:*'||chr(10)||v_provider))),
      jsonb_build_object('type','context','elements', jsonb_build_array(
        jsonb_build_object('type','mrkdwn','text','Signup received from F1 DataStop')))
    ))
  );
  return new;
exception when others then
  -- Never let a notification failure break auth.
  raise warning 'notify_slack_signup: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_notify_slack_signup on auth.users;
create trigger trg_notify_slack_signup
  after insert or update on auth.users
  for each row
  when (new.email_confirmed_at is not null)
  execute function public.notify_slack_signup();
