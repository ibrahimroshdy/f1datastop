#!/usr/bin/env node
/**
 * Fetches https://www.formula1.com/en/teams and lists `*logowhite.webp` paths
 * for updating NORMALIZED_CONSTRUCTOR_ID_TO_F1_TEAM_LOGO_PATH.
 */
const url = "https://www.formula1.com/en/teams";

const res = await fetch(url, {
  headers: { "User-Agent": "F1DataStop-team-logo-sync/1.0 (+https://github.com)" },
});
if (!res.ok) {
  console.error("Fetch failed", res.status);
  process.exit(1);
}
const html = await res.text();
const re = /common\/f1\/(\d{4})\/([^"'\s<>]+?\/\d{4}[^"'\s<>]*?logowhite\.webp)/g;
const seen = new Set();
let m;
while ((m = re.exec(html))) {
  const [, year, rest] = m;
  if (rest.includes("carright") || rest.includes("driver")) continue;
  seen.add(`${year}/${rest}`);
}
console.log(`Found ${seen.size} team logo paths from ${url}:\n`);
[...seen].sort().forEach((p) => console.log(`  "${p}",`));
