-- Privileged one-shot helper: copy the Slack webhook (held in the edge-function secret
-- SLACK_WEBHOOK_URL) into Vault as `slack_signup_webhook`, where the signup-notify trigger
-- reads it. Callable only by service_role (the edge function), so the URL never transits
-- the client or chat. Idempotent (create or update).
create or replace function public.store_signup_webhook(p_url text)
returns text
language plpgsql
security definer
set search_path = vault, public
as $$
declare sid uuid;
begin
  select id into sid from vault.secrets where name = 'slack_signup_webhook';
  if sid is null then
    perform vault.create_secret(p_url, 'slack_signup_webhook', 'signup notify webhook (copied from edge secret)');
    return 'created';
  else
    perform vault.update_secret(sid, p_url);
    return 'updated';
  end if;
end;
$$;

revoke all on function public.store_signup_webhook(text) from public, anon, authenticated;
grant execute on function public.store_signup_webhook(text) to service_role;
