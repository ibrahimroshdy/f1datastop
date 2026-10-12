---
title: Runbooks
description: "Day-to-day operations for F1 DataStop: checking the clock, running jobs, secrets and troubleshooting."
---

Practical steps for looking after the project. The list of jobs and times is on [Scheduled jobs](/pipeline.html).

## Check or pause the clock

The clock lives in Supabase (`pg_cron`). GitHub's own schedule is not used for data jobs; the only GitHub schedule is the once-a-day backup for the digest, described on [Scheduled jobs](/pipeline.html). In the Supabase SQL editor:

```sql
-- list the jobs
select jobname, schedule, active from cron.job where jobname like 'f1ds-%';

-- the last runs
select * from cron.job_run_details order by runid desc limit 10;

-- pause one job (running migration 20261012130000 again restores it)
select cron.unschedule('f1ds-charts');

-- did GitHub accept the last starts? 204 or 200 means yes
select id, status_code, error_msg from net._http_response order by id desc limit 5;
```

## Run something now

```sh
gh workflow run pipeline.yml --ref main -f job=reconcile   # or charts | assets | digest | all
gh workflow run queue.yml --ref main                       # handle waiting requests now
cd analysis
python charts_todo.py --season "$(date -u +%Y)"            # which charts are still missing?
python index_export.py --season "$(date -u +%Y)"           # refresh the CDN indexes after a manual export
```

## Custom chart requests

A visitor picks drivers in the Deep Dive tab. That adds a row to `f1_chart_requests`, and a database trigger starts the Queue workflow. The workflow runs `generate.py --only <chart> --drivers <codes>`, uploads the picture to R2, adds a row to `analysis_charts`, and the site picks it up. Requests for the same drivers are shared: the key is the driver codes in capitals, sorted and joined with `-`.

The charts that can be customised are `driver_compare`, `season_scorecard`, `dominance_flat`, `track_dominance`, `parallax_stack`, `speed_trace` and `driver_radar`. The list is `CUSTOMIZABLE_CHARTS` in `web/src/services/chartRequestService.ts`. How the queue works is on [Scheduled jobs](/pipeline.html).

## Secrets

- **GitHub Actions secrets:** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `BLOB_PUBLIC_BASE`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `F1_LIVETIMING_PROXY`, `SLACK_ALERTS_WEBHOOK`.
- **Website (Vercel or `.env`):** the three `VITE_SUPABASE_*` values are required; the rest are optional. See [Getting started](/getting-started.html).
- **Server functions:** `BMC_WEBHOOK_SECRET` and `F1_PROXY_TOKEN`, set with `supabase secrets set`.
- **Supabase Vault:** `github_actions_dispatch_token` (and optionally `github_actions_dispatch_repo`), used by the database to start workflows.

:::caution
**Never commit service-role keys.** Browser code only gets the public (anon) key.
:::

## When something is wrong

| What you see | What to check |
| --- | --- |
| A job reports "no data" for a session | Right after a session this is normal: the upstream data can be hours late. Run it again later. A job exiting with code 2 means "not available yet" and counts as a skip. |
| FastF1 fails on GitHub with "no data" | F1's timing servers refuse GitHub's computers, so downloads go through the `f1-livetiming-proxy` function. Check the `F1_LIVETIMING_PROXY` secret first. |
| Charts or assets jobs fail | The jobs run every step, write a summary, and fail if any call failed. Check whether Jolpica is up, and look at `api_metrics` for 429 (too many requests) answers. |
| Nothing has updated for a day | Read the daily digest in Slack. Look at the cron job list above, and at the GitHub start responses. If the responses are 401 or 403, the GitHub token in the Vault has probably expired: create a new one and use `vault.update_secret`. |
| A 404 from a data source | The data really does not exist. It is recorded as `empty` and not retried. |
| A 429, 5xx, 521, 522 or a timeout | Temporary. It is retried with a delay. |
| A visitor's request is stuck | Look at the row's `status` in `f1_chart_requests` or `f1_telemetry_requests`. A row stuck in `processing` for over 30 minutes is reset automatically on the next queue run. You can start one with `gh workflow run queue.yml --ref main`. |
| Results changed after a race (for example a penalty) | The 6-hourly results update re-checks results after a race, so penalties applied later are picked up by the next run. |
