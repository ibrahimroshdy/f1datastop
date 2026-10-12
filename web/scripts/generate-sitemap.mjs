#!/usr/bin/env node
/**
 * Build public/sitemap.xml.
 *
 * Why: this is an SPA, so crawlers only ever see index.html. Without a sitemap the deep
 * routes — every race, driver, circuit and season — are effectively undiscoverable, since
 * nothing links to them from static HTML. The warehouse already knows exactly which
 * rounds exist, so we enumerate from there rather than guessing.
 *
 * Runs at build time. If Supabase is unreachable it falls back to the static season JSON
 * on the CDN, and as a last resort keeps the sitemap already committed in the repo — it
 * will never SHRINK the file. That last rule matters: while the Supabase project was
 * restricted (402 on every request) every deploy silently published a 10-URL sitemap in
 * place of a 493-URL one, dropping every race, driver and circuit page from search.
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = "https://www.f1datastop.com";
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../public/sitemap.xml");

const URL_ = process.env.VITE_SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

/** Static, always-present routes. changefreq/priority are hints, not directives. */
const STATIC = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/calendar", changefreq: "daily", priority: "0.9" },
  { path: "/standings", changefreq: "daily", priority: "0.9" },
  { path: "/race-analysis", changefreq: "daily", priority: "0.9" },
  { path: "/pit-wall", changefreq: "weekly", priority: "0.8" },
  { path: "/drivers", changefreq: "weekly", priority: "0.8" },
  { path: "/constructors", changefreq: "weekly", priority: "0.8" },
  { path: "/developers", changefreq: "monthly", priority: "0.4" },
  { path: "/privacy", changefreq: "yearly", priority: "0.2" },
];

async function rest(path) {
  if (!URL_ || !KEY) return null;
  try {
    const r = await fetch(`${URL_.replace(/\/$/, "")}/rest/v1/${path}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
      signal: AbortSignal.timeout(20000),
    });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

const CDN = (process.env.VITE_BLOB_HOST || "https://cdn.f1datastop.com").replace(/\/$/, "");

/** Fetch `data/{path}` from the CDN. null on any failure — the caller degrades. */
async function cdn(path) {
  try {
    const r = await fetch(`${CDN}/data/${path}`, { signal: AbortSignal.timeout(20000) });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

/** Races/drivers/circuits from the CDN season files — same shape the app reads. */
async function fromCdn(seasons) {
  const races = [];
  const drivers = new Set();
  for (const season of seasons) {
    const schedule = await cdn(`${season}/schedule.json`);
    for (const r of schedule || []) {
      if (r?.round) races.push({ season, round: Number(r.round), date: r.date });
    }
    for (const row of (await cdn(`${season}/driverStandings.json`)) || []) {
      const id = row?.Driver?.driverId;
      if (id) drivers.add(id);
    }
  }
  const circuits = new Set();
  for (const row of (await cdn("index/circuits/all.json")) || []) {
    if (row?.circuit_id) circuits.add(row.circuit_id);
  }
  return { races, drivers: [...drivers], circuits: [...circuits] };
}

const xmlEscape = (s) => String(s).replace(/[<>&'"]/g, (c) =>
  ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]);

function urlEntry({ path, changefreq, priority, lastmod }) {
  return [
    "  <url>",
    `    <loc>${xmlEscape(SITE + path)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : null,
    priority ? `    <priority>${priority}</priority>` : null,
    "  </url>",
  ].filter(Boolean).join("\n");
}

async function main() {
  const entries = [...STATIC];

  // Races: one analysis page per round. /race-info/* and /circuits only redirect, so they
  // are not listed.
  let races = await rest("f1_race?select=season,round,date&order=season.desc,round.asc&limit=2000");
  let cdnFallback = null;
  if (!races?.length) {
    const thisYear = new Date().getFullYear();
    const seasons = Array.from({ length: 10 }, (_, i) => thisYear - i);
    cdnFallback = await fromCdn(seasons);
    races = cdnFallback.races;
    if (races.length) console.log(`[sitemap] warehouse unavailable — ${races.length} races from the CDN`);
  }
  if (races?.length) {
    for (const r of races) {
      const lastmod = r.date ? String(r.date).slice(0, 10) : undefined;
      entries.push({ path: `/race-analysis/${r.season}/${r.round}`, changefreq: "weekly", priority: "0.8", lastmod });
    }
    console.log(`[sitemap] ${races.length} races`);
  } else {
    console.warn("[sitemap] no race rows — static routes only");
  }

  // Drivers and circuits are addressed by slug/id.
  // /drivers/:slug — slug is fully populated and mirrors the Ergast id the app links with.
  let drivers = await rest("f1_driver?select=slug,ergast_id&limit=1000");
  if (!drivers?.length && cdnFallback) drivers = cdnFallback.drivers.map((id) => ({ slug: id }));
  if (drivers?.length) {
    for (const d of drivers) {
      const id = d.slug || d.ergast_id;
      if (id) entries.push({ path: `/drivers/${id}`, changefreq: "weekly", priority: "0.7" });
    }
    console.log(`[sitemap] ${drivers.length} drivers`);
  } else {
    console.warn("[sitemap] no driver rows");
  }

  // /teams/:slug — slug from the warehouse (no CDN equivalent, so teams are simply omitted
  // when it is unreachable; the never-shrink rule below then keeps the committed file).
  const teams = await rest("f1_constructor?select=slug&limit=1000");
  if (teams?.length) {
    for (const t of teams) if (t.slug) entries.push({ path: `/teams/${t.slug}`, changefreq: "weekly", priority: "0.6" });
    console.log(`[sitemap] ${teams.length} teams`);
  } else {
    console.warn("[sitemap] no team rows");
  }

  let circuits = await rest("f1_circuit?select=circuit_id&limit=500");
  if (!circuits?.length && cdnFallback) circuits = cdnFallback.circuits.map((c) => ({ circuit_id: c }));
  if (circuits?.length) {
    for (const c of circuits) if (c.circuit_id) entries.push({ path: `/circuits/${c.circuit_id}`, changefreq: "monthly", priority: "0.6" });
    console.log(`[sitemap] ${circuits.length} circuits`);
  }

  // De-dupe defensively — a repeated <loc> is an invalid sitemap.
  const seen = new Set();
  const unique = entries.filter((e) => !seen.has(e.path) && seen.add(e.path));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${unique.map(urlEntry).join("\n")}
</urlset>
`;
  // Never shrink. A data source that is down must not quietly de-index the site; the
  // sitemap committed in the repo is a known-good floor and simply gets deployed again.
  if (existsSync(OUT)) {
    // Count only routes that still belong in the sitemap (redirect-only paths were dropped on purpose).
    const prev = [...readFileSync(OUT, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)]
      .filter((m) => !/\/race-info\//.test(m[1].replace(SITE, "")) && !/^\/circuits$/.test(m[1].replace(SITE, "")))
      .length;
    if (prev > unique.length) {
      console.warn(`[sitemap] generated ${unique.length} urls but ${prev} are already committed — keeping the existing file`);
      return;
    }
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, xml, "utf8");
  console.log(`[sitemap] wrote ${unique.length} urls -> public/sitemap.xml`);
}

main().catch((e) => {
  // Never fail the build over a sitemap.
  console.warn("[sitemap] skipped:", e?.message ?? e);
  process.exit(0);
});
