import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { NavLink } from "react-router-dom";

import { cn } from "@/lib/utils";

export type ViewItem<T extends string> = {
  key: T;
  label: ReactNode;
  icon?: LucideIcon;
  /** Route mode: render a NavLink (active = current route) instead of a button. */
  to?: string;
  /** NavLink `end` matching for the `to` route. */
  end?: boolean;
  /** Small attention dot on the item (e.g. live/new data). */
  dot?: boolean;
};

// Static so Tailwind keeps the classes (no dynamic `grid-cols-${n}`).
const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
};

/**
 * Canonical view / mode switcher for f1datastop — THE pattern for switching
 * between views of the same screen. A raised pill marks the active view on a
 * muted track. NEVER use a horizontal scroll strip of buttons or a <select> for
 * this (see docs/MOBILE_PATTERNS.md).
 *
 * Modes per item:
 * - state: pass `value` + `onChange`; active item is `key === value`.
 * - route: give an item a `to`; it renders a `NavLink`, active on route match.
 *
 * `stack`: on mobile, lay items out as an EVEN grid with the icon stacked above
 * the label (all views visible at once, no scroll) — use for 4+ items. Collapses
 * to a single inline row from `sm` up. Without `stack`, an inline row at every
 * width (good for 2–3 items). Pass `cols` to force the mobile grid column count
 * (defaults to `items.length`, capped at 6); e.g. 9 items → `cols={3}`.
 */
export function ViewSwitcher<T extends string>({
  items,
  value,
  onChange,
  stack = false,
  compact = false,
  cols,
  className,
}: {
  items: ReadonlyArray<ViewItem<T>>;
  value?: T;
  onChange?: (value: T) => void;
  stack?: boolean;
  /** Tighter mobile sizing (smaller min-height/padding/icon) in `stack` mode. */
  compact?: boolean;
  /** Mobile grid columns in `stack` mode. Defaults to items.length (max 6). */
  cols?: number;
  className?: string;
}) {
  const gridCols = GRID_COLS[cols ?? items.length] ?? "grid-cols-3";

  const itemClass = (active: boolean) =>
    cn(
      "rounded-md font-semibold tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      stack
        ? cn(
            "flex flex-col items-center justify-center gap-1 px-1 text-center text-[11px] leading-tight sm:min-h-0 sm:flex-row sm:gap-1.5 sm:px-3 sm:py-0 sm:text-xs",
            compact ? "min-h-[44px] py-1.5" : "min-h-[52px] py-2",
          )
        : "inline-flex min-h-[36px] items-center justify-center gap-1.5 px-3 text-xs",
      active
        ? "bg-card text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground",
    );

  return (
    <div
      className={cn(
        "rounded-lg bg-muted/60 p-1",
        stack
          ? cn("grid gap-1 sm:inline-flex sm:h-10 sm:gap-0", gridCols)
          : "inline-flex h-10",
        className,
      )}
      role="tablist"
    >
      {items.map(({ key, label, icon: Icon, to, end, dot }) => {
        const content = (
          <>
            {Icon ? (
              <span className="relative shrink-0">
                <Icon className={cn(compact ? "h-3.5 w-3.5 sm:h-4 sm:w-4" : "h-4 w-4")} />
                {dot ? (
                  <span aria-hidden className="absolute -right-1 -top-1 flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary ring-1 ring-background" />
                  </span>
                ) : null}
              </span>
            ) : null}
            <span className={stack ? "line-clamp-2" : undefined}>{label}</span>
            {dot && !Icon ? (
              <span aria-hidden className="ms-1 inline-flex h-2 w-2 rounded-full bg-primary" />
            ) : null}
          </>
        );

        if (to != null) {
          return (
            <NavLink key={key} to={to} end={end} className={({ isActive }) => itemClass(isActive)}>
              {content}
            </NavLink>
          );
        }
        const active = key === value;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(key)}
            className={itemClass(active)}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
