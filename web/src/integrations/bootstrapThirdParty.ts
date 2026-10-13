import {
  adsenseClientId,
  isAdSenseEnabled,
  isClarityEnabled,
  isGaEnabled,
} from "@/config/integrations";
import { bridgeConsent } from "./clarity/consentBridge";

// NOTE: the Google tag (gtag.js) + consent defaults now load from index.html's
// inline snippet (build-time id from VITE_GA_MEASUREMENT_ID), so the initial
// page_view is auto-counted before React mounts. This bootstrap only handles
// AdSense; it inherits the consent state already set in index.html.

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

  // Clarity needs a consent signal for EEA/UK/CH visitors; the only consent UI is Google's
  // (Funding Choices), so forward its TCF decision. GA needs the same decision as a
  // gtag('consent','update') or EEA/UK/CH visits stay denied. No-op if no CMP ever appears.
  if (isClarityEnabled || isGaEnabled) bridgeConsent({ clarity: isClarityEnabled, gtag: isGaEnabled });

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
