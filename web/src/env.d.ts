/// <reference types="vite/client" />

interface ImportMetaEnv {
  // ─── Supabase (public data reads + edge functions; anonymous, no login) ───
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_SUPABASE_PROJECT_ID: string;

  // ─── F1 API (optional) ───────────────────────────────────────────────────
  /** Route Ergast/OpenF1 through Supabase f1-proxy + Postgres cache. */
  readonly VITE_F1_PROXY_ENABLED?: string;
  /** Serve durable domains from the Postgres warehouse (default off). */
  readonly VITE_DB_SERVING_ENABLED?: string;
  /** Public blob host (Cloudflare R2), e.g. https://f1datastop.r2.dev. */
  readonly VITE_BLOB_HOST?: string;
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
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
