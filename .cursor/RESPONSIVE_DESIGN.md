# F1 DataStop Responsive Design

Breakpoints, layout patterns, and mobile behavior for consistent responsive design.

## 1. Breakpoints

Use Tailwind’s default breakpoints unless a specific need is documented:

| Breakpoint | Min width | Usage |
|------------|-----------|--------|
| (default)  | 0px       | Mobile first base styles |
| `sm`       | 640px     | Large phones, small tablets |
| `md`       | 768px     | Tablets, small laptops |
| `lg`       | 1024px    | Laptops, desktops |
| `xl`       | 1280px    | Large desktops |
| `2xl`      | 1536px    | Extra-wide (use sparingly) |

Prefer mobile-first: write base styles for small screens, then add `sm:`, `md:`, `lg:` as needed.

## 2. Layout Patterns

- **Grid**: Use `grid` with `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` (or similar) for card/content grids. Use consistent `gap-4` or `gap-6`.
- **Flex**: Use `flex flex-col md:flex-row` for header rows and sections that stack on mobile.
- **Containers**: Use a max-width container (e.g. `max-w-7xl mx-auto`) for main content when full-width is not desired.
- **Sidebar**: Sidebar collapses or becomes a drawer on mobile; main content takes full width. See `MainLayout` and `MobileNavigation`.

## 3. Typography and Spacing

- **Text size**: Use responsive typography (e.g. `text-sm md:text-base`, `text-2xl md:text-3xl` for headings) so content is readable on small screens.
- **Spacing**: Use consistent spacing scale (`p-4`, `gap-4`, `space-y-4`). Increase padding/gap on `md` or `lg` where it improves readability.
- **Touch targets**: Buttons and links should have a minimum tap target of about 44×44px on touch devices. Use `min-h-[44px]` or `py-3` where needed.

## 4. Charts and Data Viz

- **Height**: Use a minimum height (e.g. `min-h-[280px]`) so charts don’t collapse on small screens. Prefer relative width (100%) so they scale with container.
- **Legends and labels**: Ensure legends and axis labels don’t overflow; consider moving legend below chart on mobile or shortening labels.
- **Tables**: For wide tables (e.g. standings), consider horizontal scroll with a visible scroll hint, or card-style rows on mobile.

## 5. Navigation

- **Desktop**: Persistent sidebar or top nav with full menu.
- **Mobile**: Hamburger or bottom nav that reveals sidebar or key links. Ensure menu is keyboard-accessible and focus is managed when opening/closing.

## 6. Modals and Dialogs

- **Full screen on mobile**: Consider `fullScreen` or near full-screen on small viewports so content is usable.
- **Scroll**: Ensure modal content scrolls when it overflows; body scroll should be locked while modal is open.

## 7. Utilities and Hooks

- **Responsive hooks**: Use `useIsMobile` and `useIsMediumOrSmaller` from `@/hooks/use-mobile` for layout decisions (e.g. sidebar, mobile nav). They use standard breakpoints (768px for medium).
- **Orientation**: Use orientation or aspect-ratio only when there is a clear UX need; prefer width-based breakpoints for layout.

## 8. Testing

- **Viewports**: Test at 320px, 375px, 768px, 1024px, and 1280px to cover phones, tablets, and desktops.
- **Touch**: Test tap targets and scroll behavior on real devices or emulation.
- **Zoom**: Ensure layout remains usable at 200% zoom (e.g. no horizontal scroll for main content unless intentional).

---

*All new layouts and components should be responsive by default and follow these breakpoints and patterns.*
