import {
  adsenseClientId,
  gaMeasurementId,
  isAdSenseEnabled,
  isGaEnabled,
} from "@/config/integrations";

/** EEA/UK/CH consent defaults — no secrets; pairs with AdSense CMP when enabled. */
const CONSENT_DEFAULTS = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
  functionality_storage: "denied",
  personalization_storage: "denied",
  security_storage: "granted",
  wait_for_update: 500,
  region: [
    "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
    "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
    "SI", "ES", "SE", "IS", "LI", "NO", "GB", "CH",
  ],
} as const;

function ensureGtagStub(): void {
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer.push(args);
    } as typeof window.gtag;
  }
}

function loadScript(src: string, id: string): void {
  if (document.getElementById(id)) return;
  const script = document.createElement("script");
  script.id = id;
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

/**
 * Load optional third-party scripts from env. Safe to call with no env vars set.
 * Call once before React mount (see main.tsx).
 */
export function bootstrapThirdPartyScripts(): void {
  if (typeof window === "undefined") return;

  ensureGtagStub();
  (window.gtag as (...args: unknown[]) => void)("consent", "default", { ...CONSENT_DEFAULTS });

  if (isGaEnabled) {
    loadScript(
      `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaMeasurementId)}`,
      "ga4-gtag",
    );
    window.gtag("js", new Date());
    window.gtag("config", gaMeasurementId, { send_page_view: false });
  }

  if (isAdSenseEnabled) {
    const client = encodeURIComponent(adsenseClientId);
    loadScript(
      `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`,
      "adsense-js",
    );
    loadScript(
      `https://fundingchoicesmessages.google.com/i/${client}?ers=1`,
      "adsense-cmp",
    );
  }
}
