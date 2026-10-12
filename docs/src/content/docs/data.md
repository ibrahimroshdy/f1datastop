---
title: Data and CDN
description: "Where F1 DataStop data comes from (Jolpica/Ergast, FastF1, OpenF1), who is trusted for what, and the CDN file layout."
---

Three public sources feed the site. Each one is trusted for specific things only, so they never overwrite each other.

## Sources

| Source | Used for | Trusted for |
| --- | --- | --- |
| [Jolpica / Ergast](https://github.com/jolpica/jolpica-f1) | Standings, schedules, results, laps, pit stops | Who the drivers and teams are, results, standings, the calendar and round numbers. A community mirror: it is read through the proxy and never copied to the CDN. |
| [FastF1](https://github.com/theOehrly/Fast-F1) | Telemetry, sector times, tyre compounds, stints, weather, race control messages | Only the detailed numbers: sectors, compounds, stints and millisecond timing. It never overwrites Ergast results. |
| [OpenF1](https://openf1.org/) | Browser-side extras such as driver photos | No longer used by the data jobs. Weather, overtakes and race control now come from FastF1. |

There is no live timing: all data appears after a session finishes. A delay of a few hours between the end of a session and its results appearing is normal.

A driver is counted as finished when the status is `Finished` or looks like `+1 Lap`; anything else is a "did not finish". The jobs and the website use the same rule.

## File layout on the CDN

Files are stored in Cloudflare R2 and served from `cdn.f1datastop.com`. The address is a default in `analysis/cdn_schedule.py`; set `BLOB_PUBLIC_BASE` to change it.

```text
charts/<season>/<round>-<slug>/<session>/<format>/<chart>[__<DRIVERS>].png
telemetry/…   circuits/…   replays/…   weather/…   season JSON files
```

- **Image formats:** `landscape` and `twitter` (16:9, 3200×1800), `instagram` (4:5) and `story` (9:16). The three big posters are made as landscape, twitter and story. The site falls back to landscape when a format is missing.
- **Charts for chosen drivers** add `__DRIVERS` to the name: the driver codes in capitals, sorted and joined with `-`. Social formats add `_twitter`, `_instagram` or `_story` to the chart type.
- **Index:** the `analysis_charts` table has one row per season, round, session and chart type. `index_export.py` refreshes the indexes after every export.

## Charts

`analysis/generate.py` draws the branded Deep Dive posters from FastF1 data. There are six large boards (`race_analysis`, `driver_compare`, `season_scorecard`, `championship`, `constructors`, `circuit_history`) and a registry of single-topic charts in `CHARTS`. To try one locally without uploading:

```sh
cd analysis
./venv/bin/python generate.py --season 2025 --round 13 --session R \
    --only race_analysis --no-upload --format landscape
```

Images are written to `analysis/out/`. `season_scorecard` reads the database, so it needs `SUPABASE_URL` and a read-only key even with `--no-upload`. Every flag and the poster designs are listed in [`analysis/POSTERS.md`](https://github.com/ibrahimroshdy/f1datastop/blob/main/analysis/POSTERS.md).

The script exits with `0` for success or nothing to do, `2` when the session data is not available yet (treated as a skip, not a failure), and `1` for a real failure. Setup for the Python scripts is in [`analysis/README.md`](https://github.com/ibrahimroshdy/f1datastop/blob/main/analysis/README.md).
