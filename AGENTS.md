# AGENTS.md — F1 DataStop contributor guide for AI agents and humans

React 18 + TypeScript + Vite app in `web/` (React Query, Tailwind, shadcn/ui).
Data: Jolpica/Ergast (historical, proxy-only) + OpenF1 (sessions) + FastF1 (telemetry).
Backend: Supabase (Postgres warehouse, `f1-proxy` edge function). CDN: Cloudflare R2.
CI: GitHub Actions (`.github/workflows/pr-ci.yml`). No login — every page renders anonymously.

## Commands (run from repo root)

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server (port 8080) |
| `npm run build` | Production build → `web/dist` |
| `npm run typecheck` | TypeScript strict check (`web/tsconfig.app.json`) |
| `npm run lint` | ESLint (advisory in CI) |
| `npm run test` | Vitest unit tests |

CI must stay green: typecheck, test, build. Python: `python -m compileall analysis`.

## Design philosophy

- **Data-first, compact, scannable.** Progressive disclosure (summary first, drill down via
  modals/tabs). No decorative elements that don't aid understanding.
- **Dark-first.** Default theme is dark; keep light theme readable. WCAG AA contrast.
- **Copy**: professional, concise, factual ("24 races", "P3"). Sentence case for labels.
- **Numbers**: tabular figures for times/positions; locale-aware formatting elsewhere.
- **Consistency over novelty**: reuse existing components and patterns, don't invent per-page ones.

## Components (`web/src/components/`)

- **F1Card** (`f1/F1Card.tsx`) is the primary card for all feature content. Variants:
  `default` | `gradient` | `glass` | `team-accent`. Structure:
  `F1Card` > `F1CardHeader` > `F1CardTitle` (+ optional `F1CardDescription`) > `F1CardContent` > optional `F1CardFooter`.
- **Base shadcn Card** (`ui/card.tsx`) only for generic layout. Never use deprecated `GlassCard`.
- **States**: `F1EmptyState` (empty data), `F1ErrorState` (failures, no raw stacks to users),
  `F1Skeleton` / `ChartSkeleton` / `StandingsSkeleton` (loading, same shape as content).
  Never add one-off empty/error/loading components — extend the F1 variants.
- **Primitives** (Button, Badge, Tabs, Dialog, Table, Tooltip, Input…): shadcn from `ui/`.
  F1-specific: `F1Badge` / `PositionBadge` / `StatusBadge`, team/driver colors from
  `constants/f1Colors.ts` (same team = same color everywhere).
- **Conventions**: F1 components in `f1/`, exported via `f1/index.ts`. Feature components
  co-located (`dashboard/`, `calendar/`, …). Keep files under ~500 lines; split when bigger.
- **Refs**: custom components used with Radix `asChild` (e.g. `TooltipTrigger`) must
  `forwardRef`. Add shadcn components only when needed: `npx shadcn@latest add <name>`.

## Theme (`web/src/context/ThemeContext.tsx`, tokens in `web/src/index.css`)

- Modes: `light` | `dark` | `dark-glass`. Hook `useTheme()` gives `theme`, `setTheme`,
  `toggleTheme`, `cycleTheme`, `isGlass`, `baseTheme`, `toggleGlass`. Persisted as `f1ds-theme`.
- **Glass (`dark-glass`) is the ONLY theme that uses glass** (`.glass`, `.glass-glow`,
  `.glass-panel`, `--glass-*`). Solid `bg-card`/`bg-muted` elsewhere. Gate with `isGlass`;
  use `baseTheme` for contrast logic. Never hardcode theme-dependent colors — use tokens.

## Charts (`web/src/components/analytics/`)

- Standardize on **MUI X Charts**, always wrapped in `MuiThemeWrapper` (theme tokens).
  New work: prefer the unified `<F1Chart title loading error empty height>` wrapper.
- Team/driver series colors via `getTeamColorById` / `constants/f1Colors.ts`.
- Containers: fixed height (300–400px) or `min-h-[280px]`, relative width, no layout jump.
- Chart root gets `role="img"` + `aria-label`; tooltips keyboard-accessible.

## UI patterns

Cards, empty/error/loading, `Dialog` (focus trap, Esc, labelled), `Tabs`, tables
(semantic `<table>`, numbers right-aligned, horizontal scroll on mobile), forms
(label per input, inline errors, no alert-only validation).

## Responsive / a11y / performance

- Mobile-first, Tailwind defaults (`sm`/`md`/`lg`/`xl`). Tap targets ~44px.
  Test 320 / 375 / 768 / 1024 / 1280px and 200% zoom. Hooks: `useIsMobile` in `@/hooks/use-mobile`.
- A11y is definition-of-done: one `<h1>` per page, logical heading order, visible focus,
  keyboard-operable everything, `aria-live` for errors/dynamic content, never color-alone.
- Perf: `React.memo`/`useMemo`/`useCallback` where measured, React Query caching with shared
  keys, `React.lazy` + `Suspense` for heavy routes/tabs, stable list keys, memoized chart
  options, tree-shakeable imports. Measure (Lighthouse, Profiler) before optimizing.

## Backend / data notes

- Frontend reads via `lib/api/f1ApiFetch.ts` (Supabase `f1-proxy` when `VITE_F1_PROXY_ENABLED=true`)
  with warehouse fallback (`services/f1Warehouse.ts`). Session codes: FP1 FP2 FP3 Q SQ SS S R.
- `analysis/` scripts (ingest, generate, exports, digest) run as `pr-ci.yml` cron jobs and
  publish to R2; `charts_todo.py` decides what needs rendering. Never redistribute raw
  Ergast data to R2 — proxy-only.
- Supabase MCP (if available): `https://mcp.supabase.com/mcp`.

## License

MIT — see LICENSE. No copyright infringement intended: Formula 1 marks belong to their
owners; data is from public APIs for educational use only. Not affiliated with F1/FIA.
