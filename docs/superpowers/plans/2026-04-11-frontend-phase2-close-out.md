# Frontend Phase 2 — Close-out checklist

**Spec:** [docs/superpowers/specs/2026-04-11-frontend-upscaling-design.md](../specs/2026-04-11-frontend-upscaling-design.md) (Phase 2 — Data-heavy surfaces)  
**Date:** 2026-04-11  

## Objective

Confirm Phase 2 exit criteria: same verification bar as global constraints, with smoke covering **Index**, **Analytics**, **Timing**, **Standings** (and related dashboard cards where applicable).

## Automated verification (recorded)

| Check | Result | Date |
|--------|--------|------|
| `npm run build` | Exit 0 — Vite production build completed | 2026-04-11 |

> **Note:** Full `npm run lint` may still report pre-existing issues outside touched files; targeted `npx eslint <paths>` was used during the Card → F1Card migration batch.

## Manual smoke (human)

Run locally with `npm run dev`. Toggle **default** and **Dark Glass** themes where relevant.

- [ ] **Index (`/`)** — Layout, cards/Sankey strip, no console errors on cold load.
- [ ] **Analytics (`/analytics`)** — Sections load, charts inside `MuiThemeWrapper`, empty/error states acceptable.
- [ ] **Timing (`/timing` or route used in app)** — Table/card, sticky header if present, theme contrast.
- [ ] **Standings** — Driver/constructor views, loading and populated states.

Mark Phase 2 **done** when the table above is filled and no regressions are filed.

## Implementation notes (this repo)

- Major Phase 2 surfaces were already aligned with **F1Card**, **F1EmptyState**, **F1ErrorState**, and **F1Skeleton** in prior work.
- Residual **shadcn `Card`** usage was tracked in [2026-04-11-frontend-phase3-close-out.md](./2026-04-11-frontend-phase3-close-out.md) companion sweep (`Card` → `F1Card` where not `F1Card.tsx` itself).

## Document history

- **2026-04-11:** Initial close-out doc; build verification recorded; manual smoke left as checklist for the team.
