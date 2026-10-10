# F1 DataStop — Design Master Plan

> **Status:** Draft v1.1 — authoritative redesign reference  
> **Created:** 2026-06-21  
> **Updated:** 2026-06-21 — full page inventory, entity DB, icon system, no-emoji policy  
> **Scope:** Visual system, IA, UX patterns, phased implementation  
> **References reviewed:** Braking Point (`../bp`), FIFA League (`../fifa-league`), internal audit  
> **Non-negotiables from product owner:**
> 1. **Dashboard keeps all current features** — same widgets, same layout intent; polish presentation only  
> 2. **Never surface data-source labels** in the UI (no Ergast/OpenF1/Jolpica badges)  
> 3. **Season Comparison** demoted or removed from primary IA  
> 4. **Glass is not the default aesthetic** — opt-in theme only  
> 5. **Never use emoji** in UI — flags via SVG (`CountryFlag`), icons via Pit Wall icon set only  
> 6. **No outbound Wikipedia / vendor links** — career & team records live in our database  

---

## Table of contents

1. [Vision & positioning](#1-vision--positioning)
2. [Design principles](#2-design-principles)
3. [Visual identity](#3-visual-identity)
4. [Color system](#4-color-system)
5. [Typography](#5-typography)
6. [Spacing, grid & layout shells](#6-spacing-grid--layout-shells)
7. [Surfaces & elevation](#7-surfaces--elevation)
8. [Motion & feedback](#8-motion--feedback)
9. [Iconography & flags](#9-iconography--flags)
10. [Data visualization](#10-data-visualization)
11. [Component library spec](#11-component-library-spec)
12. [Theme system](#12-theme-system)
13. [Information architecture](#13-information-architecture)
14. [Navigation & chrome](#14-navigation--chrome)
15. [Page specifications](#15-page-specifications)
16. [Dashboard — feature-preserving refresh](#16-dashboard--feature-preserving-refresh)
17. [Anti-patterns & removals](#17-anti-patterns--removals)
18. [Accessibility](#18-accessibility)
19. [Implementation phases](#19-implementation-phases)
20. [Acceptance criteria & QA](#20-acceptance-criteria--qa)
21. [Appendix: token migration map](#21-appendix-token-migration-map)
22. [Complete page inventory](#22-complete-page-inventory)
23. [Entity registry — drivers, teams, media](#23-entity-registry--drivers-teams-media)
24. [Entity database & career records](#24-entity-database--career-records)
25. [Pit Wall icon system](#25-pit-wall-icon-system)
26. [No-emoji & no-external-profile policy](#26-no-emoji--no-external-profile-policy)
27. [Per-page redesign checklist](#27-per-page-redesign-checklist)

---

## 1. Vision & positioning

### One-line vision

**F1 DataStop is a broadcast-grade F1 data desk** — dense, precise, team-colored, and immediately scannable — not a generic analytics SaaS dashboard.

### What we are

- A **season-long companion** for fans who want standings, last-race context, and deep race analysis in one place.
- A **chart-forward** product: Sankey, position traces, qualifying deltas, pit-stop tables are core value.
- A **public-first** app: F1 data is not behind login; auth enhances profile/embed features only.

### What we are not

- Not a live timing replacement (OpenF1 live blocks are supplementary, not primary nav).
- Not a news site, fantasy game, or social network.
- Not a BI tool that exposes implementation details (API names, cache layers, data vendors).

### Competitive reference synthesis

| Source | Borrow | Reject |
|--------|--------|--------|
| **Braking Point** | Weekend status language, thin top nav, ⌘K search, circuit guide, head-to-head compare, track silhouettes, session lifecycle UX | Realtime-first IA, session-only driver profiles, dark-only with no theme choice |
| **FIFA League** | Solid surfaces, grouped sidebar, route-level layout, `PageHeader` pattern, opaque fixed chrome, thin route files, welcome onboarding | Auth-gated shell, pitch-green brand, prediction-centric nav |
| **Current F1 DataStop** | Dashboard widget set, Sankey hero, combined standings, calendar depth, embeds | Purple-primary tokens, glass-by-default, 13-tab analysis soup, data-source badges, PageSelector rainbow nav |

---

## 2. Design principles

### P1 — Clarity over completeness (everywhere except Dashboard scope)

Users should never wonder *which page* answers their question. One canonical route per question (standings, race analysis, calendar). **Exception:** Dashboard intentionally aggregates season snapshot — that is its job.

### P2 — Data speaks; chrome whispers

UI chrome (borders, glow, blur, gradients) must never compete with numbers, positions, and team colors. **No vendor/source labels on charts or tabs.**

### P3 — F1 red is sacred

`#E10600` is the only brand accent for CTAs, live states, and primary emphasis. Purple is removed from default tokens.

### P4 — Team color is content

Constructor colors come from `f1Colors.ts` and appear on **data rows and chart series**, not on decorative UI chrome.

### P5 — Progressive disclosure

Race Analysis shows **Essentials** first; telemetry, radio, overtakes live under **Advanced**. Season Comparison is not a top-level peer tab.

### P6 — Solid by default, glass by choice

Default themes use layered neutrals. Glass/blur exists only in **Cockpit** theme (`dark-glass` rename) and only via `isGlass` gates.

### P7 — Consistency through primitives

`F1Card`, `PageHeader`, `F1EmptyState`, `F1ErrorState`, `F1Skeleton` — no one-off card styling per page.

### P8 — Dashboard feature parity

The home dashboard **retains**:
- `HeaderSection` (next session countdown)
- `CombinedStandingsCard`
- `SeasonChampionshipCard` (when season incomplete)
- Qualifying → Race Sankey (`MuiSankeyChart`)
- `QualifyingResultsCard`, `LastRaceResultsCard`, `FastestPitStopCard`

Layout order and grid structure stay the same; **visual treatment** upgrades per this document.

---

## 3. Visual identity

### Brand name treatment

- **Wordmark:** `F1` in F1 Red + `DataStop` in foreground (weight 600).
- **Never:** gradient text on headings, purple glow on titles, “Ultimate Formula 1 Analytics Platform” marketing copy in-app.

### Aesthetic name: **Pit Wall**

Evokes the calm, information-dense environment of a team’s strategy wall — dark canvas, sharp numerals, team-colored traces, red for urgency/live.

### Texture

- **Subtle carbon weave** on `--page-background` only (2–3% opacity diagonal lines). Optional; disable in light theme.
- **No** full-page purple mesh gradients in `MainLayout`.

### Shape language

- **Cards:** `rounded-xl` (12px) — consistent, not mixed `rounded-2xl` / `rounded-lg`.
- **Buttons:** `rounded-md` (6px).
- **Pills / status chips:** `rounded-full`.
- **Charts:** square plot area, minimal rounded clip on container only.

### Density modes

| Mode | Use |
|------|-----|
| **Compact** (default) | Standings tables, dashboard cards, analysis tabs |
| **Comfortable** | Auth pages, Privacy, empty states, onboarding |
| **Wide** | Sankey, position charts, race analysis essentials |

---

## 4. Color system

### 4.1 Core semantic tokens (dark default)

Replace current purple primary in `web/src/index.css`:

```css
:root {
  /* Canvas hierarchy */
  --background: 0 0% 4%;           /* #0A0A0A — page */
  --foreground: 0 0% 96%;          /* #F5F5F5 — primary text */

  --card: 0 0% 7%;                 /* #121212 — raised surface */
  --card-foreground: 0 0% 96%;

  --muted: 0 0% 11%;               /* #1C1C1C — inset / secondary panels */
  --muted-foreground: 0 0% 62%;    /* #9E9E9E — labels */

  --border: 0 0% 16%;              /* #292929 */
  --input: 0 0% 14%;

  /* Brand */
  --primary: 0 100% 44%;           /* #E10600 — F1 Red */
  --primary-foreground: 0 0% 100%;
  --ring: 0 100% 44%;

  /* Secondary actions */
  --secondary: 0 0% 12%;
  --secondary-foreground: 0 0% 90%;
  --accent: 0 0% 14%;
  --accent-foreground: 0 0% 96%;

  /* Status */
  --status-live: 0 84% 55%;        /* red-orange pulse */
  --status-upcoming: 217 91% 60%;  /* blue */
  --status-complete: 142 55% 45%;  /* green */
  --status-warning: 38 92% 50%;    /* amber — quali, caution */

  /* F1 brand aliases */
  --f1-red: 0 100% 44%;
  --f1-black: 0 0% 4%;
  --f1-white: 0 0% 100%;

  /* Podium */
  --position-gold: 45 93% 47%;
  --position-silver: 0 0% 75%;
  --position-bronze: 30 60% 45%;
}
```

### 4.2 Light theme

```css
.light {
  --background: 0 0% 98%;
  --foreground: 0 0% 9%;
  --card: 0 0% 100%;
  --muted: 0 0% 94%;
  --muted-foreground: 0 0% 40%;
  --border: 0 0% 88%;
  --primary: 0 100% 44%;
  --ring: 0 100% 44%;
}
```

### 4.3 Cockpit theme (rename from `dark-glass`)

Glass tokens use **F1 red glow**, not purple:

```css
.dark-glass, .cockpit {
  --glass-glow: 0 0 32px rgba(225, 6, 0, 0.12);
  --glass-glow-subtle: 0 0 16px rgba(225, 6, 0, 0.06);
  --glass-border: rgba(255, 255, 255, 0.10);
  --glass-bg: rgba(255, 255, 255, 0.04);
  --glass-mode: 1;
}
```

### 4.4 Team colors

- Source of truth: `web/src/constants/f1Colors.ts`
- **Usage rules:**
  - Left **3px border** on standings rows (driver + constructor).
  - Chart series stroke/fill per driver.
  - Avatar ring on driver cards.
  - **Never** as full-card background fills (too loud).

### 4.5 Chart palette

| Role | Token |
|------|-------|
| Grid lines | `hsl(var(--chart-grid))` — 15% lightness dark |
| Axis text | `hsl(var(--chart-axis))` — muted-foreground |
| Tooltip bg | `hsl(var(--card))` solid, 1px border |
| Fastest lap | `--status-warning` or purple `#A855F7` **only** for FL indicator |
| DNF / retired | `--destructive` desaturated |

### 4.6 Forbidden colors in UI chrome

- `rgba(147, 51, 234, …)` purple glow — **remove**
- Rainbow gradients on nav cards — **remove**
- `#9333EA` primary — **remove**

---

## 5. Typography

### 5.1 Font stack

| Role | Font | Fallback |
|------|------|----------|
| **Display** | `"Exo 2", system-ui` | bp-inspired motorsport display |
| **Body** | `"Inter", system-ui` | existing; keep |
| **Mono / timing** | `"JetBrains Mono", ui-monospace` | lap times, countdown |

Load Exo 2 via `@fontsource/exo-2` or Google Fonts in `index.html`.

### 5.2 Type scale

| Token | Size | Weight | Use |
|-------|------|--------|-----|
| `display-lg` | 2rem (32px) | 700 | Marketing landing only |
| `display` | 1.75rem (28px) | 700 | Page titles |
| `heading-lg` | 1.25rem (20px) | 600 | Card titles |
| `heading` | 1.125rem (18px) | 600 | Section headers |
| `body` | 0.875rem (14px) | 400 | Default UI |
| `body-sm` | 0.8125rem (13px) | 400 | Table cells |
| `label` | 0.6875rem (11px) | 600 | Eyebrows, uppercase kickers |
| `micro` | 0.625rem (10px) | 500 | Session type pills, meta |

### 5.3 Utility classes (new — add to `index.css`)

```css
.eyebrow {
  @apply text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground;
}
.stat-numeral {
  @apply font-display text-2xl font-bold tabular-nums tracking-tight;
}
.timing {
  @apply font-mono text-sm tabular-nums;
}
.position-pill {
  @apply font-mono text-xs font-bold tabular-nums;
}
```

### 5.4 Copy tone

- **Do:** “P3 · +2 positions · 25 pts”
- **Don't:** “Comprehensive race data and telemetry insights”
- **Don't:** “Powered by Ergast API” / “OpenF1 data” anywhere in UI

---

## 6. Spacing, grid & layout shells

### 6.1 Page shells (new `web/src/lib/layout.ts`)

```typescript
export const pageShell = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";
export const pageShellWide = "mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-8";
export const pageShellNarrow = "mx-auto w-full max-w-xl px-4 sm:px-6";
export const pageStack = "space-y-6";
export const sectionStack = "space-y-4";
```

### 6.2 Dashboard grid (unchanged structure)

```
┌─────────────────────────────────────────────────────────────┐
│ HeaderSection (countdown + title)                           │
├──────────────────────────────┬──────────────────────────────┤
│ CombinedStandingsCard (2/3)  │ SeasonChampionshipCard (1/3) │
├──────────────────────────────┴──────────────────────────────┤
│ Sankey — Qualifying → Race (full width, h≈550px)            │
├──────────────────┬──────────────────┬───────────────────────┤
│ QualifyingResults  │ LastRaceResults  │ FastestPitStop        │
└──────────────────┴──────────────────┴───────────────────────┘
```

Gap: `gap-4 md:gap-6`. No change to React structure in `Index.tsx`.

### 6.3 Breakpoints

Standard Tailwind: `sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536.

---

## 7. Surfaces & elevation

### 7.1 Elevation levels

| Level | Token | Use |
|-------|-------|-----|
| 0 | `--background` | Page canvas |
| 1 | `--card` | F1Card default |
| 2 | `--muted` | Inset tables, chart plot background |
| 3 | `--popover` | Dropdowns, tooltips |
| 4 | Fixed chrome | Sidebar, top bar — **solid**, no blur |

### 7.2 F1Card variants (canonical)

| Variant | When |
|---------|------|
| `default` | 95% of UI including Dashboard |
| `team-accent` | Standings rows, driver cards — left border only |
| `gradient` | **Deprecated** — remove usages |
| `glass` | **Only** when `isGlass === true` |

### 7.3 Borders

- Default: `border border-border`
- Active nav: `border-l-2 border-l-primary` (sidebar)
- Focus: `ring-2 ring-ring ring-offset-2 ring-offset-background`

### 7.4 MainLayout background

- **Remove:** animated purple mesh / heavy gradient overlays.
- **Add:** optional static carbon texture at 2% opacity on `--background`.

---

## 8. Motion & feedback

### 8.1 Durations

| Token | Value | Use |
|-------|-------|-----|
| `--transition-fast` | 150ms | Hover, toggle |
| `--transition-normal` | 250ms | Tab switch, card expand |
| `--transition-slow` | 400ms | Page enter |

### 8.2 Allowed motion

- Page enter: `animate-fade-in` (opacity + 4px translateY, 200ms)
- Countdown digit tick: none (static update — avoid flashy flip clocks)
- Live pulse: `status-live` dot only on **HeaderSection** when session <6h
- Skeleton: `F1Skeleton` shimmer — keep

### 8.3 Forbidden motion

- Staggered rainbow card entrances on PageSelector
- Parallax on scroll
- Glass shimmer loops

---

## 9. Iconography & flags

- **Icons:** Lucide only, 16px inline, 20px card titles, stroke-width 2.
- **Flags:** `react-country-flag` SVG at 14–16px beside GP names.
- **Session type color dots** (calendar): Race=red, Quali=amber, Sprint=purple, Practice=blue (bp pattern).

---

## 10. Data visualization

### 10.1 Global chart rules

1. Wrap all Recharts in `MuiThemeWrapper` / chart tokens.
2. **No data-source badge** in chart header or tab label.
3. Y-axis lap times: monospace, fixed width.
4. Legend: max 10 series visible; overflow → “+N drivers”.
5. Empty: `F1ChartEmpty` with actionable copy (“Select a completed race”).

### 10.2 Chart height defaults

| Chart | Min height |
|-------|------------|
| Sankey (dashboard) | 550px (keep) |
| Position / lap | 400px |
| Qualifying | 360px |
| Pit stop table | auto |

### 10.3 Sankey (dashboard hero)

- Keep full-width placement.
- Title: **Qualifying → Race** (drop “Progression” fluff or keep subtitle minimal).
- Race chip button: team-neutral border, flag + GP name — no primary fill.

---

## 11. Component library spec

### 11.1 New: `PageHeader`

```tsx
<PageHeader
  eyebrow="2025 Season"
  title="Race Analysis"
  description="Monaco Grand Prix · Round 8"
  actions={<YearSelector />}
/>
```

File: `web/src/components/f1/PageHeader.tsx`

### 11.2 `F1Card` — required props discipline

- Every card: `F1CardHeader` + `F1CardTitle` OR explicit `aria-label`.
- Dashboard cards: use `team-accent` on standings only.

### 11.3 Standings row pattern

```
│█│ P1  VER  Red Bull Racing          575 pts  ▂▂▂▂▂ wins 3
 ↑ team color 3px border
```

### 11.4 Tab pattern (Race Analysis)

- **Desktop:** underline tabs (fifa/bp style), not nested pill + shadcn double stack.
- **Mobile:** single `Select` for tab — keep.
- Tab groups: **Essentials** | **Advanced** — not Ergast vs OpenF1 labels.

### 11.5 Remove component

- `DataSourceBadge` — delete file and all imports.
- Do **not** replace with another vendor label; tabs named by fan language only.

---

## 12. Theme system

### 12.1 Themes

| ID | Label | Default? |
|----|-------|----------|
| `dark` | Pit Wall Dark | **Yes** |
| `light` | Pit Wall Light | No |
| `dark-glass` | Cockpit | No (rename UI label only) |

Remove references to `light-glass`, `slate`.

### 12.2 Theme toggle

- Single control in sidebar footer (fifa pattern).
- No “Glass Themes” subsection with lonely one option — fold Cockpit into main list.

### 12.3 `useThemeVariant()` — mandatory

All pages use hook instead of manual `isGlass ? "glass" : "default"` copies.

---

## 13. Information architecture

### 13.1 Route map (target)

| Route | Purpose | Nav |
|-------|---------|-----|
| `/` | Dashboard (unchanged features) | Dashboard |
| `/calendar` | Season schedule | Calendar |
| `/standings` | **NEW** Full championship tables | Standings |
| `/race-analysis`, `/race-analysis/:y/:r` | Deep analysis | Analysis |
| `/drivers` | Driver grid | Drivers |
| `/constructors` | Team grid | Teams |
| `/circuits` | **NEW** Track guide (phase 2) | Circuits |
| `/compare` | **NEW** Head-to-head (phase 3) | Search/Menu |
| `/profile`, auth, embed, dev | Secondary | Account / footer |

Legacy redirects stay (`/analytics`, `/race-info` → analysis) but **remove stale labels** from UI.

### 13.2 Race Analysis IA (restructured)

```
Race Analysis
├── Race picker (year + round + flag) — sticky header
├── Essentials (default tab group)
│   ├── Results
│   ├── Positions
│   ├── Qualifying
│   ├── Quali → Race (Sankey)
│   └── Pit Stops
└── Advanced (collapsed accordion or second tab row)
    ├── Weather
    ├── Telemetry
    ├── Team Radio
    └── Overtakes
```

**Removed from primary IA:**
- Top-level “Season Comparison” tab
- “Ergast” / “OpenF1” tab group labels
- All `DataSourceBadge` instances

**OpenF1 panels:** Appear inside Advanced only when `year >= 2023` and session data exists; otherwise hidden entirely (not empty tabs).

### 13.3 Calendar

- **Keep** list, grid, globe, distribution — user did not ask to cut calendar modes.
- Default view: **list**.
- Globe/distribution: secondary toggle, not first-run default.

### 13.4 Search (phase 2)

- ⌘K palette: Drivers, Grands Prix, pages.
- No API names in search results.

---

## 14. Navigation & chrome

### 14.1 Sidebar groups (fifa-inspired)

```
OVERVIEW
  Dashboard
  Calendar

EXPLORE
  Standings      ← new route
  Race Analysis
  Drivers
  Constructors

ACCOUNT
  Profile / Sign in

FOOTER
  Theme toggle
  How to use     ← new narrow page (phase 2)
  Privacy
```

Remove section label **“F1 Information”** (implies false paywall).

### 14.2 Remove PageSelector

- Delete rainbow mobile nav from `HeaderSection`.
- Mobile: bottom tab bar (5 items): Home, Calendar, Standings, Analysis, More.

### 14.3 Top bar

- Opaque `bg-background border-b border-border` — **no backdrop-blur**.
- Optional: global search trigger.

### 14.4 Ads

- Reduce to **one** in-content slot OR sidebar — not top + bottom + sidebar simultaneously.
- Ad containers use `muted` surface, no glass.

### 14.5 Footer

- Compress to fifa-style single row: © · Privacy · Terms · (optional sync health dot).
- Remove 4-column marketing grid.

---

## 15. Page specifications

### 15.1 Dashboard (`/`)

See [Section 16](#16-dashboard--feature-preserving-refresh) — feature freeze, visual refresh only.

### 15.2 Calendar (`/calendar`)

- `PageHeader`: eyebrow = season year, title = “Race Calendar”.
- View switcher: segmented control, not 4 equal hero buttons.
- Race detail dialog: primary CTA **“Open race analysis”** styled `primary`.

### 15.3 Standings (`/standings`) — NEW

- Relocate full `CombinedStandingsCard` logic or reuse `standings/*` tables.
- Dashboard keeps snapshot; this page is canonical full table.
- Driver/constructor toggle as tabs.

### 15.4 Race Analysis

- Max **2** tab bars visible (Essentials / Advanced, then sub-tab).
- Sticky context bar: flag, GP name, round, year.
- Loading: `F1Skeleton variant="chart"` per panel.

### 15.5 Drivers / Constructors

- Unify header with `PageHeader`.
- Add shareable URLs in phase 2 (`/drivers/:id`).

### 15.6 Auth / Profile

- Solid card on `pageShellNarrow` — no glass on auth forms.

---

## 16. Dashboard — feature-preserving refresh

> **Constraint:** Do not remove, reorder, or merge dashboard widgets. Polish only.

### 16.1 HeaderSection

| Element | Current | Refresh |
|---------|---------|---------|
| Title | Generic h1 | `PageHeader` with eyebrow “2025 Season” |
| Countdown card | Glass variant always | `default` card; glass only if Cockpit theme |
| Urgency | Unknown | `<6h`: `status-live` dot on countdown |
| PageSelector | Rainbow 5-up | **Remove** — navigation via sidebar/bottom nav |
| Offline alert | Alert | Keep; use `F1ErrorState` styling |

### 16.2 CombinedStandingsCard

- Team left-border on rows.
- Tab switch driver/constructor: underline tabs.
- Points: `stat-numeral` for leader.
- Progress bars: team color fill, not purple generic.

### 16.3 SeasonChampionshipCard

- Chart bars: team colors from standings leader trend.
- Remove purple gradient fill.

### 16.4 Sankey block

- Card: `variant="default"` default.
- Title icon: `GitCompare` in `--primary` red, not purple.
- Description: one line max.

### 16.5 Bottom trio (Qualifying / Last Race / Pit Stop)

- Equal height cards: `min-h-[280px]`.
- Shared header pattern: eyebrow “Last GP” + race name chip.
- Loading skeletons match final heights.

### 16.6 Dashboard does NOT get

- Weekend-hub replacement layout (bp home).
- Removal of Sankey or standings.
- Data source indicators.

---

## 17. Anti-patterns & removals

### 17.1 Remove from UI

| Item | Files |
|------|-------|
| `DataSourceBadge` | `DataSourceBadge.tsx`, `RaceAnalysis.tsx`, `YearComparisonAnalytics.tsx` |
| `PageSelector` | `PageSelector.tsx`, `HeaderSection.tsx` |
| Season Comparison top tab | `RaceAnalysis.tsx`, optionally entire `YearComparisonAnalytics.tsx` |
| Purple primary tokens | `index.css` |
| Purple `--f1-red` override | `index.css` |
| Orphan pages | `Standings.tsx`, `Timing.tsx` (wire to routes or delete) |
| Unused dashboard orphans | `PolePositionsCard`, `SeasonCharts`, etc. |

### 17.2 Remove from copy

- “Ergast”, “OpenF1”, “Jolpica” in user-visible strings.
- “Analytics” as nav label → **“Race Analysis”** everywhere.

### 17.3 Keep but relocate

- Embeds → Developers footer only.
- Developer PitStop easter egg → unchanged.

---

## 18. Accessibility

- WCAG AA contrast on `--foreground` vs `--background` and `--card`.
- Focus rings on all interactive elements.
- Chart tooltips: keyboard-dismissible where Recharts allows.
- `prefers-reduced-motion`: disable fade-in and pulse.
- Tab order: sidebar → main → footer.

---

## 19. Implementation phases

### Phase R0 — Token & cleanup foundation (3–5 days)

- [ ] Fix `index.css` tokens (F1 red primary, remove purple glow)
- [ ] Add Exo 2 + layout utilities + `PageHeader`
- [ ] Remove `DataSourceBadge` entirely
- [ ] Remove `PageSelector` from HeaderSection
- [ ] Fix stale nav strings (Analytics, Race Info)
- [ ] Delete orphan components/pages
- [ ] Update `DESIGN_PHILOSOPHY.md` + `DESIGN_SYSTEM.md` to reference this doc

### Phase R1 — Chrome & nav (1 week)

- [ ] Grouped sidebar IA
- [ ] Mobile bottom nav
- [ ] Opaque sidebar/topbar (no blur)
- [ ] Compact footer
- [ ] Route-level `MainLayout` + `<Outlet />` (fifa pattern)
- [ ] Ad slot reduction

### Phase R2 — Dashboard visual refresh (3–4 days)

- [ ] Apply Section 16 polish to each dashboard widget
- [ ] **No feature/layout removal**
- [ ] QA dashboard at 375px, 768px, 1280px

### Phase R3 — Race Analysis restructure (1–2 weeks)

- [ ] Essentials / Advanced tab model
- [ ] Remove Season Comparison from top level
- [ ] Hide OpenF1 advanced panels when N/A
- [ ] `PageHeader` + sticky race context

### Phase R4 — New routes (1–2 weeks)

- [ ] `/standings` page
- [ ] `/circuits` index (bp-inspired)
- [ ] ⌘K search

### Phase R5 — Cockpit theme polish (ongoing)

- [ ] Rename label to Cockpit
- [ ] F1-red glass glow
- [ ] Audit all `isGlass` branches

### Phase R6 — Entity database & career records (2–3 weeks)

- [ ] Supabase migration: `f1_driver`, `f1_constructor`, `f1_driver_career`, `f1_constructor_career`
- [ ] Seed script from Ergast + portrait/logo maps (§23)
- [ ] Wikipedia scrape script (offline) with Ergast validation
- [ ] `DriverCareerPanel` + `TeamHeritagePanel` — replace all Wikipedia/outbound profile links
- [ ] New routes: `/drivers/:slug`, `/teams/:slug`
- [ ] Remove emoji flags globally (§26 file list)
- [ ] Add `PitIcon` wrapper + semantic icon map (§25)

---

## 20. Acceptance criteria & QA

### Visual

- [ ] Primary buttons and links use `#E10600`, not purple.
- [ ] No purple box-shadow on cards in default dark theme.
- [ ] No “Ergast” / “OpenF1” visible anywhere in production UI.
- [ ] Dashboard shows all 6 content blocks from v2 (header, standings, season card, sankey, 3 cards).

### Functional

- [ ] All existing dashboard data loads identically post-refresh.
- [ ] Race Analysis Essentials tabs cover previous Ergast tabs.
- [ ] Legacy URLs redirect without auth blur trap.

### Performance

- [ ] No additional chart bundles on dashboard.
- [ ] Lighthouse CLS stable on countdown tick.

### Regression

- [ ] `npm run test`, `typecheck`, `build` pass.
- [ ] All three themes render without broken contrast.

---

## 21. Appendix: token migration map

| Old token / pattern | New |
|---------------------|-----|
| `--primary: 270 75% 55%` | `--primary: 0 100% 44%` |
| `--f1-red: 270…` | `--f1-red: 0 100% 44%` |
| `--ring: 270…` | `--ring: 0 100% 44%` |
| `rgba(147, 51, 234, …)` glow | `rgba(225, 6, 0, …)` or remove |
| `variant="glass"` unconditional | `variant={isGlass ? "glass" : "default"}` |
| Manual theme ternaries | `useThemeVariant()` |
| `DataSourceBadge source="ergast"` | **delete** |
| Nav “Analytics” | “Race Analysis” |
| Theme “Dark Glass” | “Cockpit” (optional) |

| Theme “Dark Glass” | “Cockpit” (optional) |
| `View Wikipedia Profile` links | In-app **Career** panel from `entity_career_stats` |
| Emoji flags (`countryUtils`, globe) | SVG `CountryFlag` only |
| Ergast `Driver.url` / `Constructor.url` in UI | Never render as links |

---

## 22. Complete page inventory

Every user-facing surface in the app as of `web/src/App.tsx` + orphan files. **No page may be skipped in redesign QA.**

### 22.1 Routed pages (18 routes)

| # | Route | Page file | Layout | Auth | Redesign priority |
|---|-------|-----------|--------|------|-----------------|
| 1 | `/` | `pages/Index.tsx` | MainLayout | Public | R2 — visual polish only, **keep all widgets** |
| 2 | `/calendar` | `pages/RaceCalendar.tsx` | MainLayout | Public | R1 — PageHeader, view switcher styling |
| 3 | `/race-analysis` | `pages/RaceAnalysis.tsx` | MainLayout | Public | R3 — Essentials/Advanced, remove badges |
| 4 | `/race-analysis/:year/:round` | same | MainLayout | Public | R3 — deep-link sticky context |
| 5 | `/drivers` | `pages/Drivers.tsx` | MainLayout | Public | R2 — entity pages, career panel |
| 6 | `/constructors` | `pages/Constructors.tsx` | MainLayout | Public | R2 — team records, remove wiki footer |
| 7 | `/standings` | **NEW** (orphan `Standings.tsx` exists) | MainLayout | Public | R4 — wire route |
| 8 | `/drivers/:slug` | **NEW** | MainLayout | Public | R4 — shareable driver profile |
| 9 | `/teams/:slug` | **NEW** | MainLayout | Public | R4 — shareable team profile |
| 10 | `/circuits` | **NEW** | MainLayout | Public | R5 — bp-inspired guide |
| 11 | `/infographic/:year/:round` | `pages/RaceInfographicPage.tsx` | Standalone lazy | Public | R2 — remove emoji flags, Pit Wall export |
| 12 | `/embed` | `pages/embed/index.tsx` | Minimal | Public | R5 — footer/dev only styling |
| 13 | `/embed/driver-standings` | `pages/embed/driver-standings.tsx` | Minimal | Public | R5 |
| 14 | `/embed/constructor-standings` | `pages/embed/constructor-standings.tsx` | Minimal | Public | R5 |
| 15 | `/auth/login` | `pages/auth/Login.tsx` | Auth shell | PublicOnly | R1 — solid card, no emoji assets |
| 16 | `/auth/signup` | `pages/auth/Signup.tsx` | Auth shell | PublicOnly | R1 — remove BuyMeACoffee emoji param |
| 17 | `/auth/reset-password` | `pages/auth/ResetPassword.tsx` | Auth shell | Public | R1 |
| 18 | `/auth/callback` | inline in `App.tsx` | Minimal spinner | Public | R1 — F1Skeleton loader |
| 19 | `/profile` | `pages/auth/Profile.tsx` | MainLayout | Protected | R2 — PageHeader |
| 20 | `/developers` | `pages/Developers.tsx` | MainLayout | Protected + dev mode | R2 — remove emoji in title |
| 21 | `/privacy` | `pages/Privacy.tsx` | Standalone | Public | R1 — narrow shell |
| 22 | `*` | `pages/NotFound.tsx` | **No** MainLayout | Public | R1 — add MainLayout + recovery links |

### 22.2 Redirect routes (must not confuse users)

| Route | Target | Issue today | Fix |
|-------|--------|-------------|-----|
| `/analytics` | `/race-analysis` | Stale “Analytics” label in PageSelector | Remove PageSelector; rename all copy |
| `/race-info`, `/race-info/:y/:r` | `/race-analysis` | Inside ProtectedRoute → blur trap | Move redirect public |

### 22.3 Orphan pages (no route — decide in R0)

| File | Purpose | Action |
|------|---------|--------|
| `pages/Standings.tsx` | Full standings duplicate | Wire to `/standings` or delete after merge |
| `pages/Timing.tsx` | Last-race table duplicate | Delete (dashboard card covers) |

### 22.4 Major sub-views & modals (same QA bar as pages)

| Surface | Component | Parent route | Notes |
|---------|-----------|--------------|-------|
| Race detail modal | `RaceDetailDialog.tsx` | Calendar, Dashboard Sankey | Tabs: info, results, quali, sprint, distribution |
| Race schedule panel | `race-detail/RaceSchedulePanel.tsx` | Dialog | Links to analysis |
| Sankey dialog | `Index.tsx` → RaceDetailDialog | Dashboard | Keep |
| Calendar list | `RaceCalendarListView.tsx` | Calendar | Default view |
| Calendar grid | `RaceCalendarGridView.tsx` | Calendar | |
| Calendar globe | `RaceCalendarGlobeView.tsx` + `F1GlobeContainer` | Calendar | Remove emoji tooltips |
| Points distribution | `PointsDistributionView.tsx` | Calendar | |
| Race infographic modal | `RaceInfographic.tsx` | Calendar | Export flow |
| Driver card modal | `DriverCard.tsx` | Drivers | Opens stats panel |
| Driver stats panel | `DriverStatsPanel.tsx` | DriverCard | **Remove Wikipedia link** → Career tab |
| Mobile nav | `MobileNavigation.tsx` | Global | Bottom bar in R1 |
| Sidebar | `Sidebar.tsx` | Global | Grouped IA |
| Top bar | `TopBar.tsx` | Global | Opaque |
| Footer | `Footer.tsx` | Global | Compress |
| Auth blur overlay | `AuthBlurOverlay.tsx` | Protected legacy | Fix redirect instead |
| Clarity dev widget | `ClarityStatus.tsx` | Dev only | Unchanged |
| Theme panels | `ThemeToggle`, `ThemeSelectorPanel` | Global | Cockpit rename |

### 22.5 Race Analysis tab inventory (current → target)

| Current tab | Source | Target group |
|-------------|--------|--------------|
| Results | Ergast | Essentials |
| Lap Times | Ergast | Essentials |
| Positions | Ergast | Essentials |
| Qualifying | Ergast | Essentials |
| Quali → Race (Sankey) | Ergast | Essentials |
| Pit Stops | Ergast | Essentials |
| Weather | OpenF1 | Advanced (2023+) |
| Team Radio | OpenF1 | Advanced |
| Telemetry | OpenF1 | Advanced |
| Overtakes | OpenF1 | Advanced |
| Session Results | OpenF1 | Advanced |
| **Season Comparison** (top tab) | Ergast | **Remove** from primary IA |

---

## 23. Entity registry — drivers, teams, media

### 23.1 Design rule: one canonical identity per entity

| Layer | Key | Display name source | Visual assets |
|-------|-----|---------------------|---------------|
| Driver | `ergastId` (e.g. `max_verstappen`) | API `givenName` + `familyName` | F1 portrait map + OpenF1 headshot fallback |
| Constructor | `constructorId` (e.g. `red_bull`) | API `name` | F1 team wordmark via `TeamLogo` |
| Circuit | `circuitId` from Ergast | API `circuitName` | Track outline SVG (future) |
| Grand Prix | `season` + `round` | API `raceName` (strip emoji — see §26) | Country flag SVG |

**Never hardcode driver/team lists in UI** except:
- Static **color** map (`f1Colors.ts`) — allowed
- Static **media path** maps (`f1DriverPortraitMedia.ts`, `f1TeamLogoMedia.ts`) — allowed, synced from formula1.com
- Static **career records** (`entity_career_stats` DB) — allowed after scrape

### 23.2 2026 grid — constructors (logo map)

From `web/src/constants/f1TeamLogoMedia.ts` (`F1_TEAM_LOGO_SEASON = 2026`):

| Ergast `constructorId` | Normalized key | Display name (API) | Logo asset |
|------------------------|----------------|--------------------|------------|
| `mercedes` | mercedes | Mercedes | `2026mercedeslogowhite.webp` |
| `ferrari` | ferrari | Ferrari | `2026ferrarilogowhite.webp` |
| `mclaren` | mclaren | McLaren | `2026mclarenlogowhite.webp` |
| `williams` | williams | Williams | `2026williamslogowhite.webp` |
| `alpine` | alpine | Alpine | `2026alpinelogowhite.webp` |
| `aston_martin` | astonmartin | Aston Martin | `2026astonmartinlogowhite.webp` |
| `red_bull` | redbull | Red Bull Racing | `2026redbullracinglogowhite.webp` |
| `rb` | rb | Racing Bulls | `2026racingbullslogowhite.webp` |
| `haas` | haas | Haas F1 Team | `2026haasf1teamlogowhite.webp` |
| `audi` | audi | Audi | `2026audilogowhite.webp` |
| `cadillac` | cadillac | Cadillac | `2026cadillaclogowhite.webp` |

**Aliases in logo map:** `alphatauri` → Racing Bulls, `sauber` / `kicksauber` → Audi.

**Team color hex** (accent borders, charts): `web/src/constants/f1Colors.ts` — keep synced when rebrands occur.

**Logo presentation rules (`TeamLogo.tsx` refresh):**
- Dark theme: white wordmark on `bg-white/10` pill — **reduce** to transparent bg + wordmark only on Pit Wall redesign
- Light theme: invert via dark pill — simplify to single treatment
- Fallback when logo 404: constructor **name text**, never emoji

### 23.3 2026 grid — drivers (portrait map)

From `web/src/constants/f1DriverPortraitMedia.ts` (`F1_DRIVER_PORTRAIT_SEASON = 2026`):

| Ergast `driverId` | Team (2026) | Portrait path key |
|-------------------|-------------|-------------------|
| `russell` | Mercedes | georus01 |
| `antonelli` | Mercedes | andant01 |
| `leclerc` | Ferrari | chalec01 |
| `hamilton` | Ferrari | lewham01 |
| `norris` | McLaren | lannor01 |
| `piastri` | McLaren | oscpia01 |
| `ocon` | Haas | estoco01 |
| `bearman` | Haas | olibea01 |
| `gasly` | Alpine | piegas01 |
| `colapinto` | Alpine | fracol01 |
| `max_verstappen` | Red Bull | maxver01 |
| `hadjar` | Red Bull | isahad01 |
| `lawson` | Racing Bulls | lialaw01 |
| `arvid_lindblad` / `lindblad` | Racing Bulls | arvlin01 |
| `hulkenberg` | Audi | nichul01 |
| `bortoleto` | Audi | gabbor01 |
| `sainz` | Williams | carsai01 |
| `albon` | Williams | alealb01 |
| `perez` | Cadillac | serper01 |
| `bottas` | Cadillac | valbot01 |
| `alonso` | Aston Martin | feralo01 |
| `stroll` | Aston Martin | lanstr01 |

**Headshot resolution order (`DriverImage.tsx`):**
1. OpenF1 `headshot_url` (when session data loaded)
2. F1.com portrait transform via `getF1PortraitPathForErgastDriverId`
3. Local fallback assets in `web/src/assets/drivers-headshot/` (legacy)
4. Initials avatar — never emoji

**Re-sync scripts:** `scripts/sync-f1-driver-portrait-paths.mjs`, `scripts/sync-f1-team-logo-paths.mjs` when grid changes.

### 23.4 Display names & spelling

- Use **API names** everywhere in UI (Ergast/Jolpica standing rows).
- Do not override “Red Bull Racing” vs “Red Bull” unless API wrong — fix in entity DB `display_name_override` column if needed.
- Driver codes: 3-letter (`VER`, `HAM`) — monospace, uppercase.

---

## 24. Entity database & career records

### 24.1 Problem today

- Ergast returns `Driver.url` / `Constructor.url` → **Wikipedia**.
- UI renders “View Wikipedia Profile” (`DriverStatsPanel.tsx`) and “View Team Profile” (`Constructors.tsx`) outbound links.
- Career stats shown are **season-only** (wins/podiums from current year results) — no lifetime achievements (Hamilton 7 titles, Kimi WDC 2007, etc.).

### 24.2 Goal

**First-party entity profiles** backed by Postgres, enriched from structured scrapes (Wikipedia infobox + tables as *source*, not *destination*).

Users never leave the app for driver/team history.

### 24.3 Proposed Supabase schema

```sql
-- Core identity (synced from Ergast + manual overrides)
create table public.f1_driver (
  ergast_id text primary key,
  given_name text not null,
  family_name text not null,
  code text,
  permanent_number text,
  nationality text,
  date_of_birth date,
  slug text unique not null,          -- e.g. max-verstappen
  portrait_path text,                 -- formula1.com path under common/f1/
  headshot_url text,                  -- optional cached CDN URL
  display_name_override text,
  active_season int,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.f1_constructor (
  ergast_id text primary key,
  name text not null,
  nationality text,
  slug text unique not null,          -- e.g. red-bull-racing
  logo_path text,
  team_color_hex text,                -- override f1Colors when needed
  display_name_override text,
  active_season int,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Career totals (scraped + verified; Wikipedia attribution in admin only, not UI)
create table public.f1_driver_career (
  ergast_id text primary key references f1_driver(ergast_id),
  championships int default 0,
  race_starts int,
  race_wins int,
  podiums int,
  pole_positions int,
  fastest_laps int,
  first_gp_year int,
  last_gp_year int,
  best_championship_position int,
  career_points numeric,
  bio_short text,                     -- 2-3 sentences, factual
  notable_records jsonb,              -- [{ "label": "Most podiums", "value": "..." }]
  source_revision text,               -- internal: wiki page revision id
  scraped_at timestamptz,
  updated_at timestamptz default now()
);

create table public.f1_constructor_career (
  ergast_id text primary key references f1_constructor(ergast_id),
  championships int default 0,
  race_wins int,
  podiums int,
  pole_positions int,
  first_season int,
  last_season int,
  bio_short text,
  notable_records jsonb,
  source_revision text,
  scraped_at timestamptz,
  updated_at timestamptz default now()
);

-- Optional: circuit reference (phase 5)
create table public.f1_circuit (
  circuit_id text primary key,
  name text not null,
  country text,
  locality text,
  length_km numeric,
  lap_record jsonb,
  slug text unique not null
);
```

**RLS:** public read on all; write service-role only (edge function / admin script).

### 24.4 Scrape pipeline (offline, not runtime)

1. **Seed** `f1_driver` / `f1_constructor` from current Ergast standings + portrait/logo maps.
2. **Scrape job** (Node script or Supabase edge cron):
   - Input: Wikipedia page title mapped from `ergast_id` (config JSON, e.g. `hamilton` → `Lewis_Hamilton`)
   - Parse infobox: championships, wins, podiums, poles, FL
   - Parse lead paragraph → `bio_short` (strip citations markup)
   - Store `source_revision` for refresh diff
3. **Validation:** cross-check wins vs Ergast `/drivers/{id}/results.json` aggregate; flag mismatches for manual review.
4. **Refresh:** monthly off-season, weekly in-season for active grid only.

**Legal/UI note:** Do not show “Source: Wikipedia” in fan UI. Optional muted “Stats as of {date}” footer on career panel only.

### 24.5 Career UI components (replace Wikipedia links)

**`DriverCareerPanel`** (inside DriverCard modal + future `/drivers/:slug`):

```
┌─────────────────────────────────────────┐
│ CAREER RECORDS                          │
├──────────┬──────────┬──────────┬────────┤
│ WDC  7   │ Wins 105 │ Podiums  │ Poles  │
│          │          │   201    │   104  │
├──────────┴──────────┴──────────┴────────┤
│ 2007 · 2008 · 2014 · 2015 · 2017 …     │  ← championship years chips
├─────────────────────────────────────────┤
│ Short bio (2 lines max)                 │
└─────────────────────────────────────────┘
```

Icons: `Trophy`, `Flag`, `Timer`, `Zap` from Pit Wall set — not emoji.

**`TeamHeritagePanel`** on Constructors page (replaces footer link):

- Championships, wins, poles, first season
- Current drivers (from standings API — dynamic)
- Team color strip + `TeamLogo` lg

### 24.6 Example records to seed (validation targets)

| Driver | Championships | Wins (approx) | Notes |
|--------|---------------|---------------|-------|
| Lewis Hamilton | 7 | 105+ | Most wins record holder (F1) |
| Max Verstappen | 4 | 60+ | Recent dominance |
| Kimi Räikkönen | 1 | 21 | 2007 WDC; “Iceman” bio line |
| Fernando Alonso | 2 | 32 | |
| Sebastian Vettel | 4 | 53 | |

Scrape verifies numbers; Ergast career endpoints used as secondary check where available.

---

## 25. Pit Wall icon system

### 25.1 Philosophy

Icons communicate **category and status**, not decoration. One library, fixed sizes, consistent stroke.

**Library:** Lucide React (already in codebase) — **do not mix** Heroicons, Phosphor, or emoji.

### 25.2 Canonical size scale

| Token | px | Use |
|-------|-----|-----|
| `icon-xs` | 12 | Inline stat tiles, micro labels |
| `icon-sm` | 16 | Buttons, table actions, card title prefix |
| `icon-md` | 20 | Default card headers |
| `icon-lg` | 24 | PageHeader, empty states |
| `icon-xl` | 32 | F1EmptyState hero icon |

Wrapper: `<PitIcon icon={Trophy} size="sm" className="text-primary" />` — new thin component in `components/f1/PitIcon.tsx`.

### 25.3 Semantic icon map (use consistently app-wide)

| Domain | Icon | Lucide name |
|--------|------|-------------|
| Championship / WDC | Trophy | `Trophy` |
| Race win | Flag | `Flag` |
| Podium | Medal | `Medal` |
| Pole position | Zap | `Zap` |
| Fastest lap | Timer | `Timer` |
| Pit stop | Wrench | `Wrench` |
| Qualifying | Clock | `Clock` |
| Position gain | TrendingUp | `TrendingUp` |
| Position loss | TrendingDown | `TrendingDown` |
| DNF / error | AlertCircle | `AlertCircle` |
| Live session | Radio (pulse dot separate) | `Radio` |
| Telemetry | Gauge | `Gauge` |
| Weather | Cloud | `Cloud` |
| Calendar / GP | Calendar | `Calendar` |
| Standings table | ListOrdered | `ListOrdered` |
| Driver | User | `User` |
| Constructor | Factory | `Factory` |
| Circuit / track | MapPin | `MapPin` |
| Compare / Sankey | GitCompare | `GitCompare` |
| Search | Search | `Search` |
| External link (circuit **website** only) | ExternalLink | `ExternalLink` |
| Settings / profile | UserCircle | `UserCircle` |

**Forbidden:** emoji as icons, per-domain random icon colors (use `text-muted-foreground` + one `text-primary` accent max).

### 25.4 Session type colors (icons optional, color required)

| Session | Color token | Icon |
|---------|-------------|------|
| Race | `--primary` (F1 red) | `Flag` |
| Qualifying | `--status-warning` (amber) | `Clock` |
| Sprint | `#A855F7` (purple — session only, not brand) | `Zap` |
| Practice | `--status-upcoming` (blue) | `Gauge` |

### 25.5 Country flags — not emoji

**Always** use `CountryFlag` component (`react-country-flag` SVG mode).

**Remove / refactor:**
- `COUNTRY_EMOJIS` map in `countryUtils.ts`
- `getCountryFlag()` emoji returns in `teamUtils.ts`, `ThreeGlobeHandler.tsx`
- `CountryFlag.tsx` fallback `🏁` → Lucide `Flag` icon or neutral SVG chequered
- `RaceInfographic.tsx` emoji flag helper for html2canvas → SVG flags only
- `f1Service.ts` “add emojis” post-processing — **delete**

---

## 26. No-emoji & no-external-profile policy

### 26.1 Hard rules

1. **Zero emoji** in React UI, copy, buttons, dev titles, or fallbacks.
2. **Zero Wikipedia links** in user-facing UI (`Driver.url`, `Constructor.url` from Ergast).
3. **Circuit Wikipedia URLs** (`Circuit.url`) — replace with in-app circuit page when `/circuits` ships; until then, link only official circuit site if API provides non-wiki URL, else no link.
4. Third-party widgets (BuyMeACoffee) — use **text button** or image without emoji query param.

### 26.2 Files requiring emoji / wiki cleanup (R0 checklist)

| File | Issue | Fix |
|------|-------|-----|
| `countryUtils.ts` | Emoji map + `getRaceNameWithoutEmoji` | Keep strip helper; delete emoji map; races never store emoji |
| `teamUtils.ts` | Emoji location flags | Delete; use CountryFlag |
| `ThreeGlobeHandler.tsx` | Emoji in globe HTML labels | Flag SVG or text code |
| `CountryFlag.tsx` | `🏁` fallback | PitIcon Flag |
| `DriverStatsPanel.tsx` | Wikipedia link | `DriverCareerPanel` |
| `Constructors.tsx` | `Constructor.url` footer | `TeamHeritagePanel` |
| `Developers.tsx` | `🛠️` in title | Remove |
| `BuyMeCoffeeWidget.tsx` / `Signup.tsx` | `emoji=` param | Text-only widget |
| `f1Service.ts` | Emoji injection on races | Remove |
| `DataSourceBadge.tsx` | External vendor links | Delete component |

### 26.3 Race name handling

- API may return emoji-prefixed names from legacy processing — **strip at adapter boundary** once (`lib/f1/adapters` race normalizer).
- Display: `{CountryFlag} {Grand Prix Name}` — never embed emoji in strings.

---

## 27. Per-page redesign checklist

Use this table for QA sign-off. **Dashboard: presentation only.**

| Page | Layout/components | Visual | Data/entity | Remove |
|------|-------------------|--------|-------------|--------|
| **Dashboard** | Keep grid §16 | F1 red, PitIcon, team borders | Same hooks | PageSelector, emoji |
| **Calendar** | PageHeader, list default | Session color dots | Same schedule API | Emoji globe labels |
| **Race Analysis** | Essentials/Advanced | Underline tabs | Same charts | DataSourceBadge, Season Comparison tab |
| **Drivers** | DriverCard + Career | Portrait + team logo | + `f1_driver_career` | Wikipedia link |
| **Constructors** | Team cards | TeamLogo refresh | + `f1_constructor_career` | Wiki footer link |
| **Standings** (new) | Reuse `standings/*` | Pit Wall tables | Ergast standings | — |
| **Driver profile** (new) | PageHeader + career + season chart | Full bleed portrait | DB + API | External links |
| **Team profile** (new) | Logo hero + heritage | Team color header | DB + API | External links |
| **Infographic** | Export layout | SVG flags | Same data | Emoji flags |
| **Login/Signup** | pageShellNarrow | Solid card | — | Emoji coffee widget |
| **Profile** | PageHeader | F1Card | Supabase profile | — |
| **Developers** | Tool grid | No emoji title | — | — |
| **Privacy** | Narrow prose | Readable type | — | — |
| **Embed *** | Minimal chrome | Theme param | Same widgets | — |
| **404** | MainLayout + Empty | Recovery links | — | — |

---

## Document maintenance

- **Owner:** Design + frontend lead  
- **Update when:** New page routes, theme changes, grid changes (driver/team maps), or dashboard widget additions  
- **Related files:** `DESIGN_SYSTEM.md`, `.cursor/rules/001_f1datastop-design.mdc`, `REFACTOR_PLAN.md` Phase 11  
- **Entity scripts:** `scripts/sync-f1-*`, future `scripts/scrape-entity-careers.mjs`

---

*End of Design Master Plan v1.1*
