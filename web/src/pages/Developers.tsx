import {
  F1Card,
  F1CardContent,
  F1CardDescription,
  F1CardHeader,
  F1CardTitle,
  PageHeader,
} from '@/components/f1';
import { pageShell, pageStack } from '@/lib/layout';
import { Code, Database, LayoutTemplate, ExternalLink, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';

const EMBEDS = [
  {
    name: 'Embed overview',
    description: 'All embeddable components with copy-paste iframe snippets.',
    href: '/embed',
  },
  {
    name: 'Driver standings',
    description: 'Live driver standings table for any site.',
    href: '/embed/driver-standings',
  },
  {
    name: 'Constructor standings',
    description: 'Live constructor standings table for any site.',
    href: '/embed/constructor-standings',
  },
];

const Developers = () => {
  const { isGlass } = useTheme();
  const cardVariant = isGlass ? 'glass' : 'default';
  const glassVariant = isGlass ? 'panel' : 'default';

  return (
    <div className={pageShell}>
      <div className={cn(pageStack, "animate-fade-in")}>
        <PageHeader
          title="Developers PitStop"
          description="Public API, data layout, embeds, and rate limits — no account needed"
        />

        {/* Embed options (unchanged) */}
        <section aria-label="Embeds">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <LayoutTemplate className="h-5 w-5 text-primary" /> Embeds
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {EMBEDS.map((tool) => (
              <F1Card
                key={tool.name}
                variant={cardVariant}
                glassVariant={glassVariant}
                className="p-0 transition-colors duration-200 hover:border-primary/40"
              >
                <F1CardHeader className="pb-2">
                  <F1CardTitle className="!text-xl mt-2">{tool.name}</F1CardTitle>
                  <F1CardDescription>{tool.description}</F1CardDescription>
                </F1CardHeader>
                <F1CardContent>
                  <a
                    href={tool.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline inline-flex items-center"
                  >
                    Open in new tab
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                </F1CardContent>
              </F1Card>
            ))}
          </div>
        </section>

        {/* Public read surface */}
        <section aria-label="Public API">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Code className="h-5 w-5 text-primary" /> Public API
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <F1Card variant={cardVariant} glassVariant={glassVariant} className="p-0">
              <F1CardHeader className="pb-2">
                <F1CardTitle className="!text-xl mt-2">f1-proxy (live data)</F1CardTitle>
                <F1CardDescription>
                  Ergast and OpenF1 reads go through the Supabase edge function,
                  which caches upstream responses in Postgres.
                </F1CardDescription>
              </F1CardHeader>
              <F1CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  POST to the <code className="text-foreground">f1-proxy</code> function
                  with <code className="text-foreground">{'{ source, path, params }'}</code> where
                  source is <code className="text-foreground">ergast</code> or{' '}
                  <code className="text-foreground">openf1</code>. Responses return{' '}
                  <code className="text-foreground">{'{ data, cached, cacheKey, status, error }'}</code>.
                </p>
                <p>
                  In the web app this is enabled with{' '}
                  <code className="text-foreground">VITE_F1_PROXY_ENABLED=true</code>; direct
                  upstream URLs remain the fallback.
                </p>
              </F1CardContent>
            </F1Card>
            <F1Card variant={cardVariant} glassVariant={glassVariant} className="p-0">
              <F1CardHeader className="pb-2">
                <F1CardTitle className="!text-xl mt-2">Static blobs (R2)</F1CardTitle>
                <F1CardDescription>
                  Large assets — chart images, telemetry blobs, replays, circuit
                  geometry — are served as public files.
                </F1CardDescription>
              </F1CardHeader>
              <F1CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Blob URLs follow{' '}
                  <code className="text-foreground">VITE_BLOB_HOST/{'{bucket}'}/{'{storage_path}'}</code> with
                  buckets <code className="text-foreground">charts</code>,{' '}
                  <code className="text-foreground">telemetry</code>,{' '}
                  <code className="text-foreground">replays</code>, and{' '}
                  <code className="text-foreground">circuits</code>. Postgres rows store only
                  the host-free <code className="text-foreground">storage_path</code>, so the
                  host stays a single environment variable.
                </p>
                <p className="flex items-start gap-1.5">
                  <Database className="mt-0.5 h-4 w-4 shrink-0" />
                  Pinned standings, older seasons, and request queues are read live
                  from Postgres; everything else prefetches from these static files.
                </p>
              </F1CardContent>
            </F1Card>
          </div>
        </section>

        {/* Rate-limit policy */}
        <section aria-label="Rate limits">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Gauge className="h-5 w-5 text-primary" /> Rate limits
          </h2>
          <F1Card variant={cardVariant} glassVariant={glassVariant} className="p-0">
            <F1CardContent className="pt-4 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">Policy:</strong> the public read
                surface is rate-limited by Cloudflare WAF rules, managed in the
                owner's Cloudflare dashboard. Aggressive scraping, credential
                stuffing patterns, or abuse that degrades the site for others may
                be throttled or blocked. Embeds and the proxy cache are designed
                so normal use — including embedded tables on third-party sites —
                stays well under the limits.
              </p>
            </F1CardContent>
          </F1Card>
        </section>
      </div>
    </div>
  );
};

export default Developers;
