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
 */
const envErgast = import.meta.env.VITE_ERGAST_BASE as string | undefined;
const ERGAST_BASE =
  envErgast && envErgast.length > 0
    ? envErgast.replace(/\/$/, "")
    : import.meta.env.DEV
      ? "/api/ergast"
      : "https://api.jolpi.ca/ergast";

// Supabase Function URLs
export const SUPABASE_FUNCTIONS = {
  NOTIFY_SLACK: "https://envqfquhkcbnitwlzepx.functions.supabase.co/notify-slack",
  VERIFY_CAPTCHA: "https://envqfquhkcbnitwlzepx.functions.supabase.co/verify-captcha",
};

// F1 API Base URLs
export const F1_API = {
  ERGAST: `${ERGAST_BASE}/f1`,
  ERGAST_BASE,
  OPENF1: "https://api.openf1.org/v1",
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