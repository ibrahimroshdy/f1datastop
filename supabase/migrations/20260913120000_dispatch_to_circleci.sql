-- Repoint the request bridge from GitHub Actions to CircleCI.
--
-- Why: the whole pipeline moved to CircleCI on 2026-09-13 after the GitHub account's
-- shared 3,000 included Actions minutes ran out mid-race-weekend and .github was deleted.
-- These triggers still POSTed to api.github.com/repos/…/dispatches, which now has nothing
-- to trigger, so a Deep Dive custom-chart request or a Pit Wall any-lap request would sit
-- pending forever.
--
-- What changes: the same trigger semantics (fire when a row ENTERS 'pending', on insert
-- or on a retry update) now POST to CircleCI's v2 pipeline endpoint with the run_job
-- pipeline parameter that .circleci/config.yml declares.
--
-- The GitHub version passed the row's id/season/round/session as client_payload. CircleCI
-- pipeline parameters must be declared in config, and the processors do not need them
-- anyway: process_chart_requests.py and process_telemetry_requests.py claim and drain
-- every pending row themselves. So only run_job is sent.
--
-- PREREQUISITE — store a CircleCI token that can TRIGGER pipelines:
--   select vault.create_secret('<circleci personal API token>', 'circleci_token');
--   -- optional, defaults to gh/ibrahimroshdy/f1datastop:
--   select vault.create_secret('gh/ibrahimroshdy/f1datastop', 'circleci_project');
--
-- A project *Status* token is NOT enough — status tokens answer 404 on the pipeline
-- endpoint. The function no-ops with a warning when the secret is missing, so applying
-- this before the secret exists is safe.

create extension if not exists pg_net;

create or replace function public.dispatch_ci_request()
returns trigger
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  cci_token   text;
  cci_project text;
  ev          text;
begin
  -- Only the transition INTO pending is a new job: ordinary updates (status ->
  -- processing/done/error, updated_at touches) must not re-fire the pipeline.
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

  select decrypted_secret into cci_token
    from vault.decrypted_secrets where name = 'circleci_token' limit 1;
  select decrypted_secret into cci_project
    from vault.decrypted_secrets where name = 'circleci_project' limit 1;

  if cci_token is null then
    raise warning 'dispatch_ci_request: missing vault secret circleci_token — skipping dispatch';
    return new;
  end if;
  cci_project := coalesce(cci_project, 'gh/ibrahimroshdy/f1datastop');

  perform net.http_post(
    url := 'https://circleci.com/api/v2/project/' || cci_project || '/pipeline',
    headers := jsonb_build_object(
      'Circle-Token', cci_token,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'branch', 'main',
      'parameters', jsonb_build_object('run_job', ev)
    )
  );
  return new;
end;
$$;

-- Repoint both triggers, then retire the GitHub function.
drop trigger if exists trg_dispatch_chart_request on public.f1_chart_requests;
create trigger trg_dispatch_chart_request
  after insert or update on public.f1_chart_requests
  for each row when (new.status = 'pending')
  execute function public.dispatch_ci_request();

drop trigger if exists trg_dispatch_telemetry_request on public.f1_telemetry_requests;
create trigger trg_dispatch_telemetry_request
  after insert or update on public.f1_telemetry_requests
  for each row when (new.status = 'pending')
  execute function public.dispatch_ci_request();

drop function if exists public.dispatch_github_request();
