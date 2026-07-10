# F1 DataStop — Season Prediction Game — Design Spec

**Date:** 2026-07-10
**Status:** Approved design, pre-implementation
**Author:** brainstorming session (studied `../fifa-league` as the reference implementation)

---

## 1. Overview

A season-long, race-to-race F1 prediction game built into f1datastop. Logged-in users
opt into "the F1 League", predict ordered top-10s each race weekend, and are graded
automatically from results already ingested by the Modal pipeline. Users compete in
persistent public/private leagues. Two season-long picks (WDC + Constructors champion)
award bonus points. Everything is modeled on `../fifa-league`'s proven schema and flows,
tailored to F1.

**The one structural difference from fifa-league:** fifa-league is single-tournament.
This game is **multi-season**. Leagues **persist across seasons** (a group created in 2026
carries into 2027, 2028…), but **each season has its own points, its own leaderboard, and
its own scoring rules**. Standings are always viewed per-season.

### Non-negotiables (from the user)
- Predict qualifying top-10 and race top-10 each weekend; sprint top-8 on sprint weekends.
- WDC + Constructors champion picks for season-long bonus.
- Leagues: public + private, join/leave/create/browse, invite codes, rolling automatically each race.
- Per-season scoring isolation — 2026 league, then 2027, each with its own points.
- Full admin page, **only `admin@f1datastop.com`** has access.
- Users must **activate** ("Join the F1 League") to become players — opt-in, not automatic.
- Users can customize their profile.
- Login required.

---

## 2. Core mechanics (decided)

| Decision | Choice |
|---|---|
| Scoring | **Real F1-points mirror** (see §4) |
| Pick lock | **One weekend deadline** = start of the weekend's first competitive session |
| Champions (WDC/WCC) | **Editable until a per-season lock round** (default ~summer break), then frozen; scored at season end |
| Sprints | **Included** — sprint top-8 prediction on sprint weekends |
| Leagues | **Persist across seasons**, points per-season |
| Activation | **Opt-in** "Join the F1 League" |
| All-time view | Secondary tab summing across seasons (primary is per-season) |

### 2.1 What a user predicts, per round
- **Qualifying** — ordered top-10 (positions 1..10)
- **Race** — ordered top-10 (positions 1..10)
- **Sprint** — ordered top-8 (positions 1..8), sprint weekends only
- **Season-long** — one WDC driver + one Constructors champion

### 2.2 Lock timing — "one weekend deadline"
All of a round's picks (Q, R, and S if present) lock at the **start of that weekend's first
competitive session**:
- Normal weekend → **Qualifying (Q)** start
- Sprint weekend → **Sprint Qualifying (SQ)** start (must be before the sprint runs)

Formally: `weekend_deadline(season, round) = min(f1_session.date_start)` over
`session_type IN ('SQ','S','Q','R')` for that (season, round).

Champion picks lock at `weekend_deadline(season, champion_lock_round)` where
`champion_lock_round` is configured per season (admin).

A global emergency lock (`game_season.globally_locked`) freezes all editing regardless of deadline.

---

## 3. When points are calculated

Grading is **automatic, per session**, as soon as that session's results are final in the DB.

| Pick | Graded when | Source |
|---|---|---|
| Qualifying top-10 | Q session done + results present | `f1_qualifying_result` |
| Sprint top-8 | Sprint done + results present | `f1_sprint_result` |
| Race top-10 | Race done + results present | `f1_race_result` |
| WDC + WCC | Season end (final round standings final) | `f1_driver_standing` / `f1_constructor_standing` |

"Session done + results present" = the session's result rows exist AND
`f1_session.date_end < now()` for that session_type.

**Trigger mechanism (idempotent, belt-and-suspenders):**
1. **Modal post-ingest hook** — after Modal writes a session's results, it calls
   `recalc_game_scores(p_season, p_round)` → points appear seconds after results land.
2. **pg_cron safety net** — every ~15 min, weekend-gated, re-runs the same grader.
3. **Admin "Regrade" button** — force a full recalc for a season.

Because results already live in the same Postgres DB, **grading is pure set-based SQL** —
no external fetch, no edge function needed (a key simplification vs fifa-league).

---

## 4. Scoring (Real F1-points mirror)

All values live in `game_season.scoring_rules` (JSONB) and are **editable per season by admin**.

### Default `scoring_rules`
```json
{
  "version": 1,
  "points": {
    "Q": [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
    "R": [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
    "S": [8, 7, 6, 5, 4, 3, 2, 1]
  },
  "half_factor": 0.5,
  "champion": { "wdc": 25, "wcc": 25 }
}
```
- Prediction depth per session = length of its `points` array (Q/R = 10, S = 8).

### Per-session grading
For each predicted slot `P` (1-indexed) holding driver `D`, let `actual = D`'s finishing
position in that session (from the result table; NULL if DNF/DNS/absent):
- `actual == P` → **full** `points[P-1]`
- `actual` within `1..len(points)` (in the top-N but wrong slot) → **`half_factor × points[P-1]`**
- otherwise → **0**

Session score = sum over slots. Round score = sum of its session scores. Points may be
fractional (half credit); totals stored as `numeric`.

### Champion bonus (season end)
- WDC pick correct (matches final `f1_driver_standing` P1 for the season) → `champion.wdc`
- WCC pick correct (matches final `f1_constructor_standing` P1) → `champion.wcc`

### "Exact hits" (for tiebreaks)
Count of predicted slots across all sessions where `actual == P`. Stored per entry.

---

## 5. Data model

All new tables are prefixed `game_`. RLS on every table. Admin bypass via `is_game_admin()`.
Scoring-output tables are written only by the grader (service role / SECURITY DEFINER).

### 5.1 Config & season
**`game_season`** — one row per F1 year the game runs (isolates scoring per season)
| col | type | notes |
|---|---|---|
| season | int PK | FK `f1_season(year)` |
| name | text | e.g. "2026 F1 League" |
| status | text | `upcoming` \| `active` \| `complete` |
| scoring_rules | jsonb | see §4; per-season editable |
| champion_lock_round | int | round after which WDC/WCC freeze |
| globally_locked | bool | emergency lock |
| created_at, updated_at | timestamptz | |

RLS: SELECT anyone authenticated; write admin only.

### 5.2 Player entry & picks
**`game_entry`** — one per (user, season). Existence = "activated for that season".
| col | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | FK auth.users |
| season | int | FK game_season |
| created_at, updated_at | timestamptz | |
| **unique** | (user_id, season) | |

**`game_race_pick`** — the ordered slots for one session of one round
| col | type | notes |
|---|---|---|
| entry_id | uuid | FK game_entry |
| round | int | |
| session_type | text | `Q` \| `R` \| `S` |
| position | smallint | 1..10 (or 1..8 for S) |
| driver_id | text | FK `f1_driver(ergast_id)` |
| **PK** | (entry_id, round, session_type, position) | |

**`game_champion_pick`** — season-long picks
| col | type | notes |
|---|---|---|
| entry_id | uuid PK | FK game_entry |
| wdc_driver_id | text | FK f1_driver |
| wcc_constructor_id | text | FK f1_constructor |
| updated_at | timestamptz | |

RLS on picks: owner reads/writes own **only while editable** (`game_pick_is_editable`);
readable by others once revealed (see §7); admin all.

### 5.3 Scoring outputs (grader-written only)
**`game_pick_score`** — (entry_id, round, session_type) → `points numeric`, `exact_hits int`, `breakdown jsonb`, `scored_at`
**`game_bonus_score`** — (id, entry_id, season, reason `wdc`|`wcc`, points numeric, scored_at)
**`game_entry_total`** — (entry_id PK, season, total_points numeric, exact_hits int, champions_correct int, last_scored_at)

RLS: SELECT own | revealed | admin; INSERT/UPDATE service role only.

### 5.4 Leagues (persistent, season-agnostic)
**`game_league`**
| col | type | notes |
|---|---|---|
| id | uuid PK | |
| name | text | |
| slug | text | unique; `global` reserved |
| invite_code | text unique | private join link |
| is_public | bool | discoverable |
| max_members | int null | |
| pick_reveal_policy | text | `after_lock` \| `never` (public leagues force `never`) |
| created_by | uuid | FK auth.users |
| created_at, invite_code_rotated_at | timestamptz | |

**`game_league_member`** — (league_id, user_id, role `member`|`captain`, joined_at); PK (league_id, user_id).
**`game_league_join_attempt`** — (id, user_id, attempted_at) for join rate-limiting (10/15min).

### 5.5 Standings history & awards (per season)
**`game_rank_snapshot`** — (id, league_id, season, user_id, round, rank, total_points, captured_at) — bump chart.
**`game_race_award`** — (league_id, season, round, user_id, points, is_goat, is_flop); PK (league_id, season, round, user_id) — per-race GOAT/flop (min ≥2 active members, spread > 0).

### 5.6 Profile (extend existing `profiles`)
Add columns: `avatar_url text`, `bio text`, `favorite_driver_id text` (FK f1_driver), `favorite_constructor_id text` (FK f1_constructor), `country text`. Keep existing `username/first_name/last_name`. RLS unchanged (own row write; add a limited public-read of display fields for member reveals via an RPC or a `game_public_profile` view).

### 5.7 Admin
**`game_audit_log`** — (id, actor uuid, action text, detail jsonb, created_at). Admin-written.

---

## 6. SQL functions / RPCs

- `is_game_admin()` → `(auth.jwt() ->> 'email') = 'admin@f1datastop.com'`. Used in RLS + audit.
- `weekend_deadline(p_season, p_round)` → timestamptz (min competitive `date_start`).
- `game_pick_is_editable(p_entry_id, p_round)` → bool (`now() < weekend_deadline` AND not `globally_locked`).
- `game_champion_is_editable(p_entry_id)` → bool (`now() < weekend_deadline(season, champion_lock_round)`).
- `activate_player(p_season)` → creates `game_entry` + joins global league; idempotent. This is the "Join the F1 League" action.
- `open_season(p_season)` (admin) → creates `game_season`, global league membership carry-forward: auto-creates entries for all existing league members.
- `create_league(name, is_public)` / `join_public_league(id)` / `join_league_by_code(code)` / `leave_league(id)` / `remove_league_member(id, user)` / `rotate_invite_code(id)` / `set_league_reveal_policy(...)` — league lifecycle (mirror fifa RPCs, rate-limited).
- `get_league_standings(p_league_id, p_season, limit, offset)` → ranked rows with tiebreak cascade + `me` row.
- `get_league_invite_preview(code)` → name + member count (no auth).
- `list_public_leagues(p_season)` → discoverable leagues + counts.
- **`recalc_game_scores(p_season, p_round default null)`** (SECURITY DEFINER) — the grader:
  1. For each activated entry + each finished session in scope, compute `game_pick_score` (set-based) from `f1_*_result`.
  2. Season-end: compute `game_bonus_score` (WDC/WCC) from final standings.
  3. Recompute `game_entry_total` (sum scores + bonuses, exact_hits, champions_correct).
  4. Snapshot ranks per league (`game_rank_snapshot`, de-duped per round).
  5. Refresh `game_race_award` (GOAT/flop per league/round).
  6. Stamp `last_scored_at`.
  Idempotent; safe to re-run; cleans orphaned scores.

---

## 7. Standings, tiebreakers, reveal

**Per-season leaderboard** = league members × that season's `game_entry_total`.
**Tiebreak cascade:** `total_points DESC → exact_hits DESC → champions_correct DESC →
race-GOAT count DESC → user_id ASC` (stable).

**Rank history:** `game_rank_snapshot` per round → bump/Sankey chart (reuse existing chart primitives).
**Per-race GOAT/flop:** highest/lowest scorer among ≥2 active members that round (customizable labels optional, default "GOAT"/"Flop").
**Pick reveal:** after `weekend_deadline` passes, private-league members can view each others'
picks if `pick_reveal_policy = after_lock`; public leagues never reveal.

---

## 8. Season lifecycle

- `upcoming` → `active` (first weekend opens) → `complete` (season end, champions scored).
- **Rollover:** admin `open_season(next_year)` creates the new `game_season` and auto-creates
  entries for every existing league member (they carry into the new season automatically);
  brand-new users still do the one-time "Join the F1 League" activation.
- Standings/history/awards are all keyed by season → switching season in the UI shows that
  season's competition. Optional **all-time** tab sums `game_entry_total` across seasons per league.

---

## 9. Admin page (`admin@f1datastop.com` only)

Gated by `is_game_admin()` (RLS) + frontend `user.email` check. Sub-pages:
- **Overview** — cards: total players, activated-this-season, leagues (public/private split),
  predictions made, this-round completion %, active season + status.
- **Players** — roster, per-player completion %, points, last active.
- **Leagues** — all leagues, filter public/private, member counts, view/edit/delete.
- **Logs** — audit trail + user activity.
- **User inspector** — one user's leagues + points history.
- **Settings** — season create/config, **live scoring-rules editor**, global lock, manual
  regrade, result override (correct wrong F1 data), champion-lock round.

---

## 10. Frontend

Routes (all behind login via `ProtectedRoute`):
- `/game` — hub: activation CTA if not activated; else next-race countdown, your pick status, quick standings.
- `/game/predict/:round` — pick editor (Q/R/S top-N), lock state + countdown.
- `/game/champions` — WDC/WCC picks.
- `/game/leagues` — my leagues + create.
- `/game/leagues/browse` — discover public leagues.
- `/game/leagues/:id` — standings (season selector + all-time tab), stats, rank chart, GOAT/flop.
- `/game/leagues/:id/manage` — captain tools (invite, members, rename, visibility, kick).
- `/game/leagues/:id/round/:round` — reveal members' picks for a round (post-lock).
- `/game/history` — your per-round points breakdown.
- `/game/rules` — scoring explainer.
- `/game/profile` (or extend `/profile`) — profile customization + your game stats.
- `/join/:code` — invite handler.
- `/admin` (+ sub-routes) — admin dashboard.

Nav: add **"Predictions"** (Trophy icon) to the EXPLORE nav group; admin link shown only to admin.
Reuse: `F1Card`, `ViewSwitcher`, `BackLink`, `instrument-label`, team-colored driver combobox,
`ProtectedRoute`, mobile patterns (`web/docs/MOBILE_PATTERNS.md`). Driver/constructor pickers use
team colors + 3-letter codes.

---

## 11. Auth

Reuse existing f1datastop auth (email/password + X OAuth, `AuthContext`, `profiles` + `handle_new_user`
trigger, `ProtectedRoute`). Game requires login; "Join the F1 League" is the in-game activation on top of auth.
Admin = email match on `admin@f1datastop.com`.

---

## 12. Delivery phases

1. **Foundation** — all `game_*` tables + RLS + `is_game_admin` + `game_season` config +
   `activate_player`/`open_season` + profile columns + nav/route scaffolding + activation screen.
2. **Predict + grade** — pick editor (Q/R/S), lock logic (`game_pick_is_editable`),
   `recalc_game_scores` grader + pg_cron + Modal hook, history page, rules page.
3. **Leagues** — create/join public+private, invite codes, standings + tiebreakers +
   rank chart + GOAT/flop, pick reveal, browse.
4. **Champions + admin + profile** — WDC/WCC picks + season-end bonus, full admin dashboard,
   profile customization, season rollover, all-time tab.

---

## 13. Open items / defaults chosen
- Sprint on a "one weekend deadline" → deadline = first competitive session (SQ on sprint weekends).
  Main-race pick therefore commits Friday on sprint weekends. (Accepted.)
- Half-credit produces fractional points; totals are `numeric`. (Accepted.)
- Public leagues never reveal picks; private default `after_lock`. (Mirrors fifa.)
- All-time tab included as secondary. (Accepted.)
- `champion_lock_round` default set per season by admin (suggest ~mid-season/summer break).
