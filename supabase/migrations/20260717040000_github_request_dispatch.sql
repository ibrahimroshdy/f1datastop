-- Supabase → GitHub bridge: when a Deep Dive chart request or a Pit Wall any-lap
-- telemetry request is inserted, fire a GitHub `repository_dispatch` so a GitHub Actions
-- workflow generates it. Replaces the two minute-crons (process_chart_requests /
-- process_telemetry_requests) with per-request, webhook-triggered runs.
--
-- PREREQUISITES (do BEFORE this fires usefully — the function no-ops with a warning if
-- the Vault secrets are missing, so applying it early is safe):
--   1. Create a fine-grained GitHub PAT (repo: ibrahimroshdy/f1datastop, Contents: R/W —
--      the permission needed to POST /dispatches). Then store it + the repo in Vault:
--        select vault.create_secret('<PAT>', 'github_pat');
--        select vault.create_secret('ibrahimroshdy/f1datastop', 'github_repo');
--   2. Push the .github/workflows/* so the dispatch has something to trigger.

create extension if not exists pg_net;

create or replace function public.dispatch_github_request()
returns trigger
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  gh_pat  text;
  gh_repo text;
  ev      text;
begin
  ev := case tg_table_name
          when 'f1_chart_requests'     then 'chart_request'
          when 'f1_telemetry_requests' then 'telemetry_request'
          else null
        end;
  if ev is null then
    return new;
  end if;

  select decrypted_secret into gh_pat  from vault.decrypted_secrets where name = 'github_pat'  limit 1;
  select decrypted_secret into gh_repo from vault.decrypted_secrets where name = 'github_repo' limit 1;
  if gh_pat is null or gh_repo is null then
    raise warning 'dispatch_github_request: missing vault secret github_pat/github_repo — skipping dispatch';
    return new;
  end if;

  perform net.http_post(
    url := 'https://api.github.com/repos/' || gh_repo || '/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || gh_pat,
      'Accept', 'application/vnd.github+json',
      'User-Agent', 'supabase-f1datastop',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'event_type', ev,
      'client_payload', jsonb_build_object(
        'id', new.id, 'season', new.season, 'round', new.round, 'session', new.session
      )
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_dispatch_chart_request on public.f1_chart_requests;
create trigger trg_dispatch_chart_request
  after insert on public.f1_chart_requests
  for each row when (new.status = 'pending')
  execute function public.dispatch_github_request();

drop trigger if exists trg_dispatch_telemetry_request on public.f1_telemetry_requests;
create trigger trg_dispatch_telemetry_request
  after insert on public.f1_telemetry_requests
  for each row when (new.status = 'pending')
  execute function public.dispatch_github_request();
