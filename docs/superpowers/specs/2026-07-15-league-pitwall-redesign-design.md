# The F1 DataStop League — "Pit Wall" premium redesign

Status: approved direction (2026-07-15). North-star spec for a 5-phase build.
Feature is already mechanically complete (13 tables, 28 RPCs, grader, cron, push,
badges, joker, H2H). This is **surfacing + identity + polish + the few missing
tables** — NOT new game mechanics.

## Locked decisions
- **Scope:** full sweep, phased. Each phase ships + is shown live before the next.
- **Identity:** **Pit Wall** sub-brand — the player is the strategist on the wall.
- **Logged-out:** full marketing landing (real growth surface).
- **Standing constraints:** stays on Telemetry-Terminal color tokens (one app);
  no mechanics/scoring changes; prod DB writes are careful + confirmed.

## Diagnosis (why it feels "poor/distant")
1. **Discovery = zero when logged out.** `navigation.ts` flags the entry
   `requiresAuth`; `Sidebar.tsx` hides it from guests; BottomNav has no game tab;
   `/game` logged-out shows a generic "Login Required" wall. All game data is
   auth-only (real F1 standings/schedule ARE public — usable on a landing).
2. **No announcements surface.** `admin_broadcast` fires push + writes an
   admin-only audit row. No durable announcements table, no in-app feed.
3. **Admin is a form-dump.** Raw JSON `<textarea>` scoring, native checkboxes,
   hand-rolled tabs, bare broadcast inputs, capped `max-w-2xl`.
4. **Leagues feel distant.** Zero league identity (no crest/accent/banner at the
   data layer). Avatars are fetched (`avatar_url`) then thrown away. No activity
   feed. Cramped `max-w-2xl` vs the hub's full width.

Already premium (preserve): GameHub, Champions, PredictRound/DriverPicker. Color
hygiene is 100% tokens. `F1Avatar / TeamLogo / CountryFlag / SCOPE_GLOW` exist but
go unused in the game — adopt them.

## Pit Wall design language (on top of Terminal tokens)
Shared primitives (new, in `web/src/features/game/components/pitwall/`):
- **`<StartLights>`** — 5-red-light strip that fills toward a deadline; "LIGHTS
  OUT" at zero. The countdown motif everywhere a deadline matters.
- **`<TimingTower>`** — the leaderboard grammar: monospace `P1..Pn`, team-colour
  left edge, points/gap column, `▲▼` movement, avatar, "YOU" row accent.
- **`<PitBoard>`** — hung pit-board rank badge (yellow/white on carbon slat) for
  P1/P2/P3 + your rank.
- **`<TeamRadio>`** — announcement card styled as race-control / team-radio
  comms: tag ("RACE CONTROL"/"TEAM RADIO"), mono body, timestamp, radio icon.
- **Atmosphere:** subtle carbon weave, hairline scanlines, start-light red/amber
  urgency accents, brake-glow on hover. Motion: light sequence, ticking timers,
  rank-row slide on movement.
- **Type:** Geist Mono for all timing/positions/gaps; Clash Display for big
  moments (LIGHTS OUT, champion names).
- **Vocabulary (labels, not route changes):** nav label **"League"** (Trophy);
  hub = *Paddock*, standings = *Timing Tower*, announcements = *Race Control*,
  admin = *Pit Wall*, predict = *The Grid*.

## New data-layer objects (the gaps)
1. **`game_announcement`** — `id, season null, title, body, url, kind
   (radio|control|news), audience (all|players), pinned, published_at,
   created_by, created_at`. RLS: read anon+auth; write admin. RPCs:
   `get_announcements(limit)` (anon), `admin_post_announcement(...)`,
   `admin_delete_announcement(id)`. Extend `admin_broadcast` to also insert a row
   so push + in-app feed are one action.
2. **`game_league` identity columns** — `crest` (emoji/seed), `accent` (hex),
   `banner_url` null, `description`. Extend `update_league` /
   `update_league_identity`. Deterministic crest fallback client-side.
3. **`game_league_event`** — `id, league_id, season, kind
   (join|leave|lead_change|reveal|round_result|goat|flop), actor_user,
   subject_user, round, detail jsonb, created_at`. Populate from join/leave RPCs
   + grader/snapshot refresh. RPC `get_league_activity(league, limit)`. RLS:
   members read (`can_view_league`).
4. **`get_public_league_preview(season, limit)`** — SECURITY DEFINER, granted
   `anon`; privacy-safe global-league top-N (username, avatar, points, rank) for
   the landing.
5. **(Phase 5) `game_notification`** inbox — `user_id, kind, title, body, url,
   created_at, read_at` + list/mark-read RPCs; fan-out from push tick + announcements.

## Phases
### Phase 1 — Discovery, Landing & Announcements
- Nav: League visible **always** (drop `requiresAuth`); relabel "League" (Trophy);
  add a mobile BottomNav tab. Guests → landing; users → hub.
- Public landing (`/game` logged-out, or `/league`): Pit Wall hero + `StartLights`
  next-race countdown + **live global leaderboard preview** (new anon RPC, real
  data) + how-it-works (3 steps) + champions/prizes teaser + Join CTA. Replaces
  the generic AuthBlur wall for the game route.
- Announcements: `game_announcement` table + RPCs; extend `admin_broadcast` to
  persist; `TeamRadio` feed on the hub (top) + a strip on the landing; admin
  composer promoted to its own "Race Control" tab.
- Build the Pit Wall primitives (`StartLights`, `TimingTower`, `PitBoard`,
  `TeamRadio`).
- **Accept:** logged-out user sees League in nav → lands on a real page with live
  data → can Join; admin posts an announcement → shows in-app on hub + landing +
  fires push.

### Phase 2 — Leagues as Arenas
- Identity columns + crest/accent/banner/description; identity editor in Manage;
  deterministic crest fallback.
- Render avatars everywhere (podium, standings, members, reveal) via `F1Avatar`.
- `game_league_event` + activity feed on LeagueDetail + hub activity strip.
- Full-width (drop `max-w-2xl` → `pageShell`), `TimingTower` standings, `PitBoard`
  badges, premium empty states.
- **Accept:** leagues visually distinct (crest/accent), faces everywhere, live
  activity, full-width.

### Phase 3 — The Grid (predict loop craft)
- PredictRound as "The Grid": grid-slot layout, `StartLights` deadline, driver
  headshots, sticky save bar, podium preview. Joker → card picker (kill dropdown).
- Champions → tactile WDC/WCC card pickers (driver/team colour+logo+flag).
- Scope-glow on RankChart/FormSparkline.
- **Accept:** core loop feels tactile + Pit Wall themed; no dropdowns for marquee
  mechanics.

### Phase 4 — Admin Cockpit (the Pit Wall)
- Operator console: health monitors, Race Control (announcements composer,
  pin/schedule), Strategy (season + **structured** scoring editor, not raw JSON),
  Timing (players/leagues mgmt w/ search+sort+actions), Audit timeline. Shared
  Tabs/Segmented/Switch primitives, full-width.
- **Accept:** admin feels like a cockpit; structured scoring; announcements first-class.

### Phase 5 — Craft & Next-Level
- Motion/celebration (light sequence, rank-up slide, reveal moment); notifications
  inbox; **shareable "my picks / my result" cards reusing the poster pipeline**.
- **Accept:** shareable cards, celebration moments, inbox.

## Verification note
Local dev Supabase (`web/.env.local`) is stale/local — warehouse-backed game
features only render against prod. To verify live: temporarily point `.env.local`
at prod (URL + publishable key from `.env`), restart vite, check, then restore.
