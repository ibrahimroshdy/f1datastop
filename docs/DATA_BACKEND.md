# F1 Data Warehouse

## Canonical Model
CANONICAL RELATIONAL SCHEMA (Postgres / Supabase `public`). All tables prefixed `f1_`, reusing existing conventions: text/int natural keys, `update_updated_at_column()` trigger, public-read RLS + service-role-only writes. Surrogate keys avoided where a stable natural key exists; composite natural keys used for season-scoped rows so ingestion is a pure UPSERT on conflict.

DIMENSION / IDENTITY (existing, reused as FK targets):
- f1_driver(ergast_id PK text, given_name, family_name, code, permanent_number, nationality, date_of_birth, slug UNIQUE, headshot_url, active_season, ...) — EXISTS. Must be EXPANDED from 22 rows (current grid) to every driver appearing in current+last-3 seasons.
- f1_constructor(ergast_id PK text, name, nationality, slug UNIQUE, team_color_hex, active_season, ...) — EXISTS. Same expansion to 4-season coverage.
- f1_driver_career / f1_constructor_career — EXISTS, unchanged.

NEW DIMENSIONS:
- f1_season(year int PK, has_results bool, race_count int, source text, created_at, updated_at).
- f1_circuit(circuit_id PK text /Ergast circuitId/, name text, locality text, country text, lat numeric, lng numeric, openf1_circuit_key int NULL /OpenF1 crosswalk/, url text, source text, created_at, updated_at).

EVENT / SESSION SPINE (the join backbone; replaces fragile findMatchingOpenF1Session):
- f1_race(id bigint GENERATED surrogate PK; UNIQUE(season,round); season int FK->f1_season, round int, race_name text, circuit_id text FK->f1_circuit, date date, time text NULL, url text, openf1_meeting_key int NULL, sprint_weekend bool, source text, raw jsonb NULL, ingested_at, created_at, updated_at). UNIQUE(season,round) is the natural key.
- f1_session(id bigint surrogate PK; UNIQUE(season,round,session_type); race_id bigint FK->f1_race, season int, round int, session_type text CHECK in ('FP1','FP2','FP3','Q','SQ','SS','S','R'), session_name text, scheduled_date date, scheduled_time text, date_start timestamptz NULL, date_end timestamptz NULL, openf1_session_key int NULL UNIQUE, openf1_meeting_key int NULL, source text, created_at, updated_at). openf1_session_key is the EXPLICIT crosswalk that kills the heuristic. Index on (openf1_session_key) and (season,round).

ERGAST-DERIVED FACTS (keyed by race + driver/constructor):
- f1_race_result(id bigint PK; UNIQUE(season,round,driver_id); race_id FK, season int, round int, driver_id text FK->f1_driver(ergast_id), constructor_id text FK->f1_constructor(ergast_id), car_number int, position int NULL, position_text text, points numeric, grid int, laps int, status text /verbatim/, is_dnf bool /derived: NOT (status='Finished' OR status ~ '^\+\d+ Lap'/, time_millis bigint NULL, time_text text NULL, fastest_lap_rank int NULL, fastest_lap_number int NULL, fastest_lap_time text NULL, fastest_lap_avg_speed numeric NULL, fastest_lap_speed_units text NULL, source text, raw jsonb NULL, created_at, updated_at). Indexes (season,round), (driver_id), (constructor_id).
- f1_qualifying_result(id PK; UNIQUE(season,round,driver_id); race_id, season, round, driver_id, constructor_id, car_number, position int, q1 text, q2 text, q3 text, source, raw jsonb, created_at, updated_at).
- f1_sprint_result(id PK; UNIQUE(season,round,driver_id); SAME columns as f1_race_result incl status/is_dnf/fastest_lap*, source, raw jsonb).
- f1_pit_stop(id PK; UNIQUE(season,round,driver_id,stop); race_id, season, round, driver_id, stop int, lap int, time_local text /HH:MM:SS/, duration_seconds numeric, source, created_at). Indexes (season,round,driver_id).
- f1_lap(id bigint PK; UNIQUE(season,round,lap_number,driver_id); race_id, season, round, lap_number int, driver_id text, position int, time_text text, time_millis bigint NULL, source, created_at). HEAVY TABLE — index (season,round) and (season,round,lap_number). This is what the laps serving view re-assembles into Ergast {Races:[{Laps:[{number,Timings[]}]}]}.
- f1_driver_standing(id PK; UNIQUE(season,round,driver_id); season, round /round at which standing computed; round=season-final for end-of-season/, driver_id, constructor_id /last team per Ergast/, position int, position_text text, points numeric, wins int, source, created_at, updated_at). Index (season,round).
- f1_constructor_standing(id PK; UNIQUE(season,round,constructor_id); season, round, constructor_id, position, position_text, points numeric, wins int, source, created_at, updated_at).

OPENF1-DERIVED FACTS (keyed by session_key + driver_number; 2023+ only):
- f1_session_driver(id PK; UNIQUE(openf1_session_key,driver_number); openf1_session_key int FK->f1_session(openf1_session_key), driver_number int, name_acronym text, first_name, last_name, full_name, team_name, team_colour text, headshot_url text, country_code text, ergast_driver_id text NULL /resolved crosswalk/, source, created_at, updated_at). The driver_number<->ergast_id bridge lives HERE explicitly.
- f1_weather(id PK; UNIQUE(openf1_session_key,date); openf1_session_key, date timestamptz, air_temperature numeric, track_temperature numeric, humidity numeric, pressure numeric, wind_speed numeric, wind_direction int, rainfall int, source, created_at).
- f1_starting_grid(id PK; UNIQUE(openf1_session_key,driver_number); openf1_session_key, position int, driver_number int, source, created_at).
- f1_overtake(id PK; UNIQUE(openf1_session_key,date,overtaking_driver_number,overtaken_driver_number); openf1_session_key, date timestamptz, overtaking_driver_number int, overtaken_driver_number int, position int, source, created_at).
- f1_team_radio(id PK; UNIQUE(openf1_session_key,driver_number,date); openf1_session_key, driver_number, date timestamptz, recording_url text, source, created_at).
- f1_position(id PK; UNIQUE(openf1_session_key,driver_number,date); openf1_session_key, driver_number, date timestamptz, position int, source, created_at) — snapshotted post-session only; live position stays on proxy.
- (DEFERRED) telemetry/car_data: NO table. Stays on live proxy. Optional later: f1_fastest_lap_trace storing ~250-pt downsampled polyline of session-fastest lap only.

FASTF1 SUMMARY FACTS (from analysis/generate.py, render-time zero-extra-cost emit):
- f1_lap_summary(id PK; UNIQUE(season,round,session_type,driver_code,lap_number); season, round, session_type, driver_code text, lap_number int, lap_time_ms int, sector1_ms/sector2_ms/sector3_ms int, compound text, stint int, tyre_life int, position int, is_pb bool, deleted bool, is_quicklap bool, speed_i1/i2/fl/st numeric, source='fastf1', created_at).
- f1_stint_summary(id PK; UNIQUE(season,round,session_type,driver_code,stint); compound, start_lap, end_lap, lap_count, avg_lap_ms, median_lap_ms, source='fastf1', created_at).
- f1_session_result_ff1(id PK; UNIQUE(season,round,session_type,driver_code); team, grid_position, finish_position, status, points, fastest_lap_ms, fastest_lap_number, top_speed numeric, source='fastf1', created_at).
- analysis_charts — EXISTS (chart PNG index), unchanged; FIX latent drift by populating drivers[].

PROVENANCE: every fact table carries `source text` ('ergast'|'openf1'|'fastf1') and durable Ergast/OpenF1 facts carry `raw jsonb` (the exact upstream sub-object) so the serving views can reassemble byte-faithful Ergast envelopes and so re-derivation never needs a refetch.

INGESTION LEDGER (coverage + freshness state machine):
- f1_sync_state(id PK; UNIQUE(domain,season,round,session_type); domain text /'schedule'|'results'|'qualifying'|'sprint'|'pitstops'|'laps'|'driver_standings'|'constructor_standings'|'openf1_session'|'openf1_weather'|... /, season int, round int NULL, session_type text NULL, status text CHECK in ('pending','partial','complete','empty','error','not_applicable'), source text, row_count int, expected_count int NULL, last_attempt_at timestamptz, last_success_at timestamptz, next_retry_at timestamptz NULL, attempt_count int, last_error text, upstream_total int NULL /MRData.total/, created_at, updated_at). This drives idempotent re-runs, the retry-until-available poller, and the serving window guard. Index (status,next_retry_at) and (domain,season).

## Translation & Conflict Rules
SOURCE -> CANONICAL MAPPING + CONFLICT RESOLUTION, per domain. Authority rule of thumb: Ergast/Jolpica is AUTHORITATIVE for identity, results, standings, schedule and round numbering. OpenF1 is AUTHORITATIVE for live/session-resource data it uniquely provides (weather, team_radio, overtakes, starting_grid, headshots, team_colour) and for the session_key crosswalk. FastF1 fills the telemetry-grade GAP (sectors, compounds, stints, ms-precision laps) and is authoritative ONLY for those summary domains.

SCHEDULE: Ergast `/f1/{year}.json` -> f1_season + f1_race (one row/Race) + f1_session (one row per present sub-object FirstPractice->FP1, SecondPractice->FP2, ThirdPractice->FP3, Qualifying->Q, SprintQualifying->SQ, Sprint->S, the race itself->R). circuit_id upserts f1_circuit. sprint_weekend = (Sprint present). Authority: Ergast only. Conflict: none (single source).

RESULTS / SPRINT: Ergast `/f1/{year}/{round}/results.json` (Races[0].Results[]) -> f1_race_result; `/sprint.json` -> f1_sprint_result. Persist status VERBATIM; derive is_dnf server-side with the SAME rule as f1Service (status='Finished' or matches '+N Lap(s)' => classified, else DNF). Parse all MRData string numerics (position/points/grid/laps, FastestLap.rank/lap, AverageSpeed.speed, Time.millis) into typed columns. driver_id=Driver.driverId, constructor_id=Constructor.constructorId (FK upsert into f1_driver/f1_constructor if absent — backfill auto-expands the dimension). Authority: Ergast. FastF1 finish/grid (f1_session_result_ff1) is a SECONDARY cross-check, never overwrites Ergast race_result.

QUALIFYING: Ergast `/qualifying.json` -> f1_qualifying_result (Q1/Q2/Q3 kept as raw strings, missing-segment => NULL). Authority: Ergast.

PITSTOPS: Ergast `/pitstops.json` -> f1_pit_stop keyed (season,round,driver_id,stop). duration parsed to numeric seconds. Authority: Ergast.

LAPS: Ergast paginated `/laps.json` -> f1_lap (one row per Timing). Ingestion does the pagination server-side (limit=100 offset loop on MRData.total) so the CLIENT never paginates Jolpica again. Serving view reassembles EXACTLY {Races:[{...,Laps:[{number,Timings:[{driverId,position,time}]}]}]} so useLapTimeData/usePositionChangeData stay untouched. Authority: Ergast for lap position/order; FastF1 f1_lap_summary holds the ms-precision + sectors variant separately (different consumer, no conflict).

STANDINGS: Ergast `/driverStandings.json` + `/constructorStandings.json` -> f1_driver_standing / f1_constructor_standing keyed by (season, round). For end-of-season use round = final round; for in-season snapshots store the round the standings were computed at. Driver's current constructor = LAST element of Constructors[] (mirror adapters.getPrimaryConstructor). Authority: Ergast. VOLATILE: these are also served short-TTL; see freshness.

OPENF1 SESSION CROSSWALK (the key conflict-resolver): on ingest, map OpenF1 session -> (season,round,session_type) DETERMINISTICALLY, never heuristically. Procedure: fetch `/sessions?year={y}` from OpenF1; for each session, match to f1_race by (country/circuit + date proximity to f1_race.date) and session_type by OpenF1 session_name->session_type table (Practice 1->FP1, Qualifying->Q, Sprint->S, Sprint Shootout/Sprint Qualifying->SQ, Race->R). Persist resolved openf1_session_key + openf1_meeting_key onto f1_session, and f1_race.openf1_meeting_key. Once persisted, ALL OpenF1 facts join via openf1_session_key with zero guessing. Conflict: if multiple OpenF1 sessions map to one f1_session, prefer exact date_start match; log ambiguity to f1_sync_state.last_error.

OPENF1 RESOURCES: drivers/weather/starting_grid/overtakes/team_radio/position keyed by session_key -> their tables. driver_number->ergast_driver_id resolved via f1_session_driver (match name_acronym/permanent_number against f1_driver; persist the resolution). Authority: OpenF1 for these resources; headshot_url/team_colour from OpenF1 also enriches f1_driver when missing (OpenF1 wins for headshots since Ergast has none).

FASTF1: generate.py emits f1_lap_summary/f1_stint_summary/f1_session_result_ff1 keyed by driver_code (Ergast `code`, e.g. VER). Crosswalk driver_code->ergast_id via f1_driver.code. Authority: FastF1 for sectors/compound/stint/ms-laps ONLY. Never touches Ergast results.

FRESHNESS / AVAILABILITY HANDLING: classify each domain DURABLE (immutable once a session is official: results, qualifying, sprint, pitstops, laps, completed schedule, all post-session OpenF1 resources) vs VOLATILE (driver/constructor standings 5min, OpenF1 live/position/car_data 30s). DURABLE domains are served DB-first with no expiry. VOLATILE standings are recomputed once results land and re-served short-TTL; live OpenF1 stays on the proxy. NEVER cache empty/error as final: an empty Ergast results array right after a session is `partial`/`pending` in f1_sync_state (retry), NOT `complete`. Distinguish 404 (genuinely absent -> status 'empty', stop retrying) from 521/522/429/timeout (transient -> retry with backoff). Older-than-window seasons (year < currentYear-3) are never ingested; serving falls through to the live proxy.

## Ingestion
IDEMPOTENT UPSERT PIPELINE, one ingester per domain, all converging on f1_sync_state. Two runtimes by capability.

(1) EDGE FUNCTION `f1-ingest` (Deno/TS) — handles ALL Ergast (Jolpica) + OpenF1 domains, because they are plain JSON over HTTP and reuse the existing proxyF1Request fetch layer (8s timeout, stale fallback, api_metrics logging, TTL). New function supabase/functions/f1-ingest/index.ts + supabase/functions/_shared/ingest/*.ts. Invoked with {domain, season, round?, mode:'backfill'|'sync'|'poll'}. For each domain an ingester: (a) reads f1_sync_state row, (b) fetches via proxyF1Request (so it ALSO warms api_cache and is rate-limit-aware), (c) parses MRData -> typed rows, (d) `supabase.from(table).upsert(rows, {onConflict: '<natural key>'})` — pure UPSERT so re-runs are no-ops on unchanged data, (e) writes f1_sync_state {status,row_count,upstream_total,last_success_at,next_retry_at}. Every ingester is a single transaction-like batch keyed by the table's UNIQUE constraint; partial laps pages tolerated (status='partial', retry remaining offsets). Laps ingester loops offset 0..total at limit=100 server-side. Standings ingester upserts both driver+constructor for a (season,round). OpenF1 crosswalk ingester runs FIRST per season to populate f1_session.openf1_session_key before any OpenF1 resource ingester.

(2) PYTHON JOB `analysis/generate.py` (FastF1) — stays the offline/CI batch (cannot run in Deno). Add emit_summaries(session, meta) right after session.load(): reuse already-loaded frames (zero extra FastF1 fetch) to UPSERT f1_lap_summary/f1_stint_summary/f1_session_result_ff1 via PostgREST with on_conflict, exactly like the existing upsert_index(). Also fix analysis_charts.drivers[] population. This runs ONLY for current+last-3 seasons completed sessions.

IDEMPOTENCY GUARANTEES: every write is UPSERT on a stable UNIQUE natural key (never INSERT); re-running any ingester for the same (season,round) converges to the same rows. raw jsonb lets re-derivation happen without refetch. f1_sync_state makes coverage queryable: "which (season,round,domain) are not yet complete" is one SELECT, so backfill/poll are resumable and never double-fetch a complete durable domain.

SYNC_STATE TRACKS: per (domain,season,round[,session_type]) — status (pending/partial/complete/empty/error/not_applicable), row_count vs expected/upstream_total (coverage), last_success_at + next_retry_at (freshness + backoff), attempt_count, last_error. The serving layer can read it to decide DB-first vs proxy ("is laps for 2025/12 complete?"). Coverage report = SELECT count(*) FILTER (WHERE status='complete') GROUP BY domain,season.

ALL of the above runs against the LOCAL supabase stack only (supabase start). Migrations + functions + scripts delivered as files; the user ships to prod.

## Backfill
BACKFILL = current season + last 3 seasons (2022..2025 as of 2026; window = [currentYear-3 .. currentYear]) + all FUTURE scheduled rounds of the current season. Older seasons are intentionally NOT backfilled (live proxy serves them).

ORDERING (dependency-correct, dimensions before facts, spine before OpenF1):
1. f1_season + f1_circuit + f1_race + f1_session for each year via `/f1/{year}.json` (schedule). This builds the spine and auto-discovers rounds.
2. Expand f1_driver / f1_constructor: derive the full driver/constructor set from each season's `/f1/{year}/driverStandings.json` + `/results.json`, upserting any missing ergast_id (so FK coverage exists for 4 seasons, not just the 22-row current grid). Existing seed scripts/seed-f1-entities.mjs pattern reused; new scripts/backfill-entities.mjs.
3. For each COMPLETED (season,round): results -> qualifying -> sprint(if sprint_weekend) -> pitstops -> laps. Skip future rounds (no results yet) — sync_state marks them 'not_applicable' until their date passes.
4. driver_standings + constructor_standings per season (final round) and per-round snapshots if desired.
5. OpenF1 crosswalk per season (year>=2023 only) -> then OpenF1 resources (session_drivers, weather, starting_grid, overtakes, team_radio, post-session position) per resolved session_key.
6. FastF1 summaries: loop generate.py over completed (season,round,session) for the window.

HOW TO RUN: a driver script scripts/backfill.mjs (Node, service-role, LOCAL only) that enumerates the window, computes the work list from f1_sync_state (only domains not 'complete'), and invokes the f1-ingest edge function per (domain,season,round) with mode='backfill'. RESUMABLE: re-running skips anything already 'complete'. RATE-SAFE: sequential per season with small inter-request delay; relies on proxyF1Request stale-fallback + api_metrics 429 visibility; never the aggressive parallel client pagination. Command: `supabase functions serve` + `node scripts/backfill.mjs --from 2022 --to 2026 --domains all`. FastF1 backfill: `for s in 2023 2024 2025 2026; do analysis/run.sh --season $s --all-rounds; done` (writes summaries + charts to LOCAL). Verify with the coverage SELECT on f1_sync_state before declaring a season done.

## Cron & In-race
SCHEDULING via pg_cron + pg_net (both AVAILABLE, not yet installed — add CREATE EXTENSION in the migration) calling the edge functions, OR Supabase scheduled functions. Two cadences:

(A) REGULAR NEW-DATA FETCH (steady state): pg_cron job every 6h invokes f1-ingest in mode='sync' for the CURRENT season: refresh schedule (cheap, catches calendar changes), driver/constructor standings (volatile), and any completed-but-not-'complete' rounds (results/qualifying/sprint/pitstops/laps). Idempotent: complete durable rounds are skipped via f1_sync_state. Also purge VOLATILE-domain staleness. Cron: `0 */6 * * *`.

(B) DURING-RACE / POST-SESSION POLLING (retry-until-available): because Jolpica lags hours after a session, a tighter poller runs only around sessions. A pg_cron job every 15 min checks f1_sync_state for rows where status in ('pending','partial') AND next_retry_at <= now() for the current/next race weekend window, and re-invokes f1-ingest for those (domain,season,round). On each attempt: if upstream returns empty array -> keep status 'partial', set next_retry_at = now()+exponential backoff (15m,30m,1h,2h cap), increment attempt_count; if rows land -> status 'complete', clear next_retry_at; if 404 after the session is long past -> status 'empty', stop. This NEVER caches empty-as-final and tolerates the multi-hour lag. Cron: `*/15 * * * *` with the function self-gating to weekend windows (reads f1_session.date_start within +/- 48h) so it's a no-op most of the week. OpenF1 live (session_key=latest) is NOT ingested on cron — it stays a proxy passthrough at 30s TTL; only POST-session snapshots of OpenF1 resources are pulled by the poller once a session ends.

INSTALL: migration adds `CREATE EXTENSION IF NOT EXISTS pg_cron; CREATE EXTENSION IF NOT EXISTS pg_net;` and `cron.schedule(...)` calls wrapped so they're idempotent (unschedule-if-exists then schedule). All scheduled against LOCAL; user enables on prod when shipping.

## Serving & Cutover
READ LAYER + CUTOVER. Two serving styles, matching the two existing patterns:

A) PostgREST VIEWS that reassemble byte-faithful Ergast/OpenF1 envelopes from the normalized tables, so the EXISTING service mappers (f1Service.ts, openF1Service.ts) need zero shape changes. Views (SECURITY INVOKER, GRANT SELECT anon/authenticated):
 - f1_v_schedule(season) -> MRData.RaceTable.Races[] JSON built from f1_race+f1_session+f1_circuit via jsonb_agg.
 - f1_v_race_results / f1_v_qualifying / f1_v_sprint / f1_v_pitstops (season,round) -> Races[0].{Results|QualifyingResults|...}.
 - f1_v_laps(season,round) -> {Races:[{Laps:[{number,Timings[]}]}]} via nested jsonb_agg ordered by lap_number, the heaviest reassembly (uses raw where stored, else rebuilt from columns).
 - f1_v_driver_standings / f1_v_constructor_standings(season).
 OpenF1 resources served as plain row sets (frontend already maps arrays).
 These are exposed as RPCs (get_schedule(p_season), get_laps(p_season,p_round), ...) returning the assembled jsonb so the client does a single supabase.rpc() call.

B) THIN CLIENT SERVING ROUTER in web/src/lib/api/f1ApiFetch.ts (the single seam every service + the two bypass paths funnel through). New fetchF1Api branch order: if isDbServingEnabled() && isServedFromDb(yearParsedFromPath) && domainIsDurable(path) -> tryFetchFromDb(source,path) which maps the canonical path to the matching RPC/view, returns a Response wrapping the assembled jsonb with X-Source:DB; on miss/error/null -> fall through to the EXISTING fetchViaProxy()/fetchDirect() chain untouched (mirror entityService null-on-error). VOLATILE domains (standings live, OpenF1 live/position/car_data) and year<window bypass DB and keep today's proxy path. Parse year from the path (it is in every path) so services need ZERO edits. Add a tiny path->RPC classifier (port resolveTtlSeconds path-matching). Also point the two BYPASS paths at fetchF1Api: useQualifyingToRaceDataByRound raw fetch + the two Embeddable* widgets — change them to call ergastFetch so they inherit DB-first.

DB-vs-PROXY FALLBACK POLICY (explicit): for year in [currentYear-3 .. +inf] AND durable domain: DB(view/RPC) -> f1-proxy(cache+stale) -> upstream(stale-on-error). For volatile domains: f1-proxy short-TTL (standings) or live passthrough (OpenF1 latest). For year < currentYear-3: straight to proxy/direct (live proxy = historical fallback). ANY DB error/miss silently falls through — a DB problem degrades to today's behavior, never a user-facing failure.

SAFE CUTOVER (additive, default-off, reversible by env flag): new flag VITE_DB_SERVING_ENABLED (default false), independent of VITE_F1_PROXY_ENABLED. Shipping the router with flag=false is a pure no-op. Phases: S0 add flag+isDbServingEnabled+isServedFromDb helpers (no behavior change). S1 apply schema migration locally + create views/RPCs. S2 run backfill to populate tables; verify coverage via f1_sync_state. S3 implement the router behind the flag (still off). S4 flip VITE_DB_SERVING_ENABLED=true in deploy env AFTER coverage confirmed; monitor api_metrics for proxy-call reduction. Rollback = flip flag false (no redeploy of logic). Keep entity views (f1_driver_profile/...) exactly as-is — they are the reference pattern.

## Delivery Plan
1. Phase 0 — Reconcile drift: `supabase db pull` against prod (read-only) to capture an authoritative baseline migration for the 3 prod-only objects (push_subscriptions, analysis_charts, drop_trivia) so repo<->remote match before adding any warehouse migration. Commit baseline; do NOT re-apply to prod.
2. Phase 1 — Canonical schema migration: author supabase/migrations/<ts>_f1_warehouse.sql (the full CREATE TABLE/INDEX/RLS + f1_sync_state + pg_cron/pg_net extensions). Apply to LOCAL stack only; verify with `supabase db reset` locally.
3. Phase 2 — Serving views + RPCs migration: author supabase/migrations/<ts>_f1_warehouse_views.sql (f1_v_* views + get_* RPCs reassembling Ergast/OpenF1 envelopes). Apply locally; unit-test that get_laps output deep-equals the live Ergast shape for a known race.
4. Phase 3 — Ergast ingesters: supabase/functions/f1-ingest + _shared/ingest/{schedule,results,qualifying,sprint,pitstops,laps,standings}.ts, each idempotent UPSERT + sync_state. Reuse proxyF1Request fetch layer. Test locally per domain on one (season,round).
5. Phase 4 — Entity expansion + backfill driver: scripts/backfill-entities.mjs (expand f1_driver/f1_constructor to 4 seasons) + scripts/backfill.mjs (window-driven, sync_state-resumable). Run full backfill 2022..2026 against LOCAL; verify coverage SELECT.
6. Phase 5 — OpenF1 crosswalk + resource ingesters: _shared/ingest/openf1_sessions.ts (deterministic session_key crosswalk first) then drivers/weather/starting_grid/overtakes/team_radio/position. Backfill 2023..2026 locally.
7. Phase 6 — FastF1 summaries: extend analysis/generate.py with emit_summaries() after session.load(); fix analysis_charts.drivers[]. Backfill summaries for window locally.
8. Phase 7 — Cron: extend/replace f1-cache-warm OR add f1-warehouse-sync; add pg_cron sync (6h) + post-session poller (15m, weekend-gated) via cron.schedule in a migration. Verify locally.
9. Phase 8 — Serving router (default-off): add VITE_DB_SERVING_ENABLED + isDbServingEnabled/isServedFromDb + tryFetchFromDb branch + path classifier in f1ApiFetch.ts; redirect the 2 bypass paths (useQualifyingToRaceDataByRound, Embeddable* widgets) to fetchF1Api. Ship with flag false (no-op).
10. Phase 9 — Cutover: after local coverage proven and user applies migrations/functions to prod, flip VITE_DB_SERVING_ENABLED=true in deploy env; monitor api_metrics proxy-call drop. Rollback = flip flag false. Each phase is its own PR per the push-each-phase workflow.
