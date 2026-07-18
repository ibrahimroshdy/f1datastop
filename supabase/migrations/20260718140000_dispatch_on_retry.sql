-- Let a FAILED request be retried.
--
-- The dispatch trigger previously fired on INSERT only. But the unique key
-- (season, round, session, chart, driver_key) carries no status, so a request that
-- errored can never be re-inserted — the client gets 23505 forever and the user is stuck
-- looking at a stale error. The client now flips such a row back to 'pending'; this makes
-- that transition dispatch too.
--
-- Guard: only dispatch when the row *enters* pending, so ordinary updates (status ->
-- processing/done/error, updated_at touches) don't re-fire the workflow.

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
  -- Only the transition INTO pending is a new job.
  if tg_op = 'UPDATE' and old.status is not distinct from 'pending' then
    return new;
  end if;

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
  after insert or update on public.f1_chart_requests
  for each row when (new.status = 'pending')
  execute function public.dispatch_github_request();

drop trigger if exists trg_dispatch_telemetry_request on public.f1_telemetry_requests;
create trigger trg_dispatch_telemetry_request
  after insert or update on public.f1_telemetry_requests
  for each row when (new.status = 'pending')
  execute function public.dispatch_github_request();
