#!/usr/bin/env node
/**
 * Fetches https://www.formula1.com/en/drivers and lists official "right" portrait
 * asset paths under common/f1/{year}/ for pasting into ERGAST_DRIVER_ID_TO_F1_PORTRAIT_PATH.
 *
 * Usage: node scripts/sync-f1-driver-portrait-paths.mjs
 */
const url = "https://www.formula1.com/en/drivers";

const res = await fetch(url, {
  headers: { "User-Agent": "F1DataStop-portrait-sync/1.0 (+https://github.com)" },
});
if (!res.ok) {
  console.error("Fetch failed", res.status);
  process.exit(1);
}
const html = await res.text();
const re = /common\/f1\/(\d{4})\/([^"'\s<>]+?\/[^"'\s<>]+?\/\d{4}[^"'\s<>]+?right\.webp)/g;
const seen = new Set();
let m;
while ((m = re.exec(html))) {
  const [, year, rest] = m;
  if (rest.includes("carright") || rest.includes("logowhite") || rest.includes("numberwhite")) continue;
  seen.add(`${year}/${rest}`);
}
console.log(`Found ${seen.size} portrait paths from ${url}:\n`);
[...seen].sort().forEach((p) => console.log(`  "${p}",`));
