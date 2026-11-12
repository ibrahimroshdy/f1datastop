# F1 DataStop news card

One headline, one big number (optional short label), and an optional driver (headshot + flag)
or team (real logo). Each run writes all 3 sizes: `_x` 1080x1350, `_ig` 1080x1440, `_threads` 1440x1920.
Existing files are never overwritten (a clash gets `_2`, `_3`, ...).

```
cd analysis/social/news_card

# driver card (team is optional: adds the small logo and the team accent colour)
python news_card.py --headline "Antonelli leads the championship by 102 points after Singapore" \
  --number 102 --label "points clear" --driver ANT --name "Kimi Antonelli" --team mercedes \
  --out test --slug test_driver_ANT

# team card
python news_card.py --headline "McLaren win in Mexico for the first time since 1989" \
  --number 36 --label "years between wins" --team mclaren --out test --slug test_team_mclaren
```

- `--driver`: 2026 grid code (headshot `<asset dir>/headshots/<CODE>.webp`, flag `<asset dir>/flags/<iso2>.png`)
- `--team`: mercedes ferrari mclaren red_bull alpine racing_bulls haas aston_martin williams audi cadillac
  (logos `<asset dir>/team-logos/<team>.png`)
- `--accent "#RRGGBB"`: overrides the colour (default: the team colour, or teal)
- Background, colours, brand, fonts and flags come from `../common/design.py`. Fonts and assets:
  `--font-dir` / `F1DS_FONT_DIR` and `--asset-dir` / `F1DS_ASSET_DIR` (see `../README.md`).
- Text containing `|`, `•`, `·` or a URL is refused. No credits or source line is drawn.
- Check every number on formula1.com and Wikipedia before you use it.
