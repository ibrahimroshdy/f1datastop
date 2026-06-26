# f1datastop — "Telemetry Terminal" visual skin

The locked art direction (chosen 2026-06-26). This is the **skin on top of `DESIGN.md`** — DESIGN.md's token system and component rules still govern; this doc defines the *feel*: an expensive piece of motorsport engineering software. Bloomberg data-density × Linear/Teenage-Engineering craft. Dense AND premium. When this doc and a generic design instinct conflict, this doc + DESIGN.md win.

## The one feeling
A race engineer's pit-wall console that costs $200k. Every screen reads like a precision instrument cluster: dark, dense, machined, mono-numeric, with restrained red and cinematic data viz. Not a website with charts — an **instrument**.

## Six signature motifs (every screen should show ≥2)
1. **Hairline instrument grid.** Data rows are separated by `border-border` hairlines (`divide-y divide-border`), not whitespace gaps. Tables read like a timing screen.
2. **Mono numerics everywhere.** Every number — lap, gap, delta, speed, position, points, %, count — is `font-mono tabular-nums` (`.timing`). This is the strongest terminal signal.
3. **Instrument labels.** Field labels are micro eyebrows: `.instrument-label` = `text-xs font-semibold uppercase tracking-widest text-muted-foreground`. Value below in mono. Label/value pairs, not sentences.
4. **Corner-tick framing.** Hero/feature panels carry subtle L-shaped corner ticks (a HUD/scope motif) via `.scope-frame`. Use sparingly — signature, not wallpaper.
5. **Scope charts.** Charts look like an oscilloscope: dark plot, hairline grid, mono ticks, crisp lines with a faint gradient area-fade + a soft series glow, a crosshair tooltip in dark glass. See `chartTheme.ts`.
6. **Machined depth + restrained glow.** Cards use `shadow-card` (inset top highlight + layered elevation). Red (`primary`) is the only accent — used for active state, emphasis, key datum, and the live pulse. `shadow-glow` reserved for interactive/live emphasis.

## Materials
- **Base:** pure-black page (`bg-background`). Panels one step up (`bg-card`) as machined plates with `shadow-card` + `border-border` hairline.
- **Density:** compact. F1Card `size="sm"` default for data panels; rows `py-1.5`/`py-2`; gaps `gap-2`/`gap-3`. Never agency `py-24` whitespace — this is a terminal.
- **Palette:** monochrome (`foreground`/`muted-foreground`) on black + one red accent. Deltas: `status-completed` (gain) / `destructive` (loss). Team color = identity only (thin left bar, dot, chart line), via `@/constants/f1Colors`.

## Typography
- Display/headings: **Exo 2** (`font-heading`), tight tracking. Big readouts use `.readout` (mono, tabular, tight) for the hero number feel.
- Body: **Inter**. Data: **JetBrains Mono** (`.timing`). Labels: `.instrument-label`.
- Smallest size `text-xs`. Numbers always tabular.

## Motion (snappy, not slow — a terminal responds instantly)
- Easing `ease-spring` (`cubic-bezier(0.32,0.72,0,1)`); durations 150–300ms (`transition-fast`/`transition-normal`). No 600ms+ agency fades.
- Entrance: rows `stagger-children` fade-up; hero numbers may count-up. Live data: red `live-pulse`. Hover: lift + glow. Tab switch: quick crossfade.
- GPU only (`transform`/`opacity`).

## Component idiom
- **Buttons:** press physics (`active:scale-0.97`), spring, primary red-glow on hover (done in `ui/button`). Filter/segment controls: hairline ghost + mono label.
- **Panels:** `F1Card` machined; add `.scope-frame` for hero. Section label = `.instrument-label` eyebrow, not a big title.
- **Badges:** mono, hairline, status/position-token colored (F1Badge/PositionBadge).
- **Charts:** route through `F1ChartContainer` + `chartTheme.ts` (scope styling, glow, crosshair). No raw hex; series via tokens/team color.

## Utilities (in `index.css`)
`.readout`, `.instrument-label`, `.hairline-grid` (auto `divide-y divide-border`), `.scope-frame` (corner ticks), `.data-row` (compact `py-1.5` flex row). Reuse these instead of re-rolling.

## Build order (waves)
1. Foundation: tokens + utilities + `chartTheme.ts` (this commit).
2. Primitives: F1Card scope option, F1Badge mono, F1ChartContainer scope wiring.
3. Pages: race-analysis → standings → drivers → circuits → calendar → home, each to the motifs above.
4. Charts: gradient area + series glow + crosshair tooltip across all recharts.
5. Polish: entrance motion, count-ups, live pulse, focus states.
