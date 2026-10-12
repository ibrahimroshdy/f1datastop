# AGENTS.md — F1 DataStop contributor guide for AI agents and humans

React 18 + TypeScript + Vite app in `web/` (React Query, Tailwind, shadcn/ui).
Data: Jolpica/Ergast (historical, proxy-only) + OpenF1 (session data) + FastF1 (telemetry). No live timing.
Backend: Supabase (Postgres warehouse, `f1-proxy` edge function). CDN: Cloudflare R2.
Documentation: the docs site in `docs/` (https://docs.f1datastop.com, Astro + Starlight) is the one place for detailed docs. Keep it in sync with code changes and keep README/markdown files short. Write plain language, no jargon.
CI: GitHub Actions (`pr-ci.yml`, `pipeline.yml`, `queue.yml` in `.github/workflows/`). No login — every page renders anonymously.

## Commands (run from repo root)

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server (port 8080) |
| `npm run build` | Production build → `web/dist` |
| `npm run typecheck` | TypeScript strict check (`web/tsconfig.app.json`) |
| `npm run lint` | ESLint (0 errors required; CI fails on errors) |
| `npm run test` | Vitest unit tests |

CI must stay green: typecheck, lint, test, build. Python: `python -m compileall analysis` and
`cd analysis && python -m unittest discover -s tests`.

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

- Tailwind v4: design tokens live in `web/src/index.css` (`@theme` block plus per-theme CSS variables);
  there is no `tailwind.config.ts`.
- Modes: `light` | `dark` | `dark-glass`. Hook `useTheme()` gives `theme`, `setTheme`,
  `toggleTheme`, `cycleTheme`, `isGlass`, `baseTheme`, `toggleGlass`. Persisted as `f1ds-theme`.
- **Glass (`dark-glass`) is the ONLY theme that uses glass** (`.glass`, `.glass-glow`,
  `.glass-panel`, `--glass-*`). Solid `bg-card`/`bg-muted` elsewhere. Gate with `isGlass`;
  use `baseTheme` for contrast logic. Never hardcode theme-dependent colors — use tokens.

## Charts (`web/src/components/analytics/`)

- Standardize on **Recharts** (`recharts`, with `ui/chart.tsx` helpers) and **D3** (`d3`, `d3-sankey`) for
  custom visuals. Style charts with `chartTheme` from `@/lib/chartTheme` and theme tokens.
- Wrap every chart in `F1ChartContainer` (`@/components/f1`): it handles loading, error and empty
  states (`isLoading`, `error`, `isEmpty`, `minHeight`). Existing `Mui*` chart filenames in
  `components/analytics/` are legacy names; they are Recharts components.
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

- Data reads go through `lib/api/f1ApiFetch.ts`. Only when `VITE_DB_SERVING_ENABLED=true` and the
  season is inside the warehouse window (newest season minus 3 onward), `services/f1Warehouse.ts`
  is tried first, and inside it the order is the CDN (static JSON on `cdn.f1datastop.com`), then
  the Supabase serving RPC. Otherwise, or on a miss, the request goes to the Supabase `f1-proxy`
  (`VITE_F1_PROXY_ENABLED=true`) or direct upstream. Volatile data (live standings, OpenF1
  live/position/car data) never uses the warehouse path. Session codes: FP1 FP2 FP3 Q SQ SS S R.
- `analysis/` scripts (ingest, generate, exports, digest) run as scheduled jobs in `pipeline.yml`
  (user chart/telemetry requests in `queue.yml`) and publish to R2; `charts_todo.py` decides what
  needs rendering. The clock is `pg_cron` in Supabase (`f1ds-*` jobs start the workflows via
  `workflow_dispatch`; migrations `20261012130000` + `20261012140000`). The one place that lists
  every schedule in plain words is `docs/src/content/docs/pipeline.md`. `check_schedules.py` (PR CI) enforces that
  the migration's cron entries equal the schedule table inside the script, that no workflow has a
  `schedule:` trigger except the single once-a-day digest backup in `pipeline.yml` (`41 7 * * *`),
  and that every started workflow/input exists. It does not read the docs, so change a schedule in
  the migration, the checker's table and `docs/src/content/docs/pipeline.md` together. The `f1ds-queue` tick calls
  `f1_dispatch_queue_if_needed()` (starts the queue only when a request is pending/stuck); the daily
  digest reports `f1_dispatch_health()` and reconcile freshness. `generate.py` exits 0 on
  success/nothing due, 2 when session data is not yet available upstream, 1 on failure. Never
  redistribute raw Ergast data to R2: proxy-only.
- Releases are automatic: conventional commits on `main` drive the semantic version (`feat` minor,
  `fix`/`perf` patch, `!`/`BREAKING CHANGE:` major) and `release.yml` publishes the tag + GitHub
  Release (no commits). Commit messages and PR titles must be conventional
  (`type(scope): subject`; PR CI's `pr-title` check). Resolver: `web/scripts/semver.mjs`; the footer
  and `/version.json` show the version and SHA.
- Supabase MCP (if available): `https://mcp.supabase.com/mcp`.

## License

MIT — see LICENSE. No copyright infringement intended: Formula 1 marks belong to their
owners; data is from public APIs for educational use only. Not affiliated with F1/FIA.
