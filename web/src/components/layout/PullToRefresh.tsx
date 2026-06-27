import { useEffect, useRef, useState, type ReactNode } from "react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const PULL_THRESHOLD = 64;
const MAX_PULL = 88;

type Props = {
  children: ReactNode;
};

/**
 * Pull-down to refresh on touch devices. Works in standalone / home-screen mode
 * where the browser does not provide native pull-to-refresh.
 *
 * f1datastop scrolls inside the layout's <main> element (overflow-y-auto), not
 * the window — so we resolve the nearest scrollable ancestor of our anchor and
 * gate the gesture on that scroller being at the top.
 */
export function PullToRefresh({ children }: Props) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLElement | Window | null>(null);
  const startY = useRef(0);
  const pulling = useRef(false);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    pullRef.current = pull;
  }, [pull]);

  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    // Resolve the closest scrollable ancestor (the layout's <main>), falling
    // back to the window if none is found.
    const findScroller = (): HTMLElement | Window => {
      let node = anchorRef.current?.parentElement ?? null;
      while (node) {
        const style = window.getComputedStyle(node);
        if (/(auto|scroll)/.test(style.overflowY)) return node;
        node = node.parentElement;
      }
      return window;
    };
    scrollerRef.current = findScroller();

    const scroller = scrollerRef.current;
    const scrollTop = () =>
      scroller === window
        ? window.scrollY
        : (scroller as HTMLElement).scrollTop;
    const atTop = () => scrollTop() <= 0;

    const onTouchStart = (e: TouchEvent) => {
      // A dialog pins the body (data-modal-open) — don't hijack its scroll.
      if (refreshingRef.current || !atTop() || document.body.dataset.modalOpen)
        return;
      startY.current = e.touches[0]?.clientY ?? 0;
      pulling.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling.current || refreshingRef.current) return;
      const y = e.touches[0]?.clientY ?? 0;
      const dy = y - startY.current;
      if (dy > 0 && atTop()) {
        const next = Math.min(dy * 0.45, MAX_PULL);
        pullRef.current = next;
        setPull(next);
        if (dy > 12) e.preventDefault();
      } else {
        pulling.current = false;
        pullRef.current = 0;
        setPull(0);
      }
    };

    const onTouchEnd = () => {
      if (!pulling.current) return;
      pulling.current = false;
      const current = pullRef.current;
      if (current >= PULL_THRESHOLD) {
        // Hard reload — a real, visible refresh (not a silent refetch).
        setRefreshing(true);
        refreshingRef.current = true;
        setPull(PULL_THRESHOLD);
        window.location.reload();
      } else {
        setPull(0);
        pullRef.current = 0;
      }
    };

    const target = scroller as EventTarget;
    target.addEventListener("touchstart", onTouchStart as EventListener, {
      passive: true,
    });
    target.addEventListener("touchmove", onTouchMove as EventListener, {
      passive: false,
    });
    target.addEventListener("touchend", onTouchEnd as EventListener);
    target.addEventListener("touchcancel", onTouchEnd as EventListener);

    return () => {
      target.removeEventListener("touchstart", onTouchStart as EventListener);
      target.removeEventListener("touchmove", onTouchMove as EventListener);
      target.removeEventListener("touchend", onTouchEnd as EventListener);
      target.removeEventListener("touchcancel", onTouchEnd as EventListener);
    };
  }, []);

  const visible = pull > 8 || refreshing;

  return (
    <>
      <div ref={anchorRef} aria-hidden className="contents" />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center transition-opacity duration-150",
          visible ? "opacity-100" : "opacity-0",
        )}
        style={{
          transform: `translateY(${Math.max(0, pull - 36)}px)`,
        }}
      >
        <div className="mt-[max(0.5rem,env(safe-area-inset-top))] rounded-full bg-card p-2 shadow-md ring-1 ring-border">
          <Spinner size="sm" className="text-primary" />
        </div>
      </div>
      {children}
    </>
  );
}

export default PullToRefresh;
