import { describe, expect, it } from "vitest";
import { getScrollContainer, newThresholds, scrollPercent, VisibleClock } from "./engagementUtils";

describe("scrollPercent", () => {
  it("measures the scrolled share of the container", () => {
    expect(scrollPercent({ scrollTop: 0, scrollHeight: 3000, clientHeight: 1000 })).toBe(0);
    expect(scrollPercent({ scrollTop: 1000, scrollHeight: 3000, clientHeight: 1000 })).toBe(50);
    expect(scrollPercent({ scrollTop: 2000, scrollHeight: 3000, clientHeight: 1000 })).toBe(100);
  });

  it("returns null, not 100, when nothing can scroll (the old window-based artifact)", () => {
    expect(scrollPercent({ scrollTop: 0, scrollHeight: 900, clientHeight: 900 })).toBeNull();
  });

  it("clamps overscroll", () => {
    expect(scrollPercent({ scrollTop: 2600, scrollHeight: 3000, clientHeight: 1000 })).toBe(100);
    expect(scrollPercent({ scrollTop: -40, scrollHeight: 3000, clientHeight: 1000 })).toBe(0);
  });
});

describe("getScrollContainer", () => {
  it("prefers #main-content and falls back to the document element", () => {
    const main = { id: "main-content" };
    const html = { id: "html" };
    const withMain = { getElementById: () => main, documentElement: html } as unknown as Document;
    const without = { getElementById: () => null, documentElement: html } as unknown as Document;
    expect(getScrollContainer(withMain)).toBe(main);
    expect(getScrollContainer(without)).toBe(html);
  });
});

describe("newThresholds", () => {
  it("returns only thresholds reached and not yet sent", () => {
    expect(newThresholds(60, [25, 50, 75], [])).toEqual([25, 50]);
    expect(newThresholds(60, [25, 50, 75], [25])).toEqual([50]);
    expect(newThresholds(10, [25, 50], [])).toEqual([]);
  });
});

describe("VisibleClock", () => {
  it("does not count time while the tab is hidden", () => {
    const c = new VisibleClock(0, true);
    c.setVisible(false, 10_000);
    expect(c.seconds(3_600_000)).toBe(10);
    c.setVisible(true, 3_600_000);
    expect(c.seconds(3_605_000)).toBe(15);
  });

  it("starts paused when created in a hidden tab", () => {
    const c = new VisibleClock(0, false);
    expect(c.seconds(60_000)).toBe(0);
  });
});
