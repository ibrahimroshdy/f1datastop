# F1 DataStop Data Visualization Standards

This document defines how charts and data visualizations should be built and styled in F1 DataStop.

## 1. Chart Libraries

- **Primary**: MUI X Charts (`@mui/x-charts`) for line, bar, and other statistical charts.
- **Sankey**: Use the existing Nivo-based or MUI-based Sankey implementation for flow data (e.g., qualifying → race position).
- **Globe / 3D**: Three.js (or existing globe component) for calendar globe view.
- **Custom**: For simple stacked bars or small inline charts, use CSS/SVG or a minimal library; keep styling consistent with the design system.

Avoid introducing a second full chart library (e.g., Recharts) for the same chart types; standardize on MUI X Charts and document any exceptions.

## 2. Theming and Wrapper

- **MuiThemeWrapper**: Wrap all MUI X Charts in `MuiThemeWrapper` so palette, typography, and grid/axis colors use design tokens (`--chart-*`, `--background`, `--foreground`).
- **Location**: `src/components/analytics/MuiThemeWrapper.tsx`
- **Do not** pass unknown or dev-tool props to MUI theme; keep the wrapper interface minimal (e.g., `children` only).

## 3. Chart Container and Card

- **Card**: Place charts inside `F1Card` or `F1ChartCard` so they follow the same card layout (header, content, optional footer).
- **Height**: Use a consistent height (e.g., 300–400px for standard charts) or a responsive height (e.g., `min-h-[280px]` with aspect ratio) so layout does not jump.
- **Responsive**: Charts should resize with container; use relative width and avoid fixed pixel widths where possible.

## 4. Axis and Grid

- **Axis**: Use theme-aware colors for axis lines and labels (e.g., `--chart-axis`). Keep font size readable.
- **Grid**: Use subtle grid lines (`--chart-grid`) so data is readable without visual noise.
- **Margins**: Use consistent margins so labels and legends are not clipped.

## 5. Tooltips and Legends

- **Tooltips**: Show clear, formatted values (e.g., position, time, points). Use theme-aware background and border (`--chart-tooltip-*`).
- **Legends**: Place legends in a consistent position (e.g., top-right or below chart). Use team/driver colors where relevant.
- **Accessibility**: Ensure tooltips are keyboard-accessible and consider ARIA labels for chart and legend (see `.cursor/ACCESSIBILITY.md`).

## 6. Loading and Empty States

- **Loading**: Use `F1Skeleton` or `ChartSkeleton` while data is loading. Prefer a dedicated chart skeleton over a generic rectangle.
- **No data**: Use `F1EmptyState` or `F1ChartEmpty` with a clear message (e.g., "No lap data for this session").
- **Error**: Use `F1ErrorState` when the chart data request fails.

## 7. Data and Colors

- **Team/driver colors**: Use `getTeamColorById` / driver color utilities from `src/constants/f1Colors.ts` for series and segments. Use hex values for inline styles (e.g., chart series color); use Tailwind classes only where the component supports it.
- **Consistency**: Use the same color for the same team/driver across dashboard, calendar, and analytics.

## 8. Unified Chart Wrapper

- **F1Chart**: Single component that wraps **F1ChartCard** and **MuiThemeWrapper**.
  - **Location**: `src/components/charts/F1Chart.tsx`
  - **Use**: Pass `title`, `subtitle`, `loading`, `error`, `empty`, `height`, and chart content as `children`. Children are automatically wrapped in `MuiThemeWrapper` for theme consistency.
  - **When to use**: New charts or refactors where you want one place for card + theme + loading/error/empty. Existing charts that already use `F1ChartCard` + `MuiThemeWrapper` at the call site can be migrated gradually to use `F1Chart` instead.
- **Migration**: For a chart that currently is rendered inside a parent-provided card with `MuiThemeWrapper` around the chart component, you can refactor the parent to use `<F1Chart title="..." loading={} error={} empty={} height={}><ChartComponent /></F1Chart>` and remove the outer card and MuiThemeWrapper from the parent.

## 9. File Locations

- **MUI chart components**: `src/components/analytics/` (e.g., `MuiSankeyChart`, `MuiQualifyingChart`, `MuiLapTimeChart`).
- **Chart card**: `src/components/charts/F1ChartCard.tsx`.
- **Theme wrapper**: `src/components/analytics/MuiThemeWrapper.tsx`.

---

*All new charts should use the theme wrapper, design tokens, and shared empty/loading/error patterns.*
