import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/integrations", () => ({ isGaEnabled: true }));

afterEach(() => vi.unstubAllGlobals());

describe("view_analysis_click", () => {
  it("uses click_source, never the reserved `source` parameter", async () => {
    const gtag = vi.fn();
    vi.stubGlobal("window", { gtag, location: { href: "https://example.test/" } });
    const { trackViewAnalysisClick } = await import("./GA4.tsx");
    trackViewAnalysisClick({ raceName: "Singapore Grand Prix", round: "17", season: "2026" });
    const call = gtag.mock.calls.find((c) => c[1] === "view_analysis_click");
    expect(call).toBeDefined();
    expect(call![2]).toMatchObject({ click_source: "race_detail_dialog" });
    expect(call![2]).not.toHaveProperty("source");
  });
});

describe("page_view on route change", () => {
  // GA4 Enhanced Measurement counts history changes; a manual page_view here double-counts.
  it("AnalyticsProvider does not send manual page_views", () => {
    const src = readFileSync(resolve(__dirname, "AnalyticsProvider.tsx"), "utf8");
    expect(src).not.toMatch(/trackPageView\s*\(/);
  });
});
