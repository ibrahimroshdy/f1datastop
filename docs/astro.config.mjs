import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

const OG_IMAGE = 'https://www.f1datastop.com/og-image.png';
const OG_ALT = 'F1 DataStop — Formula 1 Data Analysis Platform';

export default defineConfig({
  site: 'https://docs.f1datastop.com',
  // One <slug>.html file per page, so the old docs.f1datastop.com/<page>.html addresses keep working.
  build: { format: 'file' },
  integrations: [
    starlight({
      title: 'F1 DataStop Docs',
      description:
        'Documentation for F1 DataStop: a free, open-source Formula 1 site with standings, results, lap analysis and telemetry charts.',
      logo: { src: './src/assets/logo.svg', alt: 'F1 DataStop' },
      favicon: '/assets/favicon.svg',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/ibrahimroshdy/f1datastop' },
      ],
      customCss: ['./src/styles/brand.css'],
      head: [
        { tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.googleapis.com' } },
        { tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' } },
        { tag: 'link', attrs: { rel: 'preconnect', href: 'https://api.fontshare.com', crossorigin: '' } },
        {
          tag: 'link',
          attrs: {
            rel: 'stylesheet',
            href: 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap',
          },
        },
        {
          tag: 'link',
          attrs: {
            rel: 'stylesheet',
            href: 'https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&display=swap',
          },
        },
        { tag: 'link', attrs: { rel: 'icon', href: '/assets/favicon.ico', type: 'image/x-icon' } },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/assets/apple-touch-icon.png' } },
        { tag: 'meta', attrs: { name: 'theme-color', content: '#08080a' } },
        { tag: 'meta', attrs: { property: 'og:image', content: OG_IMAGE } },
        { tag: 'meta', attrs: { property: 'og:image:secure_url', content: OG_IMAGE } },
        { tag: 'meta', attrs: { property: 'og:image:type', content: 'image/png' } },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
        { tag: 'meta', attrs: { property: 'og:image:alt', content: OG_ALT } },
        { tag: 'meta', attrs: { name: 'twitter:site', content: '@f1datastop' } },
        { tag: 'meta', attrs: { name: 'twitter:image', content: OG_IMAGE } },
        { tag: 'meta', attrs: { name: 'twitter:image:alt', content: OG_ALT } },
      ],
      sidebar: [
        { label: 'Overview', slug: 'index' },
        { label: 'Getting started', slug: 'getting-started' },
        { label: 'How it works', slug: 'architecture' },
        { label: 'Backend', slug: 'backend' },
        { label: 'Data and CDN', slug: 'data' },
        { label: 'Scheduled jobs', slug: 'pipeline' },
        { label: 'API and embeds', slug: 'api-embeds' },
        { label: 'Developers', slug: 'developers' },
        { label: 'Releases', slug: 'releases' },
        { label: 'Runbooks', slug: 'runbooks' },
      ],
      lastUpdated: false,
    }),
  ],
});
