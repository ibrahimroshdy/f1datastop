---
title: Backend
description: "The F1 DataStop backend: Supabase database, migrations, server functions and the warehouse tables."
---

The backend is a Supabase project: a Postgres database plus a few server functions. Anyone can read the data; only the scheduled jobs can write it.

## Set up a fresh project

Migrations in `supabase/migrations/` are the source of truth: a baseline file (`00000000000000_baseline.sql`) plus the changes after it.

```sh
supabase login
supabase link --project-ref <project-ref>
supabase db push
supabase functions deploy f1-proxy
supabase functions deploy bmc-webhook --no-verify-jwt
supabase functions deploy f1-livetiming-proxy --no-verify-jwt
supabase secrets set BMC_WEBHOOK_SECRET=<secret> F1_PROXY_TOKEN=<token>
```

Then add the GitHub secrets the workflows need (repository Settings, then Secrets and variables, then Actions):

| Secret | Used for |
| --- | --- |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Uploading files to Cloudflare R2. |
| `BLOB_PUBLIC_BASE` | The public address of the CDN. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Writing to the database from the jobs. |
| `F1_LIVETIMING_PROXY` | Reaching the F1 timing servers, which refuse GitHub's computers (see below). |
| `SLACK_ALERTS_WEBHOOK` | The daily digest message. |

:::caution
**Never commit a service-role key.** The website only uses the public (anon) key. The service-role key lives only in GitHub secrets and in your own terminal.
:::

## Server functions

| Function | What it does |
| --- | --- |
| `f1-proxy` | Fetches Jolpica and OpenF1 data for the site and caches it in the `api_cache` table (8 second timeout, serves the older copy if the provider is down, logs to `api_metrics`). Cache lifetimes are in `supabase/functions/_shared/cacheTtl.ts`. |
| `f1-livetiming-proxy` | Public. F1's timing servers block GitHub's computers, so FastF1 downloads go through this function instead. It checks a secret token in the address (`F1_PROXY_TOKEN`). |
| `bmc-webhook` | Public. Receives supporter notifications and checks them with `BMC_WEBHOOK_SECRET`. |

The two public functions are marked `verify_jwt = false` in `supabase/config.toml`.

## The warehouse tables

Every table name starts with `f1_`. Rows are written with "insert, or update if it already exists" using a unique key made of real values (such as season and round), so running a job twice is harmless. Everyone can read; only the service role can write.

- **Basics:** `f1_driver`, `f1_constructor` (and career tables), `f1_season`, `f1_circuit`.
- **Race weekends:** `f1_race` (one row per season and round) and `f1_session` (one row per season, round and session code).
- **Results from Jolpica/Ergast:** `f1_race_result`, `f1_qualifying_result`, `f1_sprint_result`, `f1_pit_stop`, `f1_lap` (large), `f1_driver_standing`, `f1_constructor_standing`.
- **Extras from FastF1:** `f1_weather`, `f1_overtake` (worked out from lap-by-lap position changes) and `f1_race_control` (race control messages), written by `ff1_ingest.py`. Also `f1_lap_summary`, `f1_stint_summary` and `f1_session_result_ff1`, written while charts are drawn.
- **Progress log:** `f1_sync_state` records, for each kind of data, season, round and session, whether it is `pending`, `partial`, `complete`, `empty`, `error` or `not_applicable`.
- **Visitor request queues:** `f1_chart_requests` and `f1_telemetry_requests`. New rows are refused while 500 are already waiting.
- **Chart index:** `analysis_charts`, one row per rendered chart.

OpenF1 is no longer used to collect data. The old tables `f1_session_driver`, `f1_starting_grid`, `f1_team_radio` and `f1_position` may still hold older rows, but nothing new is written to them.

To see how complete the data is:

```sql
SELECT domain, status, count(*) FROM f1_sync_state GROUP BY domain, status;
```

## How far back the database goes

The current season and the three before it, plus the remaining scheduled rounds of the current season. Older seasons are not stored: the `f1-proxy` function serves them. The script is `analysis/backfill.py`:

```sh
cd analysis && . .venv/bin/activate
export SUPABASE_URL=http://127.0.0.1:54321            # a local test project only
export SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key>
python backfill.py --from-season 2023 --to-season 2026
python backfill.py --season 2025 --dry-run             # fetch and print, write nothing
```

It also accepts `--round`, `--latest` and `--domains` (for example `schedule,results,laps`). It waits between requests, treats a 404 as "this really does not exist" (`empty`), and retries 429, 5xx, 521, 522 and timeouts with a delay. It never saves an empty answer as final.

:::caution
**Never copy raw Ergast data to the CDN.** Jolpica/Ergast data is proxy-only. Also never mark empty or failed data as final: a gap right after a session is `partial` and is retried.
:::

## Turning on database reads

The setting `VITE_DB_SERVING_ENABLED` is off by default and is separate from `VITE_F1_PROXY_ENABLED`. Turning it on makes the site read schedule, results, laps and older standings snapshots from our own copy (CDN files, then the database) for seasons inside the window, before the proxy. Turn it on only after the progress log shows the data is complete and the migrations are applied. To go back, switch it off again.

## Migration notes

The files in `supabase/migrations/` have short comments. The clock itself is described on [Scheduled jobs](/pipeline.html). When adding a migration, name the file with the exact version Supabase records (`supabase migration list`) and apply it with `supabase db push`, not with an editor tool that stamps its own version, which makes the history drift.
