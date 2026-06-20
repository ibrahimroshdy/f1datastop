/// <reference types="vite/client" />

interface ImportMetaEnv {
  // ─── Supabase (required for auth + edge functions) ───────────────────────
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_SUPABASE_PROJECT_ID: string;

  // ─── F1 API (optional) ───────────────────────────────────────────────────
  /** Route Ergast/OpenF1 through Supabase f1-proxy + Postgres cache. */
  readonly VITE_F1_PROXY_ENABLED?: string;
  /** Override Ergast base, e.g. `/api/ergast` on Vercel. */
  readonly VITE_ERGAST_BASE?: string;
  /** Override OpenF1 base, e.g. `/api/openf1` on Vercel. */
  readonly VITE_OPENF1_BASE?: string;

  // ─── AdSense (optional — no ads when unset) ──────────────────────────────
  readonly VITE_ADSENSE_CLIENT_ID?: string;
  readonly VITE_ADSENSE_SLOT_TOP_IN_CONTENT?: string;
  readonly VITE_ADSENSE_SLOT_BOTTOM_IN_CONTENT?: string;
  readonly VITE_ADSENSE_SLOT_SIDEBAR?: string;

  // ─── Analytics (optional — no-op when unset) ─────────────────────────────
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_CLARITY_PROJECT_ID?: string;

  // ─── Maps (optional) ───────────────────────────────────────────────────
  readonly VITE_MAPBOX_TOKEN?: string;

  // ─── reCAPTCHA (optional — public site key) ──────────────────────────────
  readonly VITE_RECAPTCHA_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
