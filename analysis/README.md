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
