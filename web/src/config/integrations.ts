/** Trimmed env string or empty when unset. */
const env = (key: keyof ImportMetaEnv): string => {
  const value = import.meta.env[key];
  return typeof value === "string" ? value.trim() : "";
};

// ─── Analytics ─────────────────────────────────────────────────────────────
export const gaMeasurementId = env("VITE_GA_MEASUREMENT_ID");
export const isGaEnabled = gaMeasurementId.length > 0;

export const clarityProjectId = env("VITE_CLARITY_PROJECT_ID");
export const isClarityEnabled = clarityProjectId.length > 0;

// ─── AdSense ─────────────────────────────────────────────────────────────────
export const adsenseClientId = env("VITE_ADSENSE_CLIENT_ID");
export const isAdSenseEnabled = adsenseClientId.length > 0;

export const adsenseSlots = {
  topInContent: env("VITE_ADSENSE_SLOT_TOP_IN_CONTENT"),
  bottomInContent: env("VITE_ADSENSE_SLOT_BOTTOM_IN_CONTENT"),
  sidebar: env("VITE_ADSENSE_SLOT_SIDEBAR"),
} as const;
