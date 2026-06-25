// Shared utilities for the f1-ingest ingestion pipeline.
// Pure helpers: parsing MRData string numerics, slugs, DNF derivation,
// session-type mapping, and exponential backoff scheduling.

/** Parse an Ergast/MRData string numeric into an int, or null. */
export function toInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

/** Parse an Ergast/MRData string numeric into a float, or null. */
export function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

/** Parse a bigint-ish string into a JS number (safe for ms millis), or null. */
export function toBigInt(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v));
  return Number.isFinite(n) ? n : null;
}

export function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/** ISO date (YYYY-MM-DD) -> same string, or null. */
export function toDate(v: unknown): string | null {
  const s = toStr(v);
  if (!s) return null;
  return s.slice(0, 10);
}

/**
 * Derive the DNF flag with the SAME rule as the frontend f1Service:
 * a driver is classified (NOT dnf) iff status === 'Finished' OR status
 * matches '+N Lap(s)'. Anything else (Accident, Engine, +1 Lap typo'd, etc.)
 * is a DNF.
 */
export function deriveIsDnf(status: string | null): boolean {
  if (!status) return true;
  if (status === "Finished") return false;
  if (/^\+\d+\s+Lap/i.test(status)) return false;
  return true;
}

/** URL-safe slug from a name, mirroring the entity-registry convention. */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/**
 * Map an Ergast schedule sub-object name OR an OpenF1 session_name to the
 * canonical session_type enum used by f1_session.
 * ('FP1','FP2','FP3','Q','SQ','SS','S','R')
 */
export function sessionTypeFromOpenF1Name(name: string | null): string | null {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n === "practice 1" || n === "fp1") return "FP1";
  if (n === "practice 2" || n === "fp2") return "FP2";
  if (n === "practice 3" || n === "fp3") return "FP3";
  if (n === "sprint qualifying" || n === "sprint shootout") return "SQ";
  if (n === "sprint") return "S";
  if (n === "qualifying") return "Q";
  if (n === "race") return "R";
  return null;
}

/** Exponential backoff schedule for the retry-until-available poller. */
const BACKOFF_MINUTES = [15, 30, 60, 120]; // caps at 2h

export function nextRetryAt(attemptCount: number): string {
  const idx = Math.min(attemptCount, BACKOFF_MINUTES.length - 1);
  const minutes = BACKOFF_MINUTES[idx];
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

/** Classify an upstream proxy status into transient vs genuine-absence. */
export function isTransient(status: number): boolean {
  // 404 = genuinely absent (stop retrying). 5xx/429/timeout = transient.
  return status === 429 || status === 408 || status === 504 || status >= 500;
}

/** Small inter-request delay to stay rate-limit-safe during backfill loops. */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
