# Phase 1 — FastF1-Only Migration Plan

**Goal:** FastF1 is the *sole* data source. Drop Ergast/Jolpica **and** OpenF1 entirely.
Everything is pulled by the scheduled CI pipeline (running FastF1), written to Supabase, served DB-first
to the frontend. Race Analysis keeps its exact UI but gets better, complete data for
**every** session, past and current.

## Locked decisions
- **Coverage: 2018+ only.** FastF1 native timing starts ~2018. Pre-2018 (1950–2017) is
  removed from the app. Season selector caps at 2018.
- **Standings are computed** from race/sprint results (FastF1 has no native standings).
- **Team Radio is parked** (FastF1 can't provide it; future feature from F1 media source).
- **Charts UI is unchanged** — only the data source and axis handling change.
- **Lap times are ALWAYS `m:ss.mmm`** — never rounded to whole seconds, anywhere.

---

## Current state (from audit)

- `backfill.py` is **Ergast-primary**: `f1_race_result`, `f1_qualifying_result`,
  `f1_sprint_result`, `f1_pit_stop`, `f1_driver_standing`, `f1_constructor_standing`,
  `f1_season`, `f1_circuit`, `f1_race`, `f1_session`, `f1_driver`, `f1_constructor`
  all come from Ergast. `f1_lap` is the only FastF1-sourced table.
- OpenF1 fills `f1_session_driver`, `f1_weather`, `f1_starting_grid`, `f1_overtake`,
  `f1_team_radio`, `f1_position` — **all currently empty** (OpenF1 has gaps; 2026 = 404s).
- Frontend OpenF1 consumers (via `f1-proxy` live path):
  1. **Session picker** — `useSessionsByYear` → `/sessions` (source of the duplicate /
     mis-named sessions bug)
  2. **Overtakes** — `/position`, `/overtakes`, `/laps`, `/starting_grid`, `/drivers`
  3. **Session Results** — `/position` + `/drivers` + `/laps` (rebuilds results from
     OpenF1 even though `get_race_results` already has them)
  4. **Weather** — `/weather`
  5. **Team Radio** — `/team_radio` (parked)
- `session.weather_data` is accessed unsafely in `generate.py` (raises unless
  `load(weather=True)`).
- Net-new FastF1 extracts needed: **weather**, **per-lap position (+ track XY)**,
  **race control messages**, **computed overtakes**, **explicit starting grid**,
  **results/quali/sprint from FastF1 instead of Ergast**, **schedule/sessions from
  FastF1**, **computed standings**.

---

## Target architecture

```
CI (FastF1)     ──►  Supabase warehouse            ──►  serving RPCs  ──►  f1Warehouse
  one session         f1_* tables + Storage blobs        get_*()            adapter (DB-first)
  load per round      (position/telemetry as blobs)                          │
                                                                             ▼
                                                                      React Race Analysis
                                                                      (UI unchanged)
f1-proxy: DELETED (both Ergast + OpenF1 branches).  useOpenF1Data: DELETED.
```

**One FastF1 session load feeds every table.** Per (season, round, session):
`session.load(laps=True, telemetry=True, weather=True, messages=True)` → extract all
domains from that one object.

---

## Data-source map (every table → FastF1 object)

| Table | FastF1 source | Notes |
|---|---|---|
| `f1_race` / `f1_session` | `get_event_schedule(year)` | canonical sessions; fixes dedup/naming |
| `f1_circuit` | `session.event` (+ `get_circuit_info`) | 2018+ |
| `f1_driver` | `session.results` (Abbreviation, DriverId, HeadshotUrl, CountryCode) | |
| `f1_constructor` | `session.results` (TeamId, TeamName, TeamColor) | |
| `f1_race_result` | `session.results` (R) | Position, GridPosition, Points, Status, Time |
| `f1_qualifying_result` | `session.results` (Q/SQ) | Q1/Q2/Q3 from `session.laps` best per segment |
| `f1_sprint_result` | `session.results` (S) | |
| `f1_starting_grid` | `session.results['GridPosition']` | explicit table |
| `f1_lap` | `session.laps` | already FastF1; add sectors/tyrelife/pit flags |
| `f1_pit_stop` | `session.laps` PitInTime/PitOutTime | derive stop + duration |
| `f1_weather` | `session.weather_data` | AirTemp, TrackTemp, Humidity, Pressure, WindSpeed, WindDirection, Rainfall |
| `f1_position` | `session.laps['Position']` per lap (+ `get_pos_data` XY blob) | per-lap for charts/overtakes; XY as Storage blob for track replay |
| `f1_overtake` | **computed** from per-lap position deltas | lap, overtaker, overtaken |
| `f1_race_control` (NEW) | `session.race_control_messages` | VSC, SC, red/yellow flags, track limits |
| `f1_driver_standing` | **computed** from results (cumulative points) | after each round |
| `f1_constructor_standing` | **computed** from results | |
| `f1_telemetry_index` + `telemetry` bucket | `lap.get_telemetry()` | already FastF1 |
| `f1_team_radio` | — | **parked** |

---

## Sub-phases (sequence)

### 1a. Schema
- Verify/finalize columns on the empty enrichment tables (`f1_weather`, `f1_position`,
  `f1_starting_grid`, `f1_session_driver`, `f1_overtake`).
- Add `f1_race_control` table.
- Confirm `f1_qualifying_result` can hold Q1/Q2/Q3 segment times as `m:ss.mmm`-capable
  values (store milliseconds int + text).
- Storage: reuse the `telemetry` blob pattern for position/track-XY (new `position` bucket
  or a shared bucket + index).

### 1b. FastF1 ingest (the core rewrite)
- **Rewrite `backfill.py`** into a single per-session FastF1 extractor that writes ALL
  domains from one `session.load(...)`. Remove every Ergast call and every OpenF1 call.
- Add extractors: weather (safe load), starting grid, per-lap position, race control,
  results/quali/sprint from `session.results`, sessions/schedule from
  `get_event_schedule`.
- Add **overtake computation** (per-lap position deltas → `f1_overtake`).
- Add **standings computation** from results (per season, cumulative) → replaces Ergast
  standings.
- Add a **position/track-XY exporter** (Storage blob + index), mirroring
  `telemetry_export.py`, for the overtakes animated replay.
- Skip-complete on every domain (like laps/telemetry already do).
- Scheduled CI jobs: one `sync_current` (whole current season, 6h, skip-complete) + a one-time
  `backfill_all` for **2018–2024**.

### 1c. Serving
- New RPCs mirroring the existing `get_*` pattern: `get_weather`, `get_position`,
  `get_overtakes`, `get_starting_grid`, `get_race_control`, `get_sessions(season)`
  (for the picker), plus computed `get_driver_standings` / `get_constructor_standings`.
- Extend `f1Warehouse.ts` adapter to serve these domains DB-first.

### 1d. Session model fix (dedup + naming)
- Build `f1_session` strictly from `get_event_schedule` → exactly one row per real session,
  correct `session_type` (FP1/FP2/FP3, Q, SQ, S, R), sprint-weekend aware.
- Dedup key `(season, round, session_type)`.
- **Session picker reads `f1_session` (`get_sessions`)**, not OpenF1 `/sessions` — kills the
  duplicate-practice / wrong-sprint-label bug.

### 1e. Frontend rewire (component-by-component, UI unchanged)
- Session picker (`RaceAnalysis.tsx`, `SelectRace.tsx`) → `get_sessions`.
- `SessionResults` → `get_race_results` (warehouse) instead of OpenF1 reconstruction.
- `OvertakesAnalysis` → `get_overtakes` + `get_position` (works for all 2018+ seasons).
- `WeatherAnalysis` → `get_weather`.
- Season selector: cap at **2018**.
- Driver detail: serve any 2018+ driver from `f1_driver` (fixes Grosjean 404).
- Team Radio tab → parked (hide or "coming soon").
- **Delete** `useOpenF1Data`, `useTelemetryData` (OpenF1 live), the OpenF1 branch of
  `f1-proxy`, and OpenF1 adapters (`processOpenF1CarData`, OpenF1 overtakes lib).

### 1f. Correctness pass (do NOT skip)
- **Lap-time formatting:** every stored lap/sector time = milliseconds int + `m:ss.mmm`
  text; every chart axis uses the `m:ss.mmm` formatter. Audit and fix every chart that
  currently rounds (the pace/violin charts).
- **Axis re-verification per chart** against FastF1 shapes: Lap Times, Positions,
  Qualifying, Weather, Pit Stops, Deep Dive — confirm ordering, units, and direction
  (e.g. position axis inverted P1-at-top, gap-to-leader in seconds, weather units °C/%/m·s⁻¹).
- **Overtakes verified working** for 2018+ sample races (2024 known-good baseline).
- **No duplicate sessions** in any event dropdown; sprint vs conventional weekends labelled
  correctly.

---

## Verification checklist (Phase 1 done when all true)
- [ ] Every session (2018–present) loads on Race Analysis — no empty tabs.
- [ ] Session dropdown: one entry per real session, correct names, sprint-aware, no dups.
- [ ] Overtakes renders real data for any 2018+ race.
- [ ] Weather / Positions / Lap Times / Quali / Pit Stops all populated from FastF1.
- [ ] All lap/sector times display `m:ss.mmm` (zero whole-second rounding).
- [ ] Standings match official (computed from results).
- [ ] `f1-proxy`, `useOpenF1Data`, Ergast calls: **gone**. No `api.jolpi.ca` / `openf1.org`
      request anywhere.
- [ ] Charts look identical to today (UI unchanged), data is complete/correct.

## Risks / open items
- **FastF1 scale**: 2018–2026 × all sessions is a large one-time backfill — run it
  locally; use FastF1 disk cache + skip-complete + batching.
- **`weather_data` raises** unless `load(weather=True)` — always load weather; guard empty.
- **Track-XY volume** — Storage blobs + index only (never raw into Postgres).
- **Standings edge cases** — fastest-lap point, sprint points, DSQ/penalties: encode the
  season's points rules in the computation.
- **Pre-2018 removed** — confirmed acceptable.
- **Team radio parked** — confirmed.
