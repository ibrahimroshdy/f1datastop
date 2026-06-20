import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type F1Source = "ergast" | "openf1";

export type ProxyRequest = {
  source: F1Source;
  path: string;
  params?: Record<string, string>;
};

export type ProxyResponse = {
  data: unknown;
  cached: boolean;
  status: number;
  cacheKey: string;
  error?: string;
};

const UPSTREAM: Record<F1Source, string> = {
  ergast: "https://api.jolpi.ca/ergast",
  openf1: "https://api.openf1.org/v1",
};

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

/** Per-source TTLs (seconds) per REFACTOR_PLAN Phase 4.2 */
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

  // openf1
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

function buildUpstreamUrl(
  source: F1Source,
  path: string,
  params?: Record<string, string>,
): string {
  const base = UPSTREAM[source];
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${base}${normalizedPath}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

export function createServiceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function logMetric(
  admin: SupabaseClient,
  entry: {
    source: F1Source;
    cacheKey: string;
    cacheHit: boolean;
    statusCode: number;
    isRateLimit: boolean;
  },
) {
  try {
    await admin.from("api_metrics").insert({
      source: entry.source,
      cache_key: entry.cacheKey,
      cache_hit: entry.cacheHit,
      status_code: entry.statusCode,
      is_rate_limit: entry.isRateLimit,
    });
  } catch (e) {
    console.error("api_metrics insert failed:", e);
  }
}

export async function proxyF1Request(
  admin: SupabaseClient,
  req: ProxyRequest,
): Promise<ProxyResponse> {
  const { source, path, params } = req;
  if (!source || !path) {
    return {
      data: null,
      cached: false,
      status: 400,
      cacheKey: "",
      error: "source and path are required",
    };
  }

  const cacheKey = buildCacheKey(source, path, params);
  const now = new Date();

  const { data: cached, error: cacheReadErr } = await admin
    .from("api_cache")
    .select("data, expires_at")
    .eq("cache_key", cacheKey)
    .maybeSingle();

  if (cacheReadErr) {
    console.error("cache read error:", cacheReadErr);
  }

  if (cached && new Date(cached.expires_at) > now) {
    await logMetric(admin, {
      source,
      cacheKey,
      cacheHit: true,
      statusCode: 200,
      isRateLimit: false,
    });
    return { data: cached.data, cached: true, status: 200, cacheKey };
  }

  const upstreamUrl = buildUpstreamUrl(source, path, params);
  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      headers: { Accept: "application/json" },
    });
  } catch (e) {
    await logMetric(admin, {
      source,
      cacheKey,
      cacheHit: false,
      statusCode: 502,
      isRateLimit: false,
    });
    return {
      data: null,
      cached: false,
      status: 502,
      cacheKey,
      error: (e as Error).message,
    };
  }

  const isRateLimit = upstreamResponse.status === 429;
  await logMetric(admin, {
    source,
    cacheKey,
    cacheHit: false,
    statusCode: upstreamResponse.status,
    isRateLimit,
  });

  if (!upstreamResponse.ok) {
    const text = await upstreamResponse.text();
    return {
      data: null,
      cached: false,
      status: upstreamResponse.status,
      cacheKey,
      error: text.slice(0, 500) || upstreamResponse.statusText,
    };
  }

  const payload = await upstreamResponse.json();
  const ttl = resolveTtlSeconds(source, path, params);
  const expiresAt = new Date(now.getTime() + ttl * 1000).toISOString();

  const { error: upsertErr } = await admin.from("api_cache").upsert(
    {
      cache_key: cacheKey,
      source,
      data: payload,
      expires_at: expiresAt,
      updated_at: now.toISOString(),
    },
    { onConflict: "cache_key" },
  );

  if (upsertErr) {
    console.error("cache upsert error:", upsertErr);
  }

  return { data: payload, cached: false, status: 200, cacheKey };
}

/** Purge expired cache rows. Returns number of deleted rows. */
export async function purgeExpiredCache(admin: SupabaseClient): Promise<number> {
  const { data, error } = await admin
    .from("api_cache")
    .delete()
    .lt("expires_at", new Date().toISOString())
    .select("cache_key");

  if (error) {
    console.error("purge error:", error);
    return 0;
  }
  return data?.length ?? 0;
}
