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
  stale?: boolean;
};

const UPSTREAM_TIMEOUT_MS = 8000;

/**
 * True when an Ergast payload is a "not yet published" shell: a race row exists
 * but every known result array is present-and-empty, or the Races list is empty.
 * Such payloads must not be durably cached (they'd mask real data for the TTL).
 * Returns false for unknown shapes (standings/schedule) so they cache normally.
 */
function isEmptyErgastPayload(payload: unknown): boolean {
  const races = (payload as any)?.MRData?.RaceTable?.Races;
  if (!Array.isArray(races)) return false;
  if (races.length === 0) return true;
  const r0 = races[0] ?? {};
  const arrays = [r0.Results, r0.QualifyingResults, r0.SprintResults, r0.PitStops, r0.Laps];
  const present = arrays.filter((a: unknown) => Array.isArray(a));
  if (present.length === 0) return false; // no result arrays in this endpoint's shape
  return present.every((a: unknown[]) => a.length === 0);
}

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

  // When the upstream (Jolpica/OpenF1) is slow or down, fall back to the last
  // cached payload even if expired — stale data beats a blank site.
  const staleFallback = (status: number, error: string): ProxyResponse => {
    if (cached) {
      return { data: cached.data, cached: true, stale: true, status: 200, cacheKey };
    }
    return { data: null, cached: false, status, cacheKey, error };
  };

  let upstreamResponse: Response;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    await logMetric(admin, {
      source,
      cacheKey,
      cacheHit: false,
      statusCode: 504,
      isRateLimit: false,
    });
    return staleFallback(504, (e as Error).message);
  }
  clearTimeout(timer);

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
    return staleFallback(
      upstreamResponse.status,
      text.slice(0, 500) || upstreamResponse.statusText,
    );
  }

  const payload = await upstreamResponse.json();
  let ttl = resolveTtlSeconds(source, path, params);
  // Never durably cache an empty / not-yet-published Ergast payload (e.g. a race
  // whose results aren't out yet returns a race shell with empty result arrays).
  // The long durable TTL would otherwise mask the real data for weeks once it
  // lands. Keep such responses short-lived so they refresh on the next request.
  if (ttl > 300 && isEmptyErgastPayload(payload)) {
    ttl = 120;
  }
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
