---
title: Developers
description: "Public Formula 1 data: static JSON on the CDN, read-only PostgREST tables, embeddable standings and async chart and telemetry requests."
---

Public data, embeds and request queues. No account is needed. Fair use; access may be rate limited.

## Embeds

Embeddable standings tables for any site. Each address opens in a new tab on the live site, and the iframe snippet, the options and the tips are on [API and embeds](/api-embeds.html).

| Embed | What it is | Address |
| --- | --- | --- |
| Embed overview | All embeddable components with copy-paste iframe snippets. | [`/embed`](https://www.f1datastop.com/embed) |
| Driver standings | Driver standings table for any site. | [`/embed/driver-standings`](https://www.f1datastop.com/embed/driver-standings) |
| Constructor standings | Constructor standings table for any site. | [`/embed/constructor-standings`](https://www.f1datastop.com/embed/constructor-standings) |

Embed URL parameters: `season` (year, default current), `theme` (`light` or `dark`, default light) and `font` (one of Roboto, Open Sans, Montserrat, Inter; default Inter).

## f1-proxy edge function (Supabase)

Routes Ergast and OpenF1 requests through a cached Supabase edge function. Enable it in the web app with `VITE_F1_PROXY_ENABLED=true`. Requests are cached in Postgres (the `api_cache` table) with a cache lifetime for each endpoint. Every response includes a `cached` flag and a `cacheKey`.

```js
// POST to f1-proxy edge function
// Base URL: https://<project-ref>.supabase.co/functions/v1/f1-proxy
// Header: Authorization: Bearer <anon-key>

const response = await fetch('/functions/v1/f1-proxy', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  },
  body: JSON.stringify({
    source: 'ergast',           // 'ergast' | 'openf1'
    path: '/f1/2026.json',      // Ergast path (no /api prefix)
    params: { limit: 50 }
  })
});

const { data, cached, cacheKey, status, error } = await response.json();
```

**Ergast paths:** `/f1/{season}.json`, `/f1/{season}/{round}/results.json`, `/f1/{season}/{round}/qualifying.json`, `/f1/{season}/{round}/sprint.json`, `/f1/{season}/{round}/pitstops.json`, `/f1/{season}/{round}/laps.json`, `/f1/{season}/driverStandings.json`, `/f1/{season}/constructorStandings.json`

**OpenF1 paths:** `/sessions`, `/drivers`, `/laps`, `/position`, `/car_data`, `/meetings`, `/circuits`

**Params:** pass them as a `params` object, for example `{ year: 2026, session_key: 9158 }`.

## Static files (CDN)

Everything the site reads is also public as static files on `cdn.f1datastop.com` (Cloudflare R2). Paths are public but **unversioned**: they can change or move without notice, so do not treat them as a stable API. The file layout is on [Data and CDN](/data.html).

```js
// Static files (public, no auth), served from the CDN
// Base URL: https://cdn.f1datastop.com

// Pre-exported JSON snapshots (schedule, results, standings, pit stops, laps)
const schedule = await fetch('https://cdn.f1datastop.com/data/2026/schedule.json').then(r => r.json());
const results  = await fetch('https://cdn.f1datastop.com/data/2026/1/results.json').then(r => r.json());

// Large assets: <host>/<bucket>/<storage_path>
// Buckets: charts | telemetry | replays | circuits
// storage_path values come from the index files below (host-free)
const chartIndex = await fetch('https://cdn.f1datastop.com/data/index/charts/2026/01/R.json').then(r => r.json());
```

| Path | What is there |
| --- | --- |
| `/charts/{storagePath}` | Chart images (PNG/WebP): driver comparisons, position charts, lap time charts |
| `/telemetry/{storagePath}` | Telemetry blobs (JSON/Parquet): speed, throttle, brake, gear, DRS per lap |
| `/replays/{storagePath}` | Session replays: full lap data for race replay visualization |
| `/circuits/{storagePath}` | Circuit geometry: track layout, sectors, corners, marshal sectors |

## Supabase PostgREST (direct table access)

If PostgREST is enabled on the Supabase project, tables can be queried directly over REST. All reads are public (anon key). Use standard PostgREST query syntax.

```js
// Direct PostgREST access (if enabled)
// Base URL: https://<project-ref>.supabase.co/rest/v1
// Header: apikey: <anon-key>, Authorization: Bearer <anon-key>

// Example: Driver standings for 2026 (all rounds, latest first)
const standings = await fetch(
  'https://<ref>.supabase.co/rest/v1/f1_driver_standing?season=eq.2026&order=round.desc,position.asc',
  { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } }
).then(r => r.json());

// Example: Race results
const results = await fetch(
  'https://<ref>.supabase.co/rest/v1/f1_race_result?season=eq.2026&round=eq.1',
  { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } }
).then(r => r.json());
```

| Table / view | Description | Key filters |
| --- | --- | --- |
| `f1_driver` | Driver metadata, codes, numbers | `ergast_id`, `slug` |
| `f1_constructor` | Constructor metadata, colors | `ergast_id`, `slug` |
| `f1_circuit` | Circuit info, coordinates | `circuit_id` |
| `f1_race` | Race schedule (race_name, circuit_id, date) | `season`, `round` |
| `f1_race_result` | Full race results per driver | `season`, `round` |
| `f1_qualifying_result` | Qualifying results per driver | `season`, `round` |
| `f1_sprint_result` | Sprint results per driver | `season`, `round` |
| `f1_pit_stop` | Pit stop data per driver | `season`, `round` |
| `f1_lap` | Lap times per driver | `season`, `round` |
| `f1_driver_standing` | Driver championship points | `season`, `round` |
| `f1_constructor_standing` | Constructor championship points | `season`, `round` |

## Async request queues

Chart and telemetry generation is asynchronous. A request is a direct, anonymous insert into a Postgres table through the public PostgREST API (it does not go through f1-proxy). A workflow (the Queue workflow) then processes the waiting rows, so expect a delay; the finished file then appears in the CDN index files for that session. A database trigger starts the workflow as soon as a row is added, and a check every 5 minutes starts it if a row is still waiting. See [Scheduled jobs](/pipeline.html#the-visitor-request-queue) for how it works.

### Chart requests

Table: `f1_chart_requests`

- `POST /rest/v1/f1_chart_requests` with `{season, round, session, chart, driver_key, drivers, format, theme, status:'pending'}`
- Poll `GET /rest/v1/f1_chart_requests?season=eq.{season}&round=eq.{round}&select=status,error`
- When `status=done`, the chart is listed in `cdn.f1datastop.com/data/index/charts/{season}/{round (2 digits)}/{session}.json`

### Telemetry requests

Table: `f1_telemetry_requests`

- `POST /rest/v1/f1_telemetry_requests` with `{season, round, session, driver, lap_number, status:'pending'}`
- Poll `GET /rest/v1/f1_telemetry_requests?season=eq.{season}&round=eq.{round}&select=status,error`
- When `status=done`, the blob is listed in `cdn.f1datastop.com/data/index/telemetry/{season}/{round (2 digits)}/{session}.json`

A duplicate request for the same chart or lap is rejected by a unique key (Postgres error 23505); poll the existing one instead.

## Fair use

No account or API key is required. This is a free project: please keep request volume modest and cache what you fetch. Access is fair use and **may be rate limited** or blocked if it degrades the site for others; there is no published quota or SLA.

**f1-proxy cache:** responses carry a `cached` flag and cache lifetimes vary by endpoint.

## Data model (Postgres warehouse)

Core tables are filled by the scheduled jobs (Ergast/Jolpica and FastF1). All reads are public. The CDN serves static JSON snapshots for schedule, results, standings, pit stops and laps. The full list of tables is on [Backend](/backend.html#the-warehouse-tables).

### Core tables (Ergast/Jolpica)

Warehouse tables filled by the scheduled jobs.

- `f1_driver`: driver metadata, codes, numbers
- `f1_constructor`: team metadata, colors
- `f1_circuit`: circuit info, coordinates
- `f1_race`: race schedule, results summary
- `f1_race_result`: driver race results
- `f1_qualifying_result`: qualifying results
- `f1_sprint_result`: sprint results
- `f1_pit_stop`: pit stop data
- `f1_lap`: lap times
- `f1_driver_standing`: driver points per round
- `f1_constructor_standing`: constructor points

### FastF1 and session tables

High-resolution telemetry and session data.

- `f1_telemetry_index`: telemetry file catalog (R2 paths)
- `f1_session`: session metadata
- `f1_session_driver`: driver-session mapping (older rows only; nothing new is written)
- `f1_position`: position data per lap (older rows only; nothing new is written)
- `f1_overtake`: overtake events
- `f1_weather`: weather per session
- `f1_race_control`: race control messages
- `f1_team_radio`: team radio transcripts (older rows only; nothing new is written)
