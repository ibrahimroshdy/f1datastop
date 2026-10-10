import {
  F1Card,
  F1CardContent,
  F1CardDescription,
  F1CardHeader,
  F1CardTitle,
  PageHeader,
} from '@/components/f1';
import { pageShell, pageStack } from '@/lib/layout';
import { Code, Database, LayoutTemplate, ExternalLink, Gauge, FileCode, Terminal, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import { useState } from 'react';

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

const API_ENDPOINTS = [
  {
    method: 'GET',
    path: '/api/v1/standings/drivers',
    description: 'Current season driver standings',
    params: ['season? (default: current)'],
    example: { season: 2024 },
  },
  {
    method: 'GET',
    path: '/api/v1/standings/constructors',
    description: 'Current season constructor standings',
    params: ['season? (default: current)'],
    example: { season: 2024 },
  },
  {
    method: 'GET',
    path: '/api/v1/schedule',
    description: 'Full season race calendar',
    params: ['season? (default: current)'],
    example: { season: 2024 },
  },
  {
    method: 'GET',
    path: '/api/v1/drivers',
    description: 'All drivers with metadata',
    params: ['season? (default: current)'],
    example: { season: 2024 },
  },
  {
    method: 'GET',
    path: '/api/v1/constructors',
    description: 'All constructors with metadata',
    params: ['season? (default: current)'],
    example: { season: 2024 },
  },
  {
    method: 'GET',
    path: '/api/v1/circuits',
    description: 'All circuits with location data',
    params: [],
    example: {},
  },
  {
    method: 'GET',
    path: '/api/v1/telemetry/live',
    description: 'Live session telemetry (OpenF1)',
    params: ['session_key', 'driver_number?'],
    example: { session_key: 9158, driver_number: 1 },
  },
  {
    method: 'GET',
    path: '/api/v1/telemetry/laps',
    description: 'Lap data for a session',
    params: ['session_key', 'driver_number?'],
    example: { session_key: 9158, driver_number: 44 },
  },
];

const PROXY_EXAMPLE = `// POST to f1-proxy edge function
// Base URL: https://<project-ref>.supabase.co/functions/v1/f1-proxy
// Header: Authorization: Bearer <anon-key>

const response = await fetch('/functions/v1/f1-proxy', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + import.meta.env.VITE_SUPABASE_ANON_KEY,
  },
  body: JSON.stringify({
    source: 'ergast',           // 'ergast' | 'openf1'
    path: '/api/f1/2024/drivers.json',
    params: { limit: 50 }
  })
});

const { data, cached, cacheKey, status, error } = await response.json();`;

const R2_EXAMPLE = `// Static blob access (public, no auth)
// Base URL: import.meta.env.VITE_BLOB_HOST (e.g. https://f1datastop.r2.dev)

const chartUrl = \`\${import.meta.env.VITE_BLOB_HOST}/charts/\${storagePath}\`;
const telemetryUrl = \`\${import.meta.env.VITE_BLOB_HOST}/telemetry/\${storagePath}\`;
const replayUrl = \`\${import.meta.env.VITE_BLOB_HOST}/replays/\${storagePath}\`;
const circuitUrl = \`\${import.meta.env.VITE_BLOB_HOST}/circuits/\${storagePath}\`;

// Buckets: charts | telemetry | replays | circuits
// storage_path comes from Postgres rows (host-free)`;

const Developers = () => {
  const { isGlass } = useTheme();
  const cardVariant = isGlass ? 'glass' : 'default';
  const glassVariant = isGlass ? 'panel' : 'default';
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const CopyButton = ({ text, label, children }: { text: string; label: string; children: React.ReactNode }) => (
    <button
      onClick={() => copyToClipboard(text, label)}
      className="text-xs px-3 py-1.5 border border-border rounded hover:bg-muted transition-colors flex items-center gap-1"
    >
      {children}
      {copied === label && <span className="text-green-500 ml-1">✓ Copied</span>}
    </button>
  );

  return (
    <div className={pageShell}>
      <div className={cn(pageStack, "animate-fade-in")}>
        <PageHeader
          title="Developers PitStop"
          description="Public API, data layout, embeds, and rate limits — no account needed"
        />

        {/* Embed options */}
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

        {/* Public REST API */}
        <section aria-label="Public REST API">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Code className="h-5 w-5 text-primary" /> Public REST API
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Base URL: <code className="text-foreground bg-muted px-1.5 py-0.5 rounded">https://api.f1datastop.com/api/v1</code> (or your deployed domain).
            All endpoints are public, no authentication required. Responses cached at edge.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-mono">Method</th>
                  <th className="pb-2 pr-4 font-mono">Endpoint</th>
                  <th className="pb-2 pr-4">Description</th>
                  <th className="pb-2 pr-4 font-mono">Params</th>
                </tr>
              </thead>
              <tbody>
                {API_ENDPOINTS.map((ep, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 pr-4 font-mono text-primary">
                      <span className="px-2 py-0.5 bg-primary/10 rounded text-xs">{ep.method}</span>
                    </td>
                    <td className="py-2 pr-4 font-mono text-foreground">{ep.path}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{ep.description}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                      {ep.params.length ? ep.params.join(', ') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex gap-3 flex-wrap">
            <CopyButton
              text='curl "https://api.f1datastop.com/api/v1/standings/drivers?season=2024"'
              label="cURL example"
            >
              <Terminal className="h-3 w-3" />
              Copy cURL
            </CopyButton>
            <CopyButton
              text='fetch("https://api.f1datastop.com/api/v1/schedule?season=2024").then(r=>r.json())'
              label="Fetch example"
            >
              <Code className="h-3 w-3" />
              Copy fetch
            </CopyButton>
          </div>
        </section>

        {/* f1-proxy edge function */}
        <section aria-label="f1-proxy edge function">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold mt-8">
            <FileCode className="h-5 w-5 text-primary" /> f1-proxy Edge Function (Supabase)
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Routes Ergast and OpenF1 requests through a cached edge function. Enable in web app with <code className="text-foreground bg-muted px-1.5 py-0.5 rounded">VITE_F1_PROXY_ENABLED=true</code>.
          </p>
          <F1Card variant={cardVariant} glassVariant={glassVariant} className="p-0">
            <F1CardContent className="p-4">
              <pre className="text-xs overflow-x-auto bg-muted p-3 rounded font-mono text-foreground"><code>{PROXY_EXAMPLE}</code></pre>
              <div className="mt-3 flex gap-2">
                <CopyButton text={PROXY_EXAMPLE} label="Proxy example">
                  <Copy className="h-3 w-3" />
                  Copy
                </CopyButton>
              </div>
            </F1CardContent>
          </F1Card>
        </section>

        {/* Static blobs (R2) */}
        <section aria-label="Static blobs (R2)">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold mt-8">
            <Database className="h-5 w-5 text-primary" /> Static Blobs (Cloudflare R2)
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Large assets served as public files. <code className="text-foreground bg-muted px-1.5 py-0.5 rounded">VITE_BLOB_HOST</code> is the single environment variable.
          </p>
          <F1Card variant={cardVariant} glassVariant={glassVariant} className="p-0">
            <F1CardContent className="p-4">
              <pre className="text-xs overflow-x-auto bg-muted p-3 rounded font-mono text-foreground"><code>{R2_EXAMPLE}</code></pre>
              <div className="mt-3 flex gap-2">
                <CopyButton text={R2_EXAMPLE} label="R2 example">
                  <Copy className="h-3 w-3" />
                  Copy
                </CopyButton>
              </div>
            </F1CardContent>
          </F1Card>
        </section>

        {/* Rate-limit policy */}
        <section aria-label="Rate limits">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold mt-8">
            <Gauge className="h-5 w-5 text-primary" /> Rate Limits
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
              <p className="mt-3">
                <strong className="text-foreground">Typical limits:</strong> ~1000 req/min per IP for API,
                higher for embeds (cached at edge). No API key required; limits are IP-based.
              </p>
            </F1CardContent>
          </F1Card>
        </section>

        {/* Data model / schema */}
        <section aria-label="Data model">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold mt-8">
            <Database className="h-5 w-5 text-primary" /> Data Model (Postgres)
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Core tables available via Supabase PostgREST (if enabled) or f1-proxy. All reads are public.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <F1Card variant={cardVariant} glassVariant={glassVariant} className="p-0">
              <F1CardHeader className="pb-2">
                <F1CardTitle className="!text-xl mt-2">Core Tables</F1CardTitle>
                <F1CardDescription>Warehouse tables populated by cron</F1CardDescription>
              </F1CardHeader>
              <F1CardContent className="space-y-2 text-sm text-muted-foreground">
                <p><code className="text-foreground">drivers</code> — driver metadata, codes, numbers</p>
                <p><code className="text-foreground">constructors</code> — team metadata, colors</p>
                <p><code className="text-foreground">circuits</code> — circuit info, coordinates</p>
                <p><code className="text-foreground">races</code> — race schedule, results</p>
                <p><code className="text-foreground">standings_driver</code> — driver championship points</p>
                <p><code className="text-foreground">standings_constructor</code> — constructor points</p>
                <p><code className="text-foreground">lap_times</code> — lap-level telemetry</p>
                <p><code className="text-foreground">telemetry_points</code> — high-res car data</p>
              </F1CardContent>
            </F1Card>
            <F1Card variant={cardVariant} glassVariant={glassVariant} className="p-0">
              <F1CardHeader className="pb-2">
                <F1CardTitle className="!text-xl mt-2">Request Queues</F1CardTitle>
                <F1CardDescription>Async chart/telemetry generation</F1CardDescription>
              </F1CardHeader>
              <F1CardContent className="space-y-2 text-sm text-muted-foreground">
                <p><code className="text-foreground">f1_chart_requests</code> — chart generation queue</p>
                <p><code className="text-foreground">f1_telemetry_requests</code> — telemetry export queue</p>
                <p>POST to create (anonymous), poll <code className="text-foreground">status</code> for <code className="text-foreground">done</code></p>
                <p>Response includes R2 <code className="text-foreground">storage_path</code> for blob download</p>
              </F1CardContent>
            </F1Card>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Developers;