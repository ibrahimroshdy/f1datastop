# F1DataStop — Analysis Posters

Everything here is drawn by [`generate.py`](generate.py), uploaded to the Supabase
Storage `charts` bucket, indexed in the `analysis_charts` table, and shown in the
app's **Deep Dive** tab. Deep Carbon palette + the app type trio (Clash Display /
Geist / Geist Mono). Every image carries the race-country flag + `@F1DataStop`.

---

## The comprehensive "tells me all" posters

| key | what | scope | driver-picked |
|-----|------|-------|:-:|
| `race_analysis` | whole race on one board — result cluster · position evolution (pit ticks, SC/VSC, fastest-lap star, DNF) · tyre strategy · places gained/lost · **real** on-track passes · **undercut scorecard** · gap to leader | per race | no (whole field) |
| `driver_compare` | 2 drivers' fastest laps — lap + sector deltas · time gain/loss track map · speed dominance · speed · cumulative gap · throttle/brake · gears | per race | **yes (pick 2)** |
| `season_scorecard` | 2 drivers across the season so far — stat cluster · race + quali H2H · finishing form · points progression | season-to-date | **yes (pick 2)** |
| `championship` | the title fight — drivers' standings + points-progression curves for the leaders | season-to-date | no (whole field) |
| `constructors` | the team battle — constructors' standings + driver-contribution split (who's scoring) | season-to-date | no (whole field) |
| `circuit_history` | this track across the years — winner + pole per edition + a "most wins here" tally | multi-year | no (whole field) |

The four season/championship boards (`season_scorecard`, `championship`, `constructors`)
are **warehouse-backed** — they read the standings/results RPCs, not the FastF1
session, so they need `SUPABASE_URL` + a read key even with `--no-upload` (see below).

Plus **18 single-topic charts** (position_changes, tyre_strategy, gap_to_leader,
lap_evolution, race_strategy, teammate_pace, teammate_laps, top_speed, driver_radar,
track_dominance, dominance_flat, pace_tyre, places_gained, speed_trace,
speed_distribution, team_pace, grid_flow, parallax_stack). Full list: the `CHARTS`
registry near the bottom of `generate.py`.

---

## Generate locally (no upload — writes to `out/`)

Uses the venv at `analysis/venv`. Run from the `analysis/` dir.

```bash
cd analysis
./venv/bin/python generate.py --season 2025 --round 13 --session R \
    --only race_analysis --no-upload --format landscape
```

Output: `analysis/out/<season>/<round>-<slug>/<session>/<format>/<chart>.png`

### Flags

| flag | meaning |
|------|---------|
| `--season 2025` | championship year |
| `--round 13` **or** `--event "Belgium"` | which race (event matches by name) |
| `--session R` | `R` race · `Q` qualifying · `S` sprint |
| `--only k1,k2` | render just these chart keys (default: all) |
| `--drivers LEC,HAM` | drivers for the driver-picked charts (codes) |
| `--format ...` | `landscape` · `twitter` · `instagram` · `story` · `both` (landscape+story) · `all` (four) |
| `--no-upload` | write PNGs to `out/` instead of Supabase |
| `--latest` | the latest completed round of the season |

### Warehouse-backed charts (`season_scorecard`)

`season_scorecard` reads the warehouse (not the FastF1 session), so it needs the
Supabase URL + a read key. The **publishable/anon** key is enough (public-read RLS):

```bash
export SUPABASE_URL=https://YOUR_PROJECT.supabase.co
export SUPABASE_ANON_KEY="$(grep -m1 '^VITE_SUPABASE_PUBLISHABLE_KEY=' ../web/.env | cut -d= -f2)"
./venv/bin/python generate.py --season 2025 --round 13 --session R \
    --only season_scorecard --drivers LEC,HAM --no-upload --format story
```

### Examples

```bash
# The three posters for one race, all formats, LEC vs HAM for the compare boards
./venv/bin/python generate.py --season 2025 --event "Belgium" --session R \
    --only race_analysis,driver_compare,season_scorecard --drivers LEC,HAM \
    --no-upload --format all

# Every chart for the latest race, landscape only
./venv/bin/python generate.py --latest --session R --no-upload --format landscape
```

---

## Generate **and upload** to the live site

Set the service-role key and drop `--no-upload` — it uploads to Storage and upserts
`analysis_charts` (which is what the app reads):

```bash
export SUPABASE_URL=https://YOUR_PROJECT.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service role key>   # never commit this
./venv/bin/python generate.py --season 2025 --event "Belgium" --session R --format all
```

In production this runs as a **GitHub Actions** job (`pr-ci.yml` → `charts`):
- **charts-race-weekend** — every 2 hours Fri–Sun, renders each session's charts plus the
  fixed teammate `driver_compare` pairs.
- **manual-chart-request** — started by the `dispatch_ci_request` DB trigger when a row lands
  in `f1_chart_requests` (the custom driver picks from the app); runs
  `process_chart_requests.py`.

---

## Driver-picked charts (Deep Dive → "Build a custom chart")

Charts in `CUSTOMIZABLE_CHARTS` (`web/src/services/chartRequestService.ts`) let a
user pick drivers in the app: `driver_compare`, `season_scorecard`, `dominance_flat`,
`track_dominance`, `parallax_stack`, `speed_trace`, `driver_radar`.

Flow: pick drivers → insert an `f1_chart_requests` row → the minute-cron runs
`generate.py --only <chart> --drivers <codes>` → the PNG lands in `analysis_charts`
and the app polls it in. Deduped by a stable `driver_key` (upper · sorted · `-`-joined),
so the same pair never regenerates.

`driver_compare` / `season_scorecard` use the **two fastest** of the picked set.

---

## Formats & where files land

| format | ratio | pixels | used for |
|--------|-------|--------|----------|
| `landscape` | 16:9 | 3200×1800 | the app + Twitter/X |
| `twitter` | 16:9 | 3200×1800 | Twitter/X |
| `instagram` | 4:5 | — | Instagram feed |
| `story` | 9:16 | 2160×3840 | Stories / Reels / Shorts / TikTok |

The three comprehensive posters render **landscape + twitter + story**. They return
nothing for `instagram` (4:5) — the app gallery falls back to the landscape image, so
there is never a gap.

- **Storage:** `charts/<season>/<round>-<slug>/<session>/<format>/<chart>[__<DRIVERKEY>].png`
- **Index:** `analysis_charts` (`season, round, session, chart_type, public_url, …`),
  unique on `(season, round, session, chart_type)`. Social variants get a
  `_twitter` / `_instagram` / `_story` suffix on `chart_type`; driver-picked ones get
  a `__<DRIVERKEY>` suffix.
- **App:** the Deep Dive tab (`AnalysisCharts.tsx`) groups by base chart type, labels
  from the row `title`, with a format toggle.
