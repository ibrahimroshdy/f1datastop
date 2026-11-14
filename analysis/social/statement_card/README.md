# F1 DataStop statement card (pixel style)

One checked fact written as one plain sentence, plus one big number in our chunky pixel face.
No lead-in, no label, no "did you know", no "fun fact" (the script refuses those words).
Each run writes all 3 sizes: `_x` 1080x1350, `_ig` 1080x1440, `_threads` 1440x1920. Nothing is overwritten.

```
cd analysis/social/statement_card
python statement_card.py --number 20 \
  --statement "Kimi Antonelli won the 2026 title aged 20 years and 68 days, the youngest champion in F1 history." \
  --driver ANT --name "Kimi Antonelli" --team mercedes --race-flag mx --race "Mexico City GP" \
  --theme dark --out test --slug statement_ANT_youngest
```

- `--number`: digits and `+ - % . : x`, drawn as 5x7 pixel glyphs with a team-colour drop shadow.
- `--driver` adds the round headshot (team-colour ring) and nationality flag; `--team` adds the logo and
  sets the colour of the pixel car, ring and number shadow; `--accent` overrides it.
- `--race-flag` / `--race`: flag and race name top left. Logo and wordmark sit top right.
- `--theme dark|light`: site palettes; dark uses the carbon and red-glow social ground, light a faint pixel grid.
- Fonts and assets as for the other scripts (`--font-dir`, `--asset-dir`, see `../README.md`).
- Check every number on formula1.com and Wikipedia first, then Jolpica.
