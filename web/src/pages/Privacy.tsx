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
<<<<<<< HEAD
            F1 DataStop (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your privacy.
            This Privacy Policy explains how we collect, use, and share information about you when you use our website.
          </p>

          <h2 className="instrument-label pt-4 text-primary">Information We Collect</h2>
          <p>We collect information about you in various ways when you use our website:</p>
          <ul className="list-disc pl-6 mt-2 mb-6">
            <li>Information you provide directly to us, such as when you create an account or contact us</li>
            <li>
              Information we collect automatically when you use our site, including usage data, device information, and
              cookies
            </li>
            <li>Information from third parties, where permitted by law</li>
=======
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
>>>>>>> fcc90ba (release: f1datastop v1.0.0 opensource (auth/game/push/captcha drop, MIT, pycountry LGPL noted))
          </ul>

          <h2 className="instrument-label pt-4 text-primary">User Analytics and Microsoft Clarity</h2>
          <F1Card variant={calloutVariant} glassVariant={calloutGlass} className="not-prose mb-6">
            <F1CardContent className="text-sm leading-relaxed text-muted-foreground">
              <p className="mb-0">
                We partner with Microsoft Clarity and Microsoft Advertising to capture how you use and interact with our
<<<<<<< HEAD
                website through behavioral metrics, heatmaps, and session replay to improve and market our
                products/services. Website usage data is captured using first and third-party cookies and other tracking
                technologies to determine the popularity of products/services and online activity. Additionally, we use this
                information for site optimization, fraud/security purposes, and advertising. For more information about how
                Microsoft collects and uses your data, visit the{" "}
=======
                website through behavioral metrics, heatmaps, and session replay to improve our products/services.
                Website usage data is captured using first and third-party cookies and other tracking technologies.
                For more information about how Microsoft collects and uses your data, visit the{" "}
>>>>>>> fcc90ba (release: f1datastop v1.0.0 opensource (auth/game/push/captcha drop, MIT, pycountry LGPL noted))
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
<<<<<<< HEAD
            <li>Understand how users interact with our website (through tools like Microsoft Clarity)</li>
            <li>Personalize your experience and deliver content relevant to your interests</li>
            <li>Respond to your comments, questions, and requests</li>
            <li>Send you technical notices, updates, security alerts, and support messages</li>
            <li>Monitor and analyze trends, usage, and activities in connection with our services</li>
            <li>Detect, investigate, and prevent fraudulent transactions and other illegal activities</li>
=======
            <li>Understand aggregate usage patterns (through tools like Microsoft Clarity)</li>
            <li>Detect, investigate, and prevent abuse that degrades the site for others</li>
            <li>Monitor and analyze trends for capacity planning</li>
>>>>>>> fcc90ba (release: f1datastop v1.0.0 opensource (auth/game/push/captcha drop, MIT, pycountry LGPL noted))
          </ul>

          <h2 className="instrument-label pt-4 text-primary">Cookies and Other Tracking Technologies</h2>
          <p>
<<<<<<< HEAD
            We and our partners use cookies and similar technologies to collect information about your interactions with our
            website. You can control or reject cookies through your browser settings, although this may limit your ability to
            use certain features of our site.
          </p>
          <p className="mt-4">
            Where required (for example in the EEA, UK, or Switzerland), we use Google&apos;s certified consent tools connected
            to Google AdSense so you can agree to or decline personalized ads and related storage. You can change your choices
            when the consent message is shown again, or via any &quot;Privacy and cookie settings&quot; or similar link Google
            provides on the site.
          </p>

          <h2 className="instrument-label pt-4 text-primary">Your Rights and Choices</h2>
          <p>Depending on your location, you may have certain rights regarding your personal information, including:</p>
          <ul className="list-disc pl-6 mt-2 mb-6">
            <li>Access to your personal information</li>
            <li>Correction of inaccurate or incomplete information</li>
            <li>Deletion of your personal information</li>
            <li>Restriction or objection to certain processing activities</li>
            <li>Data portability</li>
            <li>Withdrawal of consent</li>
          </ul>
=======
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
>>>>>>> fcc90ba (release: f1datastop v1.0.0 opensource (auth/game/push/captcha drop, MIT, pycountry LGPL noted))

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

<<<<<<< HEAD
export default Privacy;
=======
export default Privacy;
>>>>>>> fcc90ba (release: f1datastop v1.0.0 opensource (auth/game/push/captcha drop, MIT, pycountry LGPL noted))
