# Frontend upscaling — design spec

**Date:** 2026-04-11  
**Status:** Draft for implementation planning  
**Stack context:** Vite + React + TypeScript, Tailwind + shadcn, MUI for charts/data grids, Framer Motion, React Router.

## Purpose

Improve visual quality, consistency, density, and feedback across F1 DataStop **without changing product behavior**: same routes, data loading, API usage, and user-visible semantics (what counts as loading, empty, or error). Work is phased so each milestone stays reviewable and shippable.

## Global constraints (all phases)

- **Behavior:** No intentional changes to fetch logic, React Query keys, auth flows, embed contracts, or analytics/event payloads unless a follow-up explicitly scopes them.
- **Design system:** Follow `.cursor/DESIGN_PHILOSOPHY.md`, `.cursor/COMPONENT_ARCHITECTURE.md`, `.cursor/UI_PATTERNS.md`, `.cursor/THEME_SYSTEM.md`, `.cursor/DATA_VISUALIZATION.md`, and `.cursor/ACCESSIBILITY.md`. Prefer **F1Card** for content cards; avoid new **GlassCard** usage—use **F1Card** with `variant="glass"` where glass is appropriate and `isGlass` is true.
- **Shared states:** Prefer **F1Skeleton**, **F1EmptyState**, and **F1ErrorState** from `@/components/f1` instead of ad-hoc spinners or one-off empty/error UI when touching an area.
- **Charts:** MUI charts remain wrapped in **MuiThemeWrapper**; chart phases focus on layout, hierarchy, and tokens—not changing data series meaning.
- **Verification before merge:** `npm run lint` and `npm run build` succeed; manual smoke on agreed route list per phase; no new console errors on cold load for sampled pages.

## Phase 1 — Foundation (approved)

**Objective:** Raise baseline consistency through shell and tokens so later page work composes cleanly.

**In scope**

- **App shell:** `TopBar`, `Sidebar`, and shared layout wrappers: spacing rhythm, typography scale for chrome (not necessarily every page body), max-width/page gutters, scroll behavior, and responsive drawer/sheet behavior where it already exists—refined, not replaced wholesale.
- **Design tokens:** Align spacing, type, radii, borders, and surfaces with existing theme and `.cursor/` guidance (dark-first, compact, glass only when glass theme is active).
- **Cross-cutting UI states:** Replace or align obvious generic loading/empty/error patterns at shell level and on the most visible wrappers touched during shell work—without changing *when* loading completes or what “empty” means.
- **Motion:** Light, consistent shell transitions (e.g. nav, sheet open/close) using existing tooling; avoid heavy animation on grids/charts in this phase.

**Out of scope for Phase 1**

- Deep passes on Analytics, calendar/map, Timing, or auth pages except incidental changes required by shell contracts (imports/layout props).
- Chart refactors, new nav items, or information architecture changes.

**Phase 1 exit criteria**

- Lint and production build clean.
- Smoke: home/index, one analytics-related route, calendar route, one auth page (if applicable in dev)—navigation and theme/glass toggle behave as before; no regressions spotted in shell interactions.

## Phase 2 — Data-heavy surfaces

**Objective:** Apply the Phase 1 foundation to the pages where users spend the most time reading tables and charts.

**In scope (representative)**

- **Pages / areas:** `Index`, `Analytics`, `Timing`, `Standings`, and closely related dashboard cards/tables—layout hierarchy, card usage (**F1Card**), skeleton/error/empty consistency, spacing and section headers, responsive breakpoints.
- **Tables and dense UI:** Readability, sticky headers where appropriate, zebra/hover patterns only if they match existing tokens—no change to column definitions or sort semantics unless fixing an existing bug (out of scope for this spec unless filed separately).
- **Chart presentation:** Margins, legends, titles, and card chrome via **MuiThemeWrapper** and design tokens; no change to underlying metrics.

**Out of scope for Phase 2**

- Globe/map-specific interaction redesign (reserved for Phase 3).
- Backend or caching changes.

**Phase 2 exit criteria**

- Same verification bar as global constraints, extended smoke list documented in the implementation plan (cover at least Index, Analytics, Timing, Standings).

## Phase 3 — Signature experiences and auth polish

**Objective:** Polish the highest-complexity visual surfaces and entry flows so they match the upgraded baseline.

**In scope (representative)**

- **Race calendar and map/globe:** Loading overlays, legends, controls, panel layout, focus states, and performance-safe motion; preserve map behavior and data boundaries.
- **Auth and profile:** Login, signup, reset, profile—visual alignment, spacing, error presentation via **F1ErrorState** where it fits existing patterns, keyboard/focus per `.cursor/ACCESSIBILITY.md`.
- **Embeds (if touched):** Visual-only tightening; embed sizing contracts and parent-facing behavior must remain unchanged.

**Out of scope for Phase 3**

- New embed variants or new public API for embed consumers unless explicitly requested later.

**Phase 3 exit criteria**

- Lint/build clean; smoke includes calendar/map happy path, one embed route if applicable, and full auth flow in a staging or local configuration.

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Theme/glass regressions | Test both default and glass themes on touched screens; gate merges on smoke checklist. |
| Unintended behavior change | Prefer styling and composition; isolate any “had to fix” logic in small commits with rationale in the implementation plan. |
| Scope creep | Each phase merges independently; do not start Phase N+1 in the same PR as Phase N without explicit plan update. |

## Implementation process (after this spec is approved)

1. **writing-plans:** Produce `docs/superpowers/plans/…` with discrete tasks per phase.
2. **Git worktree:** Isolate branch work per project conventions.
3. **subagent-driven-development:** One implementation task at a time; spec compliance review, then code quality review, before moving to the next task.

## Document history

- **2026-04-11:** Initial spec from approved Phase 1 direction; Phases 2–3 defined for sequencing.
