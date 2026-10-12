# Python scripts (`analysis/`)

These scripts collect Formula 1 data, draw the Deep Dive charts and publish files to the CDN. They run as scheduled jobs on GitHub Actions; there is no separate server. The full documentation is at https://docs.f1datastop.com:

- [Scheduled jobs](https://docs.f1datastop.com/pipeline.html): what runs, when, and how the request queue works
- [Data and CDN](https://docs.f1datastop.com/data.html): data sources, file layout and the charts
- [Backend](https://docs.f1datastop.com/backend.html): database tables and the backfill window
- [Runbooks](https://docs.f1datastop.com/runbooks.html): secrets and troubleshooting

## Run locally

```bash
cd analysis
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt

# draw charts into ./out, no upload:
python generate.py --season 2024 --round 1 --session R --no-upload
```

To upload for real, set the same secrets the workflows use (`R2_*`, `BLOB_PUBLIC_BASE`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; the full list is in [Runbooks](https://docs.f1datastop.com/runbooks.html)) and run `python generate.py --latest`. The `analysis_charts` table and the R2 bucket must exist first.

`generate.py` exits with `0` for success or nothing to do, `2` when the session data is not available yet (a skip, not an error) and `1` for a failure.

Add new chart types to the `CHARTS` registry in `generate.py`. Flags and poster designs are in [POSTERS.md](POSTERS.md).

## Main scripts

| Script | Purpose |
|---|---|
| `ingest.py`, `ff1_ingest.py` | Store results (Jolpica/Ergast) and extras (FastF1) in the database |
| `backfill.py` | Fill the database for a range of seasons (`--season`, `--from-season`, `--latest`, `--dry-run`) |
| `generate.py` | Draw the charts and posters |
| `data_export.py`, `index_export.py`, `telemetry_export.py`, `race_replay_export.py`, `circuit_geometry_export.py`, `weather_export.py` | Publish files and indexes to the CDN |
| `reconcile_needed.py`, `charts_todo.py` | Quick checks that decide whether a job has work to do |
| `process_chart_requests.py`, `process_telemetry_requests.py` | Handle visitor requests |
| `free_tier_digest.py` | The daily Slack digest |

## Tests

```bash
cd analysis && python -m unittest discover -s tests
```

The tests use only the standard library and need no network.

Jolpica/Ergast data is proxy-only: never publish raw Ergast data to the CDN. `backfill.py` writes with the service-role key to whatever project `SUPABASE_URL` names, so point it at a local test project when experimenting.
