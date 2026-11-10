import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * The sliding act pill (docs/design/decisions.md D7, after Mondar PR #41): one filled pill
 * behind the active item of a segmented control or tab list, gliding to the next item when
 * the choice changes. The container marks itself `data-pill="ready"` once the pill is placed,
 * so items can drop their own active fill and let the pill show through. Without JS, or before
 * the first measure, the active item keeps its own fill.
 */
export function SlidingPill({
  containerRef,
  activeSelector,
}: {
  containerRef: RefObject<HTMLElement>;
  /** Finds the active item inside the container, e.g. `[data-state=active]`. */
  activeSelector: string;
}) {
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const place = () => {
      const active = el.querySelector<HTMLElement>(activeSelector);
      if (!active) {
        setBox(null);
        el.removeAttribute("data-pill");
        return;
      }
      setBox({ x: active.offsetLeft, y: active.offsetTop, w: active.offsetWidth, h: active.offsetHeight });
      el.setAttribute("data-pill", "ready");
    };
    place();
    const mo = new MutationObserver(place);
    mo.observe(el, { subtree: true, attributes: true, attributeFilter: ["data-state", "aria-selected", "aria-current"] });
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => {
      mo.disconnect();
      ro.disconnect();
    };
  }, [containerRef, activeSelector]);

  if (!box) return null;
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 z-0 rounded-full bg-act motion-safe:transition-[transform,width,height] motion-safe:duration-300 motion-safe:ease-[var(--ease-drawer)]"
      style={{ width: box.w, height: box.h, transform: `translate(${box.x}px, ${box.y}px)` }}
    />
  );
}
