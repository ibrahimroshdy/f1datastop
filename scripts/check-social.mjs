// Social check — node, no deps.
// Asserts the Task 3 social-preview + README-hero swap:
// root og-image.png and web/public/og-image.png exist, are 1200x630,
// and are byte-identical (matching SHA256); logo-readme.svg is gone;
// README.md no longer references logo-readme.svg and points at the new hero.
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const rootOg = join(root, "og-image.png");
const publicOg = join(root, "web", "public", "og-image.png");
const oldHero = join(root, "logo-readme.svg");
const readmePath = join(root, "README.md");

const failures = [];
const ok = (cond, msg) => { if (!cond) failures.push(msg); };

// PNG dimensions from the IHDR chunk (bytes 16-23), no deps needed.
function pngSize(buf) {
  const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIG)) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

ok(existsSync(rootOg), "root og-image.png missing");
ok(existsSync(publicOg), "web/public/og-image.png missing");

if (existsSync(rootOg) && existsSync(publicOg)) {
  const a = readFileSync(rootOg);
  const b = readFileSync(publicOg);
  const sa = pngSize(a);
  const sb = pngSize(b);
  ok(sa !== null, "root og-image.png is not a valid PNG");
  ok(sb !== null, "web/public/og-image.png is not a valid PNG");
  if (sa) ok(sa.w === 1200 && sa.h === 630, `root og-image.png is ${sa.w}x${sa.h}, want 1200x630`);
  if (sb) ok(sb.w === 1200 && sb.h === 630, `web/public/og-image.png is ${sb.w}x${sb.h}, want 1200x630`);
  const ha = createHash("sha256").update(a).digest("hex");
  const hb = createHash("sha256").update(b).digest("hex");
  ok(ha === hb, `OG hashes differ: root ${ha.slice(0, 12)}… vs public ${hb.slice(0, 12)}…`);
  if (ha === hb) console.log(`OG sha256 (both): ${ha}`);
}

ok(!existsSync(oldHero), "logo-readme.svg still exists");

if (existsSync(readmePath)) {
  const readme = readFileSync(readmePath, "utf8");
  ok(!readme.includes("logo-readme.svg"), "README.md still references logo-readme.svg");
  ok(readme.includes("docs/public/assets/f1datastop-hero.svg"), "README.md does not reference docs/public/assets/f1datastop-hero.svg");
} else {
  ok(false, "README.md missing");
}

if (failures.length > 0) {
  console.error("FAIL: social check failed:");
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log("PASS: social check");
