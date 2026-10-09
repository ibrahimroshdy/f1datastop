# f1datastop Design Language — DESIGN.md

The single, prescriptive design language for the f1datastop frontend. Quality bar: "35 top frontend engineers." If a choice is not described here, it does not ship. Reference implementations: `web/src/pages/Standings.tsx` and `web/src/pages/RaceCalendar.tsx`.

---

## 0. The One System (TL;DR)

A dark **"Pit Wall"** system: **deep-carbon** page (hue-shifted near-black ladder — bg `240 8% 3.5%` → card `6%` → muted `10%` → accent `14%` → border `15%`), a **single F1 brand-red accent** (`--primary` = `0 100% 44%`, the #E10600 family). **Clash Display** headings, **Geist** body, **Geist Mono** for timing/numbers. **All** color flows through HSL CSS-variable tokens in `web/src/index.css`, consumed via semantic Tailwind classes. Every page is `pageShell > (pageStack + animate-fade-in) > PageHeader`, then F1Card sections, with loading/empty/error routed through `F1Skeleton`/`F1EmptyState`/`F1ErrorState` and charts through `F1ChartContainer`.

**Three hard rules that catch 80% of violations:**
1. **Color = tokens only.** Never a Tailwind palette color (`bg-red-500`, `text-zinc-400`, `bg-yellow-500`, `text-purple-500`) and never raw hex/`#fff`. Inline hex is allowed **only** for dynamic per-team colors.
2. **Never use `f1-red`, `f1-black`, `f1-dark`, `f1-gray` Tailwind utilities.** `f1-red` currently maps to `#E10600` in `tailwind.config.ts` line 70 (the same red family as `--primary`) — an early Lovable-era poison once mapped it to purple `#9333ea`, so treat these legacy utilities as permanently banned regardless of their current value. Use `bg-primary`/`bg-background`/`bg-card` instead.
3. **Use the F1* component, not raw shadcn or hand markup.** PageHeader for titles, F1Card for cards, F1Badge/PositionBadge/StatusBadge for pills, F1Skeleton/F1EmptyState/F1ErrorState for states.

---

## 1. Color

All color is **HSL channel triples** in CSS variables across three theme classes in `index.css`: `:root` (default dark Pit Wall), `.light`, `.dark-glass`. `tailwind.config.ts` wraps each as `hsl(var(--x))`. **Use semantic token classes only.**

### 1.1 Core surface & text tokens

| Token | Class | Dark value (`:root`) | Use |
|---|---|---|---|
| background | `bg-background` / `text-foreground` | bg `0 0% 0%` (pure black), fg `0 0% 98%` | Page surface + primary text |
| card | `bg-card` / `text-card-foreground` | `0 0% 3%` | Card surfaces (one step above bg) |
| popover | `bg-popover` | `0 0% 3%` | Popovers, menus, tooltips |
| primary | `bg-primary` / `text-primary` / `border-primary` / `ring-primary` | `0 100% 44%` | **The ONE accent** — F1 brand red |
| primary-foreground | `text-primary-foreground` | `0 0% 98%` | Text/icons on a primary fill |
| secondary / muted | `bg-secondary` / `bg-muted` | `0 0% 12%` | Muted surfaces |
| muted-foreground | `text-muted-foreground` | `0 0% 70%` | **All** secondary/caption/label copy |
| accent | `bg-accent` | `0 0% 15%` | Hover/active surfaces |
| border / input | `border-border` / `border-input` | `0 0% 15%` | Hairlines (global `* { @apply border-border }`) |
| destructive | `bg-destructive` / `text-destructive` | `0 62.8% 30.6%` | Errors only |

### 1.2 Semantic scale tokens (prefer the F1Badge that wraps them)

| Token | CSS var | Use |
|---|---|---|
| `status-live` | `--status-live` `0 84% 60%` | Live session |
| `status-completed` | `--status-completed` `142 71% 45%` | Completed / positive / gain |
| `status-upcoming` | `--status-upcoming` `217 91% 60%` | Upcoming / neutral-info |
| `status-cancelled` | `--status-cancelled` `0 0% 50%` | Cancelled / inactive |
| `position-gold` | `--position-gold` `45 93% 47%` | P1 / podium gold |
| `position-silver` | `--position-silver` `0 0% 75%` | P2 |
| `position-bronze` | `--position-bronze` `30 60% 40%` | P3 |

Consume as `bg-status-completed` / `text-position-gold` (mapped in tailwind.config.ts) or `hsl(var(--position-gold))` inline for SVG/recharts.

### 1.3 Brand red — the ONLY way to reference it

Use `--primary` via `bg-primary`/`text-primary`/`border-primary`/`ring-primary`, or `hsl(var(--primary))` inline. The CSS var `--f1-red` (= `0 100% 44%`) is also correct. There is exactly **one** accent color in this product; it is red. Do not introduce blue/amber/green/purple as UI accents.

### 1.4 Team colors — the one sanctioned inline-hex

Dynamic per-team color is the **only** allowed raw-hex/inline-style usage. Always source it from `getTeamHexColor` / `TEAM_COLORS` / `DRIVER_COLORS` in `@/constants/f1Colors` — never a local hardcoded map, never a frozen Tailwind utility (`bg-ferrari`, etc.). Fallback for unknown teams = `TEAM_COLORS.default`, never `#666`/`#666666`/`#6b7280`. Apply as `style={{ backgroundColor }}`, `borderLeft: '3px solid ${teamColor}'`, or via F1 component props (`teamColor`, `accent='team'`).

### 1.5 POISONED / BANNED utilities (never use)

- `bg-f1-red` / `text-f1-red` / `border-f1-red` / `ring-f1-red` → legacy utilities (once poisoned to PURPLE `#9333ea`; now `#E10600`, same family as `--primary` — still banned). Use `primary`.
- `bg-f1-black` (#15151e), `bg-f1-dark`, `bg-f1-gray`, and literal hex like `#15151e` → use `background`/`card`/`muted`.
- Frozen team utilities `bg-redbull`/`bg-ferrari`/`bg-mclaren`/etc. → use `getTeamHexColor` inline.
- **Any** Tailwind palette color: `*-zinc-*`, `*-slate-*`, `*-gray-*`, `*-neutral-*`, `*-red-500`, `*-green-500`, `*-blue-500`, `*-yellow-500`, `*-amber-*`, `*-orange-*`, `*-purple-*`, `*-violet-*`, `*-emerald-*`, `*-indigo-*`, `*-sky-*`, `text-white`, `text-black`, `bg-white/X`, `bg-black/X`. → map to a semantic token below.

### 1.6 Palette → token migration map (memorize)

| Was (banned) | Use |
|---|---|
| `bg-f1-red`, `border-f1-red`, `ring-f1-red`, `bg-red-500/X`, `outline-red-500` | `bg-primary` / `border-primary` / `ring-primary` |
| `bg-f1-black`, `bg-neutral-950`, `bg-gray-900` | `bg-background` |
| `bg-gray-800`, `bg-zinc-900`, `bg-zinc-800`, `bg-slate-100`, `bg-white` (as surface) | `bg-card` or `bg-muted` |
| `bg-zinc-900/50`, `bg-zinc-50`, `bg-white/5`, `bg-muted/20` (surface) | `bg-muted/40` (or F1Card variant) |
| `text-white`, `text-gray-900` | `text-foreground` (or `text-primary-foreground` on a fill) |
| `text-gray-400/500/600`, `text-zinc-400/500`, `text-foreground/70` | `text-muted-foreground` |
| `border-gray-*`, `border-white/10`, `border-zinc-800` | `border-border` |
| `text-blue-500` (links, info) | `text-primary` |
| `text-green-500`, `text-emerald-500`, `#16a34a`, `#10b981` (positive/gain) | `text-status-completed` / `hsl(var(--status-completed))` |
| `text-red-500`, `#dc2626`, `#ef4444` (negative/DNF/loss) | `text-destructive` / `hsl(var(--destructive))` |
| `bg-yellow-500`, `text-yellow-500`, `border-l-yellow-500`, `#eab308` (gold/P1) | `bg-position-gold` / `text-position-gold` (or PositionBadge) |
| `bg-gray-300`, `border-l-gray-400` (silver/P2) | `position-silver` / PositionBadge |
| `bg-amber-600`, `border-l-amber-600`, `#f59e0b` (bronze/P3) | `position-bronze` / PositionBadge |
| `bg-purple-500`, `text-purple-500`, `bg-violet-500`, `text-amber-500` (dev/fastest-lap/triple-header/etc.) | `text-primary` (single accent) or a defined token |
| `#666`, `#666666`, `#6b7280` (team fallback) | `TEAM_COLORS.default` |

### 1.7 Categorical encodings (race-type, weather metrics, chart series)

Where genuinely distinct hues are needed to encode categories (race-type stripes, multi-metric weather charts, chart series), **define named CSS variables** in `index.css` (e.g. `--race-single`, `--race-double`, `--race-triple`, `--race-sprint`, or a `CHART_SERIES[]` constant) and reference those — never raw `bg-blue-500`/`bg-violet-500`. Keep the legend swatch and the chart stroke reading from the **same** source so they can't drift. The only sanctioned non-red hues are the categorical tokens `--fastest-lap` / `--gain` / `--loss` and `--position-gold` / `--position-silver` / `--position-bronze` (plus `--status-*` and `--weather-*` chart series) — everything else stays monochrome + the single red accent.

---

## 2. Typography

Two display fonts set in `index.css`, plus mono for numerics. (Loaded in `index.html`: Geist + Geist Mono via Google Fonts, Clash Display via Fontshare.)

- **Headings/display → Clash Display** via `.font-heading` (and all `h1`–`h6` get Clash Display + `letter-spacing: -0.015em` + `font-weight: 600` globally).
- **Body → Geist** (`body`, Tailwind `font-sans`).
- **Mono → Geist Mono** via `font-mono`, for timing/lap-time/numeric data. Utility `.timing` = `font-mono tabular-nums tracking-wide`.
- **Fallbacks only (never reference directly in new work):** Exo 2 (display fallback), Inter (body fallback, e.g. embeds), JetBrains Mono (data/chart fallback in the `font-mono` stack). Canonical is Clash Display / Geist / Geist Mono.

### 2.1 Canonical scale

| Role | Class | Where |
|---|---|---|
| Page title (h1) | `font-heading text-2xl font-bold tracking-tight md:text-3xl` | **PageHeader only** — never hand-roll |
| Eyebrow (above title) | `text-xs font-semibold uppercase tracking-widest text-primary` | PageHeader eyebrow |
| Page description | `text-sm text-muted-foreground` | PageHeader description |
| Card title | `text-lg font-bold` (Clash Display via global h-rule) | **F1CardTitle** — don't override size |
| Card description | F1CardDescription default | — |
| Stat numeral | `.stat-numeral` = `font-heading text-2xl font-bold tabular-nums tracking-tight` | Big numbers |
| Body small / caption | `.body-sm` = `text-sm leading-relaxed text-muted-foreground` | Secondary copy |

### 2.2 Rules

- **Body copy never goes below `text-xs`.** `text-2xs` (0.625rem) is sanctioned **only** for micro eyebrows/badges/timing metadata (instrument labels, counts, lap pills) — never arbitrary `text-[10px]`, `text-[9px]`, `text-[8px]`, `text-[11px]`; use `text-2xs` or `text-xs`.
- **All numbers are `tabular-nums`** (points, positions, percentages, counts).
- **Timing/lap/gap/interval data uses `font-mono` (`.timing`).**
- Responsive bump convention: base mobile size, `md:` one step up (`text-2xl md:text-3xl`).
- **Do not** `!important`-override F1CardTitle (`!text-xl`, `!text-sm`, `text-base font-semibold`). If you need a smaller title, pass F1Card `size='sm'` so the scale flows from context.
- Section labels are **eyebrows** (`text-xs font-semibold uppercase tracking-widest text-muted-foreground/text-primary`) or **F1CardTitle** — never a hand-rolled `<h2>`/`<h3>`/`<h4>` with bespoke sizing.
- Metadata separators use `•` (middot), not `|`. Affordance arrows use lucide icons (`ArrowRight`/`ChevronRight`), not `→`.

---

## 3. Spacing & Layout

The page shell + stack utilities in `web/src/lib/layout.ts` are **mandatory**.

### 3.1 The page wrapper (non-negotiable structure)

```tsx
<div className={pageShell}>                         {/* outer */}
  <div className={cn(pageStack, 'animate-fade-in')}> {/* inner */}
    <PageHeader eyebrow="…" title="…" description="…" />
    {/* F1Card sections … */}
  </div>
</div>
```

- `pageShell` = `mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-4 py-6 md:px-6 md:py-8 2xl:px-10` (variants: `pageShellWide` max-w-[1400px], `pageShellNarrow` max-w-lg).
- `pageStack` = `flex flex-col gap-6` (`pageStackTight` = gap-4). Vertical section rhythm is **gap-6**.
- The inner stack **always** carries `animate-fade-in`. The shell and stack are **two separate divs** — don't merge them or duplicate padding (`pageShellNarrow` already supplies px/py; don't add `py-6` on top).
- First stack child is **always** `<PageHeader/>`.

### 3.2 Card padding (driven by context, never hardcoded)

F1Card padding flows from its `size` prop via React context: `sm`=p-3, default=p-4, `lg`=p-6, `xl`=p-8. **Do not** set `p-0` on F1Card and then hand-pad F1CardHeader/F1CardContent. If you need a flush chart/media region, pass `size` and let the content region own its edge-to-edge area — don't bypass the size system.

### 3.3 Inline & grid spacing

- Inline row gaps: `gap-2` / `gap-3`.
- Vertical rhythm: use flex `gap-6`/`gap-4` (matching pageStack), **not** `space-y-6`/`space-y-4` and **not** `mb-*`/`mt-8` magic margins on stack children — the parent gap owns spacing.
- Grids: Tailwind responsive col counts. Custom `xs` breakpoint = 480px available.
- Container cap = 1600px on 2xl via `pageShell` (`max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px]`). Don't introduce one-off max-widths; use `pageShell` or `pageShellWide`.

### 3.4 Tabs — underline pattern only

Tabs are **underline**, never pills/boxed: `TabsList` = `border-b border-border bg-transparent`; trigger = `rounded-none border-b-2 border-transparent`, active = `border-primary`, transparent bg. See Standings `underlineTabTrigger`. Never `rounded-full`/grid-boxed/`bg-muted` pill tabs.

### 3.5 Mobile

Respect PWA safe-area insets on fixed/floating elements (`env(safe-area-inset-*)` / the project safe-area utilities).

---

## 4. Radii, Shadows, Motion, Glass

### 4.1 Radius (token-driven)

`--radius = 0.5rem`. Tailwind: `rounded-lg`=var(--radius), `rounded-md`=−2px, `rounded-sm`=−4px, `rounded-xl`=+4px, `rounded-2xl`=+8px. F1Card root = `rounded-xl overflow-hidden`. Use the `rounded-*` scale; never arbitrary radii.

### 4.2 Shadows (tokenized)

`shadow-premium-sm/md/lg/xl`, `shadow-glow`, `shadow-glow-lg`, `shadow-glass/-lg`. Default card elevation = `shadow-sm`; hover lifts to `shadow-lg` (`hover:-translate-y-1`) or `shadow-glow`. **The red glow (`shadow-glow`) is reserved for primary/interactive emphasis** — don't sprinkle it. Never arbitrary box-shadows or raw `shadow-md`; use the scale (a hairline `border-b border-border` is preferred over a 1px box-shadow).

### 4.3 Motion

Tokenized durations: `transition-fast` 150ms, `transition-normal` 250ms, `transition-slow` 400ms, easing `cubic-bezier(0.4,0,0.2,1)`. F1Card uses `transition-all duration-300`. Standard page entrance = `animate-fade-in` on the stack; lists may use `stagger-children`/`animate-slide-up`. For framer-motion color animations, use `hsl(var(--status-*))`, not raw `rgba(34,197,94,…)`.

### 4.4 Glass mode (the one correct way)

`.dark-glass` / F1Card `variant='glass'` swap solid card bg for backdrop-blur glass utilities (`.glass`, `.glass-glow`, `.glass-panel`) driven by `--glass-*` vars. **Read `isGlass`/`cardVariant`/`glassVariant` from `useThemeVariant()` and pass `variant`/`glassVariant` to F1Card.** Do **not** hand-branch `isGlass ? 'bg-white/5 border-white/10' : 'bg-muted/50'` with raw white/black-alpha literals, and do **not** derive a manual `isDark` from theme to pick `bg-zinc-900 vs bg-zinc-50` — semantic tokens already adapt across all three themes, so a single `bg-card`/`bg-muted` is correct in every mode. Do **not** force `bg-card`/`border-border` in className on an F1Card (it defeats glass mode).

---

## 5. Component Catalog (use these, not raw shadcn or hand markup)

Canonical wrappers live in `web/src/components/f1` (barrel `components/f1/index.ts`).

| Component | When to use | Don't |
|---|---|---|
| **PageHeader** | Top of **every** page: eyebrow / title / description / actions. | Hand-roll an `<h1>`. |
| **F1Card** + F1CardHeader/Title/Description/Content/Footer | The ONE card primitive. Drive look via props: `variant` (default/gradient/glass/team-accent), `glassVariant`, `size` (sm/default/lg/xl), `hover` (false/true/lift/glow), `accent` (none/red/team/top), `teamColor`, `interactive`, `loading`. | Raw `<Card>`; hardcoded padding/border/shadow; `p-0`+manual padding; manual team border (`border-t-[3px]`, inline `borderTopWidth`) — use `accent='top'/'team'`. |
| **F1Badge** + PositionBadge / StatusBadge | All pills: position (P1/P2/P3 gold/silver/bronze + Trophy/Medal), status (completed/upcoming/live/cancelled/delayed, live pulses), team (teamColor + alpha), points (red ` PTS`), time (mono). | Raw `<Badge>` or bespoke colored spans; rendering bare position/points numbers. |
| **F1Avatar** + DriverAvatar / TeamAvatar | Driver/team images with team-color ring, size xs–xl, optional driverNumber badge. | Raw `<Avatar>` + manual ring/bg. |
| **F1Progress** + PointsProgress / ComparisonProgress | Points/comparison bars (teamColor/gradient/tabular labels). | Raw `<Progress>` with manual `indicatorClassName`; hand-built `div` track + inline-width fill. |
| **F1Skeleton** (+ StandingsSkeleton, DriverCardSkeleton, ChartSkeleton) | All loading. | Raw `<Skeleton>` tables; custom spinners (`animate-spin`, `Loader2` blocks). |
| **F1EmptyState** (+ SeasonStartEmpty, NoRaceResultsEmpty, NoChartDataEmpty, LoadingFailedEmpty, ComingSoonEmpty) | All empty/not-found states (incl. 404). | Hand-rolled "No data" centered divs. |
| **F1ErrorState** (+ NetworkError, ServerError, RateLimitError, DataLoadError) | All errors, with `onRetry`, `variant` inline/card/fullscreen. | Raw `<Alert variant="destructive">`. |
| **F1ChartContainer** | Wrap **every** chart; handles isLoading/error/isEmpty/minHeight → ChartSkeleton / F1ErrorState / F1EmptyState. | Raw ChartContainer + hand-rolled loading/empty; ad-hoc tooltips (reuse F1ChartTooltip). |
| **SessionSelector** | Standard session/race `<Select>`. | Bespoke clickable-Badge pickers. |
| **PitIcon** | Brand icon. | — |

Iconography: **lucide-react** icons (accent ones `text-primary`), **react-country-flag** SVG flags. **Never emoji** as icons/flags, never inline `<svg>` for stock glyphs (use lucide `<Check/>` etc.).

---

## 6. Do / Don't

**DO**
```tsx
<div className={pageShell}>
  <div className={cn(pageStack, 'animate-fade-in')}>
    <PageHeader eyebrow={`${year} Season`} title="Standings" description="Driver and constructor championship" />
    <F1Card variant={cardVariant} glassVariant={glassVariant} size="default">
      <F1CardHeader><F1CardTitle icon={<Trophy className="h-5 w-5" />}>Drivers</F1CardTitle></F1CardHeader>
      <F1CardContent>
        <PositionBadge position={Number(d.position)} />
        <span className="text-right font-bold tabular-nums">{d.points}</span>
      </F1CardContent>
    </F1Card>
  </div>
</div>
```

**DON'T**
```tsx
<div className="max-w-7xl mx-auto p-6 space-y-6">            {/* ad-hoc shell, no animate-fade-in */}
  <h1 className="text-2xl font-bold tracking-tight">Standings</h1>  {/* hand-rolled h1, not Clash Display */}
  <Card className="border-border bg-card p-0">              {/* raw Card, forces bg-card, kills glass */}
    <h3 className="font-semibold text-sm">Drivers</h3>      {/* hand-rolled title */}
    <Badge className="bg-yellow-500 text-black">P1</Badge>  {/* palette, not PositionBadge */}
    <Badge className="bg-f1-red text-white">LIVE</Badge>    {/* PURPLE bug + text-white */}
    <span className="font-bold">{d.points}</span>           {/* no tabular-nums */}
  </Card>
</div>
```

---

## 7. Enforcement Checklist (PR-blocking)

Color
- [ ] No Tailwind palette colors (`-zinc/slate/gray/neutral/red-500/green-500/blue-500/yellow-500/amber/orange/purple/violet/emerald/indigo/sky`, `text-white`, `text-black`, `bg-white/X`, `bg-black/X`).
- [ ] No `f1-red`/`f1-black`/`f1-dark`/`f1-gray` utilities; no raw hex except dynamic team color.
- [ ] No frozen team utilities (`bg-ferrari` etc.); team color comes from `getTeamHexColor`/`TEAM_COLORS`, fallback `TEAM_COLORS.default`.
- [ ] Brand red only via `primary`; the single accent is red — no blue/amber/green/purple UI accents.
- [ ] Positions/status use `position-*`/`status-*` tokens (or the F1Badge that wraps them).

Theme
- [ ] No manual `isDark`/`isGlass` color branching; one `bg-card`/`bg-muted` token used in all themes.
- [ ] Glass via `useThemeVariant()` → F1Card `variant`/`glassVariant`, not hand-branched white-alpha.

Components
- [ ] Page title is `PageHeader` (with eyebrow); section titles are `F1CardTitle` or eyebrow — no hand-rolled h1/h2/h3/h4.
- [ ] Cards are `F1Card` (+ subcomponents); padding via `size`, no `p-0`+manual padding; team accent via `accent` prop.
- [ ] Pills are F1Badge/PositionBadge/StatusBadge; avatars F1Avatar; bars F1Progress.
- [ ] Loading → F1Skeleton; empty → F1EmptyState; error → F1ErrorState; every chart wrapped in F1ChartContainer.
- [ ] No duplicate teamColors maps — import `TEAM_COLORS` from `@/constants/f1Colors`.

Typography
- [ ] Headings Clash Display (`font-heading`) + `tracking-tight`; no `!important` size overrides on F1CardTitle.
- [ ] Numbers `tabular-nums`; timing/lap data `font-mono` (`.timing`).
- [ ] Body copy never below `text-xs`; `text-2xs` only for micro eyebrows/badges/timing metadata; no arbitrary `text-[10px]` etc.

Layout & motion
- [ ] `pageShell` > (`pageStack` + `animate-fade-in`) > `PageHeader`; no ad-hoc max-width/padding, no `space-y-*`/magic margins on stack children.
- [ ] Tabs are underline (`border-b-2`, active `border-primary`), not pills.
- [ ] Radii from `rounded-*` scale; shadows from `shadow-premium-*`/`shadow-glow`; `shadow-glow` reserved for primary emphasis.

Iconography & hygiene
- [ ] lucide icons + react-country-flag SVG; no emoji, no inline stock `<svg>`, no `→`/`|` glyphs.
- [ ] No leftover `console.log`; no dead/duplicate components shipped.
