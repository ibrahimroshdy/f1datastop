/**
 * AdSense client + slot IDs from env (Vite `VITE_*`).
 * Create **Display** ad units in AdSense → Ads → Ad units; use each unit’s numeric **Ad slot** ID here.
 *
 * **Brand safety:** categories (e.g. sensitive topics) are controlled in AdSense
 * → Blocking controls → Sensitive categories / General categories — not in HTML.
 */

export const ADSENSE_CLIENT_ID =
  (import.meta.env.VITE_ADSENSE_CLIENT_ID as string | undefined)?.trim() ||
  "ca-pub-3379071701548171";

const trim = (v: string | undefined) => (v ?? "").trim();

export const adsenseSlots = {
  topInContent: trim(import.meta.env.VITE_ADSENSE_SLOT_TOP_IN_CONTENT),
  bottomInContent: trim(import.meta.env.VITE_ADSENSE_SLOT_BOTTOM_IN_CONTENT),
  sidebar: trim(import.meta.env.VITE_ADSENSE_SLOT_SIDEBAR),
} as const;
