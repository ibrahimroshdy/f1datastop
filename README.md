# F1 DataStop 

<p align="center">
  <img src="web/public/f1-cover.png" alt="F1 DataStop" width="320">
</p>

<p align="center">
  <strong>Formula 1 data analysis — lap times, strategy, standings, and race insights</strong>
</p>

<p align="center">
  <a href="https://f1datastop.vercel.app">Live demo</a> •
  <a href="#features">Features</a> •
  <a href="#getting-started">Getting started</a> •
  <a href="#project-structure">Structure</a> •
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

---

## Pipeline status

[![CircleCI](https://dl.circleci.com/status-badge/img/gh/ibrahimroshdy/f1datastop/tree/main.svg?style=svg&circle-token=CCIPRJ_Y2Dr4J6BvcB3Yn7Rqtr31A_549ac013fdf5fb9347f456c9ba7b6d4906126d02)](https://app.circleci.com/pipelines/github/ibrahimroshdy/f1datastop)

All CI runs on **CircleCI** ([`.circleci/config.yml`](.circleci/config.yml)). GitHub Actions
is no longer used: the account's shared 3,000 included minutes ran out mid-race-weekend on
2026-09-12, taking the whole pipeline down, so it moved to CircleCI's 30,000 free credits.

| Workflow | Job | When | What it does |
|---|---|---|---|
| `on-push` | `web` | every push | typecheck, lint (advisory), test, build |
| `on-push` | `verify` | every push | byte-compiles the analysis scripts |
| `reconcile-6h` | `reconcile` | 00/06/12/18 UTC | ingest results, publish season JSON to the CDN |
| `reconcile-race-weekend` | `reconcile` | every 30 min, 12:00–21:30 UTC, Fri–Sun | same, during sessions |
| `charts-race-weekend` | `charts` | every 2 h, Fri–Sun | render Deep Dive charts for finished sessions |
| `assets-daily` | `assets` | 06:30 UTC | telemetry, circuit geometry, replays, weather |
| `digest-daily` | `digest` | 07:17 UTC | free-tier usage digest to Slack |

Any job can also be run on demand — CircleCI has no `workflow_dispatch`, so a `run_job`
pipeline parameter stands in:

```bash
curl -u "$CIRCLE_TOKEN:" -X POST -H 'Content-Type: application/json' \
  https://circleci.com/api/v2/project/gh/ibrahimroshdy/f1datastop/pipeline \
  -d '{"branch":"main","parameters":{"run_job":"charts"}}'
```

Valid values: `reconcile`, `charts`, `assets`, `digest`, `chart_request`, `telemetry_request`.

---

A React + TypeScript app for F1 fans: championship standings, lap and position analysis, race calendar, embeddable widgets, and optional auth via Supabase. Data comes from [Jolpica/Ergast](https://github.com/jolpica/jolpica-f1) (historical) and [OpenF1](https://openf1.org/) (live/session).

## Features

- **Dashboard** — standings, last race, next race countdown, season overview
- **Analytics** — lap times, position changes, qualifying, pit stops, year comparisons
- **Race calendar** — list, grid, and 3D globe views with race detail panels
- **Drivers & constructors** — profiles with team colors and headshots (OpenF1)
- **Embeddable widgets** — driver/constructor standings iframes
- **Auth** (optional) — Supabase email + social login for profile features

## Tech stack

| Layer | Stack |
|-------|--------|
| Frontend | React 18, TypeScript, Vite, Tailwind, shadcn/ui |
| Data | React Query, Jolpica/Ergast + OpenF1 APIs |
| Backend | Supabase (auth, edge functions, Postgres cache) |
| Charts | Recharts, D3 |
| Deploy | Vercel |
| CI | CircleCI (`.circleci/config.yml`) |

## Getting started

### Prerequisites

- Node.js 20+
- npm
- Supabase project (for auth and optional F1 API proxy cache)

### Install & run

```bash
git clone https://github.com/ibrahimroshdy/f1datastop.git
cd f1datastop
npm install --prefix web
cp .env.example web/.env.local
```

Edit `web/.env.local` — at minimum set the Supabase keys from your project dashboard:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=YOUR_PROJECT
```

Start dev server:

```bash
npm run dev
```

Open http://localhost:8080.

See [`.env.example`](.env.example) for optional integrations (GA4, Clarity, AdSense, Mapbox, reCAPTCHA, F1 proxy). **All integrations are disabled when their env var is unset.**

### Scripts (from repo root)

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build → `web/dist` |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit tests |

## Data sources

| API | Use |
|-----|-----|
| **Jolpica/Ergast** | Standings, schedules, results, lap times, pit stops |
| **OpenF1** | Live timing, telemetry, weather, team radio, headshots |

On Vercel, same-origin rewrites proxy `/api/ergast` and `/api/openf1`. With `VITE_F1_PROXY_ENABLED=true`, requests can route through the Supabase `f1-proxy` edge function and Postgres `api_cache` table for shared caching.

Team and driver lists are fetched dynamically — no hardcoded grid for a specific season.

## Project structure

```
f1datastop/
├── web/                      # Vite React app
│   ├── src/
│   │   ├── components/       # Feature UI (calendar, analytics, dashboard, …)
│   │   ├── hooks/f1/         # React Query hooks per domain
│   │   ├── lib/f1/           # Types, adapters, calc logic (sankey, overtakes, …)
│   │   ├── lib/api/          # F1 fetch + proxy helpers
│   │   ├── config/           # integrations.ts — env-gated third-party keys
│   │   └── integrations/     # GA4, Clarity, Supabase clients
│   ├── public/
│   └── package.json
├── supabase/
│   ├── functions/            # f1-proxy, f1-cache-warm, notify-slack, captcha-verify
│   └── migrations/
├── vercel.json               # Build web/, API rewrites
├── .env.example
└── CONTRIBUTING.md
```

## Deployment (Vercel)

Root `vercel.json` builds from `web/`:

```json
{
  "installCommand": "npm install --prefix web",
  "buildCommand": "npm --prefix web run build",
  "outputDirectory": "web/dist"
}
```

Set environment variables in the Vercel dashboard (Production + Preview). See `.env.example`.

## Embeddable widgets

```html
<iframe src="https://f1datastop.vercel.app/embed/driver-standings?season=2025&theme=dark" width="400" height="600"></iframe>
```

Parameters: `season`, `theme` (`light` | `dark`), optional `font`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). PRs should pass CI: typecheck, lint, test, build.

## License

[MIT](LICENSE) — Copyright (c) 2026 Ibrahim Roshdy

## Acknowledgments

- [Jolpica F1 API](https://github.com/jolpica/jolpica-f1) — historical data
- [OpenF1](https://openf1.org/) — live session data
- [shadcn/ui](https://ui.shadcn.com/) — component primitives
