# Frontend Phase 1 — Shell & foundation implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 1 of the frontend upscaling spec: tighter app shell (TopBar, Sidebar, MainLayout, Footer), consistent spacing and motion, and no intentional behavior or data-flow changes.

**Architecture:** All authenticated-style browsing uses `MainLayout` from individual pages (for example `src/pages/Index.tsx`). Adjustments stay in layout components and shared CSS variables in `src/index.css` so page-level data components are untouched. Glass vs solid chrome continues to branch on `useTheme().isGlass` from `src/context/ThemeContext.tsx`.

**Tech stack:** React 18, TypeScript, Vite, Tailwind CSS 3, shadcn/ui, Framer Motion (already in dependencies; use only where it already exists in shell unless a micro-interaction is clearly shell-only).

**Testing note:** There is no unit or E2E runner in `package.json`. Every task uses **contract verification**: `npm run lint` (exit 0), `npm run build` (exit 0), plus the **manual smoke list** in Task 6.

**Authoritative spec:** `docs/superpowers/specs/2026-04-11-frontend-upscaling-design.md` (Phase 1 section).

---

## File map (Phase 1)

| File | Role |
|------|------|
| `src/components/layout/MainLayout.tsx` | Root shell: skip link, glass background mesh, sidebar + main column, main scroll, inner padding, footer slot |
| `src/components/layout/TopBar.tsx` | Sticky chrome, sidebar toggle, mobile logo, theme control |
| `src/components/layout/Sidebar.tsx` | Desktop + mobile nav, collapse state, backdrop, `NavItem`, `SectionHeader` |
| `src/components/layout/MobileNavigation.tsx` | Stacked nav used inside sidebar on small screens |
| `src/components/layout/Footer.tsx` | Site footer inside main scroll area |
| `src/components/layout/nextRace/NextRaceInfo.tsx` | TopBar center cluster; only touch if spacing breaks TopBar rhythm |
| `src/index.css` | CSS variables for theme, glass utilities, radii; add shell-only tokens here if needed |
| `tailwind.config.ts` | Tailwind theme extension; extend only if a token must be first-class in class names |

Do **not** edit chart components, React Query hooks, or `src/App.tsx` route definitions in Phase 1 except where a layout file import path changes (should not be needed).

---

### Task 0: Isolated branch and baseline verification

**Files:**

- Modify: none
- Create: git branch / worktree only

- [ ] **Step 1: Create worktree and branch**

From repo root `/Users/ibrahimroshdy/PycharmProjects/f1datastop` (adjust parent path if you keep worktrees elsewhere):

```bash
cd /Users/ibrahimroshdy/PycharmProjects/f1datastop
git fetch origin
git worktree add ../f1datastop-phase1-shell -b feat/frontend-phase1-shell origin/main
cd ../f1datastop-phase1-shell
```

Expected: new directory `../f1datastop-phase1-shell` on branch `feat/frontend-phase1-shell` with clean `git status`.

- [ ] **Step 2: Install and record baseline lint and build**

```bash
npm ci
npm run lint
npm run build
```

Expected: `eslint` exits 0; `vite build` completes with no TypeScript errors.

- [ ] **Step 3: Commit (optional meta)**

If your process requires an empty checkpoint, skip commit; otherwise no file changes yet.

---

### Task 1: MainLayout — main column rhythm and scroll

**Files:**

- Modify: `src/components/layout/MainLayout.tsx` (approximately lines 80–155: outer shell, `main`, inner padding wrapper)

- [ ] **Step 1: Baseline verification**

```bash
npm run lint && npm run build
```

Expected: PASS (establishes pre-change baseline).

- [ ] **Step 2: Refine `main` and inner wrapper classes**

Goals (no route or cookie behavior changes):

- Keep `id="main-content"` and `role="main"` unchanged.
- Keep skip-link `href="#main-content"` unchanged.
- Harmonize vertical rhythm: use a single padding scale on the content wrapper (for example keep `p-4 md:p-6` or bump to `p-4 md:p-6 lg:px-8` **only** if Footer alignment task uses the same horizontal scale—coordinate with Task 4).
- Add `scroll-smooth` on `<main>` **only** if you confirm no in-page anchor or map interaction depends on instant scroll; if unsure, omit `scroll-smooth`.

Example **illustrative** patch for the inner content wrapper (adjust to match final design; do not remove `isGlass && "relative"`):

```tsx
        <main
          id="main-content"
          role="main"
          className={cn(
            "flex-1 overflow-y-auto overflow-x-hidden",
            "transition-[padding] duration-300 ease-out"
          )}
        >
          <div
            className={cn(
              "min-h-full p-4 md:p-6 lg:px-8",
              isGlass && "relative"
            )}
          >
            <div className="animate-fade-in">{children}</div>
          </div>
```

- [ ] **Step 3: Verify**

```bash
npm run lint && npm run build
```

Expected: PASS.

- [ ] **Step 4: Manual smoke (MainLayout)**

With `npm run dev`, visit `/`, `/calendar`, `/race-analysis`. Confirm: sidebar toggle, collapse (desktop), mobile drawer, theme/glass toggle, and full-width map/calendar still usable. No change to when data appears.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/MainLayout.tsx
git commit -m "refactor(layout): tighten main content shell spacing"
```

---

### Task 2: TopBar — density and chrome consistency

**Files:**

- Modify: `src/components/layout/TopBar.tsx` (lines 26–114: root bar, sections, button classes)
- Modify (optional): `src/components/layout/nextRace/NextRaceInfo.tsx` — only if clipping or overflow appears after TopBar change

- [ ] **Step 1: Baseline**

```bash
npm run lint && npm run build
```

- [ ] **Step 2: Adjust TopBar layout**

Keep props `sidebarOpen` / `setSidebarOpen` and all event handlers identical.

Illustrative adjustments (pick what matches `.cursor/DESIGN_PHILOSOPHY.md` after visual check):

- Align horizontal padding with MainLayout: e.g. `px-3 sm:px-4 lg:px-6` if main uses `lg:px-8`.
- Ensure icon buttons stay `h-8 w-8` and meet focus ring rules from `.cursor/ACCESSIBILITY.md` (`focus-visible:ring-2` already present on toggle—mirror on other icon-only controls if any lack it).

Example snippet for root bar only:

```tsx
    <div
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center justify-between gap-2 px-3 sm:px-4 lg:px-6",
        "transition-colors duration-200",
        isGlass
          ? "glass-topbar"
          : "border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      )}
    >
```

- [ ] **Step 3: Verify**

```bash
npm run lint && npm run build
```

- [ ] **Step 4: Manual smoke**

Narrow viewport: logo appears when sidebar closed; toggle works. Glass theme: topbar still readable.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/TopBar.tsx
git commit -m "style(layout): refine TopBar spacing and chrome"
```

---

### Task 3: Sidebar — nav item and section rhythm

**Files:**

- Modify: `src/components/layout/Sidebar.tsx` (`NavItem` ~126–151, `SectionHeader` ~204–216, sidebar container ~236–252, header block ~255–307)

- [ ] **Step 1: Baseline**

```bash
npm run lint && npm run build
```

- [ ] **Step 2: Unify desktop nav density with design tokens**

Do not change `mainNavigation`, `protectedNavigation`, or `authNavigation` arrays or routes.

Within `NavItem` `className` for the `Link`, keep behavior (active styles, `aria-current`, tooltips when collapsed). Adjust only spacing/rounding to align with `MobileNavigation` (for example both use `rounded-md` **or** both use `rounded-xl`—pick one and apply to `NavItem` and `MobileNavigation` in Task 3b).

**3a — Sidebar `NavItem` example target:**

```tsx
        className={cn(
          "group relative flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-200",
          isCollapsed && !isMediumOrSmaller ? "justify-center px-2 py-2" : "px-3 py-2",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
```

**3b — MobileNavigation match**

Modify: `src/components/layout/MobileNavigation.tsx` (lines 28–50) so border radius, vertical padding, and active/hover intensities match the desktop `NavItem` choice. Do not remove `aria-current` or `onNavClick`.

- [ ] **Step 3: Verify**

```bash
npm run lint && npm run build
```

- [ ] **Step 4: Manual smoke**

Desktop: collapse/expand, tooltips when collapsed, active route indicator. Mobile: backdrop tap closes drawer; navigation still closes sheet on navigate.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Sidebar.tsx src/components/layout/MobileNavigation.tsx
git commit -m "style(layout): align sidebar and mobile nav density"
```

---

### Task 4: Footer — align with main horizontal gutters

**Files:**

- Modify: `src/components/layout/Footer.tsx` (outer `footer` and inner `container` ~45–51)

- [ ] **Step 1: Baseline**

```bash
npm run lint && npm run build
```

- [ ] **Step 2: Match horizontal padding to MainLayout**

If MainLayout content wrapper uses `p-4 md:p-6 lg:px-8`, Footer’s inner wrapper should use the same horizontal padding so the footer grid lines up with page content. Prefer replacing `container mx-auto px-4` with explicit max-width + padding consistent with MainLayout, for example:

```tsx
    <footer className={cn("relative mt-auto", /* existing glass/card classes */)}>
      <div className="mx-auto w-full max-w-[1600px] px-4 md:px-6 lg:px-8 py-8 md:py-12">
```

Do **not** change link URLs or external `rel`/`target` behavior.

- [ ] **Step 3: Verify**

```bash
npm run lint && npm run build
```

- [ ] **Step 4: Manual smoke**

Scroll to footer on `/` and `/privacy`; check glass and non-glass themes.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Footer.tsx
git commit -m "style(layout): align Footer gutters with main shell"
```

---

### Task 5: Optional shell tokens in CSS (only if Tasks 1–4 need them)

**Files:**

- Modify: `src/index.css` (add variables under `:root` / `.dark` only if a repeated literal appears twice or more across layout files)
- Modify: `tailwind.config.ts` only if you extend `theme.extend` for a new spacing key

- [ ] **Step 1: Decide YAGNI**

If padding values are single-use Tailwind classes, **skip this task** entirely (mark all checkboxes done with N/A in commit message or omit task from execution).

- [ ] **Step 2: If needed, add variables**

Example (only if adopted):

```css
  :root {
    --shell-pad-x: 1rem;
    --shell-pad-x-md: 1.5rem;
    --shell-pad-x-lg: 2rem;
  }
```

Then reference via arbitrary values or document in comments—prefer Tailwind consistency over new variables unless the spec requires shared tokens.

- [ ] **Step 3: Verify**

```bash
npm run lint && npm run build
```

- [ ] **Step 4: Commit** (if files changed)

```bash
git add src/index.css tailwind.config.ts
git commit -m "chore(theme): add shell spacing tokens for layout"
```

---

### Task 6: Phase 1 exit — full verification and PR

**Files:** none (checklist only)

- [ ] **Step 1: Lint and production build**

```bash
npm run lint
npm run build
```

Expected: both exit 0.

- [ ] **Step 2: Manual smoke matrix** (from spec Phase 1 exit)

| Route | Check |
|-------|--------|
| `/` | Dashboard loads; TopBar + sidebar behave; no console errors on cold load |
| `/race-analysis` | Page renders inside shell; charts unchanged functionally |
| `/calendar` | Map/globe or calendar full width still works; sidebar does not trap focus incorrectly |
| `/auth/login` | Layout acceptable (may not use MainLayout—confirm no regression if auth uses different layout) |

- [ ] **Step 3: Open PR** (or hand off to human)

Title example: `feat(ui): Phase 1 shell spacing and nav consistency`

Description should link `docs/superpowers/specs/2026-04-11-frontend-upscaling-design.md` Phase 1 and this plan file.

---

## Plan self-review (spec coverage)

| Spec requirement (Phase 1) | Task |
|----------------------------|------|
| App shell TopBar/Sidebar/MainLayout | Tasks 1–3 |
| Page gutters / rhythm | Tasks 1, 4 (and optional 5) |
| Motion limited to shell | Tasks 1–2 use existing `transition-*` only; no new chart animation |
| Cross-cutting empty/error at shell | Not required unless shell currently shows raw spinners; **no task** unless audit finds shell-level loading UI outside F1 components |
| No deep Analytics/calendar/auth refactors | File map excludes those pages |
| Verification | Task 0 baseline + Task 6 exit; per-task lint/build |

**Placeholder scan:** None.

**Type/name consistency:** `NavItem` / `MobileNavigation` share the same rounding token by construction in Task 3.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-11-frontend-phase1-shell.md`.

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, spec compliance review, then code quality review, before the next task.

**2. Inline execution** — Run tasks sequentially in one session with human checkpoints after each task.

Which approach do you want for implementation?
