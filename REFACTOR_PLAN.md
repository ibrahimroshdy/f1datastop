# F1DataStop — Migration, Cleanup & Refactor Plan

> Status: **IN PROGRESS** — Phases 0–6 done; Phase 7 next
> Decisions locked (2026-06-20):
> 1. **Approach:** Refactor in place (keep repo + git history)
> 2. **Structure:** Monorepo `web/` + `supabase/` (match fifa-league)
> 3. **Integrations:** Keep GA4 / Clarity / AdSense / Slack — but **env-gate everything**, nothing hardcoded
> 4. **Data layer:** Supabase **edge-function proxy + cache table** (TTL) in front of Ergast/OpenF1
>
> Target architecture reference: `../fifa-league` (clean sibling).
> Prediction-sheet feature is **100% PARKED** — last phase only, do not start.

---

## Guiding principles (from fifa-league)

- Strict TypeScript. No `any`. Hand-written DB types in `integrations/supabase/database.ts` + generated types.
- Domain-grouped folders, not type-grouped. Thin pages (~80–150 LOC) that compose hooks + components.
- One hook per data domain; hierarchical React Query keys; mutations beside their queries.
- Business/calculation logic lives in `lib/`, never in components.
- UI primitives in `ui/` never import domain types.
- File-size discipline: primitives 50–100 LOC, feature components 100–300, split anything >300.

---

## Phase 0 — Safety & secrets (DO FIRST, blocking) — ✅ CODE DONE (commit 15b0858, branch phase0-secrets-safety)

> Remaining = manual/dashboard actions only: rotate reCAPTCHA secret + redeploy edge fns,
> optional anon-key rotation, ~~flip notify-slack verify_jwt~~ ✅ (config + deploy v133),
> `supabase db pull` to sync migration history. (See supabase/migrations/README.md.)


Nothing else ships until this is clean. These are the items that make the repo unsafe and the deploy non-reproducible.

0.1 **Rotate the exposed Supabase anon key.** The current key is committed in `.env` AND hardcoded in `src/integrations/supabase/client.ts`. It is in git history. Rotate in Supabase dashboard, then only ever read from `import.meta.env`.

0.2 **Stop tracking secrets.** Add `.env`, `.env.local`, `.env.*.local` to `.gitignore`. `git rm --cached .env`. Keep only `.env.example`.

0.3 **Remove hardcoded credentials from source.** `client.ts` must use `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` with a placeholder fallback + console warning (fifa-league pattern). Move GA4 id (`index.html:57`), reCAPTCHA site key (`apiConfig.ts`), AdSense publisher id out of source into env.

0.4 **Reconcile Supabase migration drift.** Repo has 3 migration files; remote tracks only `20260510121724`. Pull the true remote schema (`supabase db pull`), commit a clean baseline migration so repo == remote. Decide which of the 3 local files are real.

0.5 **Recover `captcha-verify` source.** It is deployed live on Supabase (`verify_jwt: true`) but its source is **missing from the repo**. Pull it into `supabase/functions/captcha-verify/` so it is version-controlled. (Local code calls it — it is not dead.)

0.6 **Secure `notify-slack`.** ✅ `verify_jwt: true` in `config.toml` + deployed (v133). Function verifies caller JWT via `auth.getUser()` (no more `admin.listUsers`). Client invokes only when session exists. Residual privacy note: payload still includes email/name for Slack ops visibility.

0.7 **Supabase advisor fixes:** set `search_path` on `handle_new_user` + `update_updated_at_column`; review `handle_new_user` SECURITY DEFINER anon EXECUTE grant; enable leaked-password protection; shorten OTP expiry; schedule Postgres patch upgrade.

0.8 **Add `LICENSE`** (missing). Fix broken README image reference.

**Exit criteria:** no secret in repo or history-going-forward, repo schema == remote, all live edge functions have source in repo, app still builds.

---

## Phase 1 — Repo restructure to monorepo — ✅ DONE (branch phase1-monorepo)

> App moved into `web/` (history preserved via git mv). Root delegating package.json,
> `vercel.json` → `web/vercel.json`. lovable-tagger removed (100% off Lovable).
> Vercel Analytics + Speed Insights mounted in `web/src/main.tsx`.
> **Vercel dashboard action required:** set project Root Directory to `web` (see Phase 9 notes).


Move the app under `web/`, keep `supabase/` at root, matching fifa-league.

```
f1datastop/
├── web/                 # the Vite React app (everything currently in src/, public/, index.html, vite/ts/eslint configs)
│   ├── src/
│   ├── public/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig*.json
│   └── package.json
├── supabase/            # migrations + functions (already exists)
├── scripts/             # seed / maintenance scripts (new, optional)
├── docs/
├── .env.example
├── package.json         # root workspace, delegates to web/
└── vercel.json          # point build at web/
```

1.1 Create `web/`, `git mv` app files in (preserves history).
1.2 Root `package.json` workspace scripts delegating to `web/` (fifa-league pattern).
1.3 Update `vercel.json` build/output to `web/`.
1.4 Update Vercel project root-directory setting at deploy time (Phase 9).

**Exit criteria:** `npm run dev` / `npm run build` work from root; Vercel preview builds green.

---

## Phase 2 — Dependency diet — ✅ DONE (PRs #8, #10 merged)

> 2a (merged): removed firebase + dom-to-image-more.
> 2b (merged): all charts → Recharts; Sankey → d3-sankey; removed @mui/material,
> @mui/x-charts, @mui/x-data-grid, @nivo/*, @emotion/*. Build + tsc clean;
> lap chart + pit-stop table screenshot-verified on live data.
> Remaining (optional, later): audit Three.js globe + Mapbox weight per-feature.


Cut bloat surfaced in audit (#15286). Each removal is its own small PR with a build check.

2.1 Remove `lovable-tagger` devDep + 2 lines in `vite.config.ts`. (100% Lovable removal — done.)
2.2 Remove **Firebase** entirely (`src/integrations/firebase/*`, deps) — config present, never imported.
2.3 **Pick ONE chart library.** Currently Recharts + MUI X-Charts + Nivo coexist. Recommend standardizing on one (Recharts is lightest + already most-used) and porting MUI/Nivo charts. Drop MUI X-Charts, MUI X-Data-Grid, Nivo Sankey → large bundle win.
2.4 Audit Three.js globe + Mapbox: keep only if the calendar globe is a kept feature; both are heavy. Decide per-feature.
2.5 Re-run bundle analysis; record before/after.

**Exit criteria:** one chart lib, no Firebase, no Lovable, measurable bundle reduction.

---

## Phase 3 — Canonical data-reference layer — ✅ COMPLETE

> 3.6 done: Drivers-page Ergast N+1 fixed — `getAllDriverResultsBySeason` + `useAllDriverResultsBySeason`.
> 3.3 done: shared `lib/api/throttledFetch.ts` retry/backoff.
> 3.4 done: per-API request queues (`ergastQueue` concurrency 1, `openF1Queue` concurrency 3).
> 3.1–3.2 done: `web/src/lib/f1/types.ts` + `adapters.ts`; wired into `useF1Metadata`, `DriverCard`; `mapOpenF1DriverToErgast` re-exported from `apiAdapters.ts`.
> 3.5 done: hierarchical React Query keys in `lib/f1/queryKeys.ts`; wired into F1/OpenF1/metadata/telemetry hooks.

3.1 Create `web/src/lib/f1/` with **canonical types** — `F1Driver`, `F1Team`, `F1Race`, `F1Session` — each carrying both `ergastId` and `openF1Number`/keys. ✅
3.2 Single `adapters.ts`: `normalizeErgastDriver`, `normalizeOpenF1Driver`, `mergeDriver`. Consolidated mappings from `useF1Metadata.ts` inline + `DriverCard.tsx` inline; driver mapping moved from `apiAdapters.ts`. ✅
3.3 **One shared retry/fetch util** (`lib/api/throttledFetch.ts`) — kill the 3 copy-pasted retry blocks in `useF1Data`, `useOpenF1Data`, `openF1Service`. ✅
3.4 **Request queue** per service (`p-queue` style: Ergast concurrency 1, OpenF1 3) to stop bursts at the source. ✅
3.5 **React Query key convention** doc + helper — hierarchical keys (`f1Keys`, `openF1Keys`, `metadataKeys`, `telemetryKeys`). ✅
3.6 **Batch driver metadata**: one `useBatchDriverMetadata(year)` consumed by all cards. Kills the 44–66-call N+1 on the Drivers page → ~2 calls. ✅ (via batch season results + OpenF1 batch)

**Exit criteria:** Drivers page makes ≤3 API calls; zero duplicated adapter/retry code; all fetches go through the queue. ✅

---

## Phase 4 — Supabase edge-function cache proxy + cache table — ✅ COMPLETE (deploy pending)

> Migration + edge functions committed. Apply migration and deploy functions to Supabase:
> `supabase db push` && `supabase functions deploy f1-proxy f1-cache-warm`
> Then set `VITE_F1_PROXY_ENABLED=true` in Vercel production env.

4.1 Migration: `api_cache` table — `cache_key text pk`, `data jsonb`, `source text`, `expires_at timestamptz`, `created_at`. RLS: read public, write service-role only. Index on `expires_at`. ✅
4.2 Edge function `f1-proxy`: `{source, path, params}` → cache hit or upstream fetch + upsert. Per-source TTLs. ✅
4.3 `web/src/lib/api/f1ApiFetch.ts` — services use proxy when `VITE_F1_PROXY_ENABLED=true`; Vercel rewrites remain fallback. ✅
4.4 Optional `f1-cache-warm` edge function — purge expired + pre-warm standings/schedule. ✅
4.5 `api_metrics` table — cache hit/miss + 429 logging from f1-proxy. ✅

**Exit criteria:** repeated loads served from cache; upstream call volume drops sharply; no client 429s under normal use. (Verify after deploy + enable proxy.)

---

## Phase 5 — Design-pattern refactor (the big one) — ✅ DONE

Apply fifa-league component discipline. Each god file is its own PR.

5.1 **`RaceDetailDialog.tsx`** ✅ — ~208 LOC composer + `race-detail/` modules.
5.2 **`RaceCalendar.tsx`** ✅ — `useRaceCalendar`, `raceCalendarUtils`, `RaceCalendarListView`, `RaceCalendarGridView`, `RaceCalendarGlobeView`; page ~217 LOC.
5.3 **`useF1Data.ts`** ✅ — split into `hooks/f1/*` (standings, schedule, sessions, lap times, pit stops, drivers, misc, qualifying-to-race); barrel re-export preserved.
5.4 **`DriverCard.tsx`** ✅ — `DriverImage`, `DriverStatsPanel`, `DriverPositionChart`, `useDriverCard`; batch season results from `useAllDriverResultsBySeason`.
5.5 **`CombinedStandingsCard.tsx`** ✅ — `standings/` folder: `DriverStandingsCard`, `ConstructorStandingsCard`, `CombinedStandingsTab`, `standingsUtils`.
5.6 **`DriverStandingsTable`** ✅ — unified in `standings/DriverStandingsTable.tsx`; removed duplicate dead files in `dashboard/` and `drivers/`.
5.7 **`useThemeVariant()`** ✅ — `hooks/useThemeVariant.ts`; wired in calendar, standings, driver card, RaceAnalysis, RaceInfoPage.
5.8 **`F1ChartContainer` + `SessionSelector`** ✅ — in `components/f1/`; wired into RaceAnalysis + RaceInfoPage.
5.9 **Calc logic in `lib/f1/`** ✅ — `sankey.ts`, `positionChanges.ts`, `overtakes.ts` (+ lap-time re-exports).

**Exit criteria:** god files split; pages are thin composers; duplicated standings table removed. Chart/page files >300 LOC remain (charts/data justified).

---

## Phase 6 — Strict TypeScript + dead-code removal — ✅ DONE

6.1 ✅ `tsconfig.app.json` → `strict: true`, `noUnusedLocals/Parameters: true`, `noImplicitAny: true`, `noFallthroughCasesInSwitch: true`. ESLint `@typescript-eslint/no-explicit-any: warn`, `@typescript-eslint/no-unused-vars: warn` (argsIgnorePattern `^_`).
6.2 ✅ `tsc -p tsconfig.app.json --noEmit` and `npm run build` pass under strict mode. Remaining `any` count in `web/src`: **360** (eslint warn-only; incremental burn-down deferred).
6.3 ✅ **Deleted dead code:** `SessionContext`, `App.css`, legacy pages (`Analytics.tsx`, `RaceInfoPage.tsx`, `LiveRace.tsx`, `LiveRaceInfo.tsx`) — routes use `<Navigate>` redirects. Firebase config was already removed in Phase 2.
6.4 ✅ Removed entire `web/src/components/glass/` folder; `HeaderSection` sprint badge uses shadcn `Badge`. Removed `SessionProvider` from `App.tsx`.

**Notes:** Strict TS fixes focused on unused imports/locals from deletions, null checks, and implicit-any in touched files. Full `any` elimination is a follow-up (Phase 6.2 incremental or later).

---

## Phase 7 — Env-gate integrations

Keep all four, but every key is an env var; integration is a no-op when its key is unset (fifa-league pattern).

7.1 GA4 measurement id, Clarity project id, AdSense client/slot ids, Mapbox token → all `VITE_*` env, disabled if absent.
7.2 Slack webhook → edge-function env only; no-op without it (Phase 0.6).
7.3 Complete `.env.example` documenting every var (frontend `VITE_*` + edge-function secrets), grouped like fifa-league.

**Exit criteria:** clone + `.env` from example + `npm run dev` works; no integration hardcoded.

---

## Phase 8 — Tests, CI, OSS hygiene

8.1 Vitest setup (currently 0 tests). Cover: `lib/f1` adapters, scoring/calc utils, cache TTL logic, the request queue.
8.2 GitHub Actions: typecheck + lint + test + build on PR.
8.3 README rewrite for standalone (remove Lovable hosting mention, fix image), `CONTRIBUTING.md`, `LICENSE` (Phase 0.8).

**Exit criteria:** CI green on PR; core data layer covered.

---

## Phase 9 — Vercel migration / deploy

9.1 Vercel project root-directory → `web/`; set all env vars in Vercel (Preview + Production).
9.2 Verify rewrites + edge-function proxy in production; confirm cache table populates.
9.3 Point custom domain; smoke-test; decommission Lovable hosting.

**Exit criteria:** production runs on Vercel + Supabase, no Lovable dependency anywhere.

---

## Phase 10 — PARKED: per-season prediction sheet

**Do not start until Phases 0–9 are done and deployed.** Reference fifa-league: `pages/PredictSheet.tsx`, `components/predict/PredictionSheet.tsx`, `hooks/useEntry.ts`, granular sub-resource tables (`entry_group_ranks`, `entry_match_picks`, `entry_awards`) that invalidate together. F1 analog: per-season grid predictions (race winners / podiums / champion) on a lockable sheet, scored after each race.

---

## Sequencing notes

- Phases 0 → 1 → 2 are mechanical and low-risk; do them first and fast.
- Phase 3 (data layer) unblocks 4 and 5 — it is the spine of the refactor.
- Phase 5 is the largest; one god-file per PR, app stays working throughout.
- Each phase = its own branch/PR with a green build. No big-bang merge.
