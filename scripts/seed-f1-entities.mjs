#!/usr/bin/env node
/**
 * Upsert F1 driver/constructor identity rows from scripts/entity/seed-config.json.
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (service role bypasses RLS).
 *
 * Usage:
 *   node scripts/seed-f1-entities.mjs
 *   node scripts/seed-f1-entities.mjs --dry-run
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dryRun = process.argv.includes("--dry-run");

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error(
    "Missing SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

const config = JSON.parse(
  readFileSync(join(__dirname, "entity/seed-config.json"), "utf8"),
);
const season = config.season ?? new Date().getFullYear();

async function upsert(table, rows, onConflict) {
  if (!rows.length) return { count: 0 };
  if (dryRun) {
    console.log(`[dry-run] Would upsert ${rows.length} row(s) into ${table}`);
    return { count: rows.length };
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${table} upsert failed (${res.status}): ${body}`);
  }

  return { count: rows.length };
}

const driverRows = (config.drivers ?? []).map((d) => ({
  ergast_id: d.ergast_id,
  given_name: d.given_name,
  family_name: d.family_name,
  slug: d.slug,
  portrait_path: d.portrait_path ?? null,
  active_season: season,
}));

const constructorRows = (config.constructors ?? []).map((c) => ({
  ergast_id: c.ergast_id,
  name: c.name,
  slug: c.slug,
  logo_path: c.logo_path ?? null,
  active_season: season,
}));

console.log(`Seeding F1 entities for season ${season}${dryRun ? " (dry-run)" : ""}…`);

const driverResult = await upsert("f1_driver", driverRows, "ergast_id");
console.log(`  drivers: ${driverResult.count}`);

const constructorResult = await upsert(
  "f1_constructor",
  constructorRows,
  "ergast_id",
);
console.log(`  constructors: ${constructorResult.count}`);

console.log("Done.");
