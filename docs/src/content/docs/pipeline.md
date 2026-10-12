---
title: Scheduled jobs
description: "Every scheduled job in F1 DataStop, when it runs and what it does, in plain words."
---

This page is the one place that lists every automatic job. If you change a schedule, change it here, in the migration and in the checker together.

## How the clock works

The clock is the `pg_cron` feature of Supabase, not GitHub's own `schedule` trigger. GitHub's trigger is best-effort: once it started a job meant to run every 5 minutes about once in 13 hours. So each Supabase job calls the database function `public.f1_dispatch_workflow()`, which asks GitHub to start the right workflow (`workflow_dispatch`, sent through `pg_net`). The jobs are named `f1ds-*`. They are created by the migrations `20261012130000_pg_cron_clock.sql` and `20261012140000_clock_robustness.sql`. Start minutes differ on purpose, so two jobs never start together and wait for each other.

The only GitHub schedule left is a backup for the daily digest (see below). It is there so that a broken clock does not go unnoticed. The workflows Pipeline and Queue only run in the main repository, so forks never need secrets.

## Every job

All times are UTC. "Fri to Sun" means Friday, Saturday and Sunday.

| Job | When | Schedule | What it does |
| --- | --- | --- | --- |
| **Check** (PR CI, `web`) | Every push and pull request | On GitHub, not scheduled | Type check, lint, tests and a build of the website. |
| **Check** (PR CI, `python-smoke`) | Every push and pull request | On GitHub, not scheduled | Compiles the Python scripts, runs their tests and checks that the schedules in the database match this page. On pull requests, a second check (`pr-title`) makes sure the title is a conventional commit message. |
| **Release** | Every push to `main` | On GitHub, not scheduled | Creates the next version tag and GitHub Release. See [Releases](/releases.html). |
| **Update results** (`reconcile`) | Every 6 hours | `7 */6 * * *` (`f1ds-reconcile`) | Reads the latest results, stores them in the database and publishes the season files to the CDN. This run always goes ahead and catches anything late. |
| **Update results**, race weekends | Every 30 minutes from 12:00 to 21:59, Fri to Sun | `*/30 12,13,14,15,16,17,18,19,20,21 * * 5,6,0` (`f1ds-reconcile-race`) | Same job, but it first runs a quick check (`reconcile_needed.py`) and only continues if a timed session started in the last 8 hours. This picks up results minutes after a session ends. |
| **Draw charts** (`charts`) | Every 2 hours at :15, Fri to Sun | `15 */2 * * 5,6,0` (`f1ds-charts`) | Draws Deep Dive charts for finished sessions that are missing them. A cheap check (`charts_todo.py`) runs first and the job ends at once when there is nothing to draw. |
| **Update extras** (`assets`) | 06:25, 12:25 and 18:25, Fri to Sun | `25 6,12,18 * * 5,6,0` (`f1ds-assets`) | Telemetry, circuit shapes, race replays and weather for the latest finished round and the next one. |
| **Daily digest** (`digest`) | Every day at 07:17 | `17 7 * * *` (`f1ds-digest`) | Posts a short message to Slack: storage and database use against the free limits, the health of recent workflow runs, any failed starts of jobs, and how old the last successful results update is (it warns above 12 hours). |
| **Digest backup** | Every day at 07:41 | `41 7 * * *` (GitHub schedule in `pipeline.yml`) | A second run of the digest, once a day, as a backup in case the Supabase clock is not working. It stays quiet unless the normal digest did not run in the last 20 hours or job starts are failing. |
| **Visitor requests** (`queue`) | As soon as a visitor asks for a chart or telemetry | A database trigger on `f1_chart_requests` and `f1_telemetry_requests` | Processes every waiting request. Each run handles requests in batches and stops when it runs out of time, then starts another run if work is left. |
| **Visitor requests**, safety net | Every 5 minutes | `*/5 * * * *` (`f1ds-queue`) | Calls `f1_dispatch_queue_if_needed()`, which starts the queue only when a request is waiting, or when one has been "processing" for more than 30 minutes. |
| **Publish docs** | When files in `docs/` change on `main` | On GitHub, not scheduled | Builds and publishes this site. |

## Running a job yourself

Open the Actions tab on GitHub, choose Pipeline or Queue, and press "Run workflow". Or use the command line:

```sh
gh workflow run pipeline.yml --ref main -f job=reconcile   # or charts | assets | digest | all
gh workflow run queue.yml --ref main
```

Pipeline also accepts `gate` (reconcile only: run only if the quick check says so), `rounds` (charts and assets only, for example `"5 6"`) and `rebuild_index` (rebuild the CDN indexes from scratch).

## The visitor request queue

When someone asks for a custom chart or telemetry, a row is added to `f1_chart_requests` or `f1_telemetry_requests`. A database trigger then calls `public.f1_dispatch_queue()`, which starts the Queue workflow. The workflow handles every waiting row:

- Rows are taken in batches of `REQUEST_LIMIT` (8 by default) until none are left or the time budget `QUEUE_TIME_BUDGET_S` is used up (540 seconds for charts and 300 seconds for telemetry, inside a 30 minute job limit).
- Each row has its own time limit: `CHART_ROW_TIMEOUT_S` (240 seconds) and `TELEMETRY_ROW_TIMEOUT_S` (180 seconds). A row that times out is marked `error` and can be retried later. A row is only started if it fits in the remaining time.
- Rows left in `processing` for more than `QUEUE_STALE_PROCESSING_S` (1800 seconds) belong to a stopped job, and are put back to `pending` first.
- If rows remain, the last step starts another Queue run with GitHub's built-in token. It only does that if this run made progress and no status update failed, so a persistent failure cannot start runs forever.

Starting the queue is best-effort: a failed start never blocks a visitor's request from being saved.

## One-time setup: the GitHub token

The database needs a GitHub token to start workflows. Create a fine-grained token limited to this repository with the permission "Actions: Read and write", and store it in the Supabase Vault (the SQL editor in the dashboard):

```sql
select vault.create_secret('<token>', 'github_actions_dispatch_token');
-- forks only, if the repository is not ibrahimroshdy/f1datastop:
select vault.create_secret('<owner>/<repo>', 'github_actions_dispatch_repo');
```

Without the token the database does nothing, so forks and fresh databases still work. To change the token, use `vault.update_secret`.

## How we notice a broken clock

- The daily digest reports `public.f1_dispatch_health()`: failed attempts to start workflows and failed cron runs. The database keeps start responses for only about 6 hours, so the report also says what window it covered.
- It also reports how long ago the last successful results update was, and warns above 12 hours.
- If the GitHub token is missing or expired, starting workflows silently does nothing. The "last successful update" line and the digest backup catch this.

## How the check keeps this page honest

`.github/scripts/check_schedules.py` runs in PR CI. It reads the migration and fails if the cron jobs differ from the schedule listed in the script, if any workflow has a `schedule:` other than the one digest backup, or if a started workflow or input does not exist. This page does not run automatically against the checker, so when you change a schedule, update the migration, the checker's table and this page in the same pull request.
