# F1 DataStop — Design Redesign Implementation Plan

> **Status:** Authoritative execution checklist (derived from codebase audit)  
> **Created:** 2026-06-09  
> **Spec source:** [`F1_DATASTOP_DESIGN_MASTER.md`](./F1_DATASTOP_DESIGN_MASTER.md) v1.1  
> **Refactor context:** [`REFACTOR_PLAN.md`](../REFACTOR_PLAN.md) Phase 11 (after Phase 9 Vercel verification)  
> **Audit method:** 4 parallel codebase agents vs design master §22–§27 + live file grep

---

## Executive summary

| Metric | Count |
|--------|-------|
| Surfaces audited (pages + modals + chrome) | **62** |
| Change items (actionable bullets) | **~248** |
| §26 policy violations (emoji/wiki/badges/tokens) | **84** |
| Missing routes to create | **4** (`/standings`, `/drivers/:slug`, `/teams/:slug`, `/circuits`) |
| Orphan pages to resolve | **2** (`Standings.tsx` wire, `Timing.tsx` delete) |
| Implementation phases | **R0–R6** (~6–10 weeks total) |

**Goal:** Broadcast-grade Pit Wall aesthetic (F1 red, solid surfaces, Exo 2) with IA cleanup — **without removing any dashboard widgets or breaking existing data flows.**

---

## Non-negotiables (product owner — do not regress)

1. **Dashboard (`/`, `Index.tsx`)** — Keep all widgets in current grid intent: `HeaderSection`, `CombinedStandingsCard`, `SeasonChampionshipCard`, Sankey, `QualifyingResultsCard`, `LastRaceResultsCard`, `FastestPitStopCard`. Visual polish only.
2. **No data-source badges** — Delete `DataSourceBadge`; never show Ergast/OpenF1/Jolpica in UI.
3. **No Wikipedia / external profile links** — Replace with in-app `DriverCareerPanel` / `TeamHeritagePanel` (Supabase).
4. **No emoji** — SVG flags via `CountryFlag`; Lucide icons only.
5. **Season Comparison** — Remove from top-level Race Analysis IA.
6. **Glass** — Not default; optional Cockpit theme only (`isGlass` guard everywhere).

---

## Phase overview & sequencing

```
Phase 9 (REFACTOR_PLAN)     Vercel prod verification — parallel OK, not blocking R0
         │
         ▼
Phase R0 (3–5 days)         Tokens, PageHeader, emoji/wiki prep, PageSelector removal, redirects
         │
         ├──► R1 (1 week)   Route-level MainLayout, grouped nav, bottom tab bar, footer/ads
         │
         ├──► R2 (3–4 days) Dashboard + list pages visual polish (Drivers, Constructors, Infographic, Profile, Developers)
         │
         ├──► R3 (1–2 wk)   Race Analysis Essentials/Advanced restructure
         │
         ├──► R4 (1–2 wk)   /standings, /drivers/:slug, /teams/:slug, ⌘K search
         │
         ├──► R5 (ongoing)  /circuits, embed polish, Cockpit theme rename
         │
         └──► R6 (2–3 wk)   Entity DB, scrape pipeline, career panels, PitIcon
```

**PR rule:** One phase (or sub-phase) per branch/PR; green CI (`typecheck`, `lint`, `test`, `build`) before merge.

---

## Phase R0 — Token & cleanup foundation

**Duration:** 3–5 days · **Risk:** Low · **Blocks:** All other phases

### R0.1 Design tokens (`web/src/index.css`)

| Task | File | Detail |
|------|------|--------|
| F1 red primary | `index.css` | `--primary`, `--ring`, `--sidebar-primary`, `--sidebar-ring`, `--f1-red`: `270 75% 55%` → `0 100% 44%` (all themes: `:root`, `.light`, `.dark-glass`) |
| Remove purple glow | `index.css` | `--glass-glow`, `--shadow-glow`, radial mesh gradients: `rgba(147, 51, 234, …)` → F1 red tint or remove |
| Exo 2 font | `index.css` / `index.html` | Load Exo 2; apply to headings per design master §5 |
| Layout utilities | **New** `web/src/lib/layout.ts` | Export `pageShell`, `pageShellNarrow`, `pageStack`, spacing constants |
| Stat/typography utilities | `index.css` | `stat-numeral`, `timing`, `body-sm`, `position-pill` per §5–§6 |

### R0.2 New shared components

| Component | Path | Purpose |
|-----------|------|---------|
| `PageHeader` | `web/src/components/f1/PageHeader.tsx` | Eyebrow + title + optional actions (replaces inline `<h1>` blocks) |
| `PitIcon` | `web/src/components/f1/PitIcon.tsx` | Lucide wrapper with size scale xs–xl (§25); export from `components/f1/index.ts` |

### R0.3 Delete / remove components

| Item | Action |
|------|--------|
| `DataSourceBadge.tsx` | **Delete** file + all 22 import sites (RaceAnalysis, YearComparisonAnalytics) |
| `PageSelector.tsx` | **Delete** file; remove from `HeaderSection.tsx` |
| `pages/Timing.tsx` | **Delete** (orphan; dashboard `LastRaceResultsCard` covers use case) |
| `CountryFlagExample.tsx` emoji tab | Remove emoji demo mode |

### R0.4 Emoji cleanup (§26 — batch 1)

| File | Fix |
|------|-----|
| `utils/countryUtils.ts` | Delete `COUNTRY_EMOJIS`, `getCountryFlag()`, `addFlagToRaceName()`; keep strip helper |
| `utils/teamUtils.ts` | Delete emoji location map + `🏁` fallback |
| `services/f1Service.ts` | Remove `processRaceData` emoji injection |
| `components/common/CountryFlag.tsx` | Remove `🏁` fallback and `svg={false}` emoji mode |
| `components/calendar/map/ThreeGlobeHandler.tsx` | Remove emoji map; use ISO/SVG in tooltips |
| `context/ThemeContext.tsx` | Replace emoji theme icons with Lucide refs |
| `components/theme/ThemeToggle.tsx` | Use Lucide icons, not `config.icon` emoji |

### R0.5 Redirect & auth fixes

| Task | File | Detail |
|------|------|--------|
| Public race-info redirect | `App.tsx` | Move `/race-info`, `/race-info/:y/:r` redirects **outside** `ProtectedRoute` (fixes blur trap) |
| Stale link cleanup | `RaceInfographicPage.tsx` | `/analytics` → `/race-analysis`; `/race-info/...` → `/race-analysis/...` |

### R0.6 Documentation sync

| File | Action |
|------|--------|
| `.cursor/DESIGN_PHILOSOPHY.md` | Reference design master; glass not default |
| `DESIGN_SYSTEM.md` | Update primary color, remove glass-as-default |
| `REFACTOR_PLAN.md` Phase 11 | Link to this plan |

### R0 exit criteria

- [ ] Grep: zero `DataSourceBadge` imports
- [ ] Grep: zero `PageSelector` imports
- [ ] Primary buttons render F1 red in all themes
- [ ] `/race-info/*` redirects without auth blur
- [ ] `npm run test && typecheck && build` pass

---

## Phase R1 — Chrome & navigation

**Duration:** ~1 week · **Risk:** Medium · **Depends on:** R0

### R1.1 Shared navigation config

**New file:** `web/src/config/navigation.ts` (~90 LOC)

```ts
// Single source of truth for sidebar, bottom nav, footer links
export const navGroups = {
  overview: [
    { label: 'Dashboard', href: '/', icon: Home },
    { label: 'Calendar', href: '/calendar', icon: Calendar },
  ],
  explore: [
    { label: 'Standings', href: '/standings', icon: ListOrdered },      // wire in R4
    { label: 'Race Analysis', href: '/race-analysis', icon: GitCompare },
    { label: 'Drivers', href: '/drivers', icon: User },
    { label: 'Teams', href: '/constructors', icon: Factory },           // label "Teams", route unchanged
  ],
  account: [ /* Profile / Sign in */ ],
};
```

### R1.2 Route-level MainLayout (fifa-league pattern)

**Current:** 11 pages each wrap `<MainLayout>{children}</MainLayout>`  
**Target:** `App.tsx` nests routes under `<Route element={<MainLayout />}>` with `<Outlet />`

| Step | Files |
|------|-------|
| 1. Update MainLayout | `MainLayout.tsx` — `children ?? <Outlet />` during migration, then `<Outlet />` only |
| 2. Restructure App.tsx | Public routes + nested `<ProtectedRoute>` for Profile/Developers inside layout |
| 3. Strip wrappers | `Index`, `RaceCalendar`, `RaceAnalysis`, `Drivers`, `Constructors`, `Standings`, `Profile`, `Developers`, `Privacy`, `RaceInfographicPage` |
| 4. Keep outside shell | Auth pages, embed routes, `NotFound` (until R1.7), auth callback |

**Protected route nesting fix:** Profile/Developers blur overlay applies to content only; sidebar/topbar stay sharp.

### R1.3 Sidebar refactor

**File:** `web/src/components/layout/Sidebar.tsx`

| Change | Detail |
|--------|--------|
| Section labels | OVERVIEW / EXPLORE / ACCOUNT (remove "F1 Information") |
| Add Standings | Link to `/standings` (can ship disabled until R4) |
| Rename Constructors | Nav label → **Teams** |
| Theme toggle | Move from TopBar to sidebar footer |
| Surface | Opaque `bg-background`; no default glass blur |
| Ad slot | Keep sidebar ad only (see R1.6) |

### R1.4 Mobile bottom navigation

**New files:**

| File | Purpose |
|------|---------|
| `BottomNav.tsx` | Fixed 5-tab bar: Home, Calendar, Standings, Analysis, More |
| `BottomNavSpacer.tsx` | Safe-area padding above tab bar |
| `MoreNavSheet.tsx` | Sheet: Drivers, Teams, Profile, Privacy, Developers |

**Modify:** `MainLayout.tsx` — mount BottomNav after `<main>` (`md:hidden`)

**Deprecate:** `MobileNavigation.tsx` drawer duplicate (optional slim-down)

### R1.5 TopBar & Footer

| Component | Change |
|-----------|--------|
| `TopBar.tsx` | Remove `backdrop-blur`; opaque `bg-background border-b`; optional search trigger placeholder |
| `Footer.tsx` | Compress 183 LOC → ~60 LOC single row: © · Privacy · Terms |
| `Privacy.tsx` | Consider `pageShellNarrow`; optional drop MainLayout for prose |

### R1.6 Ad slot reduction

| Current (3 slots) | Target (1 slot) |
|-------------------|-----------------|
| Top in-content + bottom in-content + sidebar | **Sidebar ad only** (desktop expanded) |

**Files:** `MainLayout.tsx` (remove top/bottom AdSenseUnit), `config/integrations.ts` (document deprecated env vars)

### R1.7 Auth & error pages

| Page | Changes |
|------|---------|
| `Login.tsx`, `Signup.tsx`, `ResetPassword.tsx` | Solid card on `pageShellNarrow`; remove BuyMeACoffee `emoji=🚦` |
| `BuyMeCoffeeWidget.tsx` | Text-only button |
| Auth callback (`App.tsx`) | Replace spinner with `F1Skeleton` |
| `NotFound.tsx` | Wrap in MainLayout; add recovery links (Calendar, Standings, Analysis) |

### R1.8 Calendar shell (PageHeader + views)

| Surface | File | Changes |
|---------|------|---------|
| Calendar page | `RaceCalendar.tsx` | `PageHeader`; segmented view switcher |
| List view | `RaceCalendarListView.tsx` | Session color dots; Pit Wall density |
| Grid view | `RaceCalendarGridView.tsx` | Token alignment |
| Globe view | `RaceCalendarGlobeView.tsx`, `ThreeGlobeHandler.tsx` | SVG flags in tooltips |
| Points distribution | `PointsDistributionView.tsx` | Chart tokens |
| Race detail dialog | `RaceDetailDialog.tsx` | Primary CTA "Open race analysis"; solid default surface |
| Dialog panels | `RaceSchedulePanel.tsx`, `RaceResultsPanels.tsx`, `RacePointsDistribution.tsx` | Team borders, session dots, underline tabs |

### R1 exit criteria

- [ ] No page file imports `MainLayout` (except tests)
- [ ] Sidebar shows OVERVIEW / EXPLORE / ACCOUNT
- [ ] Mobile bottom bar visible ≤768px; content not obscured
- [ ] At most one ad region on desktop
- [ ] Footer ≤2 lines on mobile

---

## Phase R2 — Dashboard & list page visual refresh

**Duration:** 3–4 days · **Risk:** Low · **Depends on:** R0 PageHeader, R0 tokens

> **Dashboard rule:** Same widgets, same grid structure. No feature removal.

### R2.1 Dashboard widgets (presentation only)

| Widget | File | Visual changes |
|--------|------|----------------|
| Header | `HeaderSection.tsx` | `PageHeader`; countdown card `variant={isGlass ? "glass" : "default"}`; live dot when session <6h; remove PageSelector |
| Combined standings | `CombinedStandingsCard.tsx` + `standings/*` | Underline tabs; team-color 3px left border; `stat-numeral` for leader points |
| Season championship | `SeasonChampionshipCard.tsx` | Team-color bars; remove purple gradient |
| Sankey block | `Index.tsx`, `MuiSankeyChart.tsx` | Default card variant; title "Qualifying → Race"; neutral race chip |
| Qualifying card | `QualifyingResultsCard.tsx` | `min-h-[280px]`; eyebrow + race chip header |
| Last race card | `LastRaceResultsCard.tsx` | Same §16.5 parity |
| Fastest pit stop | `FastestPitStopCard.tsx` | Same parity; Wrench icon |
| Page layout | `Index.tsx` | `pageShell`/`pageStack`; single `animate-fade-in` (not stagger-children) |

### R2.2 Other R2 pages

| Page | File | Changes |
|------|------|---------|
| Drivers | `Drivers.tsx` | `PageHeader`; Pit Wall card grid; portrait + team logo |
| Driver card modal | `DriverCard.tsx` | Solid modal; team-color avatar ring |
| Constructors | `Constructors.tsx` | `PageHeader`; `TeamLogo` refresh (transparent bg); **wiki footer stays until R6** |
| Infographic page | `RaceInfographicPage.tsx` | SVG flags only; Pit Wall export typography; fix stale links |
| Infographic modal | `RaceInfographic.tsx` | Replace `getEmojiFlag()` with `CountryFlag` for html2canvas |
| Profile | `Profile.tsx` | `PageHeader`; solid F1Card |
| Developers | `Developers.tsx` | Remove `🛠️` from title; Pit Wall tool grid |
| Developer toast | `DeveloperContext.tsx` | Remove emoji from toast |
| Race schedule content | `RaceScheduleContent.tsx` | Replace `getCountryFlag()` emoji with `CountryFlag` SVG |
| Pit stop table | `MuiPitStopTable.tsx` | Replace `⚡` with Lucide `Zap` |

### R2 exit criteria

- [ ] Dashboard shows all 6 content blocks at 375px, 768px, 1280px
- [ ] No widget removed or reordered from current intent
- [ ] No purple primary on dashboard CTAs
- [ ] Lighthouse CLS stable on countdown tick

---

## Phase R3 — Race Analysis restructure

**Duration:** 1–2 weeks · **Risk:** High · **Depends on:** R0 (badges deleted), R0/R2 PageHeader

### R3.1 IA change

**Remove:**
- Top-level "Season Comparison" tab (`YearComparisonAnalytics.tsx` — keep file for dev/embed or delete later)
- All `DataSourceBadge` usages (done in R0)
- Ergast/OpenF1 user-visible strings in alerts and footers

**Add:**
- Two-tier tabs: **Essentials | Advanced** (max 2 tab bars visible)
- Sticky race context bar (flag, GP name, round, year)
- `PageHeader` with season eyebrow

### R3.2 Tab mapping (current → target)

| Current tab | Target group | Notes |
|-------------|--------------|-------|
| Results (Ergast) | **Essentials** | May need extraction from calendar panels |
| Lap Times | **Essentials** | Per design master §22.5 |
| Positions | Essentials | |
| Qualifying | Essentials | |
| Quali → Race (Sankey) | Essentials | Rename label |
| Pit Stops | Essentials | |
| Weather | Advanced | Hide when year <2023 or no OpenF1 session |
| Team Radio | Advanced | Hide when N/A |
| Telemetry | Advanced | Hide when N/A |
| Overtakes | Advanced | Hide when N/A |
| Session Results (OpenF1) | Advanced | Not same as Ergast Results |
| Season Comparison | **Remove** | Demote from primary IA |

### R3.3 File split (643 LOC monolith → modules)

| New file | Responsibility |
|----------|----------------|
| `pages/RaceAnalysis.tsx` | Orchestrator: URL params, hooks, tab state (~120 LOC) |
| `components/race-analysis/RaceAnalysisHeader.tsx` | Sticky context bar + PageHeader |
| `components/race-analysis/RacePicker.tsx` | Year/round/session selectors |
| `components/race-analysis/RaceAnalysisTabs.tsx` | Essentials/Advanced tab bars |
| `components/race-analysis/raceAnalysisTabs.config.ts` | Tab IDs, labels, icons, visibility rules |
| `components/race-analysis/essentials/*.tsx` | Thin wrappers per Ergast panel |
| `components/race-analysis/advanced/*.tsx` | OpenF1 panels |

### R3.4 Copy cleanup

| File | Remove |
|------|--------|
| `RaceAnalysis.tsx` | "historical data (Ergast) and real-time telemetry (OpenF1…)" |
| `RaceAnalysis.tsx` | "Live telemetry data from OpenF1 is only available…" |
| `TeamRadio.tsx` | "Audio provided by OpenF1" |

### R3 open decisions (resolve before coding)

1. **Pre-2023 Results in Essentials** — OpenF1 `SessionResults` unavailable; need Ergast results component or calendar panel reuse.
2. **Lap Times** — In design §22.5 Essentials; confirm keep (recommended: keep).

### R3 exit criteria

- [ ] ≤2 tab bars visible on Race Analysis
- [ ] No "Ergast" / "OpenF1" / "Jolpica" in production UI
- [ ] Season Comparison not in top-level navigation
- [ ] Deep link `/race-analysis/:year/:round` syncs selectors + sticky bar
- [ ] Advanced group hidden entirely when N/A (not empty placeholder tabs)

---

## Phase R4 — New routes & search

**Duration:** 1–2 weeks · **Risk:** Low–Medium · **Depends on:** R1 nav config, R6 for full profile pages

### R4.1 `/standings` (wire orphan)

| Task | File |
|------|------|
| Add route | `App.tsx` — `<Route path="/standings" element={<Standings />} />` inside MainLayout |
| Refactor page | `Standings.tsx` — remove MainLayout wrapper; `PageHeader`; replace emoji flags with `CountryFlag` |
| Reuse components | Prefer `DriverStandingsCard`, `ConstructorStandingsCard`, `CombinedStandingsTab` from `standings/*` |
| Dashboard link | `CombinedStandingsCard.tsx` — "View full standings →" link |

### R4.2 `/drivers/:slug` & `/teams/:slug`

**Blocked on R6 entity DB for full career data; can ship shell earlier.**

| Route | Page | Composition |
|-------|------|-------------|
| `/drivers/:slug` | `DriverProfile.tsx` | Portrait hero, `DriverCareerPanel`, season stats chart |
| `/teams/:slug` | `TeamProfile.tsx` | Logo hero, `TeamHeritagePanel`, current drivers from standings |
| `/constructors/:slug` | Redirect | → `/teams/:slug` (optional alias) |

**Navigation wiring:**
- `DriverCard.tsx` — "View profile" → `/drivers/{slug}`
- `Constructors.tsx` — team name link → `/teams/{slug}`

### R4.3 Global search (⌘K)

**Scope (R4 — not blocking R1):**

| In scope | Out of scope |
|----------|--------------|
| Static page index | Full Ergast driver history search |
| Current season driver list | `/circuits` (R5) |
| GP list from schedule hook | Telemetry search |
| ⌘K / Ctrl+K + TopBar button | Server-side index |

**New files:** `GlobalSearchDialog.tsx`, `useGlobalSearch.ts`, `config/searchPages.ts`  
**Modify:** `TopBar.tsx`, `MainLayout.tsx` (mount dialog once)

### R4 exit criteria

- [ ] `/standings` reachable from sidebar, bottom nav, dashboard card
- [ ] `/drivers/max-verstappen` loads (404 for invalid slug)
- [ ] ⌘K opens palette; no vendor names in results

---

## Phase R5 — Circuits, embeds, Cockpit theme

**Duration:** Ongoing · **Risk:** Low

### R5.1 `/circuits` (new)

- bp-inspired circuit index
- Optional `f1_circuit` Supabase table (§24.3)
- Track silhouette SVG assets (phase 2)
- Replace `Circuit.url` Wikipedia links in `SelectedRaceInfo.tsx` with in-app route or no link

### R5.2 Embed routes polish

| Route | File | Changes |
|-------|------|---------|
| `/embed` | `embed/index.tsx` | Pit Wall minimal chrome; remove "Ergast Developer API" footer |
| `/embed/driver-standings` | `EmbeddableDriverStandings.tsx` | F1 red primary; Pit Wall table styling |
| `/embed/constructor-standings` | `EmbeddableConstructorStandings.tsx` | Same |

### R5.3 Cockpit theme

| Task | File |
|------|------|
| Rename label | `ThemeContext.tsx`, `ThemeToggle.tsx` — "Dark Glass" → "Cockpit" |
| F1-red glass glow | `index.css` `.dark-glass` tokens |
| Audit `isGlass` branches | All components using `variant="glass"` unconditionally |

---

## Phase R6 — Entity database & career records

**Duration:** 2–3 weeks · **Risk:** Medium · **Depends on:** Supabase linked

### R6.1 Migrations

| File | Contents |
|------|----------|
| `supabase/migrations/20260621100000_f1_entity_registry.sql` | `f1_driver`, `f1_constructor`, `f1_driver_career`, `f1_constructor_career`, RLS, triggers |
| `supabase/migrations/20260621100100_f1_entity_views.sql` | `f1_driver_profile`, `f1_constructor_profile` views |

**Key columns:** `slug` (URL), `portrait_path`, `logo_path`, `championship_years int[]`, `bio_short`, `scraped_at`

### R6.2 Seed & scrape scripts

| Script | Purpose |
|--------|---------|
| `scripts/entity/seed-config.json` | 22 drivers + 11 teams: slugs, wiki titles |
| `scripts/entity/wiki-titles.json` | Wikipedia page map |
| `scripts/seed-f1-entities.mjs` | Upsert identity from Ergast 2026 + media maps |
| `scripts/scrape-entity-careers.mjs` | Parse wiki infobox → career tables; Ergast validation |

**Validation targets:** Hamilton (7 WDC), Verstappen (4), Alonso (2), Ferrari, Red Bull championships.

### R6.3 Frontend layer

| Layer | Path |
|-------|------|
| Types | `web/src/lib/entity/types.ts` |
| Query keys | `web/src/lib/entity/queryKeys.ts` |
| Service | `web/src/services/entityService.ts` |
| Hooks | `useDriverCareer`, `useConstructorCareer` in `hooks/entity/` |
| Components | `DriverCareerPanel.tsx`, `TeamHeritagePanel.tsx` |

### R6.4 UI integration (replace Wikipedia)

| Surface | Before | After |
|---------|--------|-------|
| `DriverStatsPanel.tsx` L300–314 | "View Wikipedia Profile →" | `<DriverCareerPanel />` |
| `Constructors.tsx` L221–229 | "View Team Profile" external link | `<TeamHeritagePanel compact />` |
| `DriverProfile.tsx` | N/A | Full career + season chart |
| `TeamProfile.tsx` | N/A | Heritage + current lineup |

### R6 exit criteria

- [ ] Grep: zero "View Wikipedia" / "View Team Profile"
- [ ] Hamilton modal shows 7 WDC from DB
- [ ] No Wikipedia URLs rendered in fan UI
- [ ] Scrape validation passes for golden records
- [ ] `npm run test` includes entity hook/component tests

---

## Complete surface matrix (62 surfaces — none skipped)

Use for QA sign-off. Status: **Audit complete, implementation pending.**

| # | Surface | Route / trigger | Primary file(s) | Phase | Status |
|---|---------|-----------------|-----------------|-------|--------|
| 1 | Dashboard | `/` | `Index.tsx` | R2 | Pending |
| 2 | HeaderSection | Dashboard | `HeaderSection.tsx` | R0/R2 | Pending |
| 3 | CombinedStandingsCard | Dashboard | `CombinedStandingsCard.tsx` | R2 | Pending |
| 4 | SeasonChampionshipCard | Dashboard | `SeasonChampionshipCard.tsx` | R2 | Pending |
| 5 | Dashboard Sankey | Dashboard | `Index.tsx`, `MuiSankeyChart.tsx` | R2 | Pending |
| 6 | QualifyingResultsCard | Dashboard | `QualifyingResultsCard.tsx` | R2 | Pending |
| 7 | LastRaceResultsCard | Dashboard | `LastRaceResultsCard.tsx` | R2 | Pending |
| 8 | FastestPitStopCard | Dashboard | `FastestPitStopCard.tsx` | R2 | Pending |
| 9 | Race Calendar | `/calendar` | `RaceCalendar.tsx` | R1 | Pending |
| 10 | Calendar List | Calendar | `RaceCalendarListView.tsx` | R1 | Pending |
| 11 | Calendar Grid | Calendar | `RaceCalendarGridView.tsx` | R1 | Pending |
| 12 | Calendar Globe | Calendar | `RaceCalendarGlobeView.tsx` | R1 | Pending |
| 13 | Points Distribution | Calendar | `PointsDistributionView.tsx` | R1 | Pending |
| 14 | Race Detail Dialog | Calendar, Dashboard | `RaceDetailDialog.tsx` | R1 | Pending |
| 15 | Dialog Schedule | Dialog | `RaceSchedulePanel.tsx` | R1 | Pending |
| 16 | Dialog Results | Dialog | `RaceResultsPanels.tsx` | R1 | Pending |
| 17 | Dialog Qualifying | Dialog | `RaceResultsPanels.tsx` | R1 | Pending |
| 18 | Dialog Sprint panels | Dialog | `RaceResultsPanels.tsx` | R1 | Pending |
| 19 | Dialog Distribution | Dialog | `RacePointsDistribution.tsx` | R1 | Pending |
| 20 | Race Infographic modal | Calendar | `RaceInfographic.tsx` | R2 | Pending |
| 21 | Race Analysis | `/race-analysis` | `RaceAnalysis.tsx` | R3 | Pending |
| 22 | RA deep link | `/race-analysis/:y/:r` | `RaceAnalysis.tsx` | R3 | Pending |
| 23 | RA Essentials tabs | RA | `race-analysis/essentials/*` | R3 | Pending |
| 24 | RA Advanced tabs | RA | `race-analysis/advanced/*` | R3 | Pending |
| 25 | Season Comparison | RA (remove) | `YearComparisonAnalytics.tsx` | R3 | Remove |
| 26 | Drivers list | `/drivers` | `Drivers.tsx` | R2 | Pending |
| 27 | DriverCard modal | Drivers | `DriverCard.tsx` | R2/R4 | Pending |
| 28 | DriverStatsPanel | DriverCard | `DriverStatsPanel.tsx` | R6 | Pending |
| 29 | Constructors list | `/constructors` | `Constructors.tsx` | R2/R6 | Pending |
| 30 | Standings page | `/standings` NEW | `Standings.tsx` | R4 | Pending |
| 31 | Driver profile | `/drivers/:slug` NEW | `DriverProfile.tsx` | R4/R6 | Pending |
| 32 | Team profile | `/teams/:slug` NEW | `TeamProfile.tsx` | R4/R6 | Pending |
| 33 | Circuits | `/circuits` NEW | TBD | R5 | Pending |
| 34 | Infographic page | `/infographic/:y/:r` | `RaceInfographicPage.tsx` | R2 | Pending |
| 35 | Embed index | `/embed` | `embed/index.tsx` | R5 | Pending |
| 36 | Embed driver standings | `/embed/driver-standings` | `EmbeddableDriverStandings.tsx` | R5 | Pending |
| 37 | Embed constructor standings | `/embed/constructor-standings` | `EmbeddableConstructorStandings.tsx` | R5 | Pending |
| 38 | Login | `/auth/login` | `Login.tsx` | R1 | Pending |
| 39 | Signup | `/auth/signup` | `Signup.tsx` | R1 | Pending |
| 40 | Reset password | `/auth/reset-password` | `ResetPassword.tsx` | R1 | Pending |
| 41 | Auth callback | `/auth/callback` | `App.tsx` | R1 | Pending |
| 42 | Profile | `/profile` | `Profile.tsx` | R2 | Pending |
| 43 | Developers | `/developers` | `Developers.tsx` | R2 | Pending |
| 44 | Privacy | `/privacy` | `Privacy.tsx` | R1 | Pending |
| 45 | 404 | `*` | `NotFound.tsx` | R1 | Pending |
| 46 | Redirect /analytics | → race-analysis | `App.tsx` | R0 | Pending |
| 47 | Redirect /race-info | → race-analysis | `App.tsx` | R0 | Pending |
| 48 | MainLayout | Global | `MainLayout.tsx` | R1 | Pending |
| 49 | Sidebar | Global | `Sidebar.tsx` | R1 | Pending |
| 50 | TopBar | Global | `TopBar.tsx` | R1 | Pending |
| 51 | PageSelector | Dashboard (delete) | `PageSelector.tsx` | R0 | Delete |
| 52 | MobileNavigation | Global | `MobileNavigation.tsx` | R1 | Replace |
| 53 | BottomNav | Global NEW | `BottomNav.tsx` | R1 | Pending |
| 54 | Footer | Global | `Footer.tsx` | R1 | Pending |
| 55 | AuthBlurOverlay | Protected | `AuthBlurOverlay.tsx` | R0 | Fix |
| 56 | ThemeToggle | Global | `ThemeToggle.tsx` | R1/R5 | Pending |
| 57 | DataSourceBadge | RA (delete) | `DataSourceBadge.tsx` | R0 | Delete |
| 58 | Timing orphan | (delete) | `Timing.tsx` | R0 | Delete |
| 59 | Global search | ⌘K NEW | `GlobalSearchDialog.tsx` | R4 | Pending |
| 60 | DriverCareerPanel | Driver surfaces NEW | `DriverCareerPanel.tsx` | R6 | Pending |
| 61 | TeamHeritagePanel | Team surfaces NEW | `TeamHeritagePanel.tsx` | R6 | Pending |
| 62 | PitIcon / PageHeader | Global NEW | `PitIcon.tsx`, `PageHeader.tsx` | R0 | Pending |

---

## §26 violation registry (84 items — grep-verified)

### Emoji (32 locations)

| File | Lines / pattern | Phase |
|------|-----------------|-------|
| `utils/countryUtils.ts` | COUNTRY_EMOJIS, getCountryFlag, addFlagToRaceName, 🏁 | R0 |
| `utils/teamUtils.ts` | Emoji location map, 🏁 fallback | R0 |
| `services/f1Service.ts` | processRaceData emoji injection | R0 |
| `ThreeGlobeHandler.tsx` | COUNTRY_EMOJIS, getEmojiFlag, globe HTML labels | R0/R1 |
| `CountryFlag.tsx` | 🏁 fallback, svg={false} mode | R0 |
| `RaceInfographic.tsx` | getEmojiFlag, export UI | R2 |
| `MuiPitStopTable.tsx` | ⚡ in duration | R2 |
| `BuyMeCoffeeWidget.tsx`, `Signup.tsx` | emoji=🚦 param | R1 |
| `Developers.tsx`, `DeveloperContext.tsx` | 🛠️ in title/toast | R2 |
| `Standings.tsx` | getCountryFlag emoji render | R4 |
| `RaceScheduleContent.tsx` | getCountryFlag emoji | R2 |
| `ThemeContext.tsx`, `ThemeToggle.tsx` | ☀️🌙🌑 theme icons | R0/R1 |
| `CountryFlagExample.tsx` | Emoji demo tab | R0 |

### Wikipedia / external profiles (5 locations)

| File | Pattern | Phase |
|------|---------|-------|
| `DriverStatsPanel.tsx` | Driver.url → "View Wikipedia Profile" | R6 |
| `Constructors.tsx` | Constructor.url → "View Team Profile" | R6 |
| `SelectedRaceInfo.tsx` | Circuit.url Wikipedia link | R5 |

### DataSourceBadge & vendor labels (22 locations)

| File | Count | Phase |
|------|-------|-------|
| `DataSourceBadge.tsx` | Component + Jolpica/OpenF1 labels | R0 delete |
| `RaceAnalysis.tsx` | 11 badge usages + 2 alert strings | R0/R3 |
| `YearComparisonAnalytics.tsx` | 4 badge usages | R0/R3 |
| `TeamRadio.tsx` | "Audio provided by OpenF1" | R3 |
| `embed/index.tsx` | "Ergast Developer API" footer | R5 |

### Purple primary tokens (18 locations in `index.css`)

All `--primary`, `--ring`, `--sidebar-*`, `--f1-red`, glow shadows across `:root`, `.light`, `.dark-glass` → **R0**

### Unconditional glass (1 location)

| File | Issue | Phase |
|------|-------|-------|
| `HeaderSection.tsx:93` | `variant="glass"` without isGlass | R2 |

### Stale routes (6 locations)

| File | Issue | Phase |
|------|-------|-------|
| `PageSelector.tsx` | /analytics, /race-info links, purple chrome | R0 delete |
| `HeaderSection.tsx` | PageSelector embed | R0 |
| `RaceInfographicPage.tsx` | /analytics, /race-info links | R0 |

---

## Suggested PR breakdown

| PR | Phase | Scope | Effort | Risk |
|----|-------|-------|--------|------|
| **PR-1** | R0 | Tokens, PageHeader, PitIcon, emoji batch 1, redirects, delete PageSelector/DataSourceBadge/Timing | 3–5 days | Low |
| **PR-2** | R1a | navigation.ts, MainLayout Outlet, App.tsx restructure, strip page wrappers | 2 days | Medium |
| **PR-3** | R1b | Sidebar groups, BottomNav, TopBar opaque, ads, footer, auth pages, 404 | 2–3 days | Medium |
| **PR-4** | R1c | Calendar PageHeader + dialog polish + globe emoji fix | 2 days | Low |
| **PR-5** | R2 | Dashboard visual refresh (all widgets) | 3–4 days | Low |
| **PR-6** | R2 | Drivers, Constructors, Infographic, Profile, Developers polish | 2 days | Low |
| **PR-7** | R3a | Race Analysis file split + Essentials/Advanced shell | 3–4 days | High |
| **PR-8** | R3b | Remove Season Comparison, copy cleanup, pre-2023 Results | 2–3 days | High |
| **PR-9** | R4 | /standings wire + dashboard link | 1 day | Low |
| **PR-10** | R6a | Supabase migrations + seed script | 2–3 days | Medium |
| **PR-11** | R6b | Scrape pipeline + validation | 3–4 days | Medium |
| **PR-12** | R6c | Career panels + wiki link removal + profile routes | 3–4 days | Medium |
| **PR-13** | R4/R5 | ⌘K search, embed polish, Cockpit rename | 3–5 days | Low |
| **PR-14** | R5 | /circuits page | 1 week | Medium |

---

## Dependency graph

```mermaid
flowchart TD
  R0[R0 Tokens cleanup PageHeader]
  NAV[navigation.ts]
  ML[MainLayout Outlet]
  SB[Sidebar BottomNav]
  AD[Ad reduction Footer]
  ST[/standings route]
  DASH[R2 Dashboard polish]
  RA[R3 Race Analysis]
  ENT[R6 Entity DB]
  PROF[R4 Profile routes]
  SK[⌘K search]
  CIR[/circuits]

  R0 --> NAV
  R0 --> DASH
  R0 --> RA
  NAV --> ML
  ML --> SB
  ML --> AD
  NAV --> ST
  ML --> ST
  ST --> SK
  R0 --> ENT
  ENT --> PROF
  NAV --> CIR
```

---

## Open decisions (resolve before respective phase)

| # | Question | Options | Recommendation |
|---|----------|---------|----------------|
| 1 | Pre-2023 Results in Essentials | Ergast results component vs calendar panel reuse | Reuse `RaceResultsPanel` from calendar |
| 2 | Lap Times tab | Keep in Essentials vs move to Advanced | **Keep** per design master §22.5 |
| 3 | Terms page | Create stub vs omit from footer | Create minimal `/terms` or link Privacy only |
| 4 | "How to use" sidebar item | Stub route vs omit in R1 | Omit in R1; add in R5 |
| 5 | YearComparisonAnalytics.tsx | Delete vs dev-only route | Keep file; remove from primary IA; optional `/developers` link |
| 6 | Sidebar ad vs in-content ad | Revenue preference | Sidebar only (design master §14.4) |
| 7 | Infographic in MainLayout | Keep chrome vs standalone export shell | Keep MainLayout; minimal chrome inside page |

---

## Global acceptance criteria (from design master §20)

### Visual
- [ ] Primary buttons/links use `#E10600`, not purple
- [ ] No purple box-shadow on cards in default dark theme
- [ ] No "Ergast" / "OpenF1" / "Jolpica" in production UI
- [ ] Dashboard shows all 6 content blocks post-refresh
- [ ] Zero emoji in React UI (grep + manual QA)

### Functional
- [ ] Dashboard data loads identically post-refresh (same hooks, same widgets)
- [ ] Race Analysis Essentials covers previous Ergast tabs
- [ ] Legacy URLs redirect without auth blur trap
- [ ] `/standings`, profile slugs resolve correctly

### Performance
- [ ] No additional chart bundles on dashboard
- [ ] Lighthouse CLS stable on countdown tick

### Regression
- [ ] `npm run test`, `typecheck`, `build` pass
- [ ] All three themes render without broken contrast
- [ ] CI green on every PR

---

## Per-page QA checklist (§27 condensed)

| Page | Layout | Visual | Data | Remove |
|------|--------|--------|------|--------|
| Dashboard | Keep grid §16 | F1 red, PitIcon, team borders | Same hooks | PageSelector, emoji |
| Calendar | PageHeader, list default | Session dots | Same API | Emoji globe |
| Race Analysis | Essentials/Advanced | Underline tabs | Same charts | Badges, Season Comparison |
| Drivers | DriverCard + Career | Portrait + logo | + career DB | Wikipedia |
| Constructors | Team cards | TeamLogo refresh | + heritage DB | Wiki footer |
| Standings | standings/* reuse | Pit Wall tables | Ergast | Emoji flags |
| Driver profile | PageHeader + career | Full bleed portrait | DB + API | External links |
| Team profile | Logo hero | Team color header | DB + API | External links |
| Infographic | Export layout | SVG flags | Same data | Emoji |
| Auth | pageShellNarrow | Solid card | — | Emoji coffee |
| Profile | PageHeader | F1Card | Supabase | — |
| Developers | Tool grid | No emoji title | — | — |
| Privacy | Narrow prose | Readable | — | — |
| Embed | Minimal chrome | Theme param | Same widgets | Vendor footer |
| 404 | MainLayout + Empty | Recovery links | — | — |

---

## Related documents

| Document | Role |
|----------|------|
| [`F1_DATASTOP_DESIGN_MASTER.md`](./F1_DATASTOP_DESIGN_MASTER.md) | Visual system, IA, page specs (authoritative) |
| [`REFACTOR_PLAN.md`](../REFACTOR_PLAN.md) | Phases 0–11 sequencing; Phase 9 before prod redesign |
| `.cursor/rules/001_f1datastop-design.mdc` | Agent rules for UI work |
| `.cursor/DESIGN_PHILOSOPHY.md` | Design principles (update in R0) |

---

## Agent audit sources

This plan was synthesized from four parallel codebase audits (2026-06-09):

1. **Page-by-page gap analysis** — 62 surfaces, ~248 change items
2. **§26 violation inventory** — 84 grep-verified violations
3. **Entity DB implementation** — migrations, seed, scrape, hooks, components
4. **Nav/shell refactor** — MainLayout Outlet, sidebar groups, bottom nav, ads, footer

---

*End of Design Implementation Plan v1.0*
