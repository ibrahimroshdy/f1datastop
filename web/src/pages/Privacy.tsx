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

        <PageHeader title="Privacy Policy" description={`Last updated: ${new Date().toLocaleDateString()}`} />

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

          <h2 className="instrument-label pt-4 text-primary">Information We Collect</h2>
          <p>We collect minimal information automatically when you use our website:</p>
          <ul className="list-disc pl-6 mt-2 mb-6">
            <li>
              Usage data and device information (browser, screen size, referral source) via Microsoft Clarity
            </li>
            <li>Anonymous telemetry for chart requests and API usage (no user identity attached)</li>
            <li>Standard web server logs (IP, timestamp, requested path) for security and abuse prevention</li>
          </ul>

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
            <li>Understand aggregate usage patterns (through tools like Microsoft Clarity)</li>
            <li>Detect, investigate, and prevent abuse that degrades the site for others</li>
            <li>Monitor and analyze trends for capacity planning</li>
          </ul>

          <h2 className="instrument-label pt-4 text-primary">Cookies and Other Tracking Technologies</h2>
          <p>
            We and our partners use cookies and similar technologies to collect anonymous usage data.
            You can control or reject cookies through your browser settings; core functionality works without them.
          </p>
          <p className="mt-4">
            Where required (for example in the EEA, UK, or Switzerland), we use Google&apos;s certified consent tools
            connected to Google AdSense so you can agree to or decline personalized ads and related storage.
          </p>

          <h2 className="instrument-label pt-4 text-primary">Your Rights and Choices</h2>
          <p>Since no personal account or identity is created, most data rights requests do not apply.
            You can control cookies via your browser. For any questions about data practices, see Contact below.</p>

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