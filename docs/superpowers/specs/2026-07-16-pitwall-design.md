# Pit Wall — F1 Race-Engineer Telemetry & Replay

**Date:** 2026-07-16
**Status:** Approved (design), implementation starting
**Owner:** f1datastop web + analysis

---

## 1. Summary

**Pit Wall** is a new premium, standalone page: a full F1 race-engineer view that
combines everything f1datastop already computes — telemetry, whole-race replay,
gaps, sectors, tyres, pits, weather, overtakes, safety — into one **adaptive
dashboard**. Inspired by GP-Tempo / F1-Tempo (session lap-chart, per-lap telemetry
review, combined view) but taken to a premium level with our design system, driver
imagery, country flags, team logos, and **any-lap** telemetry (not just fastest).

Two compare modes: **Focus** (one driver, deep) and **Overlay** (multi-driver, delta
vs reference). Everything is URL-shareable.

## 2. Goals / Non-goals

**Goals**
- One cohesive premium page that assembles session lap-chart + deep telemetry + track
  replay + timing/weather/stints, configurable and compact.
- **Any lap** deep telemetry on demand (backend extension), not only the fastest lap.
- Era-aware: never assume DRS. Render only channels present in the data (2026 = no DRS).
- Reuse existing data + engines; add the minimum new backend.
- Fully shareable via URL.

**Non-goals (v1)**
- Live/real-time timing (we have no live feed).
- Deleting the existing Race Analysis `telemetry` / `racecontrol` tabs (keep; later
  redirect to Pit Wall).
- Practice-session parity if data is missing (best-effort where FastF1 has it).

## 3. Naming & IA

- **Pit Wall** = this new engineer page (thematically: where race engineers sit).
- **League/prediction game "Pit Wall" → renamed "Podium"** (discrete sweep across
  `web/src/features/game/**`, including the `components/pitwall/` folder, copy, share
  cards, any `Pit Wall` user-facing strings). No route change required unless a route
  literally contains `pitwall`; Pit Wall the page owns `/pit-wall`.

## 4. Subsystems

1. **Frontend** — `web/src/features/pitwall/**` — the adaptive dashboard page + panels.
2. **Backend** — any-lap telemetry queue: new `f1_telemetry_requests` table, extended
   `analysis/telemetry_export.py`, new `process_telemetry_requests` queue drainer.
3. **Rename** — game "Pit Wall" → "Podium".

## 5. Data inventory (reuse) + constraints

**Reused as-is:**
- `services/raceReplayService.ts` — `RaceReplayBlob` (per-frame xy for ALL laps, pos,
  gap, `laps[]` with sectors + tyre + tyre-age + pit, `drs[]` windows, `safety`, `rc`,
  `overtakes`) via `getRaceReplay` + `fetchRaceReplayBlob`.
- `services/telemetryService.ts` — `TelemetryBlob` (`channels` dict: speed/throttle/
  brake/gear/rpm/drs/distance/x/y) + `getTelemetryIndex` + `fetchTelemetryBlob`.
  `hooks/useFastF1Telemetry.ts` (`useTelemetryIndex`, `useTelemetryLaps`).
- `services/circuitGeometryService.ts` + `components/race/CircuitGeometryMap.tsx` —
  outline `[x,y,d]`, numbered corners, marshal sectors, straights.
- `components/race/FastF1TelemetryChart.tsx` — `cumulativeTime` + driver-vs-driver
  delta math.
- `components/race/RaceSimulator.tsx` — `usePlayhead` (rAF float-frame playhead) +
  `useTiming` (per-frame timing snapshot: pos/gap/interval/sectors/fastest/tyre/DRS) +
  car x/y interpolation + track-backdrop geometry. **Extract the two hooks to a shared
  module (§12).**
- `hooks/useLapTimeData.ts` (lap times + selection state), `hooks/useWarehouse.ts`
  (`useDbWeather`, `useDbPitLaps`, `useDbRaceControl`), `hooks/f1/usePitStops.ts`
  (pit durations, Ergast).
- `lib/chartTheme.tsx` (`chartTheme`, `ScopeDefs`, `SCOPE_GLOW`), `lib/f1/safetyPeriods.ts`
  + `components/analytics/SafetyCarBands.tsx`.
- Media/color: `standingsUtils` (`getTeamHexColor`, `normalizeTeamId`,
  `getNationalityCode`), `constants/f1Colors.ts` (`TEAM_COLORS`, `colorWithAlpha`,
  `lightenColor`/`darkenColor`), `constants/f1DriverPortraitMedia.ts`
  (`getF1PortraitPathForErgastDriverId`, `buildF1DriverHeadshotUrl`),
  `utils/imageCache.ts` (`getDriverImageUrls`, `useCachedImage`),
  `constants/f1TeamLogoMedia.ts` (`getF1TeamLogoUrl`), `components/common/TeamLogo.tsx`,
  `components/common/CountryFlag.tsx`, `components/f1/F1Avatar.tsx`
  (`DriverAvatar`, `F1Avatar`).
- Selectors: `components/analytics/DriverSelector.tsx` (team-colored chip grid),
  `components/f1/SessionSelector.tsx`.
- Layout: `lib/layout.ts` (`pageShellWide`, `pageStack`), `components/f1/F1Card`,
  `F1ChartContainer`, `F1Skeleton`.

**Constraints / gaps (drive design):**
- Deep telemetry channels exist only for the **fastest lap** per driver today →
  solved by §6 (any-lap queue).
- **Per-lap tyre** only in the replay blob (`ReplayLap.tyre/tyl/pit`) — join by lap
  number; race/quali/sprint-scoped.
- **No stint model, no outlier flag, no zoom util** — compute/build (see §8).
- Pit **durations** only from Ergast `getPitStops`; pit **laps** from warehouse.
- Weather only via `useDbWeather` (warehouse coverage gated).
- No `?drivers=`/`?lap=` URL params yet — add (§10).

## 6. Any-lap telemetry pipeline (backend)

Storage path + `f1_telemetry_index` are already lap-keyed
(`{season}/{round:02d}/{session}/{DRV}_{lap}.json`, unique on
`season,round,session,driver_code,lap_number`). So arbitrary laps already fit; we add
a request queue + a specific-lap export path + a drainer.

### 6.1 Table (prod migration via MCP)
```
f1_telemetry_requests (
  id uuid pk default gen_random_uuid(),
  season int not null, round int not null, session text not null default 'R',
  driver text not null,            -- 3-letter code
  lap_number int not null,
  status text not null default 'pending',   -- pending|processing|done|error
  public_url text, error text,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (season, round, session, driver, lap_number)   -- dedup
)
```
RLS: mirror `f1_chart_requests` — anon `insert` + `select` allowed; service_role full.
(Confirm exact policy shape against `f1_chart_requests` before applying.)

### 6.2 `analysis/telemetry_export.py`
Refactor the per-lap body of `export_session` into `_export_one_lap(s, lap, drv, res, upload)`.
Add `export_lap(season, rnd, session_code, driver, lap_number, upload, force)` that
loads the session, picks that driver's specific lap
(`dl[dl["LapNumber"]==lap]` else nearest), and reuses `_export_one_lap`. Index
`lap_type = "requested"`. Add CLI `--lap`. Fastest-lap path unchanged.

### 6.3 Drainer — `process_telemetry_requests`
Mirror `process_chart_requests`: claim ≤4 `pending` rows, patch `processing`, run
`telemetry_export.py --season .. --round .. --session .. --drivers DRV --lap N`, then
GET `f1_telemetry_index` for that key → patch `done`+`public_url` (or `error`).
Started per request by the `dispatch_ci_request` DB trigger (CircleCI).

### 6.4 Frontend
- `services/telemetryRequestService.ts` — `submitTelemetryLap({season,round,session,driver,lap})`
  (REST insert into `f1_telemetry_requests`, ignore-duplicate), `getTelemetryLapRequest(...)`
  (read status).
- `hooks/useLapTelemetry(season, round, session, driver, lap)` — react-query:
  1. read `getTelemetryIndex` (cached) → find `(driver, lap)` row → if present,
     `fetchTelemetryBlob(public_url)` and return.
  2. else `submitTelemetryLap` + poll request status (~4s) until `done`, then fetch
     blob; surface `pending/processing/error` states to the UI.
- Fastest lap stays instant (already in index). Any other lap = "generating…" then cached forever.

### 6.5 Era-awareness
Blob `channels` is a flexible dict. Frontend renders **only channels present** and
never assumes DRS. A `channelsPresent(blob)` helper drives which telemetry rows show.
2026 → no `drs` key → DRS trace/zones hidden; show ERS/override channels if the export
provides them. Cross-check season rules (DRS 2011–2025; 2026 none, active aero + battery
override, new PU, 22 cars).

## 7. Page architecture — adaptive dashboard

`web/src/features/pitwall/routes/PitWall.tsx`, wrapped in `pageShellWide`/`pageStack`.
Curated premium layout; panels **expand / collapse / show-hide** (config), NOT free
drag-drop (keeps it premium + consistent).

- **ContextBar** (sticky): season → event → session pickers + Share + mode toggle
  (Focus/Overlay) + panel-visibility menu. All state → URL (§10).
- **DriverRail** (collapsible): team-colored code chips (reuse/adapt `DriverSelector`)
  with headshot, number, team logo, flag, P#, fastest-lap mark. Selecting drivers
  drives every panel.
- **PanelShell**: a grid whose columns/reflow depend on mode + which panels are shown.
  Each panel = `F1Card` with a header (title, expand, hide) + body.

## 8. Panels

- **P1 · LapTimePanel** (session view): all laps; team-colored lines (teammate dashed);
  **tyre-colored dots** per stint (join `ReplayLap.tyre` by lap); pit `ReferenceLine`s
  (with duration on hover); fastest-lap line; safety bands; **outlier toggle**
  (computed: drop in/out/pit laps + laps > median × threshold); **drag-to-zoom**
  (new `useDragZoom` util over recharts); hover crosshair. Click a point → set active
  `lap` for P2/P3. Base template: `MuiLapTimeChart.tsx`.
- **P2 · TelemetryPanel** (deep): stacked traces speed / throttle / brake / gear / rpm
  (+ DRS only if present) + **delta vs reference**; shared x = distance; synced vertical
  crosshair with P3 playhead; drag-to-zoom. Data via `useLapTelemetry` (any lap). Reuse
  `cumulativeTime`/delta from `FastF1TelemetryChart`. Era-aware rows.
- **P3 · TrackStagePanel**: circuit (numbered corners, marshal sectors, straights) with
  **moving dot(s)** synced to a shared playhead. Fastest/any-lap telemetry → dot from
  telemetry x/y; whole-race context → dot from replay xy. Playback **0.5x/1x/2x/4x**
  (add 0.5x), scrubber, restart. Uses shared replay engine (§12).
- **P4 · TimingTowerPanel** (overlay mode): live P / gap / interval, purple-green
  sectors, tyre, fastest-lap holder, overtakes + race-control feed. From replay
  `useTiming` snapshot. (Lift from `RaceSimulator`'s `TimingTower`/`SectorBars`.)
- **P5 · WeatherStrip**: track/air temp, rain, wind, synced to playhead time
  (`useDbWeather`, nearest `time_seconds`). Hidden if no warehouse weather.
- **P6 · StintStrip**: per-driver compound stint bars + pit stops (duration). Stints
  derived from `ReplayLap.tyre` transitions + pit laps.
- **DriverDossier** (header per active driver): headshot, team logo, country flag, car
  number, position, best lap — premium identity block.

## 9. Compare modes

- **Focus (1 driver)**: single-driver everything — full telemetry, its stints, dossier,
  one dot. Panel grid one-column-dense.
- **Overlay (≤5 drivers)**: overlaid traces, **delta vs a chosen reference driver**,
  timing tower, all dots + lap-lines. Reference driver selectable in ContextBar.

## 10. URL / share schema

Route: `/pit-wall/:year?/:round?` + query:
`?session=R|Q|S|SQ|FP1..&drivers=RUS,ANT&mode=focus|overlay&ref=RUS&lap=3&panels=lap,tel,track,tower,weather,stint`
Use `useUrlTab` for enumerated params + a small `usePitWallState` wrapper over
`useSearchParams` (mirror `RaceAnalysis.tsx`). Selecting anything updates URL
(`replace:true`); Share copies the URL.

## 11. Routing & nav

- `App.tsx` MainLayout block → add lazy `<Route path="/pit-wall" .../>` (+ `:year/:round`).
- `config/navigation.ts` `explore` group → add `{ label: "Pit Wall", href: "/pit-wall", icon }`.
- Deep-link: a "Open in Pit Wall" affordance from Race Analysis (later; not blocking).

## 12. Replay engine extraction

Lift `usePlayhead` + `useTiming` (+ car interpolation + outline/sector/start-finish
geometry helpers) from `components/race/RaceSimulator.tsx` into
`web/src/lib/f1/replayEngine.ts` (pure hooks/functions, no JSX). Re-import them back
into `RaceSimulator.tsx` so Race Control is unchanged. Pit Wall's P3/P4 build on the
shared engine. Add a `speed 0.5` option (engine supports fractional speed already).

## 13. Premium design direction

"Telemetry Terminal": mono readouts (`timing`/`readout`/`instrument-label`), glow
traces (`SCOPE_GLOW`), glass `F1Card` panels, team-color accents, driver imagery +
flags + logos woven through dossiers/legends/track. Final **hallmark** polish pass +
responsive (320/375/414/768) + dark/light.

## 14. Phases

1. **Backend any-lap pipeline** — migration (`f1_telemetry_requests`), `telemetry_export.py`
   `export_lap`, `process_telemetry_requests` cron, `telemetryRequestService` + `useLapTelemetry`.
2. **Scaffold** — feature dir, route, nav, `pageShellWide`, `usePitWallState` URL state,
   ContextBar (season/event/session/mode/share), DriverRail, PanelShell.
3. **P1 LapTimePanel** — tyre dots, pits, outlier toggle, drag-to-zoom, click→lap.
4. **Replay engine extraction** + **P3 TrackStage** + **P2 TelemetryPanel** (era-aware,
   any-lap) with synced playhead.
5. **P4 TimingTower + P5 Weather + P6 Stints + DriverDossier + compare modes**.
6. **Podium rename** (game Pit Wall → Podium).
7. **Hallmark polish** + responsive + Share card + `npm run typecheck`.

## 15. Risks / constraints / user actions

- Any-lap generation needs the CI drainer to run; until then, non-fastest laps show
  "generating…" and never complete. Fastest laps work immediately.
- `SUPABASE_SERVICE_ROLE_KEY` is a secret (env only; never commit/echo).
- FastF1 quirks: some rounds fail telemetry (e.g. Monaco 'Date' column) — export must
  fail cleanly and mark the request `error`.
- Warehouse coverage gates weather/replay; panels self-hide when data absent.
- Local dev Supabase is stale for 2026; verify warehouse-backed panels via prod-swap.

## 16. Verification

- `npm run typecheck` clean each phase (CI).
- Browser-preview: light + dark, 320→1280, each panel; confirm era-awareness on a 2026
  session (no DRS row) vs a 2024 session (DRS present).
- Fastest lap instant; a non-fastest lap enqueues a request row (verify insert) and,
  post-deploy, completes.
