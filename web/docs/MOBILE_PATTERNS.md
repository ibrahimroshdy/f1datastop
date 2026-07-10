# F1 DataStop — Mobile Design Patterns (canonical)

The mobile experience must be **compact, scannable, and touch-first** — every view
fits the screen, nothing endless-scrolls sideways, nothing is smaller than a thumb.

**Source of truth:** the sibling app `../fifa-league` (its `ViewSwitcher`, `BottomNav`,
page shells, list/card patterns). When in doubt, mirror fifa-league's mobile pattern
and re-token to Pit Wall (f1-red primary, JetBrains Mono numerals, `instrument-label`
eyebrows). This doc is the short playbook; see also `F1_DATASTOP_DESIGN_MASTER.md`.

---

## Core rules (non-negotiable)

1. **Responsive, never a fixed mobile column.** Use `pageShell`/`pageStack` from
   `web/src/lib/layout.ts`. No `w-[NNNpx]` / `min-w-*` on content.
2. **No horizontal page scroll.** Wrap the app in `overflow-x-clip`. Any wide thing
   (tables, chart, chip row) scrolls *inside its own* `overflow-x-auto` container —
   never the page. Prefer collapsing to a stack over sideways scroll.
3. **Tap targets ≥ 44px** (`min-h-11`); `min-h-[44px]` compact floor is fine for dense
   grids. Icon-only controls get a real hit box (`flex h-11 w-11 items-center justify-center`),
   not a bare 16px icon.
4. **Safe areas.** Fixed/bottom/side surfaces use `.safe-bottom` / `.safe-top` or
   `pb-[max(1.5rem,env(safe-area-inset-bottom))]`. Sheet + Dialog already do.
5. **Type floor.** Body/labels ≥ `text-xs` (12px). `text-2xs` (11px) and `text-3xs`
   (10px) are **only** for dense tabular numerals and bottom-nav labels. **Never** use
   `text-[8px]/[9px]` or `text-2xs` for meaningful content labels.
6. **Density.** Comfortable padding (`p-3`/`p-4`), not `p-1`. Rows breathe.

---

## Primitives — use these, don't reinvent

### `ViewSwitcher` — switching between views of a screen
`web/src/components/ui/view-switcher.tsx`. **THE** control for "which view am I looking
at" (tabs, segments, modes). Raised pill marks the active view on a muted track.

- `stack` → mobile = even icon-above-label **grid, all views visible, no scroll**;
  collapses to an inline row at `sm+`. Use for 4+ items. `cols={n}` sets grid columns
  (e.g. 9 items → `cols={3}` for even 3×3).
- `compact` → 44px tiles (vs 52px). State mode (`value`+`onChange`) or route mode (`to`).

```tsx
<ViewSwitcher stack compact cols={3} value={tab} onChange={setTab}
  items={TABS.map(t => ({ key: t.id, label: t.label, icon: t.icon }))} />
```

**BANNED for view switching:** horizontal scroll strip of chips ❌ · `<select>`/dropdown ❌.

### Page shell — `web/src/lib/layout.ts`
`pageShell` (max-w-7xl, responsive px), `pageStack` (gap column). Every page uses one.

### Bottom nav — `components/layout/BottomNav.tsx`
Opaque bg (**no `backdrop-blur`** on fixed bars — iOS re-raster flicker), `nav-stable`,
`.safe-bottom`, ~56px height, active icon in a pill, `text-[10px]/text-3xs` labels.
Overflow items go in the **More sheet** (`MoreNavSheet`) — bottom `Sheet`, 44px tiles.

### Cards / lists / tables
- Card: `F1Card` (`overflow-hidden p-0`); list inside = `ul` with `divide-y divide-border`,
  rows are list items with comfortable padding.
- **Tables → mobile card fallback.** Desktop `<table>` in `hidden md:block`; a stacked
  card/`divide-y` list in `md:hidden`. Never ship a raw multi-column `<table>` to mobile
  with only `overflow-x-auto`.
- Numerals: `tabular-nums`, right-aligned, `text-2xs`/`text-xs`.

### Sheet / Dialog — `components/ui/{sheet,dialog}.tsx`
Close button is a 44px hit box; `Sheet` variants carry safe-area + inner scroll; dialogs
use `max-h-[90dvh]`. Content heights are viewport-relative (`60vh`), not fixed `h-[600px]`.

### Section labels
`.instrument-label` / `.eyebrow` (uppercase, tracked, muted) above a group or value.

---

## Charts on mobile
- Always `ResponsiveContainer`; heights are `h-[Nvh] sm:h-[Npx]` (not fixed px).
- Derive chart margins from width (`width < 480 ? small : large`); suppress/relocate
  edge labels below the breakpoint instead of letting them clip.
- Every hover tooltip must have a **touch equivalent** (`onPointerDown`) — no data may be
  hover-only, since touch has no hover.

---

## Pre-flight checklist (any new/edited mobile surface)
- [ ] No horizontal page scroll at 360–430px.
- [ ] All interactive targets ≥ 44px.
- [ ] View switching uses `ViewSwitcher` (not a scroll strip / dropdown).
- [ ] No text below `text-xs` except dense numerals/nav labels.
- [ ] Fixed/bottom surfaces respect safe-area.
- [ ] Tables have a card fallback; charts are responsive + touch-tooltip.
- [ ] Uses `pageShell`/`pageStack`, `F1Card`, `instrument-label`.
