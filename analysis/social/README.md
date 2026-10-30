# Social exports

Scripts that turn F1 DataStop data into the three portrait social sizes
(x 1080x1350, ig 1080x1440, threads 1440x1920). They run on the content box and read the
shared theme, fonts, logo, flags and headshots from its /workspace paths.

- `quali_to_race/quali_to_race.py`: the website's "Qualifying to Race" card
  (`web/src/components/analytics/MuiSankeyChart.tsx`, data rules from `web/src/lib/f1/sankey.ts`)
  ported to Python and laid out natively per size. Data from Jolpica qualifying and race results.
  `python quali_to_race.py --season 2025 --round 20 --out DIR --slug NAME`
- `deepdive/run_deepdive.py`: session auto export. Runs `analysis/generate.py` (unchanged) and fits
  its charts to the three sizes; `grid_flow` is drawn by `quali_to_race.py` instead of generate.py.
  `python run_deepdive.py ROUND SESSION [--season 2026] [--charts a,b] [--out DIR]`
- `session_results/session_results.py`: full classification card for any session (FP1, FP2, FP3,
  sprint quali, sprint, quali, race). Data from the formula1.com results page (saved as
  `<slug>_data.csv` next to the images), or a CSV/JSON file via `--data`. Holds when not published.
  `python session_results.py --season 2026 --race mexico --session fp2 --out DIR --slug NAME`
- `news_card/news_card.py`: one headline, one number, optional driver or team. See `news_card/README.md`.

No output overwrites an existing file. No image carries a URL, credits or the | and dot separators.
