# FastF1 analysis pipeline

Generates branded telemetry/strategy charts (things Ergast/OpenF1 can't easily do)
and serves them on the website — **no separate bot repo, no always-on server**.

```
GitHub Actions (cron, per race weekend)
        │  python analysis/generate.py --latest
        ▼
FastF1 → matplotlib PNGs (Pit Wall branding)
        │  upload
        ▼
Supabase Storage  (bucket: charts/{season}/{round}/{session}/{type}.png, public)
Supabase table    (analysis_charts index row)
        │  read
        ▼
Web app → Race Analysis → "Deep Dive" tab embeds the images
```

## Charts (v1)
`speed_trace`, `tyre_strategy`, `position_changes`, `team_pace`. Add more in
`generate.py` (the bot's other ~20 chart ideas port here).

## Run
```bash
cd analysis
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt

# local test (writes ./out, no upload):
python generate.py --season 2024 --round 1 --session R --no-upload

# real run (uploads to Supabase):
export SUPABASE_URL=https://envqfquhkcbnitwlzepx.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
python generate.py --latest
```

## Automation setup (one-time)
Add two **GitHub repo secrets** (Settings → Secrets → Actions):
- `SUPABASE_URL` = https://envqfquhkcbnitwlzepx.supabase.co
- `SUPABASE_SERVICE_ROLE_KEY` = the project service-role key

Then `.github/workflows/analysis.yml` runs automatically after each race weekend
(Sun 20:00 + Mon 09:00 UTC) and on demand (Actions → Run workflow → optional
season/round/session). Storage bucket `charts` + table `analysis_charts` already exist.

## Canonical data backfill (`backfill.py`)
`backfill.py` is the Python sibling of the `f1-ingest` edge function. It pulls
Jolpica (Ergast-compatible) + OpenF1 and writes canonical `f1_*` warehouse rows
to Supabase via PostgREST, reusing the same service-role upload pattern as
`generate.py` (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`). Every write is an
**idempotent UPSERT** on each table's UNIQUE natural key (see
`supabase/migrations/20260624120000_f1_warehouse.sql`), so re-runs converge and
never double-fetch a domain already marked `complete` in `f1_sync_state`.

Authority: Jolpica/Ergast is authoritative for identity, schedule, results,
qualifying, sprint, pitstops, laps and standings; OpenF1 (2023+) supplies the
explicit `openf1_session_key` crosswalk plus session_drivers / weather /
starting_grid / overtakes / team_radio / position. `is_dnf` is derived at ingest
(`Finished` or `+N Lap` => classified, else DNF); `/laps` + `/pitstops` are
paginated server-side so the client never paginates Jolpica again.

**Window:** current season + last 3 (`[currentYear-3 .. currentYear]`) plus all
future scheduled rounds of the current season. Older seasons are intentionally
not backfilled — the live proxy serves them.

```bash
cd analysis && . .venv/bin/activate
export SUPABASE_URL=http://127.0.0.1:54321          # LOCAL stack only
export SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key>

# one season (completed rounds + future schedule rows)
python backfill.py --season 2025

# the full window, dependency-correct (dimensions -> spine -> facts -> openf1)
python backfill.py --from-season 2023 --to-season 2026

# a single round, the latest completed round, a domain subset, or a dry-run
python backfill.py --season 2025 --round 12
python backfill.py --latest
python backfill.py --season 2025 --domains schedule,results,laps --no-openf1
python backfill.py --season 2025 --dry-run        # fetch + print, no writes
```

Resumable + rate-safe: it runs sequentially with a small inter-request delay and
treats 404 as genuinely-absent (`empty`) vs 429/5xx/521/522/timeout as transient
(retry with backoff, never cache empty-as-final). Verify coverage before
declaring a season done:

```sql
SELECT domain, status, count(*) FROM f1_sync_state GROUP BY domain, status ORDER BY domain;
```

> Env defaults to the public Jolpica/OpenF1 hosts; override with `JOLPICA_BASE`
> / `OPENF1_BASE`. Point `SUPABASE_URL` at the **local** stack — the user ships
> to prod.
