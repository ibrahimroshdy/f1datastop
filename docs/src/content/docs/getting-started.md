---
title: Getting started
description: "Run F1 DataStop on your own computer: requirements, settings, commands and checks before a pull request."
---

You need Node.js and a free Supabase project. The site does not need the Python scripts to run.

## What you need

- Node.js 20 or newer (22 is recommended) and npm.
- A Supabase project. The site reads the cached data and the database through it.
- Optional: the [Supabase command line tool](https://supabase.com/docs/guides/cli), if you work on server functions or migrations.
- Optional: Python 3.11 and a virtual environment, if you work on the scripts in `analysis/`.

## Install and start

```sh
git clone https://github.com/ibrahimroshdy/f1datastop.git
cd f1datastop
npm install --prefix web
cp .env.example web/.env.local
```

Open `web/.env.local` and fill in the three Supabase values from your project's dashboard (Project Settings, then API). Then start the site:

```sh
npm run dev
```

Open [http://localhost:8080](http://localhost:8080).

## Settings (environment variables)

All settings are in [`.env.example`](https://github.com/ibrahimroshdy/f1datastop/blob/main/.env.example). They all start with `VITE_` and are read when the site is built. Anything optional is switched off when its value is empty.

| Setting | Needed? | What it does |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes | Address of your Supabase project. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | The public (anon) key. It is safe in the browser because the database only allows reading. Never put the service-role key here. |
| `VITE_SUPABASE_PROJECT_ID` | Yes | Your project's short id. |
| `VITE_F1_PROXY_ENABLED` | No | `true` sends requests for Jolpica and OpenF1 data through the `f1-proxy` server function, which caches them. Default `false`. |
| `VITE_ERGAST_BASE`, `VITE_OPENF1_BASE` | No | Same-site addresses (for example `/api/ergast`) used on Vercel to avoid cross-site errors. They are commented out by default. |
| `VITE_DB_SERVING_ENABLED` | No | `true` reads schedule, results and similar data from our own copy (CDN files, then the database) for recent seasons, and falls back to the proxy if something is missing. Default `false`. |
| `VITE_GA_MEASUREMENT_ID` | No | Google Analytics 4 id. Empty means no analytics script. |
| `VITE_CLARITY_PROJECT_ID` | No | Microsoft Clarity project id. Empty means off. |
| `VITE_ADSENSE_CLIENT_ID` and the three `VITE_ADSENSE_SLOT_*` values | No | Google AdSense. Empty means no ads script and no ad slots. |

:::note
Supabase also provides `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` to server functions by itself. Do not set those in your `.env` file.
:::

## Commands

Run these from the top folder of the project.

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the site at port 8080. |
| `npm run build` | Builds the site into `web/dist`. |
| `npm run typecheck` | Checks the TypeScript types. |
| `npm run lint` | Checks code style. Zero errors are required. |
| `npm run test` | Runs the unit tests. |

## Before you open a pull request

```sh
npm run typecheck && npm run lint && npm run test && npm run build
```

If you changed anything in `analysis/`, also run:

```sh
python -m compileall -q analysis
cd analysis && python -m unittest discover -s tests
```

If you changed a schedule or a workflow, run `python .github/scripts/check_schedules.py` (it needs the `pyyaml` package). The automatic checks on GitHub run all of these. Use a [conventional pull request title](/releases.html), such as `feat(web): add a tyre chart`, because it decides the next version number.

If you changed these docs, run `npm --prefix docs ci && npm --prefix docs run check`. It builds the site and checks the result. To see the site while you edit, run `npm --prefix docs run dev`.

Full contributor rules are in [CONTRIBUTING.md](https://github.com/ibrahimroshdy/f1datastop/blob/main/CONTRIBUTING.md).
