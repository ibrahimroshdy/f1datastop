import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { pageShellNarrow } from '@/lib/layout';
import { useTheme } from '@/context/ThemeContext';
import BuyMeCoffeeWidget from '@/components/common/BuyMeCoffeeWidget';
import Seo from "@/components/common/Seo";

/**
 * Shared chrome for the auth screens (login · signup · reset). Provides the
 * atmospheric Deep-Carbon backdrop, the "return to dashboard" link, and one
 * restrained community footer — replacing the old floating BuyMeACoffee overlay
 * and the loud Product Hunt badge that used to sit above each card.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      {/* Auth screens carry no search value and shouldn't compete with real pages.
          Covers login, signup and reset in one place since they all use this shell. */}
      <Seo noIndex title="Sign in" />
      {/* Atmospheric backdrop — red ember glow + faint telemetry grid, masked to fade at the edges. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(60rem_40rem_at_50%_-10%,hsl(var(--primary)/0.10),transparent_70%)]" />
        <div
          className="absolute inset-0 opacity-[0.035] bg-[linear-gradient(to_right,hsl(var(--foreground))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--foreground))_1px,transparent_1px)] bg-[size:46px_46px]"
          style={{
            WebkitMaskImage: 'radial-gradient(46rem 34rem at 50% 32%, #000 30%, transparent 78%)',
            maskImage: 'radial-gradient(46rem 34rem at 50% 32%, #000 30%, transparent 78%)',
          }}
        />
      </div>

      <div className={cn(pageShellNarrow, 'relative w-full')}>
        <div className="mb-6">
          <Link
            to="/"
            className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
            Return to Dashboard
          </Link>
        </div>

        {children}

        <AuthCommunityFooter />
      </div>
    </div>
  );
}

/** Community strip below the card — the real Product Hunt badge + Buy-Me-a-Coffee
 *  button (with live supporter count), sat in one tidy centered row, plus a quiet
 *  Support link. No floating overlay, no oversized badge above the form. */
function AuthCommunityFooter() {
  const { theme } = useTheme();
  return (
    <div className="mt-8 flex flex-col items-center gap-3 border-t border-border/60 pt-6">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a
          href="https://www.producthunt.com/posts/f1-datastop?embed=true&utm_source=badge-featured&utm_medium=badge&utm_souce=badge-f1-datastop"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-opacity hover:opacity-90"
        >
          <img
            src={`https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=950747&theme=${theme}&t=1744238501973`}
            alt="F1 DataStop - Live formula 1 news and race data | Product Hunt"
            width={200}
            height={43}
            style={{ width: 200, height: 43 }}
            loading="lazy"
          />
        </a>
        <BuyMeCoffeeWidget size="large" position="inline" />
      </div>
      <a
        href="mailto:admin@f1datastop.com"
        className="text-xs text-muted-foreground/80 transition-colors hover:text-foreground"
      >
        Support
      </a>
    </div>
  );
}

export default AuthShell;
