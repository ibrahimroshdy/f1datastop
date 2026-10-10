# F1 DataStop Design Philosophy

This document defines the core design principles and philosophy for the F1 DataStop application. All UI, UX, and component decisions should align with these principles.

## 1. Information Density

- **Data-first**: Every screen should prioritize clear presentation of F1 data. Avoid decorative elements that do not support understanding.
- **Progressive disclosure**: Show the most important information first; allow users to drill down for detail (e.g., race modal, analytics tabs).
- **Scannable layouts**: Use consistent hierarchy (headings, tables, cards) so users can quickly find standings, times, and results.
- **No clutter**: Prefer compact, purposeful layouts over large empty space. Use whitespace to separate sections, not to fill.

## 2. F1 Branding

- **Primary accent**: Use the app primary (purple, `--primary`) for key actions, highlights, and F1-relevant emphasis (e.g., wins, poles, live state).
- **Team and driver colors**: Use official or consistent team/driver colors from `src/constants/f1Colors.ts` for standings, charts, and badges.
- **Typography**: Use clear, readable fonts; reserve bold for rankings and key metrics. Avoid playful or casual type that conflicts with a data/product feel.
- **Tone**: Professional and precise. Copy should be concise and factual (e.g., "24 races", "P3", "Fastest lap").

## 3. Glass Morphism

- **Theme-driven**: Glass effects are tied to the **Dark Glass** theme. In Light and Dark themes, use solid backgrounds (`bg-card`, `bg-muted`).
- **Consistency**: Use the shared glass utilities (`.glass`, `.glass-glow`, `.glass-panel`) and CSS variables (`--glass-bg`, `--glass-border`, etc.) from `src/index.css`.
- **Restraint**: Use glass for cards and panels, not for every surface. Avoid stacking multiple glass layers.
- **Unified card**: Use `F1Card` with `variant="glass"` and `glassVariant` for all glass card UIs; do not introduce new ad-hoc glass card components.

## 4. Dark-First Design

- **Default experience**: The default theme is dark. Layouts and contrast should be optimized for dark backgrounds.
- **Light theme support**: Ensure text, borders, and charts remain readable and accessible in the light theme.
- **Contrast**: Meet WCAG AA for text and interactive elements in both themes. Use `text-muted-foreground` for secondary text.

## 5. Compact & Clean

- **Card usage**: Prefer `F1Card` (and its subcomponents) for content blocks. Use a single card system; avoid mixing base `Card` and custom card types for the same purpose.
- **Spacing**: Use the design system spacing scale (`--space-1` through `--space-12`) and Tailwind spacing utilities consistently.
- **Borders and radius**: Use `--radius` and `rounded-xl` for cards/panels. Prefer subtle borders (`border-border`) over heavy outlines.

## 6. Motion & Feedback

- **Transitions**: Use `--transition-fast`, `--transition-normal` for hover, focus, and state changes. Avoid long or distracting animations.
- **Loading**: Use `F1Skeleton` for content loading and a consistent spinner for inline actions.
- **Empty and error**: Use `F1EmptyState` and `F1ErrorState` for empty data and errors. Provide clear, actionable messages.
- **Micro-interactions**: Hover and focus states should be visible and consistent (e.g., `hover:shadow-lg`, focus rings).

## 7. Data Presentation

- **Charts**: Use the shared chart wrapper and theme (e.g., `MuiThemeWrapper`, chart CSS variables) so all charts feel part of one system.
- **Tables**: Use consistent table styling (e.g., standings tables) with clear headers and alignment. Support responsive behavior.
- **Numbers**: Use tabular figures for times and positions where alignment matters.
- **Labels**: Use consistent terminology (e.g., "Constructor", "Driver", "Round", "Points") across the app.

## 8. Consistency Over Novelty

- **Components**: Prefer existing design system components over one-off implementations.
- **Patterns**: Reuse patterns (e.g., card with header + content, modal with tabs) instead of inventing new ones per page.
- **Naming**: Use consistent naming for props and variants (e.g., `variant`, `size`, `hover`) across similar components.

---

*This philosophy underpins the F1 DataStop Design System Revamp. When in doubt, favor clarity, consistency, and data-first presentation.*
