# F1 DataStop UI Patterns

Reusable UI patterns and best practices for consistent implementation across the app.

## 1. Card Pattern

- **Structure**: `F1Card` > `F1CardHeader` (optional) > `F1CardTitle` (+ optional `F1CardDescription`) > `F1CardContent` > optional `F1CardFooter`.
- **When**: Any content block that groups related info (standings, next race, chart, list).
- **Variant**: Use `default` for most; `glass` when theme is Dark Glass; `team-accent` when highlighting a team with a colored bar.

## 2. Empty State Pattern

- **Component**: `F1EmptyState` with a prescribed type (e.g. `season-start`, `no-data`, `no-results`, `coming-soon`).
- **When**: No data to show but no error (e.g. season not started, no search results).
- **Content**: Short heading + optional description + optional action. Avoid long paragraphs.

## 3. Error State Pattern

- **Component**: `F1ErrorState` (or specific variants like `NetworkError`, `DataLoadError`).
- **When**: API failure, network error, or unrecoverable data load failure.
- **Content**: Clear error message + optional retry or link. Do not show raw stack traces to users.

## 4. Loading Pattern

- **Component**: `F1Skeleton` (or `StandingsSkeleton`, `ChartSkeleton`, etc.).
- **When**: Data is loading; show skeleton in the same shape as the content.
- **Avoid**: Spinner-only for full sections; prefer skeleton for layout stability.

## 5. List / Table Pattern

- **Tables**: Use semantic `<table>` with `TableHeader`, `TableBody`, `TableRow`, `TableCell` (shadcn). Keep headers and alignment consistent (e.g. numbers right-aligned).
- **Lists**: Use `<ul>`/`<ol>` or a list component with consistent spacing and optional dividers.
- **Responsive**: On small screens, consider card-like rows or horizontal scroll for wide tables.

## 6. Modal / Dialog Pattern

- **Component**: shadcn `Dialog` or existing race detail modal.
- **Structure**: Overlay > Content > Header (title + close) > Body (tabs or single content) > optional Footer.
- **Accessibility**: Focus trap, close on Escape, `aria-labelledby` / `aria-describedby`.

## 7. Tabs Pattern

- **Component**: shadcn `Tabs` (`TabsList`, `TabsTrigger`, `TabsContent`).
- **When**: Multiple views in the same card or section (e.g. Driver / Constructor, Overview / Distribution).
- **Default**: Select the first or most relevant tab by default. Keep labels short.

## 8. Badge and Status Pattern

- **Badges**: Use shadcn `Badge` or `F1Badge` / `PositionBadge` / `StatusBadge` for status, position, or category.
- **Colors**: Use semantic colors (e.g. live, completed, warning) or team/driver colors from `f1Colors`.
- **Ref**: Use `React.forwardRef` on custom Badge if used with `TooltipTrigger asChild`.

## 9. Form and Input Pattern

- **Components**: shadcn `Input`, `Label`, `Button`. Use `GlassInput` only when theme is Dark Glass and the design specifies glass inputs.
- **Validation**: Show inline or below-field errors; avoid alert-only validation.
- **Labels**: Always associate labels with inputs (e.g. `htmlFor` / `id` or `Label` wrapping).

## 10. Responsive Pattern

- **Breakpoints**: Prefer Tailwind defaults (sm, md, lg, xl). Document custom breakpoints in `.cursor/RESPONSIVE_DESIGN.md`.
- **Mobile first**: Base styles for mobile; add `md:` / `lg:` for larger layouts.
- **Touch**: Use adequate tap targets (e.g. min 44px) for interactive elements on mobile.

## 11. Animation Pattern

- **Transitions**: Use design tokens `--transition-fast` / `--transition-normal` for hover and state changes.
- **Avoid**: Long or decorative animations that delay access to content.
- **Reduced motion**: Respect `prefers-reduced-motion` where feasible.

## 12. Icon and Copy Pattern

- **Icons**: Use `lucide-react` consistently. Prefer one icon per action or status.
- **Copy**: Use sentence case for labels and titles. Use title case only for product or section names if required by brand.
- **Numbers**: Use locale-aware formatting for dates and numbers where appropriate; use tabular figures for aligned columns.

---

*Prefer these patterns over one-off implementations to keep the app consistent and maintainable.*
