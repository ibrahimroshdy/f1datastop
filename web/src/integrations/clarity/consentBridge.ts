/**
 * Mirror the Google Funding Choices (TCF) consent decision to Microsoft Clarity and to
 * Google tag Consent Mode.
 *
 * Clarity requires a consent signal for EEA/UK/CH traffic and accepts it through
 * `clarity('consentv2', { ad_Storage, analytics_Storage })`. There is no custom banner in
 * this app: where a consent message is shown it is Google's (AdSense -> Privacy &
 * messaging), which speaks the IAB TCF API. This bridge listens to that API and forwards
 * the result.
 *
 * - No `__tcfapi` appears (no CMP configured, or blocked): nothing is sent, so Clarity
 *   keeps its own regional defaults.
 * - `gdprApplies === false` (visitor outside the regulated regions): granted.
 * - `gdprApplies === true`: granted only for what the visitor consented to.
 *
 * The purpose-to-signal mapping below is our own choice, not a vendor specification:
 *   analytics_Storage <- TCF purpose 1 (store/access on device) AND purpose 8 (measure content performance)
 *   ad_Storage        <- TCF purpose 1 AND purpose 3/4 (ad profile + personalised ads)
 */

type Granted = "granted" | "denied";

interface TcData {
  gdprApplies?: boolean;
  eventStatus?: string;
  purpose?: { consents?: Record<string, boolean> };
}

type TcfApi = (
  command: string,
  version: number,
  callback: (data: TcData, success: boolean) => void,
) => void;

declare global {
  interface Window {
    __tcfapi?: TcfApi;
  }
}

const POLL_MS = 250;
const MAX_WAIT_MS = 15000;

/** Map a TCF payload to Clarity's two signals, or null while the visitor has not decided. */
export function consentFromTcData(data: TcData): { ad: Granted; analytics: Granted } | null {
  if (data.gdprApplies === false) return { ad: "granted", analytics: "granted" };
  // Only a loaded/decided state carries a real choice; "cmpuishown" means the dialog is open.
  if (data.eventStatus !== "tcloaded" && data.eventStatus !== "useractioncomplete") return null;
  const p = data.purpose?.consents ?? {};
  const analytics = p[1] && p[8] ? "granted" : "denied";
  const ad = p[1] && p[3] && p[4] ? "granted" : "denied";
  return { ad, analytics };
}

function sendToClarity(ad: Granted, analytics: Granted): void {
  // Clarity's snippet queues calls made before it finishes loading; mirror that stub so a
  // decision that arrives first is not lost.
  const w = window as unknown as { clarity?: ((...a: unknown[]) => void) & { q?: unknown[] } };
  if (typeof w.clarity !== "function") {
    const stub = function (...args: unknown[]) {
      (stub.q = stub.q || []).push(args);
    } as ((...a: unknown[]) => void) & { q?: unknown[] };
    w.clarity = stub;
  }
  w.clarity!("consentv2", { ad_Storage: ad, analytics_Storage: analytics });
}

/**
 * Send the same decision to Google tag Consent Mode. index.html starts EEA/UK/CH visitors
 * with analytics/ad storage denied and nothing else ever updated it, so GA dropped or only
 * modelled those visits even after the visitor accepted.
 */
export function sendToGtag(ad: Granted, analytics: Granted): void {
  const w = window as unknown as { gtag?: (...a: unknown[]) => void };
  if (typeof w.gtag !== "function") return; // GA not configured in this environment
  w.gtag("consent", "update", {
    analytics_storage: analytics,
    ad_storage: ad,
    ad_user_data: ad,
    ad_personalization: ad,
  });
}

export interface ConsentTargets {
  clarity?: boolean;
  gtag?: boolean;
}

/** Start forwarding TCF consent to Clarity and/or gtag. Safe to call once, with or without a CMP. */
export function bridgeConsent(targets: ConsentTargets): void {
  if (typeof window === "undefined") return;
  let waited = 0;
  const timer = window.setInterval(() => {
    if (typeof window.__tcfapi === "function") {
      window.clearInterval(timer);
      window.__tcfapi("addEventListener", 2, (data, success) => {
        if (!success) return;
        const decided = consentFromTcData(data);
        if (!decided) return;
        if (targets.clarity) sendToClarity(decided.ad, decided.analytics);
        if (targets.gtag) sendToGtag(decided.ad, decided.analytics);
      });
      return;
    }
    waited += POLL_MS;
    if (waited >= MAX_WAIT_MS) window.clearInterval(timer);
  }, POLL_MS);
}

/** Backwards-compatible entry point: Clarity only. */
export function bridgeConsentToClarity(): void {
  bridgeConsent({ clarity: true });
}
