/**
 * API Configuration Constants
 * This file contains all API endpoints, function URLs, and other API-related configuration.
 *
 * Ergast (Jolpica mirror) often does not send CORS headers, so browsers block direct calls from
 * localhost or your deployed domain. Use:
 * - Dev: Vite proxies `/api/ergast` → `https://api.jolpi.ca/ergast` (see vite.config.ts; also enabled for `vite preview`).
 * - Production: set `VITE_ERGAST_BASE=/api/ergast` and add a host rewrite (e.g. vercel.json) OR set
 *   `VITE_ERGAST_BASE=https://your-server.com/ergast-proxy` to your own proxy.
 *
 * Optional override (full origin + path prefix, no trailing slash): e.g. `https://api.jolpi.ca/ergast`
 *
 * Production default `/api/ergast` expects a host rewrite (see vercel.json). Override if you proxy elsewhere.
 */
const envErgast = import.meta.env.VITE_ERGAST_BASE as string | undefined;
const ERGAST_BASE =
  envErgast && envErgast.length > 0
    ? envErgast.replace(/\/$/, "")
    : "/api/ergast";

/**
 * OpenF1: direct browser calls often hit CORS on custom domains. Default `/api/openf1` uses Vite (dev) or
 * Vercel rewrite (prod). Override with `VITE_OPENF1_BASE` if needed (must allow your origin).
 */
const envOpenF1 = import.meta.env.VITE_OPENF1_BASE as string | undefined;
const OPENF1_BASE =
  envOpenF1 && envOpenF1.length > 0
    ? envOpenF1.replace(/\/$/, "")
    : "/api/openf1";

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