/**
 * API Configuration Constants
 * This file contains all API endpoints, function URLs, and other API-related configuration.
 *
 * Ergast (Jolpica mirror) often does not send CORS headers, so browsers block direct calls from
 * localhost or your deployed domain. Use:
 * - Dev: Vite proxies `/api/ergast` → `https://api.jolpi.ca/ergast` (see vite.config.ts; also enabled for `vite preview`).
 * - Production (default): direct `https://api.jolpi.ca/ergast` — works on static hosts without `/api` rewrites.
 * - Vercel + vercel.json rewrites: set `VITE_ERGAST_BASE=/api/ergast` at build time so traffic goes same-origin.
 *
 * Optional override (origin + path prefix, no trailing slash).
 */
const envErgast = import.meta.env.VITE_ERGAST_BASE as string | undefined;
const ERGAST_BASE =
  envErgast && envErgast.length > 0
    ? envErgast.replace(/\/$/, "")
    : import.meta.env.DEV
      ? "/api/ergast"
      : "https://api.jolpi.ca/ergast";

/**
 * OpenF1: dev uses Vite `/api/openf1`. Production default is direct API URL (no server rewrites required).
 * On Vercel with `vercel.json` OpenF1 rewrite, set `VITE_OPENF1_BASE=/api/openf1` to avoid CORS to api.openf1.org.
 */
const envOpenF1 = import.meta.env.VITE_OPENF1_BASE as string | undefined;
const OPENF1_BASE =
  envOpenF1 && envOpenF1.length > 0
    ? envOpenF1.replace(/\/$/, "")
    : import.meta.env.DEV
      ? "/api/openf1"
      : "https://api.openf1.org/v1";

// F1 API Base URLs
export const F1_API = {
  ERGAST: `${ERGAST_BASE}/f1`,
  ERGAST_BASE,
  OPENF1_BASE,
  /** @deprecated Use OPENF1_BASE — kept for docs/search parity */
  OPENF1: OPENF1_BASE,
};

// Third-party API Configuration
export const THIRD_PARTY_APIS = {
  WEATHER: "https://api.open-meteo.com/v1",
};

// Google reCAPTCHA configuration
export const RECAPTCHA = {
  SITE_KEY: "6LcYyxIrAAAAAEwZXGJ14TO5fztt52s1lgP6qie1", // User's actual site key
};

// API Request Configuration
export const API_CONFIG = {
  DEFAULT_TIMEOUT: 30000, // 30 seconds
  CACHE_DURATION: 1000 * 60 * 60, // 1 hour in milliseconds
}; 