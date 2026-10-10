# F1 DataStop Component Architecture

This document describes the component hierarchy, when to use which components, and composition patterns for F1 DataStop.

## 1. Component Hierarchy

```
App
├── Providers (Theme, Auth, Query, Router, etc.)
├── MainLayout
│   ├── Sidebar / MobileNavigation
│   ├── Header (optional)
│   └── main
│       └── Page components
│           ├── Layout primitives (div, section, grid)
│           ├── F1Card | Card (shadcn)
│           │   ├── F1CardHeader / CardHeader
│           │   ├── F1CardTitle / CardTitle
│           │   ├── F1CardDescription / CardDescription
│           │   ├── F1CardContent / CardContent
│           │   └── F1CardFooter / CardFooter
│           ├── F1EmptyState / F1ErrorState / F1Skeleton
│           ├── Charts (wrapped in MuiThemeWrapper / F1ChartCard)
│           └── UI primitives (Button, Badge, Tabs, etc.)
```

## 2. Card Components

### F1Card (primary card)

- **Use for**: All F1-branded content blocks: standings, race cards, analytics panels, dashboard widgets.
- **Location**: `src/components/f1/F1Card.tsx`
- **Variants**: `default` | `gradient` | `glass` | `team-accent`
- **Props**: `variant`, `size` (sm | default | lg | xl), `hover` (false | true | "lift" | "glow"), `glassVariant` (when variant is glass), `accent`, `teamColor`, `showAccent`, `loading`, `interactive`
- **Subcomponents**: `F1CardHeader`, `F1CardTitle`, `F1CardDescription`, `F1CardContent`, `F1CardFooter`

When to use which variant:

- **default**: Standard content cards (e.g., standings, results).
- **gradient**: Subtle gradient background for emphasis.
- **glass**: Use when the theme is Dark Glass; use `glassVariant` (default, glow, panel, subtle) for the desired effect.
- **team-accent**: Use with `showAccent` and `teamColor` for team-colored accent bar.

### Base Card (shadcn)

- **Use for**: Generic layout or when F1-specific styling (variants, glass, accent) is not needed. Prefer `F1Card` for feature-level content.
- **Location**: `src/components/ui/card.tsx`

### Deprecated: GlassCard

- **Status**: Deprecated. Use `F1Card` with `variant="glass"` and `glassVariant` instead.
- **Location**: `src/components/glass/GlassCard.tsx` (re-exports F1Card for backward compatibility).

## 3. Empty, Error, and Loading States

- **F1EmptyState**: Use for empty data (no races, no results, season start). Prefer predefined types (e.g., `season-start`, `no-data`) over custom-only usage.
- **F1ErrorState**: Use for API/server errors and data load failures. Use consistent error types and messages.
- **F1Skeleton**: Use for loading placeholders (standings, charts, cards). Use `StandingsSkeleton`, `ChartSkeleton`, etc. where provided.

Do not introduce new ad-hoc empty/error/loading components; extend the F1 variants where needed.

## 4. Charts and Data Visualization

- **Wrapper**: Use `MuiThemeWrapper` for MUI X Charts so theme and tokens are consistent.
- **Card**: Use `F1ChartCard` or `F1Card` to wrap charts so they follow the card system.
- **Loading/Empty**: Use `F1Skeleton` (e.g., `ChartSkeleton`) and `F1EmptyState` / `F1ChartEmpty` where applicable.

See `.cursor/DATA_VISUALIZATION.md` for chart-specific standards.

## 5. Layout and Structure

- **MainLayout**: Provides sidebar, main content area, and responsive behavior. Page content goes inside `main`.
- **Grids**: Use Tailwind grid (`grid`, `grid-cols-*`, `gap-*`) with consistent breakpoints (see `.cursor/RESPONSIVE_DESIGN.md`).
- **Sections**: Use semantic elements (`section`, `header`) and consistent spacing between sections.

## 6. Composition Patterns

- **Card with header**: Use `F1Card` > `F1CardHeader` > `F1CardTitle` (optional `F1CardDescription`) > `F1CardContent`.
- **Card with footer**: Add `F1CardFooter` for actions or secondary info.
- **List inside card**: Put list (table or list markup) inside `F1CardContent`.
- **Chart inside card**: Wrap chart in `F1Card` with title in `F1CardHeader`; use `F1CardContent` for the chart container.
- **Tabs**: Use shadcn `Tabs` inside a card when multiple views (e.g., Driver / Constructor) share the same card.

## 7. When to Use F1 vs Base UI

| Need | Use |
|------|-----|
| Content card with F1 styling / glass / accent | F1Card |
| Generic container or minimal card | Card (shadcn) |
| Empty data message | F1EmptyState |
| Error message | F1ErrorState |
| Loading placeholder | F1Skeleton |
| Buttons, inputs, badges, dialogs | shadcn UI components |
| F1-specific badges (position, status) | F1Badge, PositionBadge, StatusBadge |

## 8. File and Export Conventions

- **F1 components**: `src/components/f1/`. Export via `src/components/f1/index.ts`.
- **UI primitives**: `src/components/ui/`. One component per file (or grouped per shadcn convention).
- **Feature components**: Co-locate in feature folders (e.g., `src/components/dashboard/`, `src/components/calendar/`) and import from `@/components/f1` and `@/components/ui` as needed.

---

*Keep components under ~500 lines; split into subcomponents or hooks when logic or markup grows.*
