#!/usr/bin/env node
/**
 * Build public/sitemap.xml.
 *
 * Why: this is an SPA, so crawlers only ever see index.html. Without a sitemap the deep
 * routes — every race, driver, circuit and season — are effectively undiscoverable, since
 * nothing links to them from static HTML. The warehouse already knows exactly which
 * rounds exist, so we enumerate from there rather than guessing.
 *
 * Runs at build time. If Supabase is unreachable it still emits the static routes and
 * exits 0 — a missing sitemap is a bad day, a failed deploy is a worse one.
 */
import { writeFileSync, mkdirSync } from "node:fs";
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
  { path: "/circuits", changefreq: "monthly", priority: "0.7" },
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

  // Races: one analysis page per round, plus the season's race-info page.
  const races = await rest("f1_race?select=season,round,date&order=season.desc,round.asc&limit=2000");
  if (races?.length) {
    for (const r of races) {
      const lastmod = r.date ? String(r.date).slice(0, 10) : undefined;
      entries.push({ path: `/race-analysis/${r.season}/${r.round}`, changefreq: "weekly", priority: "0.8", lastmod });
      entries.push({ path: `/race-info/${r.season}/${r.round}`, changefreq: "monthly", priority: "0.5", lastmod });
    }
    console.log(`[sitemap] ${races.length} races`);
  } else {
    console.warn("[sitemap] no race rows — static routes only");
  }

  // Drivers and circuits are addressed by slug/id.
  // /drivers/:slug — slug is fully populated and mirrors the Ergast id the app links with.
  const drivers = await rest("f1_driver?select=slug,ergast_id&limit=1000");
  if (drivers?.length) {
    for (const d of drivers) {
      const id = d.slug || d.ergast_id;
      if (id) entries.push({ path: `/drivers/${id}`, changefreq: "weekly", priority: "0.7" });
    }
    console.log(`[sitemap] ${drivers.length} drivers`);
  } else {
    console.warn("[sitemap] no driver rows");
  }

  const circuits = await rest("f1_circuit?select=circuit_id&limit=500");
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
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, xml, "utf8");
  console.log(`[sitemap] wrote ${unique.length} urls -> public/sitemap.xml`);
}

main().catch((e) => {
  // Never fail the build over a sitemap.
  console.warn("[sitemap] skipped:", e?.message ?? e);
  process.exit(0);
});
