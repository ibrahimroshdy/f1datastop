# Google Analytics (GA4) integration

How analytics is wired in F1 DataStop. Plain Google Analytics 4 through `gtag.js`; there is no Firebase and no login.

## How it loads

`web/index.html` is the **only** loader. An inline script:

1. defines `dataLayer` / `gtag`;
2. sets Consent Mode defaults, then loads `gtag.js` and calls `gtag('config', ID)`, which sends the first `page_view` automatically.

The measurement ID is injected at build time from `VITE_GA_MEASUREMENT_ID` (`%VITE_GA_MEASUREMENT_ID%` in the HTML). If it is unset, nothing loads and every helper below is a no-op (`isGaEnabled` in `src/config/integrations.ts`). A measurement ID is public by design.

## Consent

- Visitors from the EEA, UK and Switzerland start with `ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage` (and functionality/personalization storage) **denied**, with `wait_for_update: 500`. Everyone else starts granted.
- There is no custom banner and this code never calls `gtag('consent', 'update', ...)`. Whether Google's consent message (Funding Choices, loaded with AdSense) updates Consent Mode on its own is not confirmed in Google's public docs; see the Task 4 report.
- `src/integrations/clarity/consentBridge.ts` forwards the TCF decision to Microsoft Clarity (`consentv2`). It is started from `bootstrapThirdParty.ts`.
- No identifier is written by this code: there is no `user_id` and no custom cookie domain or cookie flags. GA uses its own default cookies.

## Files

| File | Purpose |
| --- | --- |
| `GA4.tsx` | `trackPageView`, `trackEvent` and the F1-specific helpers (calendar, race card, results, driver/team interactions). All guard on `isGaEnabled` and `window.gtag`. Also exports a `GoogleAnalytics` route-change component. |
| `AnalyticsProvider.tsx` | Wraps the app. Sends a `page_view` on each SPA route change, **skipping the first render** (index.html already sent it). Registers error / unhandled-rejection tracking and renders `EngagementTracker`. |
| `EngagementTracker.tsx` | Scroll depth, time on page and inactivity events. |

`src/hooks/useAnalytics.ts` is the hook components use to send events.

## Sending events

```typescript
import { trackEvent } from '@/integrations/google-analytics/GA4';

trackEvent('button_click', { button_name: 'chart_request' });
```

Page views for route changes are sent by `AnalyticsProvider`; do not send them by hand.

## Debugging

In development, `trackEvent` logs each event to the console. Use GA4 DebugView or Tag Assistant to inspect hits in a browser.
