# Modal → GitHub Actions — Cutover Runbook

Practical steps to switch the backend off Modal. Design: `docs/superpowers/specs/2026-07-17-modal-to-github-actions-migration-design.md`.

**Repo is private → 2000 GitHub Actions min/mo.** On-demand jobs are webhook-triggered (no polling); periodic jobs are scheduled; the big historical backfill runs **locally** (off the GitHub budget).

## What was added
- `analysis/process_chart_requests.py`, `analysis/process_telemetry_requests.py` — standalone queue drainers (replace the two Modal minute-crons).
- `analysis/telemetry_export.py --all-laps` — bulk per-lap export (local backfill).
- `.github/actions/f1-setup/` — Python + FastF1 deps + fonts + cache.
- `.github/workflows/` — `f1-chart-request`, `f1-telemetry-request` (repository_dispatch), `f1-reconcile` (2h), `f1-assets` (6h), `f1-charts-latest` (weekend).
- `supabase/migrations/20260717040000_github_request_dispatch.sql` — the Supabase→GitHub trigger.

## Step 1 — GitHub repo secrets
Repo → Settings → Secrets and variables → Actions → New repository secret:
- `SUPABASE_URL` = `https://envqfquhkcbnitwlzepx.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = the prod service_role key (Supabase → Settings → API)

## Step 2 — GitHub PAT for the webhook
- Create a **fine-grained PAT**: Settings → Developer settings → Fine-grained tokens.
  - Repository access: only `ibrahimroshdy/f1datastop`.
  - Permission: **Contents → Read and write** (required to POST `/dispatches`).
- Copy the token (shown once).

## Step 3 — Supabase Vault secrets
In the SQL editor (prod):
```sql
select vault.create_secret('<the-fine-grained-PAT>', 'github_pat');
select vault.create_secret('ibrahimroshdy/f1datastop', 'github_repo');
```

## Step 4 — Push + apply
- Push the branch (workflows only run once on the default branch / as configured).
- Apply the trigger migration (`supabase db push`, or run the SQL in `20260717040000_github_request_dispatch.sql`).

## Step 5 — Smoke test (Modal still running)
1. **Chart:** insert a pending request and confirm the workflow runs and the row completes:
   ```sql
   insert into f1_chart_requests (season, round, session, chart, driver_key, drivers, status)
   values (2026, 9, 'R', 'driver_compare', 'ANT-RUS', array['RUS','ANT'], 'pending');
   ```
   → GitHub → Actions → "Deep Dive chart request" runs → row `status` becomes `done` with a `public_url`.
2. **Telemetry:** same via `f1_telemetry_requests` (or just click a non-fastest lap in Pit Wall while signed in).
3. **Periodic:** Actions → "F1 reconcile current season" → Run workflow → confirm green.

(If a dispatch doesn't fire: check the Vault secrets exist, the PAT has Contents R/W, and `select * from net._http_response order by created desc limit 5;` for the POST result.)

## Step 6 — Cut Modal
Once all three paths are green:
```bash
modal app stop f1datastop      # stops the 5 crons
```
Keep `modal_app.py` in the repo (archived) for one race weekend as rollback, then delete.

## Step 7 — Local historical backfill (per-lap telemetry)
Runs on your machine, off the GitHub budget. See the design doc / the fish commands:
```fish
cd analysis; source venv/bin/activate.fish
set -x SUPABASE_URL "https://envqfquhkcbnitwlzepx.supabase.co"
set -x SUPABASE_SERVICE_ROLE_KEY "<shell only>"
set -x FASTF1_CACHE "$PWD/.fastf1cache"
# all sessions (Q + S skip cleanly when absent)
for sess in R Q S
    python telemetry_export.py --season 2026 --round 9 --session $sess --all-laps   # smoke
end
```
Then widen to all 2026, then 2025→2018, looping `for sess in R Q S`. Resumable (skips already-exported laps). Sessions: R=race, Q=qualifying, S=sprint (only sprint weekends have S; others no-op).

## Budget note
Ongoing est. ≈ 1400 min/mo (reconcile 2h + assets 6h + weekend charts + on-demand). Backfill = 0 GitHub min (local). If tight, drop reconcile to race-weekend + daily.
