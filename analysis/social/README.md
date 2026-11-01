# Social exports

Scripts that turn F1 DataStop data into the three portrait social sizes
(x 1080x1350, ig 1080x1440, threads 1440x1920). They run on the content box and read the
shared theme, fonts, logo, flags and headshots from its /workspace paths.

- `quali_to_race/quali_to_race.py`: the website's "Qualifying to Race" card
  (`web/src/components/analytics/MuiSankeyChart.tsx`, data rules from `web/src/lib/f1/sankey.ts`)
  ported to Python and laid out natively per size. Data from Jolpica qualifying and race results.
  `python quali_to_race.py --season 2025 --round 20 --out DIR --slug NAME`
  `--f1 SLUG` takes quali, the OFFICIAL starting grid (penalties, back-of-grid, quali DQ) and the race
  result from formula1.com instead, headlined "<Grand Prix name> <season>" (or `--title`):
  `python quali_to_race.py --season 2026 --f1 mexico --out DIR`
- `deepdive/run_deepdive.py`: session auto export. Runs `analysis/generate.py` (unchanged) and fits
  its charts to the three sizes; `grid_flow` is drawn by `quali_to_race.py` instead of generate.py.
  `python run_deepdive.py ROUND SESSION [--season 2026] [--charts a,b] [--out DIR]`
- `session_results/session_results.py`: full classification card for any session (FP1, FP2, FP3,
  sprint quali, sprint, quali, race). Data from the formula1.com results page (saved as
  `<slug>_data.csv` next to the images), or a CSV/JSON file via `--data`. Holds when not published.
  `python session_results.py --season 2026 --race mexico --session fp2 --out DIR --slug NAME`
  Each row ends in a mini tyre stint strip (OpenF1 stints, Pirelli colours, lap numbers at the stops;
  nothing drawn when OpenF1 has no stints). A formula1.com DQ shows as DQ on the card and the H2H.
  Race only: `--times auto|on|off|only` (auto = on for the race) adds the fastest-laps card from the
  formula1.com fastest-laps page, `<slug>_times_{x,ig,threads}.png` + `_times_data.csv`; a failure
  prints a WARNING and the other cards still render.
- `news_card/news_card.py`: one headline, one number, optional driver or team. See `news_card/README.md`.

No output overwrites an existing file. No image carries a URL, credits or the | and dot separators.
