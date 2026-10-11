import {
  F1Card,
  F1CardContent,
  F1CardDescription,
  F1CardHeader,
  F1CardTitle,
  PageHeader,
} from '@/components/f1';
import { pageShell, pageStack } from '@/lib/layout';
import { Database, LayoutTemplate, ExternalLink, Gauge, FileCode, Copy, Server } from 'lucide-react';
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

const PROXY_EXAMPLE = `// POST to f1-proxy edge function
// Base URL: https://<project-ref>.supabase.co/functions/v1/f1-proxy
// Header: Authorization: Bearer <anon-key>

const response = await fetch('/functions/v1/f1-proxy', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  },
  body: JSON.stringify({
    source: 'ergast',           // 'ergast' | 'openf1'
    path: '/f1/2026.json',      // Ergast path (no /api prefix)
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

const POSTGREST_EXAMPLE = `// Direct PostgREST access (if enabled)
// Base URL: https://<project-ref>.supabase.co/rest/v1
// Header: apikey: <anon-key>, Authorization: Bearer <anon-key>

// Example: Driver standings for 2026
const standings = await fetch(
  'https://<ref>.supabase.co/rest/v1/standings_driver?season=eq.2026&order=position.asc',
  { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } }
).then(r => r.json());

// Example: Race results
const results = await fetch(
  'https://<ref>.supabase.co/rest/v1/f1_race_result?season=eq.2026&round=eq.1',
  { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } }
).then(r => r.json());`;

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
                  <F1CardTitle className="text-xl! mt-2">{tool.name}</F1CardTitle>
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

        {/* f1-proxy Edge Function */}
        <section aria-label="f1-proxy Edge Function">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold mt-8">
            <Server className="h-5 w-5 text-primary" /> f1-proxy Edge Function (Supabase)
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Routes Ergast and OpenF1 requests through a cached Supabase edge function. Enable in web app with <code className="text-foreground bg-muted px-1.5 py-0.5 rounded">VITE_F1_PROXY_ENABLED=true</code>.
            Requests are cached in Postgres (api_cache table) with TTLs per endpoint. All responses include <code className="text-foreground">cached</code> flag and <code className="text-foreground">cacheKey</code>.
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

          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
            <p><strong className="text-foreground">Ergast paths:</strong> <code className="text-foreground">/f1/{"{"}season{"}"}.json</code>, <code className="text-foreground">/f1/{"{"}season{"}"}/{"{"}round{"}"}/results.json</code>, <code className="text-foreground">/f1/{"{"}season{"}"}/{"{"}round{"}"}/qualifying.json</code>, <code className="text-foreground">/f1/{"{"}season{"}"}/{"{"}round{"}"}/sprint.json</code>, <code className="text-foreground">/f1/{"{"}season{"}"}/{"{"}round{"}"}/pitstops.json</code>, <code className="text-foreground">/f1/{"{"}season{"}"}/{"{"}round{"}"}/laps.json</code>, <code className="text-foreground">/f1/{"{"}season{"}"}/driverStandings.json</code>, <code className="text-foreground">/f1/{"{"}season{"}"}/constructorStandings.json</code></p>
            <p><strong className="text-foreground">OpenF1 paths:</strong> <code className="text-foreground">/sessions</code>, <code className="text-foreground">/drivers</code>, <code className="text-foreground">/laps</code>, <code className="text-foreground">/position</code>, <code className="text-foreground">/car_data</code>, <code className="text-foreground">/meetings</code>, <code className="text-foreground">/circuits</code></p>
            <p><strong className="text-foreground">Params:</strong> Pass as <code className="text-foreground">params</code> object — e.g. <code className="text-foreground">\{"{"} year: 2026, session_key: 9158 \{"}"}</code></p>
          </div>
        </section>

        {/* Static blobs (R2) */}
        <section aria-label="Static blobs (R2)">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold mt-8">
            <Database className="h-5 w-5 text-primary" /> Static Blobs (Cloudflare R2)
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Large assets served as public files via Cloudflare R2. <code className="text-foreground bg-muted px-1.5 py-0.5 rounded">VITE_BLOB_HOST</code> is the single environment variable.
            <code className="text-foreground">storage_path</code> comes from Postgres rows (host-free, so host stays a single env var).
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

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-muted-foreground">
            <div className="p-3 bg-muted/50 rounded">
              <p className="font-mono text-primary mb-1">/charts/{"{"}storagePath{"}"}</p>
              <p>Chart images (PNG/WebP) — driver comparisons, position charts, lap time charts</p>
            </div>
            <div className="p-3 bg-muted/50 rounded">
              <p className="font-mono text-primary mb-1">/telemetry/{"{"}storagePath{"}"}</p>
              <p>Telemetry blobs (JSON/Parquet) — speed, throttle, brake, gear, DRS per lap</p>
            </div>
            <div className="p-3 bg-muted/50 rounded">
              <p className="font-mono text-primary mb-1">/replays/{"{"}storagePath{"}"}</p>
              <p>Session replays — full lap data for race replay visualization</p>
            </div>
            <div className="p-3 bg-muted/50 rounded">
              <p className="font-mono text-primary mb-1">/circuits/{"{"}storagePath{"}"}</p>
              <p>Circuit geometry — track layout, sectors, corners, marshal sectors</p>
            </div>
          </div>
        </section>

        {/* PostgREST Direct Access */}
        <section aria-label="Supabase PostgREST">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold mt-8">
            <Database className="h-5 w-5 text-primary" /> Supabase PostgREST (Direct Table Access)
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            If <code className="text-foreground bg-muted px-1.5 py-0.5 rounded">PostgREST</code> is enabled on the Supabase project, tables are directly queryable via REST.
            All reads are public (anon key). Use standard PostgREST query syntax.
          </p>
          <F1Card variant={cardVariant} glassVariant={glassVariant} className="p-0">
            <F1CardContent className="p-4">
              <pre className="text-xs overflow-x-auto bg-muted p-3 rounded font-mono text-foreground"><code>{POSTGREST_EXAMPLE}</code></pre>
              <div className="mt-3 flex gap-2">
                <CopyButton text={POSTGREST_EXAMPLE} label="PostgREST example">
                  <Copy className="h-3 w-3" />
                  Copy
                </CopyButton>
              </div>
            </F1CardContent>
          </F1Card>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-mono">Table / View</th>
                  <th className="pb-2 pr-4">Description</th>
                  <th className="pb-2 pr-4 font-mono">Key Filters</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { table: 'drivers', desc: 'Driver metadata, codes, numbers', filters: 'driver_id, code, number' },
                  { table: 'constructors', desc: 'Constructor metadata, colors', filters: 'constructor_id, name' },
                  { table: 'circuits', desc: 'Circuit info, coordinates', filters: 'circuit_id, name' },
                  { table: 'f1_race', desc: 'Race schedule, results summary', filters: 'season, round' },
                  { table: 'f1_race_result', desc: 'Full race results per driver', filters: 'season, round, driver_id' },
                  { table: 'f1_qualifying_result', desc: 'Qualifying results per driver', filters: 'season, round, driver_id' },
                  { table: 'f1_sprint_result', desc: 'Sprint results per driver', filters: 'season, round, driver_id' },
                  { table: 'f1_pit_stop', desc: 'Pit stop data per driver', filters: 'season, round, driver_id' },
                  { table: 'f1_lap', desc: 'Lap times per driver', filters: 'season, round, driver_id, lap_number' },
                  { table: 'f1_telemetry_index', desc: 'Telemetry file index', filters: 'season, round, driver_id, session_type' },
                  { table: 'f1_driver_standing', desc: 'Driver championship points', filters: 'season, round' },
                  { table: 'f1_constructor_standing', desc: 'Constructor championship points', filters: 'season, round' },
                  { table: 'standings_driver', desc: 'Driver standings (materialized view)', filters: 'season, position' },
                  { table: 'standings_constructor', desc: 'Constructor standings (materialized view)', filters: 'season, position' },
                ].map((t, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 pr-4 font-mono text-foreground">{t.table}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{t.desc}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">{t.filters}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Request Queues */}
        <section aria-label="Request Queues">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold mt-8">
            <FileCode className="h-5 w-5 text-primary" /> Async Request Queues
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Chart and telemetry generation are async. POST to create (anonymous), poll <code className="text-foreground">status</code> for <code className="text-foreground">done</code>.
            Response includes R2 <code className="text-foreground">storage_path</code> for blob download.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <F1Card variant={cardVariant} glassVariant={glassVariant} className="p-0">
              <F1CardHeader className="pb-2">
                <F1CardTitle className="text-xl! mt-2">Chart Requests</F1CardTitle>
                <F1CardDescription>f1_chart_requests table</F1CardDescription>
              </F1CardHeader>
              <F1CardContent className="space-y-2 text-sm text-muted-foreground">
                <p><code className="text-foreground">POST</code> to f1-proxy with <code className="text-foreground">\{"{"}source, path, params, format, theme\{"}"}</code></p>
                <p>Returns <code className="text-foreground">\{"{"}id, status: 'pending'\{"}"}</code></p>
                <p>Poll <code className="text-foreground">GET /rest/v1/f1_chart_requests?id=eq.\{"{"}id\{"}"}&select=status,storage_path</code></p>
                <p>When <code className="text-foreground">status=done</code>, download from <code className="text-foreground">VITE_BLOB_HOST/charts/\{"{"}storage_path\{"}"}</code></p>
              </F1CardContent>
            </F1Card>
            <F1Card variant={cardVariant} glassVariant={glassVariant} className="p-0">
              <F1CardHeader className="pb-2">
                <F1CardTitle className="text-xl! mt-2">Telemetry Requests</F1CardTitle>
                <F1CardDescription>f1_telemetry_requests table</F1CardDescription>
              </F1CardHeader>
              <F1CardContent className="space-y-2 text-sm text-muted-foreground">
                <p><code className="text-foreground">POST</code> to f1-proxy with <code className="text-foreground">\{"{"}source:'openf1', path:'/laps', params:\{"{"}session_key, driver_number\{"}"}\{"}"}</code></p>
                <p>Returns <code className="text-foreground">\{"{"}id, status: 'pending'\{"}"}</code></p>
                <p>Poll <code className="text-foreground">GET /rest/v1/f1_telemetry_requests?id=eq.\{"{"}id\{"}"}&select=status,storage_path</code></p>
                <p>When <code className="text-foreground">status=done</code>, download from <code className="text-foreground">VITE_BLOB_HOST/telemetry/\{"{"}storage_path\{"}"}</code></p>
              </F1CardContent>
            </F1Card>
          </div>
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
                <strong className="text-foreground">Typical limits:</strong> ~1000 req/min per IP for f1-proxy,
                higher for embeds (cached at edge). No API key required; limits are IP-based.
              </p>
              <p className="mt-3">
                <strong className="text-foreground">Cache behavior:</strong> Ergast responses cached 1h–7d depending on endpoint;
                OpenF1 cached 30s–5min for live data. Check <code className="text-foreground">cached</code> flag in response.
              </p>
            </F1CardContent>
          </F1Card>
        </section>

        {/* Data Model / Schema */}
        <section aria-label="Data Model">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold mt-8">
            <Database className="h-5 w-5 text-primary" /> Data Model (Postgres Warehouse)
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Core tables populated by cron ingest (Ergast/Jolpica + OpenF1 + FastF1). All reads public.
            CDN (R2) serves static JSON snapshots for schedule/results/standings/pitstops/laps.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <F1Card variant={cardVariant} glassVariant={glassVariant} className="p-0">
              <F1CardHeader className="pb-2">
                <F1CardTitle className="text-xl! mt-2">Core Tables (Ergast/Jolpica)</F1CardTitle>
                <F1CardDescription>Warehouse tables populated by cron</F1CardDescription>
              </F1CardHeader>
              <F1CardContent className="space-y-2 text-sm text-muted-foreground">
                <p><code className="text-foreground">drivers</code> — driver metadata, codes, numbers</p>
                <p><code className="text-foreground">constructors</code> — team metadata, colors</p>
                <p><code className="text-foreground">circuits</code> — circuit info, coordinates</p>
                <p><code className="text-foreground">f1_race</code> — race schedule, results summary</p>
                <p><code className="text-foreground">f1_race_result</code> — driver race results</p>
                <p><code className="text-foreground">f1_qualifying_result</code> — qualifying results</p>
                <p><code className="text-foreground">f1_sprint_result</code> — sprint results</p>
                <p><code className="text-foreground">f1_pit_stop</code> — pit stop data</p>
                <p><code className="text-foreground">f1_lap</code> — lap times</p>
                <p><code className="text-foreground">f1_driver_standing</code> — driver points per round</p>
                <p><code className="text-foreground">f1_constructor_standing</code> — constructor points</p>
              </F1CardContent>
            </F1Card>
            <F1Card variant={cardVariant} glassVariant={glassVariant} className="p-0">
              <F1CardHeader className="pb-2">
                <F1CardTitle className="text-xl! mt-2">FastF1 / OpenF1 Tables</F1CardTitle>
                <F1CardDescription>High-res telemetry & session data</F1CardDescription>
              </F1CardHeader>
              <F1CardContent className="space-y-2 text-sm text-muted-foreground">
                <p><code className="text-foreground">f1_telemetry_index</code> — telemetry file catalog (R2 paths)</p>
                <p><code className="text-foreground">f1_session</code> — session metadata (OpenF1)</p>
                <p><code className="text-foreground">f1_session_driver</code> — driver-session mapping</p>
                <p><code className="text-foreground">f1_position</code> — position data per lap</p>
                <p><code className="text-foreground">f1_overtake</code> — overtake events</p>
                <p><code className="text-foreground">f1_weather</code> — weather per session</p>
                <p><code className="text-foreground">f1_race_control</code> — race control messages</p>
                <p><code className="text-foreground">f1_team_radio</code> — team radio transcripts</p>
              </F1CardContent>
            </F1Card>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Developers;