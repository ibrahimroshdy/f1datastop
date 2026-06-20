/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Supabase (required)
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_SUPABASE_PROJECT_ID: string;

  // AdSense (optional — units render only when a slot id is set)
  readonly VITE_ADSENSE_CLIENT_ID?: string;
  readonly VITE_ADSENSE_SLOT_TOP_IN_CONTENT?: string;
  readonly VITE_ADSENSE_SLOT_BOTTOM_IN_CONTENT?: string;
  readonly VITE_ADSENSE_SLOT_SIDEBAR?: string;

  // Analytics (optional — disabled when unset)
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_CLARITY_PROJECT_ID?: string;

  // Maps (optional)
  readonly VITE_MAPBOX_TOKEN?: string;

  // reCAPTCHA (optional — site key, public)
  readonly VITE_RECAPTCHA_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
