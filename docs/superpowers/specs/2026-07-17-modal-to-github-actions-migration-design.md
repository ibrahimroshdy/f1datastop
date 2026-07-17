# Modal → GitHub Actions Migration — Design

**Date:** 2026-07-17
**Goal:** Remove Modal entirely (its $30/mo≈"$1/day" credit cap silently breaks Deep Dive custom charts and any-lap telemetry). Move all compute to **GitHub Actions** (ongoing) + **local runs** (historical backfill). The web UI does not change. Repo is **private** (`ibrahimroshdy/f1datastop`) → **2000 GitHub Actions minutes/mo** budget.

## 1. What Modal does today (`modal_app.py`)

Scheduled crons (5):

| Cron | Schedule | Job |
|---|---|---|
| `backfill_current` | every 6h | reconcile current season into warehouse (results, standings, laps) |
| line 229 (`**ORCH`) | every 6h | replay + circuit-geometry reconcile for latest |
| `generate_latest` | weekends, every 3h | regenerate analysis charts/posters for the latest race |
| `process_chart_requests` | every 1 min | **Deep Dive** queue → `generate.py --drivers …` |
| `process_telemetry_requests` | every 1 min | **any-lap telemetry** queue → `telemetry_export.py --lap …` |

Manual functions (backfills): `ingest_season`, `backfill_range`, `export_telemetry`/`backfill_telemetry`, `export_race_replays`/`backfill_replays`, `backfill_circuits`, `generate_season`/`generate_range`/`generate_all_sessions`.

All are Python + FastF1. Env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Deps: `analysis/requirements.txt` + `fontconfig` (brand fonts) + a FastF1 cache dir (`FASTF1_CACHE`).

## 2. Target architecture (no Modal)

```
Supabase = state + webhooks + storage        GitHub Actions = compute (FastF1)
──────────────────────────────────────────────────────────────────────────────
ONGOING (2026+) — GitHub Actions
  reconcile.yml          schedule every 2h    ← backfill_current (data check)
  replay-geometry.yml    schedule every 6h    ← replays + circuit geometry (latest)
  charts-latest.yml      schedule weekend     ← generate_latest (posters)
  chart-request.yml      repository_dispatch  ← Deep Dive, one run per request
  telemetry-request.yml  repository_dispatch  ← any-lap telemetry, one run per request

HISTORICAL (2018–2026) — LOCAL (user machine, free compute, no GitHub minutes)
  local backfill runbook: telemetry all-laps + replays + charts + geometry,
  2026 → 2018, starting with 2026 R9 Silverstone as the smoke test.

BRIDGE
  Supabase DB webhook on INSERT(f1_chart_requests | f1_telemetry_requests)
    → POST GitHub repository_dispatch (event_type + client_payload = the row)
    → the matching *-request.yml workflow runs, uploads to Storage, marks row done
  Web UI unchanged: still inserts the request row and polls getRequestState/analysis_charts.
```

### Why this split
- **Backfill is the only heavy cost** (all laps × all races ≈ 1000 blobs/race, FastF1-bound). Running it **locally** keeps it off the 2000-min GitHub budget entirely.
- **Ongoing work is light**: periodic reconciles + occasional on-demand requests. Webhook-triggered (not polled) so it costs minutes only when there's actual work.

## 3. Components

### 3.1 Shared CI setup (composite action or repeated steps)
- `actions/setup-python`
- `pip install -r analysis/requirements.txt`; `sudo apt-get install -y fontconfig`
- `actions/cache` keyed on season/round for the **FastF1 cache** (`FASTF1_CACHE`) — avoids re-downloading session data every run (big latency + rate-limit win).
- Env from secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

### 3.2 Workflows (`.github/workflows/`)
- **reconcile.yml** — `on: schedule (0 */2 * * *)` + `workflow_dispatch`. Runs `backfill_current` equivalent (`ingest_season` for the current season, skip-complete). ~2 min/run.
- **replay-geometry.yml** — `on: schedule (0 */6 * * *)`. Runs `race_replay_export.py` + circuit geometry for the latest round(s).
- **charts-latest.yml** — `on: schedule (weekend)`. Runs `generate.py --latest`.
- **chart-request.yml** — `on: repository_dispatch (types: [chart_request])`. Reads `client_payload` (season/round/session/chart/drivers), runs `generate.py`, uploads PNGs to Storage, inserts `analysis_charts`, sets the request row `done`/`error`. `concurrency` group to serialize bursts.
- **telemetry-request.yml** — `on: repository_dispatch (types: [telemetry_request])`. Same shape → `telemetry_export.py --lap`.
- **(optional) telemetry-backfill.yml** — `on: workflow_dispatch (season, round)`. A single-race all-laps export from CI, for the rare case we want a specific old race without a local run. Bulk backfill stays local.

### 3.3 Supabase → GitHub bridge
- **DB webhook** (Supabase Dashboard → Database Webhooks) OR a `pg_net` trigger on `INSERT` to `f1_chart_requests` and `f1_telemetry_requests`.
- Target: `POST https://api.github.com/repos/ibrahimroshdy/f1datastop/dispatches` with `{ event_type, client_payload: <NEW row minus internal cols> }`.
- Auth: a **fine-grained GitHub PAT** with **Contents: read/write** (permission required to trigger `repository_dispatch`) on this repo only, stored in **Supabase Vault** (never in the frontend).
- `client_payload` ≤ 64 KB — a request row is tiny, fine.

### 3.4 Small script change needed
`telemetry_export.py` today exports the fastest lap (+ one `--lap`). For the **all-laps** local backfill, add an `--all-laps` mode that loops every valid lap in the race and exports each (dedup against `f1_telemetry_index`). This is the only new script code; everything else reuses existing scripts.

## 4. Request flow (Deep Dive + any-lap) — unchanged for users

1. User clicks Generate / picks a lap → frontend inserts a row in `f1_chart_requests` / `f1_telemetry_requests` (status `pending`). *(already implemented — `chartRequestService`, `telemetryRequestService`)*
2. Supabase webhook fires `repository_dispatch` to GitHub with the row.
3. GitHub Actions runs the generator, uploads to Storage, writes `analysis_charts` / `f1_telemetry_index`, marks the row `done`.
4. Frontend (already polling every 5 s) shows the result.

Latency ≈ 30–60 s (runner cold start + FastF1), same ballpark as Modal.

## 5. Budget (private repo = 2000 min/mo)

| Job | Runs/mo | ~min ea | ~min/mo |
|---|---|---|---|
| reconcile (2h) | ~360 | 2 | 720 |
| replay-geometry (6h) | ~120 | 3 | 360 |
| charts-latest (weekend) | ~30 | 4 | 120 |
| Deep Dive + telemetry (on-demand) | usage | 1–2 | ~200 |
| **Backfill** | — | — | **0 (local)** |
| **Total** | | | **≈ 1400** |

~600 min headroom. If tighter, scope reconcile to race-weekends + daily instead of a flat 2h.

## 6. Migration (big-bang)

1. Add the `--all-laps` mode to `telemetry_export.py`.
2. Add all workflows + a shared setup step; add GitHub secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
3. Create the fine-grained PAT → Supabase Vault; add the two DB webhooks.
4. **Smoke test with Modal still running:** manually insert a chart request + a telemetry request → confirm the webhook fires, the workflow runs, the row goes `done`, the asset appears. Trigger `reconcile.yml` via `workflow_dispatch`.
5. **Local backfill:** run 2026 R9 Silverstone all-laps first (verify in Pit Wall auto-follow), then all 2026, then 2025 → 2018.
6. **Cut Modal:** stop the Modal app (`modal app stop …`) / remove the schedules, then delete/archive `modal_app.py`. Update `README`/memory.

## 7. Risks & mitigations
- **FastF1 rate-limits / slow cold data** → `actions/cache` the FastF1 cache; local backfill reuses a warm local cache.
- **PAT leakage** → fine-grained, single-repo, Contents-only, stored in Supabase Vault; rotate if exposed. `SERVICE_ROLE_KEY` only in GitHub Secrets, never logged.
- **Concurrency bursts** (many requests) → `concurrency` groups per workflow; requests still queue in the table and get picked up.
- **Backfill runtime** (hours) → local, batched by season; idempotent (skip-complete / dedup on index).
- **A job silently failing** (big-bang risk) → the smoke test in step 4 before cutting Modal; keep `modal_app.py` archived (not deleted) for one race weekend as a rollback.

## 8. Decisions (locked)
- **Scope:** 2026+ ongoing on GitHub Actions; 2018–2026 historical backfill **run locally**, 2026 → 2018, starting 2026 R9 Silverstone.
- **Approach:** big-bang (build everything, smoke test, cut Modal).
- **Reconcile cadence:** every 2 h (data check) + 6 h replay/geometry + weekend charts.
- **On-demand:** webhook-triggered `repository_dispatch` (no polling), so Deep Dive + any-lap keep working with no per-day cap.

## 9. Out of scope
- Frontend changes (none needed — request tables + polling already exist).
- Weather local-schema drift (separate issue).
- Real-time (<10 s) generation — webhook latency ~30–60 s is accepted.
