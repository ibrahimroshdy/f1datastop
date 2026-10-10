# F1 DataStop — Claude guidance

Source of truth: `AGENTS.md` (read it before writing code).

## Quick reference

- App lives in `web/` (React 18 + TS + Vite). Commands from repo root:
  `npm run dev` (port 8080), `npm run build`, `npm run typecheck`, `npm run lint`, `npm run test`.
- CI (`.github/workflows/pr-ci.yml`) must stay green: typecheck, test, build.
- UI: `F1Card` for content cards; `F1EmptyState` / `F1ErrorState` / `F1Skeleton` for states;
  shadcn primitives from `web/src/components/ui/`. Glass only in `dark-glass` theme.
- Charts: MUI X Charts inside `MuiThemeWrapper` (or unified `F1Chart`).
- Data: `web/src/lib/api/f1ApiFetch.ts` + warehouse fallback. Session codes:
  FP1 FP2 FP3 Q SQ SS S R. Never redistribute raw Ergast data to R2 — proxy-only.
- Every page renders anonymously. MIT — see LICENSE.
