import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildCacheKey,
  resolveTtlSeconds,
  type F1Source,
} from "./cacheTtl.ts";

export type { F1Source };
export { buildCacheKey, resolveTtlSeconds };

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
