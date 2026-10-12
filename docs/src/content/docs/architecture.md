---
title: How it works
description: "How F1 DataStop gets data to your screen: CDN files, the database and the proxy, plus project layout and tech stack."
---

For recent seasons the site can read from ready-made files on a CDN, then our own database, and only then from the original data providers through a caching proxy. This only happens when database reading is switched on; otherwise it goes straight to the proxy or the provider.

## The three steps

Which path a request takes depends on a setting and on the season asked for.

1. **When `VITE_DB_SERVING_ENABLED` is `true`, Supabase is configured and the season is inside the stored window** (the newest season and the three before it, plus future rounds), the site tries our own copy of the data first, in this order:
   1. **CDN files.** Scheduled jobs publish season data as static files on `cdn.f1datastop.com`. The site reads these through `web/src/services/f1Warehouse.ts`.
   2. **Our database (the warehouse).** If the CDN file is missing or cannot be reached, the site asks the Supabase tables whose names start with `f1_`.
2. **The proxy or the provider.** If the setting is off, the season is older than the window, or neither CDN nor database had an answer, the request goes through `web/src/lib/api/f1ApiFetch.ts`. With `VITE_F1_PROXY_ENABLED=true` it goes to the `f1-proxy` server function, which caches answers in the database. Otherwise it goes straight to Jolpica or OpenF1.

Fast-changing data (current standings, and OpenF1 live, position and car data) never uses our own copy: it always goes to the proxy or the provider, which keeps short cache times. A problem with the CDN or database therefore makes the site slower, but it does not show an error to visitors.

Chart images and Deep Dive files are separate: the site loads them straight from the CDN.

The diagram shows where the data lives, not the order of the lookups above.

```text
Jolpica / Ergast ─┐
OpenF1 ───────────┼─▶ f1-proxy (with cache) ─▶ website
FastF1 (Python) ──┘           │                    ▲
                              ▼                    │ read only
                  Supabase database (f1_ tables) ──┘
                              ▲
  Python scripts on GitHub ───┴─▶ Cloudflare R2 (cdn.f1datastop.com) ─▶ website
```

## Session codes

Every part of the project uses the same short codes for a session in a race weekend.

| Code | Session |
| --- | --- |
| `FP1`, `FP2`, `FP3` | Free practice |
| `Q` | Qualifying |
| `SQ` | Sprint qualifying |
| `SS` | Sprint shootout (older name for sprint qualifying) |
| `S` | Sprint |
| `R` | Race |

## Rules that apply by season

From 2011 to 2025 cars have DRS (a flap that opens on straights). The 2026 season has no DRS: it uses active aerodynamics and a battery boost, with 22 cars and new engines. Check the season before assuming a rule.

## Project layout

```text
f1datastop/
├── web/                 the website (React, TypeScript, Vite)
│   └── src/
│       ├── components/  screens and widgets, grouped by feature
│       ├── hooks/f1/    data hooks (React Query)
│       ├── lib/f1/      types, adapters and calculations
│       ├── lib/api/     fetch and proxy helpers
│       ├── services/    CDN and warehouse readers
│       ├── config/      optional third-party settings
│       └── integrations/ analytics and Supabase clients
├── api/                 Vercel function for social preview images
├── supabase/
│   ├── functions/       f1-proxy, f1-livetiming-proxy, bmc-webhook
│   └── migrations/      database changes
├── analysis/            Python: collect data, draw charts, export files
├── docs/                this site
└── .github/workflows/   checks, scheduled jobs, releases, docs deploy
```

## Tech stack

| Part | What is used |
| --- | --- |
| Website | React 18, TypeScript, Vite, Tailwind CSS v4, shadcn/ui |
| Data fetching | React Query |
| Charts | Recharts and D3 in the website; matplotlib in the Python scripts |
| Database and server functions | Supabase (Postgres and edge functions) |
| File storage and CDN | Cloudflare R2 |
| Hosting | Vercel for the site, GitHub Pages for these docs |
| Automation | GitHub Actions, started by a clock inside Supabase (see [Scheduled jobs](/pipeline.html)) |

## Workflows

| Workflow | Purpose |
| --- | --- |
| PR CI (`pr-ci.yml`) | Checks every push and pull request. It needs no secrets, so it runs on forks too. |
| Pipeline (`pipeline.yml`) | The scheduled data jobs. |
| Queue (`queue.yml`) | Handles chart and telemetry requests made by visitors. |
| Release (`release.yml`) | Creates version tags and GitHub Releases. See [Releases](/releases.html). |
| Docs (`docs.yml`) | Publishes this site when files in `docs/` change. |

Pipeline and Queue only run in the main repository, so forks never need any secrets. The times and details are on [Scheduled jobs](/pipeline.html).
