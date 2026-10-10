import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ergastPathFromUrl,
  isF1ProxyEnabled,
  openF1PathFromUrl,
} from "@/lib/api/f1ApiFetch";

describe("ergastPathFromUrl", () => {
  it("extracts /f1 path from full Jolpica URL", () => {
    expect(
      ergastPathFromUrl("https://api.jolpi.ca/ergast/f1/2025/driverStandings.json"),
    ).toBe("/f1/2025/driverStandings.json");
  });

  it("preserves query string", () => {
    expect(ergastPathFromUrl("/f1/2025/results.json?limit=10")).toBe(
      "/f1/2025/results.json?limit=10",
    );
  });
});

describe("openF1PathFromUrl", () => {
  it("strips /api/openf1 prefix", () => {
    expect(openF1PathFromUrl("/api/openf1/sessions?session_key=latest")).toBe(
      "/sessions?session_key=latest",
    );
  });

  it("extracts path from absolute OpenF1 URL", () => {
    expect(openF1PathFromUrl("https://api.openf1.org/v1/drivers?session_key=9158")).toBe(
      "/drivers?session_key=9158",
    );
  });
});

describe("isF1ProxyEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is false when flag is unset", () => {
    vi.stubEnv("VITE_F1_PROXY_ENABLED", "");
    vi.stubEnv("VITE_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "pk");
    expect(isF1ProxyEnabled()).toBe(false);
  });

  it("is true when flag and Supabase env are set", () => {
    vi.stubEnv("VITE_F1_PROXY_ENABLED", "true");
    vi.stubEnv("VITE_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "pk");
    expect(isF1ProxyEnabled()).toBe(true);
  });

  it("is false when Supabase URL is missing", () => {
    vi.stubEnv("VITE_F1_PROXY_ENABLED", "true");
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "pk");
    expect(isF1ProxyEnabled()).toBe(false);
  });
});
