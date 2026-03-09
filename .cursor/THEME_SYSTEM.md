# F1 DataStop Theme System

This document describes the theme architecture and how to use it correctly across the app.

## 1. Theme Modes

- **light**: Light background, dark text. No glass effects.
- **dark**: Dark background (pure black base), light text. No glass effects.
- **dark-glass**: Dark base with glass morphism (backdrop blur, glass panels, glow). This is the only theme that uses glass.

Defined in `src/context/ThemeContext.tsx` as `ThemeMode`: `'light' | 'dark' | 'dark-glass'`.

## 2. Theme Context

- **Provider**: `ThemeProvider` wraps the app and provides theme state and helpers.
- **Hook**: `useTheme()` returns:
  - `theme`: Current `ThemeMode`
  - `setTheme(theme: ThemeMode)`: Set theme directly
  - `toggleTheme()`: Toggle between light and dark (no glass)
  - `cycleTheme()`: Cycle through light → dark → dark-glass
  - `isGlass`: `true` when `theme === 'dark-glass'`
  - `baseTheme`: `'dark' | 'light'` (derived from theme)
  - `toggleGlass()`: Switch between dark and dark-glass (when base is dark)

## 3. Applying the Theme

- **Root class**: The active theme class (`light`, `dark`, `dark-glass`) is applied to `document.documentElement` by `ThemeProvider`. CSS variables and component classes are scoped by this.
- **Persistence**: Theme is stored in `localStorage` under `f1ds-theme`.
- **System preference**: Initial load can use `prefers-color-scheme: dark` if no saved theme exists.

## 4. CSS Variables

- **Base tokens**: `--background`, `--foreground`, `--card`, `--primary`, `--muted`, `--border`, etc. are defined per theme in `src/index.css`.
- **Glass tokens**: `--glass-bg`, `--glass-border`, `--glass-blur`, `--glass-shadow`, `--glass-glow`, etc. are used when the theme is `dark-glass`. Components use utility classes (e.g. `.glass`, `.glass-glow`) that reference these.
- **Chart tokens**: `--chart-background`, `--chart-grid`, `--chart-axis`, `--chart-tooltip-*` for consistent chart theming.

Do not hardcode colors that should change with theme; use design tokens or Tailwind theme-aware classes.

## 5. Glass-Aware Components

- **Conditional glass**: When a component should look different in glass mode, use `useTheme().isGlass` and apply glass classes or `F1Card variant="glass"` only when `isGlass` is true.
- **Cards**: Use `F1Card` with `variant="glass"` and `glassVariant` when the UI is in Dark Glass theme; use `default` or `gradient` otherwise.
- **Avoid**: Mixing glass styles in non–glass themes. Glass should be confined to `dark-glass`.

## 6. Base Theme vs Glass

- **baseTheme**: Used to decide light vs dark contrast (e.g., meta theme-color, chart defaults). From `getBaseTheme(theme)`.
- **isGlass**: Used to decide whether to render glass UI (cards, panels, badges). From `isGlassTheme(theme)`.

Use `baseTheme` for color/contrast logic and `isGlass` for glass vs solid styling.

## 7. Adding or Changing Themes

- Add new mode to `ThemeMode` and update `themeConfig`, `themeCycle`, and `getBaseTheme` / `isGlassTheme` as needed.
- Add or adjust CSS variables and utility classes in `src/index.css` for the new theme.
- Ensure `ThemeProvider` applies the correct root class and persistence key.

---

*All theme-dependent UI should go through ThemeContext and design tokens, not inline theme assumptions.*
