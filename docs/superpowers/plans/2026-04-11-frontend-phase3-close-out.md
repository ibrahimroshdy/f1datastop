# Frontend Phase 3 — Close-out checklist

**Spec:** [docs/superpowers/specs/2026-04-11-frontend-upscaling-design.md](../specs/2026-04-11-frontend-upscaling-design.md) (Phase 3 — Signature experiences)  
**Date:** 2026-04-11  

## Objective

Confirm Phase 3 exit criteria: lint/build clean; smoke includes **calendar / map or globe happy path**, **embed route(s)** if applicable, and **auth** flows (login, signup, reset, profile as configured).

## Automated verification (recorded)

| Check | Result | Date |
|--------|--------|------|
| `npm run build` | Exit 0 — recorded alongside Phase 2 close-out | 2026-04-11 |

## Embed routes (code map)

These routes exist for embed consumers:

- [src/pages/embed/index.tsx](../../src/pages/embed/index.tsx) — embed documentation / copy snippets  
- [src/pages/embed/driver-standings.tsx](../../src/pages/embed/driver-standings.tsx)  
- [src/pages/embed/constructor-standings.tsx](../../src/pages/embed/constructor-standings.tsx)  

**Manual smoke**

- [ ] Open each embed URL in dev/staging; confirm layout and **no sizing contract regressions** for parent iframes.

## Calendar / globe

**Manual smoke**

- [ ] **Race Calendar** — List view, grid view, globe view, distribution view; year change; race detail dialog.
- [ ] **Globe** — Search, filters, paths toggle, detail quality popover, marker select / hover, loading overlay.

## Auth

**Manual smoke** (as enabled in environment)

- [ ] Login, signup, reset password, profile — keyboard focus, errors visible, success paths.

## Document history

- **2026-04-11:** Initial close-out doc; embed paths enumerated; manual items left as checklist.
