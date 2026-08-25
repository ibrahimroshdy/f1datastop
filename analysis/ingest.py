#!/usr/bin/env python3
"""FastF1-only warehouse ingester (Phase 1). 2018+ only.

Single source of truth: FastF1. No Ergast, no OpenF1. For a round it loads each
real session once and writes every domain from that session object:

  schedule/sessions/circuit   f1_race, f1_session, f1_circuit   (get_event_schedule)
  drivers / constructors      f1_driver, f1_constructor         (session.results)
  race / quali / sprint       f1_race_result / f1_qualifying_result / f1_sprint_result
  laps                        f1_lap  (per session_type)
  pit stops                   f1_pit_stop
  weather / overtakes / rc    via ff1_ingest
  standings (computed)        f1_driver_standing, f1_constructor_standing

  python ingest.py --season 2024 --round 1
  python ingest.py --season 2024                 # whole season
  python ingest.py --season 2024 --round 1 --no-upload
"""
import argparse
import os

import backfill as bf   # supa_upsert, supa_select, _env, to_int, _fmt_laptime, race_id_for
import f1_proxy  # noqa: F401 — repoints livetiming at the proxy when configured
import ff1_ingest as enrich

# FastF1 schedule session-name -> canonical code (fixes the dup/naming bug)
SESSION_CODE = {
    "Practice 1": "FP1", "Practice 2": "FP2", "Practice 3": "FP3",
    "Qualifying": "Q", "Sprint Qualifying": "SQ", "Sprint Shootout": "SQ",
    "Sprint": "S", "Race": "R",
}
# Sessions we ingest structured data for (FP handled on-demand by generate.py)
TIMED = {"Q", "S", "SQ", "R"}
FORCE = False  # re-ingest rounds even if already complete


def _cache():
    import fastf1
    cache = os.environ.get("FASTF1_CACHE", ".fastf1cache")
    os.makedirs(cache, exist_ok=True)
    fastf1.Cache.enable_cache(cache)


def _purge_season(table, season):
    """Delete a season's stale NON-FastF1 rows before rewriting the clean set.

    Only legacy (Ergast/OpenF1) rows are removed — current FastF1 rows are left
    intact so that a later upsert failure can never empty the season. The DELETE
    response is checked so a failed purge surfaces instead of silently passing."""
    if bf.DRY_RUN:
        return
    import requests
    url, key = bf._env()
    r = requests.delete(
        f"{url}/rest/v1/{table}",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        params={"season": f"eq.{season}", "source": "neq.fastf1"}, timeout=60,
    )
    r.raise_for_status()


def _millis(td):
    import pandas as pd
    try:
        if td is None or pd.isna(td):
            return None
        return int(round(td.total_seconds() * 1000))
    except Exception:  # noqa: BLE001
        return None


def _result_time_text(t, pos):
    """Classification time string for f1_race_result / f1_sprint_result.

    FastF1's results `Time` is the winner's *total* race time and, for everyone
    else, the *gap* to the winner (NaT when lapped or retired — the status text
    carries "+1 Lap"/"DNF" in that case). Ergast/UI convention shows the winner's
    total and a leading-"+" gap for the rest — so only P1 gets the bare time.
    Previously only P1 was written at all, leaving every other row's time_text
    NULL and the UI rendering "+undefined"."""
    s = bf._fmt_laptime(t)
    if s is None:
        return None
    return s if pos == 1 else f"+{s}"


def _int(v):
    return bf.to_int(v)


def _num(v):
    import pandas as pd
    try:
        return round(float(v), 3) if pd.notna(v) else None
    except (TypeError, ValueError):
        return None


def _dnf(status):
    if not status:
        return True
    s = str(status)
    # Classified finishes: "Finished", "Lapped" (classified but ≥1 lap down),
    # and "+N Lap(s)". Everything else (Retired/Accident/DNS/DSQ/…) is a DNF.
    return not (s == "Finished" or s == "Lapped" or ("Lap" in s and s.startswith("+")))


# ── schedule / sessions / circuits ────────────────────────────────────────────
def ingest_schedule(season):
    import fastf1
    import pandas as pd
    sch = fastf1.get_event_schedule(season, include_testing=False)
    races, sessions, circuits = [], [], []
    for _, ev in sch.iterrows():
        rnd = _int(ev.get("RoundNumber"))
        if not rnd or rnd < 1:
            continue
        fmt = str(ev.get("EventFormat", "conventional"))
        loc = str(ev.get("Location") or "")
        cid = loc.lower().replace(" ", "_") or f"r{season}_{rnd}"
        circuits.append({"circuit_id": cid, "name": str(ev.get("Location") or ""),
                         "locality": loc, "country": str(ev.get("Country") or ""),
                         "source": "fastf1"})
        races.append({
            "season": season, "round": rnd,
            "race_name": str(ev.get("EventName") or ""),
            "circuit_id": cid,
            "date": ev["EventDate"].date().isoformat() if pd.notna(ev.get("EventDate")) else None,
            "sprint_weekend": "sprint" in fmt,
            "source": "fastf1",
        })
        for i in range(1, 6):
            name = ev.get(f"Session{i}")
            if not name or pd.isna(name):
                continue
            code = SESSION_CODE.get(str(name))
            if not code:
                continue
            dstart = ev.get(f"Session{i}DateUtc")
            sessions.append({
                "season": season, "round": rnd, "session_type": code,
                "session_name": str(name),
                "date_start": dstart.isoformat() if pd.notna(dstart) else None,
                "source": "fastf1", "_rid_key": (season, rnd),
            })
    # f1_race FKs f1_season(year) — ensure the parent season row exists first.
    bf.supa_upsert("f1_season",
                   [{"year": season, "has_results": True,
                     "race_count": len(races), "source": "fastf1"}], "year")
    bf.supa_upsert("f1_circuit", circuits, "circuit_id")
    bf.supa_upsert("f1_race", races, "season,round")
    # resolve race_id for sessions
    for srow in sessions:
        srow.pop("_rid_key", None)
        srow["race_id"] = bf.race_id_for(srow["season"], srow["round"])
    # Purge the season's sessions first so stale rows from the old Ergast/OpenF1
    # ingest (duplicate practices, wrong sprint labels) are removed, then write
    # the clean FastF1 set. Dedup key = (season, round, session_type).
    _purge_season("f1_session", season)
    bf.supa_upsert("f1_session", sessions, "season,round,session_type")
    print(f"  schedule {season}: {len(races)} races, {len(sessions)} sessions")
    return {r["round"]: r for r in races}


# ── entities ──────────────────────────────────────────────────────────────────
def _merge_upsert(table, rows, conflict_key):
    """Upsert entity rows WITHOUT nulling columns FastF1 didn't supply.

    A plain upsert overwrites every column in the payload, so any field FastF1 leaves
    empty wipes a good stored value. That is not hypothetical: FastF1 has no CountryCode
    for 2026, so re-ingesting Spa blanked nationality for all 22 drivers and every
    country flag on the site disappeared. It also shortened names to FastF1's version
    ("Kimi Antonelli" over Ergast's "Andrea Kimi Antonelli").

    Read the existing rows and let a stored value win whenever the incoming one is empty,
    so an ingest can only ever add detail.
    """
    if not rows:
        return
    try:
        keys = {r[conflict_key] for r in rows if r.get(conflict_key)}
        existing = {}
        for row in bf.supa_select(table, "*") or []:
            if row.get(conflict_key) in keys:
                existing[row[conflict_key]] = row
    except (Exception, SystemExit):  # noqa: BLE001
        existing = {}  # can't read — fall through to a plain upsert
    for r in rows:
        prev = existing.get(r.get(conflict_key))
        if not prev:
            continue
        for col, val in list(r.items()):
            if val in (None, "") and prev.get(col) not in (None, ""):
                r[col] = prev[col]
    bf.supa_upsert(table, rows, conflict_key)


def upsert_entities(session, season):
    drivers, constructors = {}, {}
    for _, r in session.results.iterrows():
        # _s() returns None for pandas NaN / None / "" — critical because a bare
        # `if did:` passes NaN (float('nan') is truthy) and str(nan) == "nan",
        # which created a junk ergast_id="nan" driver row (the Sainz 404 bug).
        did = _s(r.get("DriverId"))
        if did:
            fam = _s(r.get("LastName"))
            drivers[did] = {
                "ergast_id": did,
                "given_name": _s(r.get("FirstName")), "family_name": fam,
                "code": _s(r.get("Abbreviation")), "permanent_number": _s(r.get("DriverNumber")),
                "nationality": _s(r.get("CountryCode")),
                "headshot_url": _s(r.get("HeadshotUrl")),
                "slug": _slug(fam or did),
                "active_season": season,
            }
        tid = _s(r.get("TeamId"))
        if tid:
            tc = _s(r.get("TeamColor"))
            nm = _s(r.get("TeamName"))
            constructors[tid] = {
                "ergast_id": tid, "name": nm,
                "team_color_hex": ("#" + tc) if tc and not tc.startswith("#") else tc,
                "slug": _slug(nm or tid),
                "active_season": season,
            }
    _merge_upsert("f1_driver", list(drivers.values()), "ergast_id")
    _merge_upsert("f1_constructor", list(constructors.values()), "ergast_id")


# ── results (race / qualifying / sprint) ──────────────────────────────────────
def _fastest_laps(session, season=None):
    """driver_id -> (fastest_text, rank) across the session."""
    import pandas as pd
    out = {}
    try:
        laps = session.laps
        best = {}
        for _, lp in laps.iterrows():
            lt = lp.get("LapTime")
            drv = lp.get("Driver")
            if drv is None or pd.isna(lt):
                continue
            sec = lt.total_seconds()
            if drv not in best or sec < best[drv][0]:
                best[drv] = (sec, lp)
        abbr2id = enrich._abbr_to_id(session, season)
        ranked = sorted(best.items(), key=lambda kv: kv[1][0])
        for rank, (abbr, (sec, lp)) in enumerate(ranked, 1):
            out[abbr2id.get(str(abbr), str(abbr))] = (
                bf._fmt_laptime(lp.get("LapTime")), rank, _int(lp.get("LapNumber")))
    except Exception:  # noqa: BLE001
        pass
    return out


# Championship points by finishing position. Only used to fill a race whose Ergast row
# hasn't published yet — Ergast overwrites it on the next reconcile. Verified empirically
# against this warehouse's own 2026 rounds 1-9: every position maps to exactly one value,
# and nothing beyond P10 scores, so there is no fastest-lap bonus to model.
# Caveat: a race stopped before 75% distance pays half points. That is rare, not derivable
# from the F1 API alone, and self-corrects once Ergast lands.
_POINTS_BY_POSITION = {1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1}


def _points_for(position):
    if position is None:
        return None
    return float(_POINTS_BY_POSITION.get(int(position), 0))


def _team_map(season, rnd):
    """driver_id -> constructor_id for a round, from data we already hold.

    FastF1's TeamId is Ergast-sourced and blank until Ergast publishes, and TeamName can't
    be matched by string ("Red Bull" vs "Red Bull Racing", "RB F1 Team" vs "Racing Bulls").
    This round's qualifying row already carries the real constructor_id per driver, so use
    that; fall back to the driver's most recent earlier race in the same season.
    """
    out = {}
    try:
        for row in bf.supa_select("f1_qualifying_result", "driver_id,constructor_id",
                                  season=season, round=rnd):
            if row.get("driver_id") and row.get("constructor_id"):
                out[row["driver_id"]] = row["constructor_id"]
    except (Exception, SystemExit):  # noqa: BLE001
        pass
    if out:
        return out
    try:
        for row in bf.supa_select("f1_race_result", "driver_id,constructor_id,round",
                                  season=season):
            if row.get("driver_id") and row.get("constructor_id") and row.get("round") != rnd:
                out.setdefault(row["driver_id"], row["constructor_id"])
    except (Exception, SystemExit):  # noqa: BLE001
        pass
    return out


def _dnf_from_laps(laps, winner_laps):
    """Classify a finish when Ergast's Status string isn't published yet.

    A driver is classified as a finisher if they covered 90% of the winner's distance —
    the FIA's own rule — which keeps lapped finishers (Spa 2026: ALO 42, BOT 43 of 44)
    out of the DNF bucket while still catching real retirements (PER 13, RUS 1, STR 25).
    Returns None when we can't tell, so the column stays empty rather than guessing.
    """
    if not laps or not winner_laps:
        return None
    return laps < 0.9 * winner_laps


def _grid_positions(session, season, rnd):
    """car_number -> starting grid slot, derived from live timing.

    Ergast's GridPosition is the only place FastF1 exposes the grid, and it stays blank
    for hours after a race. Falling back to the qualifying position (what the UI did)
    silently erases every grid penalty — Spa 2026 had three (NOR 3->13, HAD 10->21,
    SAI 15->19) and 20 of 22 drivers actually started somewhere other than where they
    qualified, so the quali->grid leg of the progression chart was a straight line.

    The timing stream carries each car's classification position from before lights out,
    which is the grid. A driver who retires immediately may never stream one (Spa: RUS,
    lap 1), so any car left over is assigned the unused slots in qualifying order — with
    a single absentee that is exact, since only one slot can remain.
    """
    try:
        from fastf1 import api
        _, stream = api.timing_data(session.api_path)
        seen = stream.dropna(subset=["Position"])
        if seen.empty:
            return {}
        first = seen.sort_values("Time").groupby("Driver").first()
        grid = {int(d): int(r["Position"]) for d, r in first.iterrows()}
    except Exception as e:  # noqa: BLE001
        print(f"  grid {season} R{rnd}: timing stream unavailable ({e}); skipped")
        return {}

    entrants = set()
    for _, r in session.results.iterrows():
        n = _int(r.get("DriverNumber"))
        if n:
            entrants.add(n)
    missing = sorted(entrants - set(grid))
    if missing:
        quali = {}
        try:
            for row in bf.supa_select("f1_qualifying_result", "car_number,position",
                                      season=season, round=rnd):
                if row.get("car_number") and row.get("position"):
                    quali[int(row["car_number"])] = int(row["position"])
        except (Exception, SystemExit):  # noqa: BLE001
            pass
        used = set(grid.values())
        free = [p for p in range(1, len(entrants) + 1) if p not in used]
        for num, slot in zip(sorted(missing, key=lambda n: quali.get(n, 99)), free):
            grid[num] = slot
    return grid


def _provisional_status(is_dnf):
    """Stand-in for Ergast's Status text, using its own vocabulary so consumers that
    string-match on it ("Finished", "+1 Lap", …) keep working. None when undecidable."""
    if is_dnf is None:
        return None
    return "Retired" if is_dnf else "Finished"


def _laps_completed(session, abbr2id):
    """driver_id -> laps completed, counted from timing data (Ergast's Laps is blank)."""
    out = {}
    try:
        for abbr, dl in session.laps.groupby("Driver"):
            did = abbr2id.get(str(abbr).strip().upper())
            if did:
                out[did] = int(len(dl))
    except Exception:  # noqa: BLE001
        pass
    return out


def ingest_results(session, season, rnd, code):
    rid = bf.race_id_for(season, rnd)
    fast = _fastest_laps(session, season) if code in ("R", "S") else {}
    # DriverId comes from Ergast, which lags the race by hours; fall back to resolving the
    # abbreviation against our own driver table so a finished race ingests immediately.
    abbr2id = enrich._abbr_to_id(session, season)
    teams = _team_map(season, rnd) if code in ("R", "S") else {}
    laps_done = _laps_completed(session, abbr2id) if code in ("R", "S") else {}
    winner_laps = max(laps_done.values()) if laps_done else None
    grid_map = _grid_positions(session, season, rnd) if code in ("R", "S") else {}
    rows = []
    for _, r in session.results.iterrows():
        did = _s(r.get("DriverId")) or abbr2id.get(str(r.get("Abbreviation") or "").strip().upper())
        if not did:
            continue
        # Ergast's DriverId is the tell: when it's absent the whole Ergast-sourced half of
        # the row (status, points, grid, time) had to be derived, so flag the row and let
        # the reconcile come back for it.
        derived = not _s(r.get("DriverId"))
        base = {
            "race_id": rid, "season": season, "round": rnd,
            "driver_id": did, "constructor_id": _s(r.get("TeamId")) or teams.get(did),
            "car_number": _int(r.get("DriverNumber")),
            "position": _int(r.get("Position")),
        }
        if code in ("R", "S"):
            base["provisional"] = derived
        if code == "Q" or code == "SQ":
            base.update({
                "q1": bf._fmt_laptime(r.get("Q1")),
                "q2": bf._fmt_laptime(r.get("Q2")),
                "q3": bf._fmt_laptime(r.get("Q3")),
                "source": "fastf1",
            })
            rows.append(base)
        else:  # R or S
            f = fast.get(did, (None, None, None))
            pos = _int(r.get("Position"))
            dnf_flag = (_dnf(r.get("Status")) if _s(r.get("Status"))
                        else _dnf_from_laps(laps_done.get(did), winner_laps))
            pts = _num(r.get("Points"))
            if pts is None and code == "R":
                pts = _points_for(pos)
            base.update({
                "position_text": _s(r.get("ClassifiedPosition")),
                "points": pts,
                # Explicit None check, not `or`: Ergast writes grid 0 for a pit-lane start,
                # which is meaningful and must not be replaced by the derived value.
                "grid": (_int(r.get("GridPosition")) if _int(r.get("GridPosition")) is not None
                         else grid_map.get(_int(r.get("DriverNumber")))),
                "laps": _int(r.get("Laps")) or laps_done.get(did),
                # Status is Ergast-only and blank for hours after the flag. The UI treats it
                # as a required string (sankey.ts does status.includes("+")), so writing the
                # raw None takes the site down — derive a provisional value instead, and let
                # the next reconcile replace it with Ergast's richer text.
                "status": _s(r.get("Status")) or _provisional_status(dnf_flag),
                "is_dnf": dnf_flag,
                "time_text": _result_time_text(r.get("Time"), pos),
                "time_millis": _millis(r.get("Time")),
                "fastest_lap_time": f[0], "fastest_lap_number": f[2],
                "source": "fastf1",
            })
            if code == "R":  # only f1_race_result has a fastest_lap_rank column
                base["fastest_lap_rank"] = f[1]
            rows.append(base)
    if code in ("Q", "SQ"):
        n = bf.supa_upsert("f1_qualifying_result", rows, "season,round,driver_id")
    elif code == "S":
        n = bf.supa_upsert("f1_sprint_result", rows, "season,round,driver_id")
    else:
        n = bf.supa_upsert("f1_race_result", rows, "season,round,driver_id")
    print(f"  results {season} R{rnd} {code}: {n}")
    return n


# ── laps ──────────────────────────────────────────────────────────────────────
def ingest_laps(session, season, rnd, code):
    import pandas as pd
    rid = bf.race_id_for(season, rnd)
    abbr2id = enrich._abbr_to_id(session, season)
    rows = []
    unresolved = set()
    for _, lp in session.laps.iterrows():
        drv = lp.get("Driver")
        ln = _int(lp.get("LapNumber"))
        if drv is None or ln is None:
            continue
        did = abbr2id.get(str(drv).strip().upper())
        if not did:
            # Never fall back to the abbreviation itself: driver_id is an FK to f1_driver,
            # so "ANT" can only ever produce a 409 that masks the real problem (an
            # unresolvable driver) behind a constraint error.
            unresolved.add(str(drv))
            continue
        rows.append({
            "race_id": rid, "season": season, "round": rnd, "session_type": code,
            "driver_id": did,
            "lap_number": ln, "position": _int(lp.get("Position")),
            "time_text": bf._fmt_laptime(lp.get("LapTime")),
            "time_millis": _millis(lp.get("LapTime")),
            "source": "fastf1",
        })
    n = bf.supa_upsert("f1_lap", rows, "season,round,session_type,driver_id,lap_number")
    if unresolved:
        print(f"  laps {season} R{rnd} {code}: WARNING unresolved drivers skipped: "
              f"{', '.join(sorted(unresolved))}")
    print(f"  laps {season} R{rnd} {code}: {n}")
    return n


# ── pit stops (derived from race laps) ────────────────────────────────────────
def ingest_pitstops(session, season, rnd):
    import pandas as pd
    rid = bf.race_id_for(season, rnd)
    abbr2id = enrich._abbr_to_id(session, season)
    rows = []
    for drv, dl in session.laps.groupby("Driver"):
        did = abbr2id.get(str(drv).strip().upper())
        if not did:
            continue  # same FK reasoning as ingest_laps — never write a raw abbreviation
        dl = dl.sort_values("LapNumber")
        stop = 0
        laps_list = list(dl.iterrows())
        for i, (_, lp) in enumerate(laps_list):
            if pd.notna(lp.get("PitInTime")):
                stop += 1
                dur = None
                if i + 1 < len(laps_list):
                    out = laps_list[i + 1][1].get("PitOutTime")
                    if pd.notna(out) and pd.notna(lp.get("PitInTime")):
                        dur = round((out - lp.get("PitInTime")).total_seconds(), 3)
                rows.append({
                    "race_id": rid, "season": season, "round": rnd,
                    "driver_id": did,
                    "stop": stop, "lap": _int(lp.get("LapNumber")),
                    "duration_seconds": dur, "source": "fastf1",
                })
    n = bf.supa_upsert("f1_pit_stop", rows, "season,round,driver_id,stop")
    print(f"  pitstops {season} R{rnd}: {n}")
    return n


# ── standings (computed from race + sprint points) ────────────────────────────
def compute_standings(season):
    rr = bf.supa_select("f1_race_result", "round,driver_id,constructor_id,position,points", season=season) or []
    sr = bf.supa_select("f1_sprint_result", "round,driver_id,constructor_id,position,points", season=season) or []
    all_rows = rr + [dict(row, _sprint=True) for row in sr]
    if not all_rows:
        print(f"  standings {season}: no results")
        return 0
    rounds = sorted({_int(r["round"]) for r in all_rows if r.get("round") is not None})
    dstand, cstand = [], []
    for r in rounds:
        dpts, dwins, dteam = {}, {}, {}
        cpts, cwins = {}, {}
        for row in all_rows:
            if _int(row["round"]) is None or _int(row["round"]) > r:
                continue
            did = row.get("driver_id"); cid = row.get("constructor_id")
            pts = float(row.get("points") or 0)
            pos = _int(row.get("position"))
            # A sprint pays championship points but is not a "win" — F1 and Ergast both
            # count Grands Prix only. Counting both inflated the trophy tally on every
            # standings row (Antonelli showed 7 against Ergast's 6, Russell 4 against 2).
            is_win = pos == 1 and not row.get("_sprint")
            if did:
                dpts[did] = dpts.get(did, 0) + pts
                dteam[did] = cid
                if is_win:
                    dwins[did] = dwins.get(did, 0) + 1
            if cid:
                cpts[cid] = cpts.get(cid, 0) + pts
                if is_win:
                    cwins[cid] = cwins.get(cid, 0) + 1
        for i, (did, p) in enumerate(sorted(dpts.items(), key=lambda kv: -kv[1]), 1):
            dstand.append({"season": season, "round": r, "driver_id": did,
                           "constructor_id": dteam.get(did), "position": i,
                           "position_text": str(i), "points": p,
                           "wins": dwins.get(did, 0), "source": "fastf1"})
        for i, (cid, p) in enumerate(sorted(cpts.items(), key=lambda kv: -kv[1]), 1):
            cstand.append({"season": season, "round": r, "constructor_id": cid,
                           "position": i, "position_text": str(i), "points": p,
                           "wins": cwins.get(cid, 0), "source": "fastf1"})
    bf.supa_upsert("f1_driver_standing", dstand, "season,round,driver_id")
    bf.supa_upsert("f1_constructor_standing", cstand, "season,round,constructor_id")
    print(f"  standings {season}: {len(dstand)} driver rows through R{rounds[-1]}")
    return len(dstand)


# ── orchestration ─────────────────────────────────────────────────────────────
def _load(season, rnd, code, **kw):
    import fastf1
    s = fastf1.get_session(season, rnd, code)
    s.load(telemetry=False, **kw)
    return s


def sessions_for_round(season, rnd):
    rows = bf.supa_select("f1_session", "session_type", season=season, round=rnd) or []
    return [r["session_type"] for r in rows if r.get("session_type") in TIMED]


def _round_done(season, rnd):
    """A round is done once AUTHORITATIVE results are in the warehouse.

    "Has results" isn't enough. A race ingested in the hours before Ergast publishes is
    stored with derived status/points/grid and provisional=true; treating that as done
    meant the cron skipped the round forever and the approximations became permanent.
    Keep retrying while any row is provisional so the reconcile upgrades it in place.
    """
    try:
        rows = bf.supa_select("f1_race_result", "driver_id,provisional",
                              season=season, round=rnd, source="fastf1")
        if not rows or len(rows) < 5:
            return False
        if any(r.get("provisional") for r in rows):
            print(f"== {season} R{rnd} == results are provisional; re-ingesting for Ergast data")
            return False
        return True
    except Exception:  # noqa: BLE001
        return False


_LATEST_ROUND_CACHE = {}


def _round_has_happened(season, rnd):
    """Cheap future-round guard — skip rounds that haven't run yet BEFORE the costly
    FastF1 load. A whole-season reconcile otherwise burns the Ergast/Jolpica
    500-calls/hour budget on future rounds and then has nothing left for the real
    ones. Past seasons are complete; only the current/future season is gated, and the
    lookup is cached once per season."""
    from datetime import datetime, timezone
    if season < datetime.now(timezone.utc).year:
        return True
    if season not in _LATEST_ROUND_CACHE:
        try:
            _LATEST_ROUND_CACHE[season] = bf.latest_completed_round(season) or 0
        except Exception:  # noqa: BLE001
            _LATEST_ROUND_CACHE[season] = 99
    return rnd <= _LATEST_ROUND_CACHE[season] + 1  # +1 = the weekend in progress


def ingest_round(season, rnd):
    _cache()
    if not FORCE and _round_done(season, rnd):
        print(f"== {season} R{rnd} == already ingested, skip (--force to redo)")
        return
    if not FORCE and not _round_has_happened(season, rnd):
        print(f"== {season} R{rnd} == hasn't run yet; skip (saves Ergast rate budget)")
        return
    print(f"== {season} R{rnd} ==")
    codes = sessions_for_round(season, rnd)
    if not codes:
        codes = ["R"]
    for code in codes:
        try:
            s = _load(season, rnd, code, laps=True,
                      weather=(code == "R"), messages=(code == "R"))
        except Exception as e:  # noqa: BLE001
            print(f"  {code}: load failed ({e}); skip")
            continue
        upsert_entities(s, season)
        ingest_results(s, season, rnd, code)
        try:
            ingest_laps(s, season, rnd, code)
        except Exception as e:  # noqa: BLE001
            print(f"  laps {code} failed: {e}")
        if code == "R":
            try:
                ingest_pitstops(s, season, rnd)
            except Exception as e:  # noqa: BLE001
                print(f"  pitstops failed: {e}")
            # enrichment reuses its own loads (weather/messages/laps)
            for fn in (lambda: enrich.ingest_weather(season, rnd, "R"),
                       lambda: enrich.ingest_overtakes(season, rnd, "R"),
                       lambda: enrich.ingest_race_control(season, rnd, "R")):
                try:
                    fn()
                except Exception as e:  # noqa: BLE001
                    print(f"  enrich failed: {e}")


def _s(v):
    import pandas as pd
    if v is None or (not isinstance(v, str) and pd.isna(v)):
        return None
    t = str(v).strip()
    return t or None


def _slug(text):
    import re
    return re.sub(r"[^a-z0-9]+", "-", str(text).lower()).strip("-") or "unknown"


def main():
    ap = argparse.ArgumentParser(description="FastF1-only warehouse ingester (2018+).")
    ap.add_argument("--season", type=int, required=True)
    ap.add_argument("--round", type=int)
    ap.add_argument("--no-upload", action="store_true")
    ap.add_argument("--no-standings", action="store_true")
    ap.add_argument("--force", action="store_true",
                    help="re-ingest rounds even if already complete")
    args = ap.parse_args()
    if args.season < 2018:
        raise SystemExit("FastF1 native data starts 2018; earlier seasons unsupported.")

    global FORCE
    FORCE = args.force
    bf.DRY_RUN = args.no_upload
    if not bf.DRY_RUN:
        bf._env()

    schedule = ingest_schedule(args.season)
    rounds = [args.round] if args.round else sorted(schedule)
    for rnd in rounds:
        ingest_round(args.season, rnd)
    if not args.no_standings:
        compute_standings(args.season)


if __name__ == "__main__":
    main()
