/**
 * Social-crawler HTML shim.
 *
 * The site is a client-rendered SPA, so every URL serves the same index.html. Googlebot
 * executes JS and picks up the per-route <Seo> tags, but social crawlers
 * (facebookexternalhit, Twitterbot, Slack, Discord, WhatsApp, LinkedIn) do NOT — they read
 * the raw HTML and stop. That's why sharing a race link previewed as the generic homepage.
 *
 * Only requests whose user-agent matches the crawler list in vercel.json are rewritten
 * here; real users always get index.html untouched. A failure in this function is
 * therefore invisible to humans, which is why this is done as a targeted rewrite rather
 * than middleware on every request.
 *
 * It emits metadata plus a redirect, so a human who somehow lands here still reaches the
 * real page.
 */

const SITE = "https://www.f1datastop.com";
const DEFAULT_IMAGE = `${SITE}/f1-cover.png`;
const SITE_NAME = "F1 DataStop";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "";

const esc = (s: string) =>
  String(s).replace(/[<>&"']/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c] as string);

async function raceName(season: string, round: string): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const r = await fetch(
      `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/f1_race?select=name,circuit_id&season=eq.${season}&round=eq.${round}&limit=1`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        signal: AbortSignal.timeout(3000) },
    );
    if (!r.ok) return null;
    const rows = (await r.json()) as { name?: string }[];
    return rows?.[0]?.name ?? null;
  } catch {
    return null;
  }
}

/** Title/description for a path. Keep in sync with src/components/common/Seo.tsx. */
async function metaFor(path: string): Promise<{ title: string; description: string }> {
  const race = path.match(/^\/race-analysis\/(\d{4})\/(\d+)/);
  if (race) {
    const [, season, round] = race;
    const name = (await raceName(season, round)) ?? `Round ${round}`;
    return {
      title: `${name} ${season} — Race Analysis — ${SITE_NAME}`,
      description: `Telemetry and strategy analysis for the ${season} ${name} — lap times, tyre stints, pit strategy, sector pace and driver head-to-heads.`,
    };
  }

  const driver = path.match(/^\/drivers\/([\w-]+)/);
  if (driver) {
    const who = driver[1].replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      title: `${who} — F1 Stats & Telemetry — ${SITE_NAME}`,
      description: `${who}'s Formula 1 results, race pace, qualifying record and telemetry breakdowns.`,
    };
  }

  const table: Record<string, { title: string; description: string }> = {
    "/": { title: `${SITE_NAME} — Formula 1 Data Analysis and Insights`,
           description: "Formula 1 telemetry, race analysis and strategy breakdowns — lap time deltas, stint strategy and driver head-to-heads." },
    "/calendar": { title: `F1 Race Calendar — ${SITE_NAME}`,
                   description: "Every round of the Formula 1 season — dates, circuits, session times and results." },
    "/standings": { title: `F1 Championship Standings — ${SITE_NAME}`,
                    description: "Driver and constructor championship standings — points, wins, podiums and the gap to the leader." },
    "/drivers": { title: `F1 Drivers — ${SITE_NAME}`,
                  description: "Every driver on the grid — championship position, points, wins and per-driver telemetry." },
    "/constructors": { title: `F1 Constructors — ${SITE_NAME}`,
                       description: "Formula 1 teams — standings, line-ups and constructor performance." },
    "/pit-wall": { title: `Pit Wall — Live Telemetry Console — ${SITE_NAME}`,
                   description: "Race-engineer console: any-lap telemetry, track map, sector times and side-by-side driver traces." },
  };
  return table[path] ?? table["/"];
}

export default async function handler(req: { url?: string }, res: {
  setHeader: (k: string, v: string) => void;
  status: (n: number) => { send: (b: string) => void };
}) {
  const path = (req.url ?? "/").split("?")[0] || "/";
  const url = `${SITE}${path === "/" ? "/" : path.replace(/\/+$/, "")}`;
  const { title, description } = await metaFor(path);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${esc(url)}" />
<meta property="og:site_name" content="${esc(SITE_NAME)}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${esc(url)}" />
<meta property="og:image" content="${DEFAULT_IMAGE}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@f1datastop" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${DEFAULT_IMAGE}" />
<meta http-equiv="refresh" content="0; url=${esc(url)}" />
</head>
<body><h1>${esc(title)}</h1><p>${esc(description)}</p><a href="${esc(url)}">Continue to ${esc(SITE_NAME)}</a></body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Cache at the edge: crawlers re-fetch often and this content changes slowly.
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(html);
}
