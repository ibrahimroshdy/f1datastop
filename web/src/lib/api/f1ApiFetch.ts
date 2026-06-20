import { F1_API } from "@/constants/apiConfig";
import { supabase } from "@/integrations/supabase/client";

export type F1ApiSource = "ergast" | "openf1";

type ProxyPayload = {
  data: unknown;
  cached?: boolean;
  cacheKey?: string;
  status?: number;
  error?: string;
};

/** When true, F1/OpenF1 requests go through the Supabase f1-proxy edge function. */
export function isF1ProxyEnabled(): boolean {
  return (
    import.meta.env.VITE_F1_PROXY_ENABLED === "true" &&
    !!import.meta.env.VITE_SUPABASE_URL &&
    !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  );
}

function directBase(source: F1ApiSource): string {
  return source === "ergast" ? F1_API.ERGAST_BASE : F1_API.OPENF1_BASE;
}

/** Split "/path?a=1" into path + params for the proxy body. */
function splitPathAndParams(pathWithQuery: string): {
  path: string;
  params?: Record<string, string>;
} {
  const qIndex = pathWithQuery.indexOf("?");
  if (qIndex === -1) {
    return { path: pathWithQuery };
  }
  const path = pathWithQuery.slice(0, qIndex);
  const params = Object.fromEntries(
    new URLSearchParams(pathWithQuery.slice(qIndex + 1)),
  );
  return { path, params };
}

async function fetchViaProxy(
  source: F1ApiSource,
  pathWithQuery: string,
): Promise<Response> {
  const { path, params } = splitPathAndParams(pathWithQuery);

  const { data, error } = await supabase.functions.invoke<ProxyPayload>(
    "f1-proxy",
    { body: { source, path, params } },
  );

  if (error) {
    throw new Error(error.message || "f1-proxy invoke failed");
  }

  const status = data?.status ?? 200;
  if (data?.error && status >= 400) {
    const err = new Error(data.error) as Error & { status?: number };
    err.status = status;
    throw err;
  }

  return new Response(JSON.stringify(data?.data ?? null), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Cache": data?.cached ? "HIT" : "MISS",
    },
  });
}

async function fetchDirect(
  source: F1ApiSource,
  pathWithQuery: string,
): Promise<Response> {
  const base = directBase(source).replace(/\/$/, "");
  const normalized = pathWithQuery.startsWith("/")
    ? pathWithQuery
    : `/${pathWithQuery}`;

  return fetch(`${base}${normalized}`, {
    mode: "cors",
    headers: { Accept: "application/json" },
  });
}

/**
 * Fetch Ergast or OpenF1 data. Uses Supabase f1-proxy when
 * VITE_F1_PROXY_ENABLED=true; otherwise direct / Vercel rewrite URLs.
 */
export async function fetchF1Api(
  source: F1ApiSource,
  pathWithQuery: string,
): Promise<Response> {
  if (isF1ProxyEnabled()) {
    return fetchViaProxy(source, pathWithQuery);
  }
  return fetchDirect(source, pathWithQuery);
}

/** Extract Ergast-relative path from a legacy full URL. */
export function ergastPathFromUrl(url: string): string {
  const f1Index = url.indexOf("/f1");
  if (f1Index >= 0) return url.slice(f1Index);
  try {
    const parsed = new URL(url);
    const idx = parsed.pathname.indexOf("/f1");
    if (idx >= 0) {
      return parsed.pathname.slice(idx) + parsed.search;
    }
  } catch {
    // not an absolute URL
  }
  return url;
}

/** Extract OpenF1-relative path from a legacy full URL. */
export function openF1PathFromUrl(url: string): string {
  const base = F1_API.OPENF1_BASE.replace(/\/$/, "");
  if (url.startsWith(base)) {
    return url.slice(base.length) || "/";
  }
  if (url.startsWith("/api/openf1")) {
    return url.replace(/^\/api\/openf1/, "") || "/";
  }
  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/^\/v1/, "") + parsed.search;
  } catch {
    return url;
  }
}

/** Retry wrapper for direct upstream calls (429 / network). Skipped when proxy handles upstream. */
export async function throttledFetchF1(
  source: F1ApiSource,
  pathOrUrl: string,
  retryDelay = 2000,
  maxRetries = 3,
  attemptRef?: Record<string, number>,
): Promise<Response> {
  const path = pathOrUrl.includes("://") || pathOrUrl.startsWith("/api/")
    ? source === "ergast"
      ? ergastPathFromUrl(pathOrUrl)
      : openF1PathFromUrl(pathOrUrl)
    : pathOrUrl;

  let retries = 0;
  const requestId = path.split("?")[0] + "_" + Math.random().toString(36).slice(2, 9);
  if (attemptRef) attemptRef[requestId] = 0;

  while (true) {
    try {
      const response = await fetchF1Api(source, path);

      if (response.status === 429 && retries < maxRetries) {
        retries++;
        if (attemptRef) attemptRef[requestId] = retries;

        let delay = retryDelay * 2 ** retries * (0.8 + Math.random() * 0.4);
        const retryAfter = response.headers.get("Retry-After");
        if (retryAfter) {
          const sec = parseInt(retryAfter, 10);
          if (!Number.isNaN(sec)) delay = Math.max(delay, sec * 1000);
        }
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      return response;
    } catch (error) {
      if (retries < maxRetries) {
        retries++;
        if (attemptRef) attemptRef[requestId] = retries;
        await new Promise((r) => setTimeout(r, retryDelay * 2 ** retries));
        continue;
      }
      throw error;
    }
  }
}

/** Convenience alias for Ergast paths like `/f1/2025/driverStandings.json`. */
export const ergastFetch = (path: string) => fetchF1Api("ergast", path);

/** Convenience alias for OpenF1 paths like `/sessions?session_key=latest`. */
export const openF1Fetch = (path: string) => fetchF1Api("openf1", path);

export const throttledErgastFetch = (
  pathOrUrl: string,
  retryDelay?: number,
  maxRetries?: number,
  attemptRef?: Record<string, number>,
) => throttledFetchF1("ergast", pathOrUrl, retryDelay, maxRetries, attemptRef);

export const throttledOpenF1Fetch = (
  pathOrUrl: string,
  retryDelay?: number,
  maxRetries?: number,
  attemptRef?: Record<string, number>,
) => throttledFetchF1("openf1", pathOrUrl, retryDelay, maxRetries, attemptRef);
