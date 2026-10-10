#!/usr/bin/env node
/**
 * Scrape Wikipedia infobox career stats into f1_driver_career / f1_constructor_career.
 * Title mapping lives in scripts/entity/wiki-titles.json.
 *
 * Usage:
 *   node scripts/scrape-entity-careers.mjs
 *   node scripts/scrape-entity-careers.mjs --entity max_verstappen
 *   node scripts/scrape-entity-careers.mjs --dry-run
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for writes.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dryRun = process.argv.includes("--dry-run");
const entityFilter = (() => {
  const idx = process.argv.indexOf("--entity");
  return idx >= 0 ? process.argv[idx + 1] : null;
})();

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error(
    "Missing SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

const wikiTitles = JSON.parse(
  readFileSync(join(__dirname, "entity/wiki-titles.json"), "utf8"),
);

/** Strip HTML and collapse whitespace from wiki extract snippets. */
function cleanText(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parse first integer from infobox label text, e.g. "4 (2021, 2022)" → 4 */
function parseIntField(text) {
  const m = text?.match(/\d+/);
  return m ? Number(m[0]) : null;
}

async function fetchWikiSummary(title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "F1DataStop-entity-scraper/1.0 (+https://github.com)" },
  });
  if (!res.ok) {
    throw new Error(`Wikipedia summary failed for "${title}" (${res.status})`);
  }
  return res.json();
}

async function fetchWikiHtml(title) {
  const url = `https://en.wikipedia.org/w/api.php?${new URLSearchParams({
    action: "parse",
    page: title,
    prop: "text",
    format: "json",
    formatversion: "2",
  })}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "F1DataStop-entity-scraper/1.0 (+https://github.com)" },
  });
  if (!res.ok) {
    throw new Error(`Wikipedia parse failed for "${title}" (${res.status})`);
  }
  const json = await res.json();
  return json.parse?.text ?? "";
}

/** Best-effort infobox field extraction from rendered HTML. */
function extractInfoboxField(html, label) {
  const re = new RegExp(
    `<th[^>]*>\\s*${label}\\s*<\\/th>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>`,
    "i",
  );
  const m = html.match(re);
  return m ? cleanText(m[1]) : null;
}

async function upsertCareer(table, row) {
  if (dryRun) {
    console.log(`[dry-run] Would upsert ${table}:`, row);
    return;
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?on_conflict=ergast_id`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify([row]),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${table} upsert failed (${res.status}): ${body}`);
  }
}

async function scrapeDriver(ergastId, wikiTitle) {
  console.log(`  driver ${ergastId} ← ${wikiTitle}`);
  const [summary, html] = await Promise.all([
    fetchWikiSummary(wikiTitle),
    fetchWikiHtml(wikiTitle),
  ]);

  const row = {
    ergast_id: ergastId,
    championships: parseIntField(extractInfoboxField(html, "Championships")) ?? 0,
    race_starts: parseIntField(extractInfoboxField(html, "Entries")),
    race_wins: parseIntField(extractInfoboxField(html, "Wins")),
    podiums: parseIntField(extractInfoboxField(html, "Podiums")),
    pole_positions: parseIntField(extractInfoboxField(html, "Pole positions")),
    fastest_laps: parseIntField(extractInfoboxField(html, "Fastest laps")),
    bio_short: summary.extract?.slice(0, 500) ?? null,
    source_revision: summary.timestamp ?? new Date().toISOString(),
    scraped_at: new Date().toISOString(),
  };

  await upsertCareer("f1_driver_career", row);
}

async function scrapeConstructor(ergastId, wikiTitle) {
  console.log(`  constructor ${ergastId} ← ${wikiTitle}`);
  const [summary, html] = await Promise.all([
    fetchWikiSummary(wikiTitle),
    fetchWikiHtml(wikiTitle),
  ]);

  const row = {
    ergast_id: ergastId,
    championships: parseIntField(extractInfoboxField(html, "Championships")) ?? 0,
    race_wins: parseIntField(extractInfoboxField(html, "Race victories")),
    podiums: parseIntField(extractInfoboxField(html, "Podiums")),
    pole_positions: parseIntField(extractInfoboxField(html, "Pole positions")),
    bio_short: summary.extract?.slice(0, 500) ?? null,
    source_revision: summary.timestamp ?? new Date().toISOString(),
    scraped_at: new Date().toISOString(),
  };

  await upsertCareer("f1_constructor_career", row);
}

const drivers = wikiTitles.drivers ?? {};
const constructors = wikiTitles.constructors ?? {};

console.log(`Scraping entity careers${dryRun ? " (dry-run)" : ""}…`);

for (const [ergastId, title] of Object.entries(drivers)) {
  if (entityFilter && entityFilter !== ergastId) continue;
  try {
    await scrapeDriver(ergastId, title);
  } catch (err) {
    console.warn(`  ⚠ driver ${ergastId}: ${err.message}`);
  }
}

for (const [ergastId, title] of Object.entries(constructors)) {
  if (entityFilter && entityFilter !== ergastId) continue;
  try {
    await scrapeConstructor(ergastId, title);
  } catch (err) {
    console.warn(`  ⚠ constructor ${ergastId}: ${err.message}`);
  }
}

console.log("Done.");
