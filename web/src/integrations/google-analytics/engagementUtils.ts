/**
 * Pure helpers for EngagementTracker, kept separate so they can be unit tested.
 */

/** The element that actually scrolls page content. MainLayout pins the document to the
 * viewport (h-screen overflow-hidden) and scrolls <main id="main-content">, so the window
 * itself never moves. Falls back to the document for layouts without that container. */
export const SCROLL_CONTAINER_ID = 'main-content';

export function getScrollContainer(doc: Document = document): HTMLElement {
  return (doc.getElementById(SCROLL_CONTAINER_ID) as HTMLElement | null) ?? doc.documentElement;
}

/**
 * Percentage of the scrollable length that has been scrolled, 0-100, or null when the
 * content fits without scrolling (nothing to measure; do not report 100%).
 */
export function scrollPercent(el: Pick<HTMLElement, 'scrollTop' | 'scrollHeight' | 'clientHeight'>): number | null {
  const track = el.scrollHeight - el.clientHeight;
  if (track <= 0) return null;
  return Math.min(100, Math.max(0, Math.floor((el.scrollTop / track) * 100)));
}

/** Thresholds newly reached by `value` that have not been reported yet. */
export function newThresholds(value: number, thresholds: number[], reached: number[]): number[] {
  return thresholds.filter((t) => value >= t && !reached.includes(t));
}

/**
 * Accumulates time only while the tab is visible, so a background tab does not keep
 * producing time_on_page events (which started empty GA sessions after the 30 min timeout).
 */
export class VisibleClock {
  private total = 0;
  private since: number | null;

  constructor(now: number, visible: boolean) {
    this.since = visible ? now : null;
  }

  setVisible(visible: boolean, now: number): void {
    if (visible && this.since === null) this.since = now;
    if (!visible && this.since !== null) {
      this.total += now - this.since;
      this.since = null;
    }
  }

  seconds(now: number): number {
    const running = this.since === null ? 0 : now - this.since;
    return Math.floor((this.total + running) / 1000);
  }
}
