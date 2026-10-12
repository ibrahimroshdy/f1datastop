# F1 DataStop — Claude guidance

Source of truth: `AGENTS.md` (read it before writing code).

## Quick reference

- App lives in `web/` (React 18 + TS + Vite). Commands from repo root:
  `npm run dev` (port 8080), `npm run build`, `npm run typecheck`, `npm run lint`, `npm run test`.
- CI (`.github/workflows/pr-ci.yml`) must stay green: typecheck, lint, test, build, docs.
- Docs site: Astro + Starlight in `docs/` (pages in `docs/src/content/docs/`, brand in `docs/src/styles/brand.css`).
  `npm --prefix docs ci && npm --prefix docs run check` builds it and checks the output. Schedules page: `docs/src/content/docs/pipeline.md`.
- UI: `F1Card` for content cards; `F1EmptyState` / `F1ErrorState` / `F1Skeleton` for states;
  shadcn primitives from `web/src/components/ui/`. Glass only in `dark-glass` theme.
- Charts: Recharts / D3 inside `F1ChartContainer`, styled via `@/lib/chartTheme`.
- Data: `web/src/lib/api/f1ApiFetch.ts` tries `web/src/services/f1Warehouse.ts` (CDN, then database) only when `VITE_DB_SERVING_ENABLED=true` and the season is in the window, else the proxy/upstream. Session codes:
  FP1 FP2 FP3 Q SQ SS S R. Never redistribute raw Ergast data to R2 — proxy-only.
- Commit messages and PR titles are Conventional Commits (`feat(web): ...`, `fix: ...`, `!` = major):
  they drive automatic versions and GitHub Releases (`release.yml`, `web/scripts/semver.mjs`).
  Never bump `web/package.json` or tag by hand. Schedules live in the pg_cron migration, checked by
  `.github/scripts/check_schedules.py`.
- Every page renders anonymously. MIT — see LICENSE.
