export type F1Source = "ergast" | "openf1";

/** Build a stable cache key from source + path + sorted query params. */
export function buildCacheKey(
  source: F1Source,
  path: string,
  params?: Record<string, string>,
): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!params || Object.keys(params).length === 0) {
    return `${source}:${normalizedPath}`;
  }
  const qs = new URLSearchParams(
    Object.entries(params).sort(([a], [b]) => a.localeCompare(b)),
  ).toString();
  return `${source}:${normalizedPath}?${qs}`;
}

/** Per-source TTLs (seconds) for f1-proxy cache entries. */
export function resolveTtlSeconds(
  source: F1Source,
  path: string,
  params?: Record<string, string>,
): number {
  const p = path.toLowerCase();
  const paramStr = params ? JSON.stringify(params).toLowerCase() : "";

  if (source === "ergast") {
    if (p.includes("driverstandings") || p.includes("constructorstandings")) {
      return 5 * 60;
    }
    if (/\/f1\/\d{4}\.json$/i.test(p)) {
      return 24 * 60 * 60;
    }
    if (p.includes("/laps")) {
      return 30 * 24 * 60 * 60;
    }
    if (
      p.includes("/results") ||
      p.includes("/qualifying") ||
      p.includes("/pitstops") ||
      p.includes("/sprint")
    ) {
      return 30 * 24 * 60 * 60;
    }
    if (p.includes("/circuits")) {
      return 7 * 24 * 60 * 60;
    }
    return 60 * 60;
  }

  const live =
    paramStr.includes("session_key=latest") ||
    p.includes("session_key=latest") ||
    params?.session_key === "latest";
  if (live) return 30;

  if (
    p.includes("/car_data") ||
    p.includes("/position") ||
    p.includes("/intervals") ||
    p.includes("/race_control")
  ) {
    return 30;
  }

  if (p.includes("/sessions")) {
    return 60 * 60;
  }

  if (
    p.includes("/laps") ||
    p.includes("/drivers") ||
    p.includes("/weather") ||
    p.includes("/team_radio") ||
    p.includes("/starting_grid")
  ) {
    return 30 * 24 * 60 * 60;
  }

  return 60 * 60;
}
