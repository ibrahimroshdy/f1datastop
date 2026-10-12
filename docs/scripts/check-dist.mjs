// Checks the built docs site in docs/dist. No dependencies. Exits 1 and lists every failure.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const failures = [];
const fail = (msg) => failures.push(msg);

const required = [
  'index.html', 'getting-started.html', 'architecture.html', 'backend.html', 'data.html',
  'pipeline.html', 'api-embeds.html', 'releases.html', 'runbooks.html', 'developers.html',
  '404.html', 'CNAME', '.nojekyll',
  'assets/favicon.svg', 'assets/favicon.ico', 'assets/apple-touch-icon.png', 'assets/hero-dark.webp', 'assets/hero-light.webp',
];
for (const f of required) if (!existsSync(join(dist, f))) fail(`missing file: ${f}`);
if (!existsSync(join(dist, 'pagefind')) || !statSync(join(dist, 'pagefind')).isDirectory()) {
  fail('missing directory: pagefind/');
}

const read = (f) => (existsSync(join(dist, f)) ? readFileSync(join(dist, f), 'utf8') : '');

if (read('CNAME').trim() !== 'docs.f1datastop.com') fail('CNAME must be docs.f1datastop.com');

const pipeline = read('pipeline.html');
for (const cron of ['*/5 * * * *', '7 */6 * * *', '15 */2 * * 5,6,0', '25 6,12,18 * * 5,6,0', '17 7 * * *', '41 7 * * *']) {
  if (!pipeline.includes(cron)) fail(`pipeline.html is missing the schedule: ${cron}`);
}

const htmlFiles = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === 'pagefind') continue;
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.html')) htmlFiles.push(p);
  }
};
if (existsSync(dist)) walk(dist);

for (const p of htmlFiles) {
  const rel = p.slice(dist.length + 1);
  const html = readFileSync(p, 'utf8');
  if (rel !== '404.html' && !/og:image[^>]*https:\/\/www\.f1datastop\.com\/og-image\.png/.test(html)) {
    fail(`${rel}: og:image must be https://www.f1datastop.com/og-image.png`);
  }
  if (/dead-man/i.test(html)) fail(`${rel}: contains "dead-man"`);
}

// Local links: every href/src must point at an existing file, and a #fragment must match an id in the target page.
const ids = new Map();
const idsOf = (file) => {
  if (!ids.has(file)) {
    const html = readFileSync(file, 'utf8');
    ids.set(file, new Set([...html.matchAll(/\sid=["']([^"']+)["']/g)].map((m) => m[1])));
  }
  return ids.get(file);
};
for (const p of htmlFiles) {
  const rel = p.slice(dist.length + 1);
  const html = readFileSync(p, 'utf8');
  for (const m of html.matchAll(/\s(?:href|src)=["']([^"']*)["']/g)) {
    const ref = m[1].trim();
    if (!ref || ref.startsWith('#') || ref.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(ref)) continue;
    const [pathPart, frag] = ref.split('#');
    const clean = pathPart.split('?')[0];
    let target = clean.startsWith('/') ? join(dist, clean) : join(dirname(p), clean);
    if (!clean) target = p;
    if (existsSync(target) && statSync(target).isDirectory()) target = join(target, 'index.html');
    if (!existsSync(target)) {
      fail(`${rel}: broken link ${ref}`);
      continue;
    }
    if (frag && target.endsWith('.html') && !idsOf(target).has(decodeURIComponent(frag))) {
      fail(`${rel}: link ${ref} has no matching #${frag} in the target page`);
    }
  }
}

if (failures.length) {
  console.error(`docs check failed (${failures.length}):\n - ${failures.join('\n - ')}`);
  process.exit(1);
}
console.log(`docs check OK (${htmlFiles.length} pages)`);
