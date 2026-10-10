# F1 DataStop Accessibility Standards

Accessibility requirements and practices for UI components and pages. Target: WCAG 2.1 Level AA where applicable.

## 1. Semantic HTML and ARIA

- **Structure**: Use semantic elements (`<main>`, `<nav>`, `<header>`, `<section>`, `<article>`, `<button>`, `<a>`) so assistive technologies can infer structure.
- **Headings**: Use a single `<h1>` per page and logical heading order (`h1` → `h2` → `h3`). Do not skip levels.
- **Landmarks**: Ensure main content is in `<main>`; navigation in `<nav>`; dialogs in appropriate roles.

## 2. Labels and Names

- **Interactive elements**: Every button, link, form control, and icon button must have an accessible name (visible text, `aria-label`, or `aria-labelledby`).
- **Form inputs**: Associate every input with a label (`<label htmlFor={id}>` or wrap input with `<Label>`). Use `aria-describedby` for hints or errors.
- **Icon-only actions**: Use `aria-label` (e.g. "Close dialog", "Open menu") so screen readers announce the action.

## 3. Keyboard and Focus

- **Keyboard operable**: All interactive UI (buttons, links, tabs, modals, custom controls) must be operable with keyboard (Tab, Enter, Space, Escape, Arrow keys as appropriate).
- **Focus order**: Focus order should follow visual order. Avoid positive `tabIndex`; use `tabIndex={0}` only when adding focus to an otherwise non-focusable element.
- **Focus visible**: Ensure focus indicator is visible (e.g. ring or outline). Do not remove focus outline without replacing it with a visible focus style.
- **Focus trap**: Modals and dialogs should trap focus inside until closed and return focus to the trigger on close.

## 4. Charts and Data Visualization

- **Chart region**: Give the chart container `role="img"` and `aria-label` (or `aria-labelledby`) describing what the chart shows (e.g. "Driver standings 2025").
- **Tooltips**: Ensure chart tooltips are keyboard-accessible and readable by screen readers. Consider `aria-live` for dynamic tooltip content.
- **Legends**: Associate legend with chart (e.g. `aria-describedby` pointing to legend id) or ensure legend items are in tab order if interactive.

## 5. Color and Contrast

- **Contrast**: Text and interactive elements must meet WCAG AA contrast (4.5:1 for normal text, 3:1 for large text and UI components).
- **Not only color**: Do not rely on color alone to convey information (e.g. position or status). Use text, icons, or patterns as well.
- **Links**: Differentiate links from body text (color and/or underline). Ensure focus style is visible.

## 6. Motion and Animation

- **Reduced motion**: Respect `prefers-reduced-motion: reduce` by disabling or simplifying non-essential animations.
- **No auto-play**: Avoid auto-playing motion that cannot be paused; if present, provide a pause control.

## 7. Error Handling and Validation

- **Errors**: Announce validation and API errors to screen readers (e.g. `aria-live="polite"` or `aria-describedby` to error message).
- **Empty/error states**: Ensure `F1EmptyState` and `F1ErrorState` are announced (e.g. heading or `role="alert"` for critical errors).

## 8. Testing and Checklist

- **Manual**: Navigate key flows with keyboard only; test with a screen reader (e.g. VoiceOver, NVDA).
- **Automated**: Use axe DevTools or Lighthouse accessibility audit where applicable.
- **Checklist**: Before release, confirm: focus order, labels, contrast, and keyboard access for new or changed components.

---

*Accessibility is part of the definition of done for every UI change.*
