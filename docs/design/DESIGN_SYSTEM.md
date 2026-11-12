# F1 DataStop design system

The rules and building blocks of the F1 DataStop web app and installed PWA, as shipped in
**v1.8.0** (PR #120) and **v1.8.1** (PR #121). Read this before changing any screen. It is written
for people and for coding agents.

**Direction: Floodlight Livery.** Carbon near-blacks, one red (`#E10600`), titles in
condensed capitals, solid floating bars, and a coloured livery stripe on a page's lead card.

## 0. How to use this document

- **Use what exists.** Every value here is already a token, utility or component in `web/`. Do
  not add a new colour, font, radius or shadow; use the token. If something is truly missing, add
  a token to `web/src/index.css` and a numbered row to [`decisions.md`](decisions.md).
- **Sources of truth, in order:**
  1. Code: `web/src/index.css` (tokens), `web/src/components/f1/` and `web/src/components/ui/`
     (components), `web/src/lib/links.ts` (addresses), `web/src/constants/` (data colours).
  2. [`decisions.md`](decisions.md): why each choice was made (D1 to D42). This guide cites them.
  3. This file, which summarises 1 and 2.
- **Older documents are superseded where they disagree.** `web/DESIGN.md` and
  `web/DESIGN_TERMINAL.md` predate this release and carry a note saying so. They describe Clash
  Display and Geist type and glass surfaces, which are gone. Follow this file.
- **Taste is already decided.** Direction, logo, names and taglines are settled in
  [`decisions.md`](decisions.md). Do not invent a new look; work inside this one.

## 1. What changed in this release

| Area | Before | Now | Decision |
|---|---|---|---|
| Fonts | Clash Display, Geist, Geist Mono | **Saira Condensed** (titles), **Saira** (UI), **JetBrains Mono** (figures) | D17, D37 |
| Red | Three different reds | One red, `#E10600`, in every theme | D12 |
| Text on dark | Grey text on black | Brightened secondary text: `#D2D3DA` (ink-2) and `#ABACB5` (muted) | D12 |
| New colour roles | none | `raised`, `ink-2`, `heading`, `figure`, `act`, `on-act`, `hold` | D37 |
| Surfaces | Glass, blur, glows | Solid surfaces only; no backdrop blur | D7 |
| Shell | Bottom nav, fixed sidebar | Mondar-style floating shell: header pill and dock on a phone; floating sidebar and top bar from 768 px; one scroller | D7, D37 |
| Cards | Lift on hover, mixed radii | `F1Card` solid, 20 px round, 0.97 press, optional livery stripe | D38 |
| Tabs and segmented controls | Scrolling, truncated | One pill track with a sliding red pill; wraps instead of scrolling | D38 |
| Tyres | Two colour sets | One Pirelli set in `constants/tyres.ts`, one `TyreIcon` | D16, D38 |
| Drivers | Names only | Face (headshot, team-colour ring), flag, team with its emblem | D26, D33, D34 |
| Races | "R1", "Round 21" | Flag plus Grand Prix name | D15 |
| Links | Many dead ends | Every driver, team, Grand Prix and circuit name is a link, built in `lib/links.ts` | D19, D40 |
| Season | Per-page year state | One `?season=` in the URL, kept across pages | D21 |
| Race pop-up | Dialog with no address | Quick look at `?race=YYYY-R`; Back closes it | D30 |
| Grand Prix | Race Analysis only | `/race-analysis/:year/:round` is the Grand Prix page, opening on the latest race | D20, D24, D40 |
| Lists | No search or filters | URL-backed search, filters, grouping, pages | D8, D40 |
| Home | Many cards, season Sankey | Compact cards and the race Sankey only | D29, D42 |
| Sankey tooltip | Text only | Face, flag, team emblem and name | D42 |
| Brand assets | Old fonts | Share image, social preview, README hero and docs site re-rendered in the new type | D41 |

## 2. Brand

- **Name:** F1 DataStop.
- **Logo:** `logo.svg`, the rear wing on a red disc, **unchanged** (D28). It is the only F1
  DataStop mark. Never redraw it, recolour it or add another mark.
- **Team emblems are not brand marks.** They always stay (D33, D36).
- **Brand red** `#E10600` is for the logo, the active ("act") state and focus rings. It is **never**
  a chart series, a row fill or a data colour (D4).
- **Theme colour** (manifest and `<meta name="theme-color">`): `#08080A` dark, `#F5F5F7` light.
- **Licence:** MIT. Every page renders anonymously; there is no login.

## 3. Colour tokens

Tokens are HSL triplets in `web/src/index.css` (`:root` = dark, the default; `.light`). Tailwind
exposes each one as a colour, for example `bg-raised`, `text-ink-2`, `text-figure`, `bg-act`.
Always use the class or `hsl(var(--token))`, never the hex value. The hex values below are only for
reference.

### 3.1 Surfaces (the Deep Carbon ladder)

| Token | Tailwind | Dark | Light | Use |
|---|---|---|---|---|
| `--background` | `bg-background` | `#08080A` | `#F5F5F7` | The page |
| `--card` | `bg-card` | `#0F0F12` | `#FFFFFF` | Cards (`F1Card`) |
| `--raised` | `bg-raised` | `#17171B` | `#FFFFFF` | Floating bars, dialogs, sheets, popovers, chart tooltips |
| `--popover` | `bg-popover` | `#17171B` | `#FFFFFF` | Radix popovers and menus |
| `--muted` / `--secondary` | `bg-muted` | `#1C1C21` | `#EEEEF1` | Pill tracks, quiet fills |
| `--accent` | `bg-accent` | `#222228` | `#E7E7EB` | Hover fill |
| `--border` / `--input` | `border-border` | `#2A2A30` | `#DEDEE3` | Hairlines, every edge |

### 3.2 Text

| Token | Tailwind | Dark | Light | Use |
|---|---|---|---|---|
| `--foreground` | `text-foreground` | `#F3F4F7` | `#0A0A0F` | Body text |
| `--heading` | `text-heading` | `#FFE9E7` | `#4A0703` | h1 to h3, names that lead a row; a faint red tint |
| `--figure` | `text-figure` | `#FFFFFF` | `#0A0A0F` | Numbers: points, times, gaps |
| `--ink-2` | `text-ink-2` | `#D2D3DA` | `#44444E` | Secondary text, inactive nav and tabs |
| `--muted-foreground` | `text-muted-foreground` | `#ABACB5` | `#5D5D69` | Labels, notes, the quietest text |

Every text role holds at least 4.5:1 contrast on its card in both themes (D4, D12). Never set text
greyer than `muted-foreground` on a dark surface.

### 3.3 Action

| Token | Tailwind | Value | Use |
|---|---|---|---|
| `--primary` | `bg-primary`, `text-primary` | `#E10600` | Brand red: links' hover accents, the livery stripe default |
| `--act` | `bg-act` | `#E10600` | The selected state: active dock tab, active tab, sliding pill |
| `--on-act` | `text-on-act` | `#FFFFFF` | Text and icons on `act` (5.0:1) |
| `--ring` | `ring-ring` | `#E10600` | Focus ring (2 px, offset 2 px) |
| `--destructive` | `bg-destructive` | dark `hsl(0 62.8% 30.6%)`, light `hsl(0 84.2% 60.2%)` | Destructive buttons only |

### 3.4 Data colours (never change, never replaced by brand red)

| Meaning | Token or source | Dark | Light |
|---|---|---|---|
| Fastest (lap, sector) | `--fastest-lap`, `timing-best` utility | `#B063F8` purple | `#9234EA` |
| Places gained | `--gain` | `#21C45D` | `#1EAE53` |
| Places lost | `--loss` | `#EF4D4D` | `#ED2C2C` |
| Held position | `--hold` | `#5D5D69` | `#ABABB5` |
| P1 / P2 / P3 | `--position-gold/silver/bronze` | `#E7B008` / `#BFBFBF` / `#A36629` | `#E7B008` / `#8C8C8C` / `#8F5924` |
| Live / completed / upcoming / cancelled | `--status-*` | see `index.css` | see `index.css` |
| Team colours | `TEAM_COLORS`, `getTeamColorById()` in `web/src/constants/f1Colors.ts` | one per team | same |
| Tyre compounds | `TYRE_COLORS` in `web/src/constants/tyres.ts` | see 3.5 | same |

**Team colours come only from `f1Colors.ts`.** Do not hard-code a team hex in a component. The
`--color-mercedes`, `--color-ferrari` and other team entries in the `@theme` block are older
values; do not use them for new work.

### 3.5 Tyres (one set, D16)

| Compound | Letter | Colour |
|---|---|---|
| Soft | S | `#DA291C` |
| Medium | M | `#FFD12E` |
| Hard | H | `#F0F0EC` |
| Intermediate | I | `#43B02A` |
| Wet | W | `#2F8CFF` |

Use `tyreCode()`, `tyreColor()` and `TyreIcon`. A test keeps this set equal to the social cards'
set in `analysis/social/session_results/session_results.py`. An unknown compound shows nothing;
never guess one.

## 4. Typography

Loaded from Google Fonts in `web/index.html`: Saira 400 to 700, Saira Condensed 600 to 800,
JetBrains Mono 400 to 700.

| Role | Family | Token / class | Rules |
|---|---|---|---|
| Display: page titles, card titles, h1 to h3 | **Saira Condensed** | `--font-display`, `font-heading` | Bold 700, **UPPERCASE**, `text-heading` colour, letter-spacing 0.005em. Applied automatically to `h1` to `h3`. |
| UI: everything else | **Saira** | `--font-sans`, `font-sans` | Sentence case. |
| Figures: times, gaps, positions, points, laps | **JetBrains Mono** | `--font-mono`, `font-mono`, `timing`, `readout`, `stat-numeral` | Always `tabular-nums`. |

**Sizes**

| Use | Size |
|---|---|
| Page title (`PageHeader` h1) | `text-3xl`, `md:text-4xl`, `leading-none` |
| Header pill title | 21 px; top bar title 26 px from 768 px |
| Body | `text-sm` to `text-base` |
| Label above a value (`instrument-label`) | 13 px, medium, `text-muted-foreground`, **sentence case** |
| Secondary line under a name | 13 px |
| Table head | `text-xs`, semibold, `text-muted-foreground` |
| Chart ticks | 11 px mono |
| Minimum on a phone | **12 px.** Nothing smaller. |

**Rules**
- No tracked or all-caps labels outside titles. Eyebrows and labels are sentence case.
- Exactly one `<h1>` per page.
- Names wrap; **nothing is truncated on a phone** (no `truncate`, no `line-clamp` on names).

## 5. Shape, elevation, spacing

**Radius**

| Thing | Radius |
|---|---|
| Card (`F1Card`) | 20 px (`rounded-[20px]`) |
| Phone sheet, dialog and drawer | 28 px; dialog on `sm+` 24 px |
| Desktop top bar | 22 px; sidebar 24 px; dock 26 px; More panel 24 px |
| Header pill, pills, tabs, dock tab, avatar | full (`rounded-full`) |
| Pill track (tabs, ViewSwitcher) | 22 px |
| Chart tooltip | 14 px |
| Base `--radius` (shadcn `rounded-lg`) | 0.875 rem (14 px) |
| Flag | 3 px, with a hairline (D15) |

**Elevation.** Solid only. Floating bars use `bg-raised` plus
`box-shadow: 0 0 0 1px border, 0 12px 32px rgb(0 0 0 / 0.55)` (light: `0 10px 28px rgb(0 0 0 / 0.12)`).
Cards use a hairline border, not a shadow. **No `backdrop-blur`, no see-through surfaces, no red glow.**

**Spacing.** Tailwind's 4 px scale. Page stacks: `pageStack` (`gap-6`) and `pageStackTight`
(`gap-4`) from `web/src/lib/layout.ts`.

**Page width.** Always wrap page content in `pageShell` from `web/src/lib/layout.ts`:
`max-w-6xl`, then `xl:max-w-7xl`, then `2xl:max-w-[1600px]`. Forms use `pageShellNarrow`. Do not add
ad-hoc `max-w-*` on data pages.

## 6. Motion

| Token / class | Value | Use |
|---|---|---|
| `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` | Anything that travels: sheets (open 420 ms, close 300 ms), the sliding pill (300 ms), the More panel |
| `--ease-pop` | `cubic-bezier(0.22, 1, 0.36, 1)` | Presses and page transitions |
| `.press` | `scale(0.97)` on `:active`, 160 ms | Every tappable card, tab and nav item |
| View Transitions | 220 ms crossfade | Every nav `Link` passes `viewTransition`; the bars hold still (`view-transition-name: shell-top / shell-side / shell-dock`) |

`prefers-reduced-motion` turns off the press, the slide and the page transitions. No hover lifts,
no bouncing, no pulsing decoration.

## 7. The shell (D7, D37)

One layout, `web/src/components/layout/MainLayout.tsx`, at every width. Floating solid bars sit
over **one scroller**, `#main-content` (`.shell-scroll`), which pads its content clear of them.

**Phone (< 768 px)**
- **Header pill** (`TopBar.tsx`, `.shell-top`): 56 px tall (`--pill-h`), 12 px from the edges, below
  the safe area. It holds the back button on detail pages, the page title and the season pill.
- **Dock** (`Dock.tsx`, `.shell-dock`): 66 px tall (`--dock-h`), 16 px from the edges. Tabs:
  **Home, Races, Standings, Drivers, More.** Every tab has the same footprint. The active tab is a
  filled `bg-act text-on-act` capsule; the others are `text-ink-2`. Icons 22 px.
- **More panel** (`MorePanel.tsx`, `.shell-more`): a solid card rising above the dock with
  **Teams, Race analysis, Pit Wall, Docs, Privacy.**
- **Dock scrim**: content fades into the background under the dock.

**Tablet and desktop (≥ 768 px)**
- **Floating sidebar** (`Sidebar.tsx`, `.shell-side`): a 72 px icon rail up to 1023 px; a 232 px
  column from 1024 px that folds to the rail with **⌘\\**. Items: Home, Races, Standings, Drivers,
  Teams, Race analysis, Pit Wall; then Docs and Privacy.
- **Floating top bar**: 64 px, 22 px round, with the title, back button, season pill and next race.
- The dock, scrim and More panel are hidden.

Navigation lives in `web/src/config/navigation.ts` (`navGroups`, `dockItems`, `moreItems`,
`isNavActive`, `routeTitle`). Change navigation there, not in the components.

## 8. Addresses and connections (D19 to D24, D30, D40)

**Every driver, team, Grand Prix and circuit name is a link.** Build every address with
`web/src/lib/links.ts`; never write a path by hand.

| Function | Address |
|---|---|
| `driverHref(driverId, season)` | `/drivers/:driverId` |
| `teamHref(constructorId, season)` | `/teams/:constructorId` |
| `circuitHref(circuitId)` | `/circuits/:circuitId` |
| `raceHref(season, round, tab?, session?)` | `/race-analysis/:season/:round?tab=&session=`, the Grand Prix page |
| `quickLookValue(season, round)` with `QUICK_LOOK_PARAM` | `?race=2026-21` on the current page |

- **Season.** Read and set it with `useSeason()` (`web/src/hooks/useSeason.ts`). It lives in
  `?season=`, omitted for the current season; older `?year=` links still work. Pages never keep
  their own year state. Seasons start in 2018.
- **Quick look.** Tapping a race anywhere opens the quick look (`components/calendar/QuickLook.tsx`,
  mounted once in `MainLayout`). Open it with `useOpenQuickLook()`. It is a sheet on a phone and a
  dialog on a desktop, opens on results for a finished race, and has **Open Grand Prix** in its
  footer. Back closes it.
- **Entries land on now.** Races, the Grand Prix page and the Pit Wall open on the next or latest
  race, never on round 1 or an empty state.
- **No content behind a dialog without a URL.** Sheets and dialogs are for pickers, filters,
  confirmations and the quick look.
- Every page renders anonymously.

## 9. Components

Import F1 components from `@/components/f1`. shadcn primitives live in `web/src/components/ui/`.

### 9.1 Surfaces

**`F1Card`** (`F1Card.tsx`), and `F1CardHeader`, `F1CardTitle`, `F1CardDescription`,
`F1CardContent`, `F1CardFooter`
- Solid `bg-card`, 1 px border, 20 px radius.
- `hover` gives the 0.97 press and a faint red border on hover; there is no lift.
- `livery` adds the stripe (see `F1Livery`).
- `accent` (`red`, `team`, `top`) draws a 4 px edge.
- The `glass` variants exist only for the Cockpit theme (see 13). Do not use them.

**`F1Livery`** (`F1Livery.tsx`): a diagonal band and a thinner trail across the top-right corner
of **a page's one lead card**.
- **Colour only.** F1 DataStop red by default; the team colour on team and driver pages.
- No numbers, no flags, no text (D25).
- Never on list rows. It is `aria-hidden`, so the card's text carries the meaning.

**Dialog, Sheet, Drawer** (`ui/dialog.tsx`, `ui/sheet.tsx`, `ui/drawer.tsx`)
- Opaque `bg-raised`, 1 px border.
- **Phone:** inset 8 px from the edges, 28 px round, rising from the bottom with the drawer curve,
  `max-h-[90dvh]`, safe-area padding. The drawer has a 40 × 5 px grab handle.
- **sm+:** the dialog is a centred card, 24 px round.
- Close buttons are 44 × 44 px.
- The overlay is `bg-black/50`. No blur.

### 9.2 Navigation controls

**`Tabs`** (`ui/tabs.tsx`) and **`ViewSwitcher`** (`ui/view-switcher.tsx`)
- One pill track: `bg-muted`, a 1 px border ring, 22 px radius, 4 px padding.
- The active item is a red `bg-act` pill that **slides** between items (`SlidingPill`, which sets
  `data-pill="ready"`).
- Triggers are at least 36 px tall, `text-sm`, with the press.
- The track **wraps**; it never scrolls sideways or truncates.
- Use these for every segmented choice.

**`SeasonPill`** (`layout/SeasonPill.tsx`): the season picker in the bars. It is built on the
app's own `Select`, never a native `<select>`.

**`PageHeader`** (`PageHeader.tsx`)
- Props: `eyebrow` (sentence case, `text-sm`, muted), `title` (the page's `<h1>`), `description`,
  `actions`.

### 9.3 Identity (drivers, teams, races)

**`DriverIdentity`** (`DriverIdentity.tsx`): the one way to show a driver in a row.
- **First line:** the face, ringed in the team colour, then the name as a link (`text-heading`,
  semibold).
- **Second line:** at 13 px, the **nationality flag**, then the **team emblem and name** as a link.
- `size`: 28, 32, 40 (the default), 56 or 72.
- `compact` shows the surname only, for summary cards.
- `extra` adds a note to the second line.
- **Never write the country name.** The flag carries it (D34).

**`F1Avatar`** (`F1Avatar.tsx`)
- A round headshot. `size`: `xs` 24, `sm` 32, `md` 40, `lg` 56, `xl` 80 px.
- `teamColor` with `showRing` gives a ring in the team colour with no offset.
- Shows initials when there is no headshot.
- Headshots come from `buildF1DriverHeadshotUrl(getF1PortraitPathForErgastDriverId(driverId))`
  (`constants/f1DriverPortraitMedia.ts`).

**`TeamName`** (`TeamName.tsx`): the team's emblem, then its name.
- `size` is the emblem height: 13 to 16 px in rows, 26 px on a team header.
- Pass `to={teamHref(...)}` to make it a link.
- The emblem is the white `logowhite` file, **inverted on the light theme**.
- **A team is never shown without its emblem, and never by its emblem alone** (D33).

**`CountryFlag`** (`components/common/CountryFlag.tsx`): `country` (a nationality or country
name) and `size` (the width in px: 14 under names, 20 by default). It renders `react-country-flag`
SVGs at 4:3, 3 px round, with a hairline in `--border` so white flags hold on white (D15). An
unknown country shows a muted flag icon, never a guessed flag.

**A race** is always its **flag and Grand Prix name** ("Las Vegas Grand Prix"). Never "R21" or
"Round 21" in titles, rows or pickers (D15). A finished race in a list shows **the winner's face**
as a link to their page, labelled "Won by …" for screen readers, instead of words (D34).

### 9.4 Data display

**`TyreIcon`** (`TyreIcon.tsx`)
- A black tyre, the compound's band near the rim, and the letter in the band's colour. One drawing
  from 16 to 48 px.
- `compound`, `size` (20 by default), optional `age` in laps.
- It has an accessible label, for example "Soft tyre, 12 laps old".

**`CompactRow`** (`components/dashboard/CompactRow.tsx`): the one summary-card row (D29).
- **Left to right:** the position; who (usually `DriverIdentity compact size={32}`); one figure at
  the end in mono `text-figure`, with an optional note under it.
- Every row is at least 56 px tall. Nothing wraps to three lines.

**`Table`** (`ui/table.tsx`)
- Heads are 40 px, `text-xs`, semibold, muted.
- Cells are `px-3 py-2.5`. Rows have hairlines and `hover:bg-muted/40`.

**`F1Badge`, `PositionBadge`, `StatusBadge`** (`F1Badge.tsx`): status and position badges using
the status and position tokens.

**Utilities** in `index.css`:
- `timing` (mono, tabular), `timing-best` (purple), `readout`, `stat-numeral`.
- `instrument-label` (a label above a value), `hairline-grid` (hairlines between rows), `data-row`,
  `position-pill`.

### 9.5 States

| Component | Use |
|---|---|
| `F1Skeleton` (`variant`: text, circular, rectangular, card, chart, table-row, avatar, badge), plus `StandingsSkeleton`, `DriverCardSkeleton`, `ChartSkeleton` | Loading. Match the final layout's shape. |
| `F1EmptyState` (`type`, `title`, `description`, `actionText` / `onAction`) | No data. A solid circle with an icon; no decorative rings or blur. Copy is plain and factual. |
| `F1ErrorState` (`type`, `variant` inline / card / fullscreen, `onRetry`) | Errors, always with a retry. |
| `F1ChartContainer` (`isLoading`, `error`, `isEmpty`, `minHeight`) | Wraps **every** chart and gives it its loading, error and empty states. |

## 10. Charts (D32, D39, D42)

- **Every chart sits inside `F1ChartContainer`** and takes its styling from `chartTheme`
  (`web/src/lib/chartTheme.tsx`). Recharts or D3 only.
- **`chartTheme`:**
  - Grid and axis in `--border`; ticks 11 px mono in `muted-foreground`.
  - The tooltip is solid `bg-raised`, 1 px border, 14 px round, 8 × 12 px padding, 12 px mono;
    its label is Saira 600 in `ink-2`.
  - The cursor is a dashed 1 px line in `ink-2`. **Brand red is never the cursor or a series.**
  - `chartTheme.gain`, `.loss`, `.hold` and `.fastestLap` for meaning.
- **Series colours** are team colours (`getTeamColorById`) or the fixed data colours. The legend
  always names the series, so colour is never the only cue.
- **Charts are not text-selectable** (`user-select: none` on Recharts).
- **The race Sankey** (`components/analytics/MuiSankeyChart.tsx`):
  - Three columns, **Quali, Grid, Race**, with every car.
  - A team-coloured marker at each place. Labels read "1 VER" on the left and "ANT 1" on the right.
  - Each band is coloured by the change: **gain green, loss red, hold grey**. A retirement is
    dimmed.
  - The legend reads Gain, Loss, Hold.
  - The tooltip (`SankeyTooltipPerson.tsx`) shows the face ringed in the team colour, the name, the
    flag and the team with its emblem, and points in `text-figure`.
  - It lives on Home and on the Grand Prix page. There is **no season grid-to-finish chart** (removed
    in v1.8.1, D42).
- **Composition of a whole** is one stacked strip, for example a race's tyre stints summing to the
  race distance with the laps in words.

### Social images

The images in `analysis/social/` use the same tokens, type and data colours, drawn from one
module, `analysis/social/common/design.py`. These differences are on purpose, not drift:

- **Hold bands at 0.35 opacity** (the site uses 0.09), so a held place still shows on a phone.
  The legend's Hold label is drawn in the hold colour.
- **Carbon background with a red glow** on the ground colour, instead of a flat surface.
- **No livery stripe.**
- **No watermark**, and no URL, credit or source line.

## 11. Lists and pages

- **Every list** (Drivers, Teams, Races) has **search, filters, grouping and pagination backed by
  the URL**, so a link or Back restores the view (D8).
- **No gauge or progress bars on table or list rows.** State the value in words or figures.
  (`F1Progress` still exists; never put it on a row.)
- Summary cards use `CompactRow`. Full names and detail stay on the full pages and tables.
- **Home:** the next Grand Prix, the last race's results, combined standings, and the race Sankey.

**Routes**

| Route | Page |
|---|---|
| `/` | Home |
| `/calendar` | Races |
| `/standings` | Standings |
| `/drivers`, `/drivers/:slug` | Drivers, driver page |
| `/constructors`, `/teams/:slug` | Teams, team page |
| `/circuits/:circuitId` | Circuit page (`/circuits` redirects to `/calendar`) |
| `/race-analysis`, `/race-analysis/:year/:round` | Grand Prix page, opening on the latest finished race |
| `/pit-wall` | Pit Wall: telemetry and replay |
| `/privacy` | Privacy |

## 12. House rules (all of them, every screen)

1. **No native browser UI:** no `<select>`, no OS date picker, no `window.alert`, `confirm` or
   `prompt`. Use `Select`, `Popover`, `Dialog` and `AlertDialog` from `components/ui`.
2. **Phones never truncate.** Text wraps. Check at 320 px.
3. **No middle dots** (U+00B7) anywhere: copy, separators or `aria-label`s. Use a gap, a line break or
   words.
4. **No gauge or progress bars on rows.** Composition is one stacked strip.
5. **Plain, short, factual copy** in sentence case. No exclamation marks or marketing voice.
6. **Data colours never move.** Team colours, purple for fastest, tyre colours and position and
   status meanings are the same in every theme. Brand red never replaces a data colour.
7. **Teams always show their emblem with their name. Drivers show face, flag and team. Countries
   are flags, never words, under drivers.**
8. **A race is flag plus Grand Prix name**, never R1 or R2.
9. **Every name is a link**, built with `lib/links.ts`.
10. **Solid surfaces only.** No blur, no glass, no glow, no see-through bars.
11. **Nothing under 12 px on a phone.** Figures in mono with tabular numbers.
12. **Accessibility:**
    - WCAG AA contrast (4.5:1 for text).
    - Keyboard access to everything; visible red focus ring.
    - One `<h1>` per page; decorative elements `aria-hidden`.
    - `aria-live` for content that updates.
    - Touch targets at least 44 px for close buttons and nav.
    - Respect `prefers-reduced-motion`.
13. **Reuse before you build.** Use `F1Card`, `DriverIdentity`, `TeamName`, `TyreIcon`,
    `CompactRow`, `Tabs`, `ViewSwitcher` and `F1ChartContainer`. Keep files under about 500 lines.

## 13. Themes

`web/src/context/ThemeContext.tsx`, saved in `localStorage` as `f1ds-theme`.

| Theme | Class | Status |
|---|---|---|
| Dark (default) | `:root` | This system |
| Light | `.light` | This system |
| Cockpit | `.dark-glass` | **Open (D9).** It keeps its old glass look until D9 decides whether to make it solid, fold it into Dark, or drop it. Do not build new work on it, and do not use the `glass*`, `premium-card` or glow utilities elsewhere. |

Check every change in **Dark and Light at 320, 375, 768 and 1280 px** before calling it done.

## 14. Brand assets and docs site

- **Icons and logo:** `logo.svg` and the existing icon sizes in `web/public/`, unchanged.
- **Share image:** `og-image.png` and `web/public/og-image.png`, rendered by
  `scripts/render-social-preview.mjs` from real app captures. Its badge reads "Free and open source".
- **Docs site** (`docs/`, Astro and Starlight):
  - `docs/src/styles/brand.css` uses the same fonts and carbon and red tokens, and a red capsule
    marks the current page.
  - Hero images are `docs/public/assets/hero-dark.webp` and `hero-light.webp`.
- **Design sources:**
  - [`decisions.md`](decisions.md) and [`audits/`](audits/).
  - The concepts board, `f1datastop-design-board.html`, built by `python3 docs/design/board-src/build.py`.
  - The key screens, `f1datastop-screens.html`, built from `docs/design/screens/`.
  - Both boards are generated; never edit their HTML by hand.

## 15. Checklist before you open a PR

- [ ] Tokens only. No new hex values, fonts, radii or shadows.
- [ ] Titles are Saira Condensed caps; the UI is Saira; figures are JetBrains Mono with tabular
      numbers.
- [ ] Drivers use `DriverIdentity` (face, flag, team emblem); teams use `TeamName`; races use flag
      plus Grand Prix name.
- [ ] Every name links through `lib/links.ts`; the season comes from `useSeason()`.
- [ ] Charts are inside `F1ChartContainer` with `chartTheme`; no brand-red series.
- [ ] No native selects or dialogs, no middle dots, no row gauges, no truncation, nothing under
      12 px.
- [ ] Checked at 320, 375, 768 and 1280 px in Dark and Light; keyboard and focus work.
- [ ] `npm run typecheck`, `npm run lint`, `npm run test` and `npm run build` pass.
- [ ] Conventional Commit title (`feat(web): …`, `fix(web): …`). Never bump `web/package.json` or
      tag by hand.
- [ ] A new design choice gets a numbered row in `decisions.md`.
