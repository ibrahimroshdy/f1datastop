import { Helmet } from "react-helmet-async";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { F1Card, F1CardContent, PageHeader } from "@/components/f1";
import { pageShellNarrow, pageStack } from "@/lib/layout";

const Privacy = () => {
  const { isGlass } = useTheme();
  const calloutVariant = isGlass ? ("glass" as const) : ("default" as const);
  const calloutGlass = isGlass ? ("subtle" as const) : ("default" as const);

  return (
      <div className={pageShellNarrow}>
        <div className={cn(pageStack, "animate-fade-in")}>
        <Helmet>
          <title>Privacy Policy | F1 DataStop</title>
          <meta name="description" content="F1 DataStop privacy policy and data collection practices" />
        </Helmet>

        <PageHeader title="Privacy Policy" description="Last updated: 2026-10-12" />

        <div
          className={cn(
            "prose prose-sm max-w-none md:prose-base dark:prose-invert",
            "prose-headings:scroll-mt-20 prose-a:text-primary"
          )}
        >
          <h2 className="instrument-label pt-4 text-primary">Introduction</h2>
          <p>
            F1 DataStop ("we", "our", or "us") is committed to protecting your privacy.
            This Privacy Policy explains how we collect, use, and share information when you use our website.
            No account creation or login is required — every page renders anonymously.
          </p>

          <h2 className="instrument-label pt-4 text-primary">Tools We Use</h2>
          <p>These are all the third-party tools running on the site. We do not use any others.</p>
          <ul className="list-disc pl-6 mt-2 mb-6 space-y-3">
            <li>
              <strong>Google Analytics 4 (GA4)</strong> — page views, approximate location, device and browser,
              referral source and interaction events (for example which race or driver you open). Uses first-party
              cookies (<code>_ga</code>, <code>_ga_*</code>) where analytics storage is allowed.
            </li>
            <li>
              <strong>Microsoft Clarity</strong> — behavioural metrics, heatmaps and <em>session replay</em> (a
              recording of how you scroll, click and move through pages). Uses
              cookies and similar technologies (<code>_clck</code>, <code>_clsk</code>) where permitted.
            </li>
            <li>
              <strong>Vercel Web Analytics</strong> — aggregate page-view counts.
            </li>
            <li>
              <strong>Vercel Speed Insights</strong> — page-performance measurements (load timings, Core Web
              Vitals) tied to the page, device and country.
            </li>
            <li>
              <strong>Google AdSense and Google Funding Choices</strong> — AdSense shows ads and may use cookies or
              similar identifiers for ad delivery, measurement and, with your consent, personalization. Funding
              Choices is Google&apos;s consent message, shown where required.
            </li>
          </ul>
          <p>
            Our hosting provider (Vercel) and CDN (Cloudflare) also process standard web request data (IP address,
            timestamp, requested path) to deliver the site and prevent abuse.
          </p>

          <h2 className="instrument-label pt-4 text-primary">Information We Collect</h2>
          <ul className="list-disc pl-6 mt-2 mb-6">
            <li>Usage data and device information (browser, screen size, referral source, approximate location)</li>
            <li>
              Requests you make for custom charts or lap telemetry (season, round, session, drivers, lap) — stored
              with no user identity attached
            </li>
            <li>Standard web server logs (IP, timestamp, requested path) for security and abuse prevention</li>
          </ul>
          <p>There are no accounts or logins, and we do not ask for your name or email address.</p>

          <h2 className="instrument-label pt-4 text-primary">User Analytics and Microsoft Clarity</h2>
          <F1Card variant={calloutVariant} glassVariant={calloutGlass} className="not-prose mb-6">
            <F1CardContent className="text-sm leading-relaxed text-muted-foreground">
              <p className="mb-0">
                We partner with Microsoft Clarity and Microsoft Advertising to capture how you use and interact with our
                website through behavioral metrics, heatmaps, and session replay to improve our products/services.
                Website usage data is captured using first and third-party cookies and other tracking technologies.
                For more information about how Microsoft collects and uses your data, visit the{" "}
                <a
                  href="https://privacy.microsoft.com/en-us/privacystatement"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  Microsoft Privacy Statement
                </a>
                .
              </p>
            </F1CardContent>
          </F1Card>

          <h2 className="instrument-label pt-4 text-primary">How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul className="list-disc pl-6 mt-2 mb-6">
            <li>Provide, maintain, and improve our services</li>
            <li>Understand aggregate usage patterns (through Google Analytics, Microsoft Clarity and Vercel)</li>
            <li>Show ads that help fund the site (Google AdSense)</li>
            <li>Detect, investigate, and prevent abuse that degrades the site for others</li>
          </ul>

          <h2 className="instrument-label pt-4 text-primary">Cookies, Local Storage and Consent</h2>
          <p>
            Cookies are set by Google Analytics, Microsoft Clarity and Google AdSense as described above. Your
            browser&apos;s local storage also keeps site preferences only: theme, sidebar state, developer mode, a
            dismissed &quot;add to home screen&quot; prompt, and cached data responses. None of these identify you.
          </p>
          <p className="mt-4">
            <strong>EEA, UK and Switzerland:</strong> Google Analytics starts with analytics and advertising storage
            denied. Google&apos;s consent message (Funding Choices) is the consent tool and is shown where it is
            enabled; Microsoft Clarity is told your choice and sets its cookies only when you allow them. Where no
            consent message appears, Google Analytics stays in its denied state for those visitors.
          </p>
          <p className="mt-4">
            <strong>Elsewhere:</strong> Google Analytics and Microsoft Clarity run with cookies by default. You can
            block or delete cookies in your browser settings or use Google&apos;s{" "}
            <a
              href="https://tools.google.com/dlpage/gaoptout"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              Analytics opt-out browser add-on
            </a>
            ; core functionality works without them.
          </p>

          <h2 className="instrument-label pt-4 text-primary">Your Rights and Choices</h2>
          <p>
            Since no personal account or identity is created, most data rights requests do not apply. You can control
            cookies through your browser and, where shown, Google&apos;s consent message. For any questions about data
            practices, see Contact below.
          </p>

          <h2 className="instrument-label pt-4 text-primary">Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy or our data practices, please contact us at:
            <br />
            <br />
            <strong>Email:</strong> admin@f1datastop.com
          </p>
        </div>
        </div>
      </div>
  );
};

export default Privacy;