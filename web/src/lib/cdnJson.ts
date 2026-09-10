/**
 * Static JSON on the CDN (cdn.f1datastop.com, backed by R2).
 *
 * The analysis pipeline snapshots everything the browser used to ask Postgres for —
 * schedule / results / standings (analysis/data_export.py) and the chart / telemetry /
 * replay / circuit indexes (analysis/index_export.py) — as files under `data/`. Reading a
 * file costs nothing (R2 egress is free, Cloudflare caches it at the edge) and keeps the
 * site up when Supabase is restricted, paused or slow. Callers use the CDN first and only
 * fall back to a Supabase query when a file is missing.
 */

const CDN_HOST = ((import.meta.env.VITE_BLOB_HOST as string | undefined) ?? "").replace(/\/+$/, "");

/** True when a CDN host is configured (production + any env with VITE_BLOB_HOST). */
export const hasCdn = (): boolean => CDN_HOST.length > 0;

/**
 * Fetch `data/{path}` from the CDN, or null when the host isn't configured, the object is
 * missing (404 — not exported yet), the body isn't JSON, or the network fails. Never throws.
 */
export async function cdnJson<T = unknown>(path: string): Promise<T | null> {
  if (!CDN_HOST) return null;
  try {
    const res = await fetch(`${CDN_HOST}/data/${path}`, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
