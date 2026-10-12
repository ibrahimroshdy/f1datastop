#!/usr/bin/env node
// F1 DataStop's public images, on the app's Deep Carbon tokens (web/src/index.css) with the locked
// mark (web/src/assets/f1-logo.svg), Clash Display, Geist and Geist Mono:
//
//   docs/public/assets/social-preview.png   GitHub's social preview (1280×640): the lockup, the
//                                           tagline, the badge and the big mark. GitHub doesn't
//                                           read it from the repo: upload it in Settings → General
//                                           → Social preview.
//   og-image.png, web/public/og-image.png   the share card (1200×630) every link preview uses (the
//                                           app's index.html, api/og.ts, the docs site): the lockup
//                                           and tagline beside the app, desktop with the phone in
//                                           front. Both files are identical (scripts/check-social.mjs).
//   docs/public/assets/hero-{dark,light}.webp  the README hero: the same desktop and phone on a
//                                           transparent background, framed for GitHub's dark and
//                                           light themes.
//
// The captures are scripts/brand/screens/{desktop,phone}-dark.webp: real screens of the app run
// locally (`npm run dev`, dark theme): the Pit Wall (/pit-wall?year=2026&round=17&session=R&
// drivers=ANT,RUS&fastest=1) at 1280×800 and the home page on a 390×844 phone. Replace them when
// the app's look changes. The fonts are the ones web/index.html links, fetched once into
// scripts/brand/.cache and embedded as data URLs. Dev only, nothing here ships with the app:
//
//   npm --prefix scripts/brand ci && node scripts/render-social-preview.mjs
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const brand = createRequire(`${root}scripts/brand/package.json`);
const { chromium } = brand('playwright');
const sharp = brand('sharp');

const TAGLINE = 'Every Formula 1 race, lap by lap, in clear charts.';
const BADGE = 'Free · Open source';

const b64 = (buf) => Buffer.from(buf).toString('base64');
const file = (rel, type) => `data:${type};base64,${b64(readFileSync(root + rel))}`;
const MARK = file('web/src/assets/f1-logo.svg', 'image/svg+xml');
const DESKTOP = file('scripts/brand/screens/desktop-dark.webp', 'image/webp');
const PHONE = file('scripts/brand/screens/phone-dark.webp', 'image/webp');

/** The stylesheets web/index.html links, with every woff2 inlined (latin faces only). */
async function fonts() {
  const html = readFileSync(`${root}web/index.html`, 'utf8');
  const hrefs = [...html.matchAll(/href="(https:\/\/(?:fonts\.googleapis\.com|api\.fontshare\.com)[^"]+)"/g)]
    .map((m) => m[1].replace(/&amp;/g, '&'));
  const cache = `${root}scripts/brand/.cache/`;
  mkdirSync(cache, { recursive: true });
  const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
  const get = async (url) => {
    const key = cache + createHash('sha1').update(url).digest('hex');
    if (!existsSync(key)) {
      const r = await fetch(url, { headers: { 'user-agent': UA } });
      if (!r.ok) throw new Error(`${url}: ${r.status}`);
      writeFileSync(key, Buffer.from(await r.arrayBuffer()));
    }
    return readFileSync(key);
  };
  let css = '';
  for (const href of hrefs) {
    const sheet = (await get(href)).toString('utf8');
    for (const face of sheet.match(/(\/\*[^*]*\*\/\s*)?@font-face\s*{[^}]+}/g) ?? []) {
      if (/^\/\*/.test(face) && !/^\/\*\s*latin\s*\*\//.test(face)) continue;
      const url = face.match(/url\(['"]?([^'")]+\.woff2)['"]?\)/)?.[1];
      if (!url) continue;
      const data = `data:font/woff2;base64,${b64(await get(url.startsWith('//') ? `https:${url}` : url))}`;
      css += face.replace(/src:[^;]+;/, `src:url(${data}) format('woff2');`) + '\n';
    }
  }
  if (!/Clash Display/.test(css) || !/Geist Mono/.test(css)) throw new Error('fonts missing from web/index.html');
  return css;
}

/** Deep Carbon (:root) and light (.light) tokens from web/src/index.css. */
const DARK = '--bg:hsl(240 8% 3.5%);--card:hsl(240 7% 6%);--elev:hsl(240 7% 8.5%);--line:hsl(240 6% 15%);--fg:hsl(220 15% 96%);--muted:hsl(240 6% 64%)';
const LIGHT = '--bg:hsl(0 0% 98%);--card:hsl(0 0% 100%);--elev:hsl(240 5% 96%);--line:hsl(240 5% 87%);--fg:hsl(240 10% 3.9%);--muted:hsl(240 4% 46.1%)';

const BASE = (fontCss) => `${fontCss}
:root{--red:hsl(0 100% 44%)}
html,body{margin:0}
body{font-family:Geist,system-ui,sans-serif;color:var(--fg);-webkit-font-smoothing:antialiased;box-sizing:border-box}
.carbon{background:var(--bg);background-image:radial-gradient(120% 75% at 50% -12%,hsl(0 100% 44% / .07),transparent 55%),
  radial-gradient(90% 90% at 100% 0%,hsl(240 24% 10% / .55),transparent 60%)}
.grid{position:absolute;inset:0;pointer-events:none;
  background-image:linear-gradient(hsl(240 6% 15% / .55) 1px,transparent 1px),linear-gradient(90deg,hsl(240 6% 15% / .55) 1px,transparent 1px);
  background-size:64px 64px;mask-image:radial-gradient(80% 90% at 75% 50%,#000 10%,transparent 70%)}
main{position:relative;display:grid;align-content:center}
.lockup{display:flex;align-items:center}
.lockup b{font:600 1em/1 'Clash Display';letter-spacing:0;word-spacing:.12em;white-space:nowrap}
h1{margin:0;font-family:'Clash Display';font-weight:600;letter-spacing:0;word-spacing:.1em;text-wrap:balance}
.badge{justify-self:start;display:inline-flex;align-items:center;gap:12px;background:var(--red);color:#fff;border-radius:2px;
  font:600 18px/1 'Geist Mono';letter-spacing:.14em;text-transform:uppercase;padding:12px 16px 11px;white-space:nowrap}
.badge i{width:8px;height:8px;border-radius:50%;background:#fff}
.url{font:500 18px/1 'Geist Mono';color:var(--muted);letter-spacing:.04em}
.frame{border:1px solid var(--line);background:var(--card);overflow:hidden}
.frame img{display:block;width:100%;height:auto}
.desktop{border-radius:12px}
.bar{display:flex;align-items:center;gap:7px;padding:9px 12px;border-bottom:1px solid var(--line);background:var(--elev)}
.bar i{width:9px;height:9px;border-radius:50%;background:var(--line)}
.bar span{margin-left:auto;margin-right:auto;transform:translateX(-14px);font:500 11px/1 'Geist Mono';color:var(--muted);
  background:var(--card);border:1px solid var(--line);border-radius:6px;padding:5px 14px}
.phone{border-radius:26px;border:6px solid #16161a;background:#16161a;box-shadow:0 0 0 1px hsl(240 6% 22%)}
.phone img{border-radius:20px}
.tick{position:absolute;width:22px;height:22px;border:0 solid hsl(0 100% 44% / .7)}`;

const ART = (url) => `
<div class="frame desktop"><div class="bar"><i></i><i></i><i></i><span>${url}</span></div><img src="${DESKTOP}" alt=""></div>
<div class="frame phone"><img src="${PHONE}" alt=""></div>`;

const CARDS = [
  {
    // GitHub's preview: the copy beside the big mark in corner-tick framing.
    out: ['docs/public/assets/social-preview.png'],
    width: 1280, height: 640, theme: DARK, body: 'carbon',
    css: `
body{display:grid;grid-template-columns:1fr 420px;align-items:center;gap:40px;padding:0 112px 0 96px;position:relative;overflow:hidden}
main{gap:34px}
.lockup{gap:18px;font-size:40px}.lockup img{width:64px;height:64px}
h1{font-size:60px;line-height:1.08;max-width:15ch}
.foot{display:flex;align-items:center;gap:22px}
.big{position:relative;display:grid;place-items:center;height:420px}
.big::before{content:"";position:absolute;inset:-60px;background:radial-gradient(closest-side,hsl(0 100% 44% / .34),transparent 72%)}
.big img{position:relative;width:300px;height:300px;transform:rotate(-8deg);filter:drop-shadow(0 26px 40px rgb(0 0 0 / .6))}
.t1{left:0;top:0;border-top-width:2px;border-left-width:2px}.t2{right:0;bottom:0;border-bottom-width:2px;border-right-width:2px}`,
    html: `<div class="grid"></div>
<main>
<div class="lockup"><img src="${MARK}" alt=""><b>F1 DataStop</b></div>
<h1>${TAGLINE}</h1>
<div class="foot"><span class="badge"><i></i>${BADGE}</span><span class="url">f1datastop.com</span></div>
</main>
<div class="big"><span class="tick t1"></span><span class="tick t2"></span><img src="${MARK}" alt=""></div>`,
  },
  {
    // The share card: the copy beside the app, desktop with the phone in front.
    out: ['web/public/og-image.png', 'og-image.png'],
    width: 1200, height: 630, theme: DARK, body: 'carbon',
    css: `
body{display:grid;grid-template-columns:400px 1fr;align-items:center;gap:40px;padding-left:72px;position:relative;overflow:hidden}
main{gap:28px}
.lockup{gap:14px;font-size:30px}.lockup img{width:48px;height:48px}
h1{font-size:46px;line-height:1.1;max-width:12ch}
.badge{font-size:14px;padding:10px 13px 9px;gap:10px}
.art{position:relative;padding:40px 0 70px}
.art::before{content:"";position:absolute;left:-40px;top:10%;width:640px;height:80%;background:radial-gradient(closest-side,hsl(0 100% 44% / .22),transparent 75%)}
.desktop{position:relative;width:740px;box-shadow:0 30px 60px -20px rgb(0 0 0 / .8),0 0 0 1px hsl(0 0% 100% / .03)}
.phone{position:absolute;left:-14px;bottom:22px;width:176px;box-shadow:0 28px 50px -12px rgb(0 0 0 / .85),0 0 0 1px hsl(240 6% 22%)}`,
    html: `<div class="grid"></div>
<main>
<div class="lockup"><img src="${MARK}" alt=""><b>F1 DataStop</b></div>
<h1>${TAGLINE}</h1>
<span class="badge"><i></i>${BADGE}</span>
</main>
<div class="art">${ART('f1datastop.com/pit-wall')}</div>`,
  },
  ...['dark', 'light'].map((theme) => ({
    // The README hero, on a transparent background: rendered at 2× and stored as webp.
    out: [`docs/public/assets/hero-${theme}.webp`],
    width: 900, height: 560, theme: theme === 'dark' ? DARK : LIGHT, body: '', hero: true,
    css: `
body{background:transparent;width:auto;height:auto;display:inline-block;padding:16px 28px 40px}
.art{position:relative;width:780px;padding-right:72px;padding-bottom:36px}
.desktop{box-shadow:0 1px 2px rgb(0 0 0 / .08),0 24px 48px -20px rgb(0 0 0 / ${theme === 'dark' ? '.7' : '.35'})}
.phone{position:absolute;right:0;bottom:0;width:190px;box-shadow:0 22px 44px -14px rgb(0 0 0 / ${theme === 'dark' ? '.8' : '.45'})}`,
    html: `<div class="art" id="art">${ART('f1datastop.com/pit-wall')}</div>`,
  })),
];

const fontCss = await fonts();
const browser = await chromium.launch();
try {
  for (const card of CARDS) {
    const page = await browser.newPage({
      viewport: { width: card.width, height: card.height },
      deviceScaleFactor: card.hero ? 2 : 1,
    });
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>:root{${card.theme}}${BASE(fontCss)}
body{width:${card.width}px;height:${card.height}px}${card.css}</style></head><body class="${card.body}">${card.html}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
    const [first, ...copies] = card.out;
    const tmp = `${root}${first}.tmp`;
    if (card.hero) {
      const png = await page.locator('body').screenshot({ type: 'png', omitBackground: true });
      await sharp(png).webp({ quality: 82, alphaQuality: 90, effort: 6 }).toFile(tmp);
    } else {
      await page.screenshot({ path: tmp, type: 'png' });
    }
    renameSync(tmp, root + first);
    for (const c of copies) copyFileSync(root + first, root + c);
    for (const f of card.out) console.log(`wrote ${f} (${Math.round(statSync(root + f).size / 1024)} KB)`);
    await page.close();
  }
} finally {
  await browser.close();
}
