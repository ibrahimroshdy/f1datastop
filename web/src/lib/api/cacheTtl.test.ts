import { describe, expect, it } from "vitest";
import {
  buildCacheKey,
  resolveTtlSeconds,
} from "../../../../supabase/functions/_shared/cacheTtl";

describe("buildCacheKey", () => {
  it("normalizes path and omits empty params", () => {
    expect(buildCacheKey("ergast", "f1/2025.json")).toBe("ergast:/f1/2025.json");
  });

  it("sorts query params for stable keys", () => {
    expect(
      buildCacheKey("openf1", "/sessions", { year: "2025", session_key: "latest" }),
    ).toBe("openf1:/sessions?session_key=latest&year=2025");
  });
});

describe("resolveTtlSeconds", () => {
  it("uses short TTL for live OpenF1 data", () => {
    expect(resolveTtlSeconds("openf1", "/position", { session_key: "latest" })).toBe(30);
  });

  it("uses 5 minutes for Ergast standings", () => {
    expect(resolveTtlSeconds("ergast", "/f1/2025/driverStandings.json")).toBe(300);
  });

  it("uses 24h for season schedule", () => {
    expect(resolveTtlSeconds("ergast", "/f1/2025.json")).toBe(86400);
  });

  it("uses 30 days for race results", () => {
    expect(resolveTtlSeconds("ergast", "/f1/2025/1/results.json")).toBe(30 * 24 * 60 * 60);
  });

  it("defaults to 1 hour for unknown Ergast paths", () => {
    expect(resolveTtlSeconds("ergast", "/f1/2025/status.json")).toBe(3600);
  });
});
