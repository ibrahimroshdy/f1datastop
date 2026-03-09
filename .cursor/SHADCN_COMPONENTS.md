# F1 DataStop shadcn Component Usage

Recommendations for using and adding shadcn/ui components in F1 DataStop.

## 1. Current Usage

The app uses shadcn-style components from `src/components/ui/`:

- **Card** (base): `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`
- **F1Card**: Extends card usage with F1 variants (default, gradient, glass, team-accent). Prefer F1Card for feature content.
- **Button**, **Badge**, **Tabs**, **Dialog**, **Alert**, **Table**, **Tooltip**, **Select**, **Input**, **Label**, etc.

Use the existing shadcn components as the base; add F1-specific variants or wrappers (e.g. F1Card, F1Badge) where the design system requires it.

## 2. Recommended Additions (from Revamp Plan)

The following shadcn components are recommended to standardize patterns:

| Component | Purpose | When to add |
|-----------|---------|-------------|
| **empty** | Empty states | **Added.** Use for generic empty UIs; use `F1EmptyState` for F1-branded empty states (season start, no results, etc.). |
| **spinner** | Loading indicators | For inline loading (e.g. button loading, small areas). Use with or alongside F1Skeleton. |
| **resizable** | Resizable panels | For analytics or dashboard panels that users can resize (e.g. chart panels). |
| **hover-card** | Rich tooltips | For tooltips that need more than a short label (e.g. driver/team summary on hover). |
| **chart** | Chart primitives | If shadcn provides chart primitives that fit the stack; otherwise continue with MUI X Charts + MuiThemeWrapper. |

Add via CLI when needed:

```bash
npx shadcn@latest add empty
npx shadcn@latest add spinner
npx shadcn@latest add resizable
npx shadcn@latest add hover-card
```

Do not add every shadcn component; add only when the revamp or a feature explicitly needs it.

## 3. When to Use shadcn vs F1 Components

- **Use shadcn**: Buttons, inputs, dialogs, tabs, tables, tooltips, badges (when no F1-specific variant is needed), dropdowns, etc.
- **Use F1**: F1Card (for content cards, especially with glass or accent), F1EmptyState, F1ErrorState, F1Skeleton, F1Badge/PositionBadge/StatusBadge when the design uses F1 branding or team/driver colors.

When in doubt, use the shadcn primitive and extend with F1 styling (e.g. F1Card wrapping shadcn Card structure) rather than building a fully custom alternative.

## 4. Ref and Composition

- **forwardRef**: Custom components that are used with `asChild` (e.g. TooltipTrigger, Slot) must forward refs. Use `React.forwardRef` and pass ref to the underlying DOM node (see Badge fix in the codebase).
- **asChild**: Prefer Radix/shadcn composition (e.g. `TooltipTrigger asChild`) so one DOM node receives both trigger and tooltip behavior. Ensure the child component forwards ref.

## 5. Theming

- shadcn components use CSS variables from the design system (e.g. `--primary`, `--background`, `--card`). Ensure theme context and root class (light/dark/dark-glass) are applied so these variables match the active theme.
- Do not override shadcn component styles globally unless it is for the design system (e.g. in `index.css` or a theme file). Prefer local overrides via `className` or component variants.

## 6. MCP Suggestion (from Revamp Plan)

For Cursor or other tooling that supports shadcn MCP:

- Use the **official shadcn/ui MCP** (or the one that matches your shadcn version) to add components via CLI and to inspect component APIs. This keeps additions consistent with the project’s shadcn setup.
- Do not use an MCP that generates custom copies of shadcn components with different APIs; prefer `npx shadcn@latest add <component>` so the codebase stays aligned with shadcn’s defaults and your existing UI folder structure.

---

*Use shadcn for primitives and layout; use F1 components for branding, empty/error/loading, and data presentation.*
