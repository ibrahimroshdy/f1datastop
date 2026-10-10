/**
 * Public URL for a large asset (chart PNG/WebP, telemetry blob, replay, circuit geometry).
 *
 * Blobs live on Cloudflare R2 behind VITE_BLOB_HOST; Postgres rows keep a host-free
 * `storage_path` so the host is a single env var, never baked into 124k rows. The row's
 * stored `public_url` is only a fallback for when the host isn't configured.
 */
export type BlobBucket = "charts" | "telemetry" | "replays" | "circuits";

const HOST = ((import.meta.env.VITE_BLOB_HOST as string | undefined) ?? "").replace(/\/+$/, "");

export function blobUrl(
  bucket: BlobBucket,
  storagePath?: string | null,
  fallback?: string | null,
): string {
  if (HOST && storagePath) return `${HOST}/${bucket}/${storagePath.replace(/^\/+/, "")}`;
  return fallback ?? "";
}
