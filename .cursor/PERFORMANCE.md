# F1 DataStop Performance Guidelines

Performance optimization practices for components, data loading, and bundle size.

## 1. React Optimization

- **Memoization**: Use `React.memo` for components that render often with the same props (e.g. list items, chart wrappers). Avoid wrapping everything; measure first.
- **useMemo**: Use for expensive derived data (e.g. filtered/sorted lists, chart series) so it is not recomputed every render.
- **useCallback**: Use for stable callback references passed to memoized children or effect dependencies. Prefer for event handlers passed down several levels.
- **State**: Keep state as local as possible; avoid lifting state higher than needed. Use React Query (or similar) for server state to avoid redundant fetches.

## 2. Data Fetching

- **Caching**: Use React Query (or existing data layer) with sensible `staleTime` and `cacheTime` so repeated navigations don’t refetch unnecessarily.
- **Deduplication**: Ensure the same query key is used for the same data so requests are deduplicated.
- **Pagination / virtualization**: For long lists (e.g. many races, many laps), use pagination or virtual scrolling so the DOM stays small.
- **Route lazy loading**: The app already uses `React.lazy` for heavy routes and components (e.g. RaceAnalysis tabs, F1GlobeContainer, TelemetryDashboard). Keep using lazy + Suspense for below-the-fold or tab content.

## 3. Code Splitting and Lazy Loading

- **Routes**: Lazy load route-level components with `React.lazy` and `Suspense` so initial bundle stays small. Provide a fallback (e.g. `F1Skeleton` or minimal spinner).
- **Heavy components**: Consider lazy loading for heavy dependencies (e.g. chart library, 3D globe) when they are not above the fold.
- **Dynamic imports**: Use dynamic `import()` for large optional features or modals that are not always opened.

## 4. Rendering

- **Avoid unnecessary re-renders**: Ensure context values are stable (e.g. memoized) when they are used by many consumers. Split contexts if only a subset of the tree needs an update.
- **Charts**: Avoid re-creating chart config objects every render; memoize options/series when passed to chart components.
- **Lists**: Use a stable `key` (e.g. id) for list items. Avoid index as key when the list can reorder or change.

## 5. Bundle Size

- **Imports**: Prefer named imports and tree-shakeable libraries. Avoid importing entire libraries when only a subset is used.
- **Dependencies**: Periodically review bundle (e.g. `vite build` + analyze) and replace or remove heavy dependencies when possible.
- **Target**: Aim for initial JS bundle under ~2MB (or project target); keep time-to-interactive under a few seconds on typical networks.

## 6. Assets and Media

- **Images**: Use appropriate formats (e.g. WebP) and sizes. Prefer responsive images or placeholders for above-the-fold content.
- **Fonts**: Subset fonts when possible; use `font-display: optional` or `swap` to avoid blocking render.

## 7. Measurement

- **Lighthouse**: Run Lighthouse (performance) on key pages and track metrics (LCP, FID, CLS).
- **Real user monitoring**: Use existing analytics/Clarity to spot slow routes or high bounce on heavy pages.
- **Profiling**: Use React DevTools Profiler to find expensive re-renders and unnecessary work.

---

*Optimize based on data; avoid premature optimization while keeping these practices in mind for new code.*
