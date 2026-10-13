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
import re

import classification
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


def _cache(fresh=False):
    """Enable the FastF1 cache. fresh=True uses a throwaway directory so a re-ingest forced
    by a Jolpica divergence can't replay the stale Ergast response that caused it.
    Returns the throwaway directory (the caller removes it) or None for the shared cache."""
    import fastf1
    if fresh:
        import tempfile
        cache = tempfile.mkdtemp(prefix="fastf1-fresh-")
    else:
        cache = os.environ.get("FASTF1_CACHE", ".fastf1cache")
    os.makedirs(cache, exist_ok=True)
    fastf1.Cache.enable_cache(cache)
    return cache if fresh else None


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
    ms = _millis(t)
    if ms is None:
        return None
    if pos == 1:
        # Winner's TOTAL race time — needs an hour field (bf._fmt_laptime has none, which
        # rendered a 1 h 51 m race as "111:15.281").
        return bf.fmt_duration_ms(ms)
    gap = bf.fmt_gap_ms(ms)
    return f"+{gap}" if gap else None


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
def _norm_race_identity(name):
    """Normalize a race name for cross-source comparison ('Singapore GP' ~ 'Singapore Grand Prix')."""
    toks = re.sub(r"[^a-z0-9 ]", "", str(name or "").lower()).split()
    drop = {"grand", "prix", "gp", "the", "of"}
    return {t for t in toks if t not in drop}


def ingest_schedule(season):
    import fastf1
    import pandas as pd
    sch = fastf1.get_event_schedule(season, include_testing=False)
    races, sessions, circuits = [], [], []
    seen_events = set()
    for _, ev in sch.iterrows():
        rnd = _int(ev.get("RoundNumber"))
        if not rnd or rnd < 1:
            continue
        # Guard against duplicated/provisional event rows (same event listed
        # twice): keep the first occurrence so one run can't write the same
        # sessions under two different rounds.
        ev_key = (str(ev.get("EventName") or ""), str(ev.get("EventDate") or ""))
        if ev_key in seen_events:
            print(f"  schedule: skipping duplicate FastF1 event row {ev_key[0]!r} (round {rnd})")
            continue
        seen_events.add(ev_key)
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
    # Identity guard: Ergast is the authority for round identity
    # (race_name/date/time/url). FastF1 round numbers have disagreed with Ergast
    # mid-season on provisional calendars, which once wrote Austin's sessions
    # under Singapore's round. FastF1 keeps authority for session start times
    # (official feed, more precise). On any mismatch we apply Ergast identity
    # and warn loudly instead of silently poisoning the warehouse.
    ergast_rounds = {}
    try:
        doc = bf.jolpica_get(f"{season}", limit=100)
        for rc in (((doc or {}).get("MRData") or {}).get("RaceTable") or {}).get("Races", []):
            try:
                ernd = int(rc.get("round"))
            except (TypeError, ValueError):
                continue
            ergast_rounds[ernd] = rc
    except Exception as e:  # noqa: BLE001
        print(f"  schedule: ergast fetch failed: {e}")
    if not ergast_rounds:
        # Can't verify identity => refuse to write anything. Writing unverified rounds is how
        # sessions ended up under the wrong round; a retry later is always cheaper.
        raise SystemExit(f"ingest {season}: Jolpica/Ergast calendar unavailable — cannot verify "
                         f"round identity, refusing to write the schedule")
    races, sessions, rejected = _apply_identity_guard(races, sessions, ergast_rounds)
    for rnd, why in sorted(rejected.items()):
        IDENTITY_ERRORS[(season, rnd)] = why
        print(f"  schedule REJECTED {season} R{rnd}: {why}")
    # f1_race FKs f1_season(year) — ensure the parent season row exists first.
    bf.supa_upsert("f1_season",
                   [{"year": season, "has_results": True,
                     "race_count": len(ergast_rounds), "source": "fastf1"}], "year")
    # Circuit identity is Ergast's too: FastF1's slug of the venue's city ('monte_carlo',
    # 'montréal') disagrees with Ergast's circuitId ('monaco', 'villeneuve') and flip-flopped
    # f1_race.circuit_id between this ingest and backfill.py's Ergast schedule write.
    circuits = []   # FastF1's slug-keyed circuit rows are dropped, not written
    for rrow in races:
        circ = ergast_rounds[rrow["round"]].get("Circuit") or {}
        if circ.get("circuitId"):
            loc = circ.get("Location") or {}
            rrow["circuit_id"] = circ["circuitId"]
            circuits.append({
                "circuit_id": circ["circuitId"], "name": circ.get("circuitName"),
                "locality": loc.get("locality"), "country": loc.get("country"),
                "lat": bf.to_num(loc.get("lat")), "lng": bf.to_num(loc.get("long")),
                "url": circ.get("url"), "source": "ergast",
            })
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
    _purge_stale_sessions(season, sessions, {r["round"] for r in races})
    print(f"  schedule {season}: {len(races)} races, {len(sessions)} sessions")
    return {r["round"]: r for r in races}


# Rounds whose identity/session-date guard failed this run: {(season, round): reason}.
# main() skips them and exits nonzero so a bad calendar fails loudly instead of poisoning rows.
IDENTITY_ERRORS = {}
OVERRIDE_SOURCE = "jolpica_override"   # f1_race_result.source set ONLY by the Jolpica overwrite
RESULT_DIVERGENCE = {}   # (season, round) -> why results still differ from Jolpica after repair
SESSION_WINDOW_BEFORE_DAYS = 4   # FP1 of a weekend is at most ~race date - 4 d
SESSION_WINDOW_AFTER_DAYS = 1    # nothing belonging to a weekend is later than race date + 1 d


def _apply_identity_guard(races, sessions, ergast_rounds):
    """Verify every FastF1-derived round against Ergast/Jolpica (the authority for identity).

    A round is REJECTED (its race row and all its session rows are dropped, never written)
    when: Ergast has no such round; the FastF1 event date is more than a day from Ergast's
    race date; ANY of its sessions is dated outside [race date - 4 d, race date + 1 d]; or it
    carries a sprint/sprint-qualifying session while Ergast says the weekend has no sprint.
    A race-name difference alone (FastF1 "São Paulo" vs Ergast "Brazilian") only logs. Accepted rounds get Ergast's
    identity (name/date/time/url) — FastF1 stays authoritative for session start times.
    Returns (good_races, good_sessions, {round: reason})."""
    from datetime import date, timedelta
    rejected = {}
    by_round = {}
    for s in sessions:
        by_round.setdefault(s["round"], []).append(s)
    for rrow in races:
        rnd = rrow["round"]
        rc = ergast_rounds.get(rnd)
        if not rc:
            rejected[rnd] = "round absent from Jolpica calendar"
            continue
        try:
            race_day = date.fromisoformat(rc["date"])
        except (KeyError, TypeError, ValueError):
            rejected[rnd] = f"Jolpica round has no usable date ({rc.get('date')!r})"
            continue
        name_differs = _norm_race_identity(rrow["race_name"]).isdisjoint(
            _norm_race_identity(rc.get("raceName")))
        if rrow.get("date"):
            drift = abs((date.fromisoformat(rrow["date"]) - race_day).days)
            if drift > 1:
                rejected[rnd] = (f"identity mismatch: fastf1={rrow['race_name']!r} {rrow['date']} "
                                 f"vs jolpica={rc.get('raceName')!r} {rc['date']} ({drift} d apart)")
                continue
        if name_differs:
            # Names legitimately differ across sources (FastF1 'São Paulo' vs Ergast 'Brazilian'),
            # so a name alone is not grounds to reject — the date and the session window are
            # the hard checks. Ergast's name is applied below.
            print(f"  schedule note: R{rnd} name differs fastf1={rrow['race_name']!r} vs "
                  f"jolpica={rc.get('raceName')!r}; dates agree, using jolpica's")
        lo = race_day - timedelta(days=SESSION_WINDOW_BEFORE_DAYS)
        hi = race_day + timedelta(days=SESSION_WINDOW_AFTER_DAYS)
        for s in by_round.get(rnd, []):
            if not s.get("date_start"):
                continue
            sd = date.fromisoformat(s["date_start"][:10])
            if not (lo <= sd <= hi):
                rejected[rnd] = (f"{s['session_type']} dated {s['date_start']} outside "
                                 f"[{lo}, {hi}] of jolpica race date {rc['date']}")
                break
            if s["session_type"] in ("S", "SQ") and "Sprint" not in rc:
                rejected[rnd] = f"{s['session_type']} session but Jolpica lists no sprint"
                break
    good = []
    for rrow in races:
        rnd = rrow["round"]
        if rnd in rejected:
            continue
        rc = ergast_rounds[rnd]
        rrow["race_name"] = rc.get("raceName") or rrow["race_name"]
        rrow["date"] = rc.get("date") or rrow["date"]
        rrow["time"] = rc.get("time") or rrow.get("time")
        rrow["url"] = rc.get("url") or rrow.get("url")
        rrow["sprint_weekend"] = "Sprint" in rc
        good.append(rrow)
    return good, [s for s in sessions if s["round"] not in rejected], rejected


def _purge_stale_sessions(season, written, good_rounds):
    """Delete this season's fastf1 session rows that the current schedule no longer lists.

    _purge_season only removes NON-fastf1 rows and the upsert never removes anything, so a
    fastf1 row written under a round that later changed (Miami's sprint weekend under R6)
    lived forever. Only rounds that passed the guard are pruned — a rejected round keeps its
    rows untouched until the calendar is fixed."""
    if bf.DRY_RUN:
        return
    keep = {(s["round"], s["session_type"]) for s in written}
    stale = [r["id"] for r in bf.supa_select("f1_session", "id,round,session_type,source", season=season)
             if r.get("source") == "fastf1" and r["round"] in good_rounds
             and (r["round"], r["session_type"]) not in keep]
    if not stale:
        return
    import requests
    url, key = bf._env()
    for i in range(0, len(stale), 100):
        ids = ",".join(str(x) for x in stale[i:i + 100])
        r = requests.delete(f"{url}/rest/v1/f1_session", params={"id": f"in.({ids})"},
                            headers={"apikey": key, "Authorization": f"Bearer {key}"}, timeout=60)
        r.raise_for_status()
    print(f"  schedule {season}: removed {len(stale)} stale mis-keyed session row(s)")


def _abbr_map(session, season):
    """enrich._abbr_to_id minus junk ids.

    ff1_ingest builds the map with `if ab and did`, which a pandas NaN DriverId passes
    (NaN is truthy), so an abbreviation can map to the string "nan" — that wrote a junk
    driver_id="nan" into sprint/qualifying/lap rows and the standings. Drop any value that
    is not a real Ergast id."""
    out = {ab: did for ab, did in enrich._abbr_to_id(session, season).items()
           if not _junk_id(did)}
    # an abbreviation whose session DriverId was junk: resolve it from our own driver table
    for ab, did in enrich._db_abbr_to_id(int(season)).items():
        if not _junk_id(did):
            out.setdefault(ab, did)
    return out


def _junk_id(v):
    return str(v).strip().lower() in ("", "nan", "none", "null")


# ── entities ──────────────────────────────────────────────────────────────────
# FastF1 gives a 3-letter IOC country code (GBR, NED, …); the site's flag lookup and the
# Ergast-shaped payloads want the demonym ("British"). Unknown codes are left as-is
# rather than dropped, and an empty code stays None so _merge_upsert keeps the stored value.
_IOC_DEMONYM = {
    "GBR": "British", "NED": "Dutch", "GER": "German", "ITA": "Italian", "FRA": "French",
    "ESP": "Spanish", "MON": "Monegasque", "AUS": "Australian", "CAN": "Canadian",
    "MEX": "Mexican", "JPN": "Japanese", "FIN": "Finnish", "DEN": "Danish", "THA": "Thai",
    "CHN": "Chinese", "USA": "American", "BRA": "Brazilian", "ARG": "Argentine",
    "NZL": "New Zealander", "SUI": "Swiss", "AUT": "Austrian", "BEL": "Belgian",
    "POL": "Polish", "RUS": "Russian", "SWE": "Swedish", "POR": "Portuguese",
    "IRL": "Irish", "EST": "Estonian", "COL": "Colombian", "IND": "Indian",
    "RSA": "South African", "VEN": "Venezuelan", "HUN": "Hungarian", "CZE": "Czech",
    "SGP": "Singaporean", "SIN": "Singaporean", "MAS": "Malaysian", "INA": "Indonesian",
    "CHI": "Chilean", "URU": "Uruguayan", "ISR": "Israeli", "TUR": "Turkish",
}


def _demonym(code):
    if not code:
        return None
    return _IOC_DEMONYM.get(str(code).upper(), code)


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
                "nationality": _demonym(_s(r.get("CountryCode"))),
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
        abbr2id = _abbr_map(session, season)
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


def _laps_value(laps, fallback):
    """Laps completed: FastF1/Ergast value when present, even 0 (BUG-006: a lap-1
    retirement was stored as 1 lap because `0 or fallback` took the timing count)."""
    v = _int(laps)
    return fallback if v is None else v


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


def _augment_qualifying_from_ergast(rows, season, rnd):
    """Backfill qualifying from Jolpica when FastF1's classification came back empty.

    FastF1 sometimes returns a qualifying session with no usable results — every
    Position/Q1-3/team null — even after the session has run (observed on 2026 R12).
    The round was then marked done off the *race* result and the empty quali never
    healed, which blanked the Qualifying→Race chart. When no row has a position, pull
    the classification from Jolpica (the same source backfill uses) and fill blanks
    only — never overwrite a value FastF1 did provide."""
    if any(r.get("position") is not None for r in rows):
        return rows
    try:
        doc = bf.jolpica_get(f"{season}/{rnd}/qualifying")
        races = doc["MRData"]["RaceTable"].get("Races", []) if doc else []
        qr = races[0].get("QualifyingResults", []) if races else []
    except Exception as e:  # noqa: BLE001
        print(f"  quali ergast fallback failed {season} R{rnd}: {e}")
        return rows
    by_id = {(q.get("Driver") or {}).get("driverId"): q for q in qr}
    filled = 0
    for r in rows:
        q = by_id.get(r.get("driver_id"))
        if not q:
            continue
        if r.get("position") is None and q.get("position") is not None:
            r["position"] = _int(q.get("position"))
            filled += 1
        for key, src in (("q1", "Q1"), ("q2", "Q2"), ("q3", "Q3")):
            if not r.get(key) and q.get(src):
                r[key] = q.get(src)
        if not r.get("constructor_id"):
            cid = (q.get("Constructor") or {}).get("constructorId")
            if cid:
                r["constructor_id"] = cid
    if filled:
        print(f"  quali {season} R{rnd}: filled {filled} rows from Jolpica (FastF1 gave no positions)")
    return rows


def _resolve_grid(r, grid_map):
    """Grid slot for a race/sprint row. FastF1's GridPosition is -1 when unresolved (a
    just-run race, before Ergast publishes); treat <0 as unknown and fall back to the
    timing-derived grid, else None so the Jolpica augment can fill it. 0 (pit lane) is a
    real Ergast value and is kept."""
    gp = _int(r.get("GridPosition"))
    if gp is not None and gp >= 0:
        return gp
    return grid_map.get(_int(r.get("DriverNumber")))


def _augment_grid_from_ergast(rows, season, rnd, endpoint, results_key):
    """Fill race/sprint grid from Jolpica when FastF1 couldn't resolve it (grid None/<0).

    Same failure mode as qualifying: a just-run race can ingest with the grid unresolved,
    and `_round_done` would lock the round off the finishing order so the -1 grid never
    heals — which coloured every quali->grid leg as a gain and stacked a bogus red bar on
    the progression chart. Fill blanks only; never overwrite a real FastF1/timing grid."""
    if all(r.get("grid") is not None and r.get("grid") >= 0 for r in rows):
        return rows
    try:
        doc = bf.jolpica_get(f"{season}/{rnd}/{endpoint}")
        races = doc["MRData"]["RaceTable"].get("Races", []) if doc else []
        er = races[0].get(results_key, []) if races else []
    except Exception as e:  # noqa: BLE001
        print(f"  grid ergast fallback failed {season} R{rnd}: {e}")
        return rows
    by_id = {(x.get("Driver") or {}).get("driverId"): x for x in er}
    filled = 0
    for r in rows:
        x = by_id.get(r.get("driver_id"))
        if x is None:
            continue
        g = _int(x.get("grid"))
        if (r.get("grid") is None or r.get("grid") < 0) and g is not None and g >= 0:
            r["grid"] = g
            filled += 1
    if filled:
        print(f"  grid {season} R{rnd}: filled {filled} rows from Jolpica (FastF1 gave no grid)")
    return rows


def ingest_results(session, season, rnd, code):
    rid = bf.race_id_for(season, rnd)
    fast = _fastest_laps(session, season) if code in ("R", "S") else {}
    # DriverId comes from Ergast, which lags the race by hours; fall back to resolving the
    # abbreviation against our own driver table so a finished race ingests immediately.
    abbr2id = _abbr_map(session, season)
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
            # The RPCs serve COALESCE(raw, rebuilt-from-columns). merge-duplicates keeps an
            # older raw (a backfill's pre-penalty Jolpica object) behind the fresh columns,
            # so write NULL explicitly and let the RPC rebuild from what we just stored.
            "raw": None,
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
            # BUG-005: ClassifiedPosition (== Jolpica positionText) decides, not Status.
            dnf_flag = classification.is_dnf(r.get("ClassifiedPosition"), r.get("Status"))
            if dnf_flag is None:
                dnf_flag = _dnf_from_laps(laps_done.get(did), winner_laps)
            pts = _num(r.get("Points"))
            if pts is None and code == "R":
                pts = _points_for(pos)
            base.update({
                "position_text": _s(r.get("ClassifiedPosition")),
                "points": pts,
                # Ergast writes grid 0 for a pit-lane start (meaningful, keep it), but FastF1
                # writes -1 when it can't resolve the grid for a just-run race. Treat <0 as
                # unknown -> derived timing grid -> None (the Jolpica augment below fills it);
                # never store -1, which rendered the progression chart as an all-"gain" wall.
                "grid": _resolve_grid(r, grid_map),
                # 0 is a real value (a lap-1 retirement); only a missing count falls back.
                "laps": _laps_value(r.get("Laps"), laps_done.get(did)),
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
        rows = _augment_qualifying_from_ergast(rows, season, rnd)
        n = bf.supa_upsert("f1_qualifying_result", rows, "season,round,driver_id")
    elif code == "S":
        rows = _augment_grid_from_ergast(rows, season, rnd, "sprint", "SprintResults")
        n = bf.supa_upsert("f1_sprint_result", rows, "season,round,driver_id")
    else:
        rows = _augment_grid_from_ergast(rows, season, rnd, "results", "Results")
        n = bf.supa_upsert("f1_race_result", rows, "season,round,driver_id")
    print(f"  results {season} R{rnd} {code}: {n}")
    return n


# ── laps ──────────────────────────────────────────────────────────────────────
def ingest_laps(session, season, rnd, code):
    import pandas as pd
    rid = bf.race_id_for(season, rnd)
    abbr2id = _abbr_map(session, season)
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
    abbr2id = _abbr_map(session, season)
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


def _jolpica_pitstop_rows(season, rnd):
    """Jolpica's pit stops for a round as f1_pit_stop rows, or None when unavailable.
    Jolpica is the authority: FastF1's PitOut-PitIn derivation drifts from the official
    pit-lane times (Singapore 2026: RUS 23.613 vs the official 23.648)."""
    rows, offset, total = [], 0, None
    rid = bf.race_id_for(season, rnd)
    while True:
        doc, state = bf.jolpica_fetch(f"{season}/{rnd}/pitstops", limit=100, offset=offset)
        if state != "ok":
            return None
        try:
            total = _int(doc["MRData"].get("total"))
            races = doc["MRData"]["RaceTable"].get("Races", [])
        except (KeyError, TypeError):
            return None
        if not races:
            break
        for ps in races[0].get("PitStops", []):
            rows.append({
                "race_id": rid, "season": season, "round": rnd,
                "driver_id": ps.get("driverId"), "stop": _int(ps.get("stop")),
                "lap": _int(ps.get("lap")), "time_local": ps.get("time"),
                "duration_seconds": bf.parse_pit_duration(ps.get("duration")), "source": "ergast",
            })
        offset += 100
        if total is None or offset >= total:
            break
    return rows or None


def _overwrite_pitstops_from_jolpica(season, rnd):
    """Make f1_pit_stop for one round exactly Jolpica's list: upsert its rows, then delete
    any warehouse stop it doesn't list (a FastF1-derived extra stop). Returns rows written,
    or None when Jolpica has nothing yet (the FastF1 rows stay as a provisional stand-in)."""
    rows = _jolpica_pitstop_rows(season, rnd)
    if not rows:
        return None
    n = bf.supa_upsert("f1_pit_stop", rows, "season,round,driver_id,stop")
    keep = {(r["driver_id"], r["stop"]) for r in rows}
    have = bf.supa_select("f1_pit_stop", "driver_id,stop", season=season, round=rnd) or []
    for h in have:
        if (h.get("driver_id"), _int(h.get("stop"))) not in keep:
            _delete_rows("f1_pit_stop", season=f"eq.{season}", round=f"eq.{rnd}",
                         driver_id=f"eq.{h.get('driver_id')}", stop=f"eq.{h.get('stop')}")
    print(f"  pitstops {season} R{rnd}: overwritten from Jolpica ({n} rows)")
    return n


def _pitstops_diverge(season, rnd):
    """True when the warehouse pit stops differ from Jolpica's (lap or duration), None
    when Jolpica can't be read."""
    rows = _jolpica_pitstop_rows(season, rnd)
    if not rows:
        return None
    want = {(r["driver_id"], r["stop"]): (r["lap"], r["duration_seconds"]) for r in rows}
    have = {(h.get("driver_id"), _int(h.get("stop"))): (_int(h.get("lap")), _num(h.get("duration_seconds")))
            for h in (bf.supa_select("f1_pit_stop", "driver_id,stop,lap,duration_seconds",
                                     season=season, round=rnd) or [])}
    return want != have


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
        # fastf1 rows and Jolpica-overwritten rows are authoritative. Plain 'ergast' rows
        # (backfill.py) are not: no FastF1 data (laps, weather, ...) sits behind them.
        rows = [r for r in (bf.supa_select("f1_race_result", "driver_id,provisional,grid,source",
                                           season=season, round=rnd) or [])
                if r.get("source") in ("fastf1", OVERRIDE_SOURCE)]
        if not rows or len(rows) < 5:
            return False
        if any(r.get("provisional") for r in rows):
            print(f"== {season} R{rnd} == results are provisional; re-ingesting for Ergast data")
            return False
        # Grid must resolve too: if every row's grid is unknown (FastF1 gave -1/None for a
        # just-run race) the round would lock off the finishing order and the grid never
        # heals — which renders the progression chart as an all-'gain' wall. Re-ingest until
        # the grid augment fills it.
        if all((row.get("grid") is None or row.get("grid") < 0) for row in rows):
            print(f"== {season} R{rnd} == grid unresolved; re-ingesting")
            return False
        # The race being final isn't enough: a round whose qualifying rows exist but carry
        # no positions (FastF1 returned an empty quali classification) would otherwise be
        # marked done and the empty quali never repaired. Keep re-ingesting — the quali
        # ingest's Jolpica fallback fills it — until qualifying has real positions.
        q = bf.supa_select("f1_qualifying_result", "position", season=season, round=rnd)
        if q and not any(row.get("position") is not None for row in q):
            print(f"== {season} R{rnd} == qualifying has no positions; re-ingesting")
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


RECHECK_DAYS = 21   # a finished round is re-verified against Jolpica for this long


def _results_diverge(season, rnd):
    """Do the warehouse's race results differ from Jolpica's (the authority)?

    Returns True (differs), False (same) or None (can't verify: Jolpica 5xx/timeout/429,
    404, or no results published yet). None must never be treated as a difference."""
    doc, state = bf.jolpica_fetch(f"{season}/{rnd}/results")
    if state != "ok":
        return None
    try:
        races = doc["MRData"]["RaceTable"]["Races"]
        jr = {x["Driver"]["driverId"]: (x["Constructor"]["constructorId"], int(x["position"]),
                                        float(x["points"]))
              for x in races[0]["Results"]} if races else {}
    except (KeyError, IndexError, TypeError, ValueError):
        return None
    if not jr:
        return None
    rows = bf.supa_select("f1_race_result", "driver_id,constructor_id,position,points,raw",
                          season=season, round=rnd) or []
    db = {r["driver_id"]: (r.get("constructor_id"), _int(r.get("position")),
                           float(r.get("points") or 0)) for r in rows}
    if db != jr:
        return True
    # The site serves COALESCE(raw, rebuilt-from-columns): a stale raw behind correct columns
    # is a divergence too (it showed pre-penalty positions/points while standings were right).
    for r in rows:
        raw = r.get("raw")
        if not raw:
            continue
        try:
            served = ((raw.get("Constructor") or {}).get("constructorId"),
                      _int(raw.get("position")), float(raw.get("points") or 0))
        except (TypeError, ValueError):
            return True
        if served != jr.get(r["driver_id"]):
            return True
    return False


def _recently_completed(season, rnd):
    """Race date (from f1_race) is today or within the last RECHECK_DAYS days."""
    from datetime import date, datetime, timedelta, timezone
    try:
        rows = bf.supa_select("f1_race", "date", season=season, round=rnd) or []
        race_day = date.fromisoformat(rows[0]["date"])
    except (Exception, SystemExit):  # noqa: BLE001
        return False
    today = datetime.now(timezone.utc).date()
    return today - timedelta(days=RECHECK_DAYS) <= race_day <= today


def _needs_penalty_recheck(season, rnd):
    """A 'done' round whose results Jolpica has since changed (post-race penalty)."""
    try:
        if not _recently_completed(season, rnd):
            return False
        return _results_diverge(season, rnd) is True
    except Exception as e:  # noqa: BLE001 — verification is best-effort, never fatal
        print(f"== {season} R{rnd} == penalty re-check skipped ({e})")
        return False


def _delete_rows(table, **eq_and_filters):
    """DELETE from a PostgREST table; filters are passed verbatim (e.g. driver_id="in.(a,b)").
    The response is checked so a failed delete surfaces instead of silently passing."""
    if bf.DRY_RUN:
        return
    import requests
    url, key = bf._env()
    r = requests.delete(
        f"{url}/rest/v1/{table}",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        params=eq_and_filters, timeout=60,
    )
    r.raise_for_status()


def _overwrite_results_from_jolpica(season, rnd):
    """Make f1_race_result for one round exactly Jolpica's classification (the authority).

    Used when a forced re-ingest still leaves FastF1 disagreeing with Jolpica (stale feed,
    a load that failed and was skipped, an upsert that left an extra driver). Rows are
    built by backfill._result_row — the same Ergast mapping the backfill uses — then every
    warehouse row for a driver Jolpica doesn't list for the round is deleted, along with
    those drivers' standing rows from that round on (compute_standings rebuilds the rest).
    Returns the number of rows written, or None when Jolpica can't be read."""
    doc, state = bf.jolpica_fetch(f"{season}/{rnd}/results")
    if state != "ok":
        return None
    try:
        res = doc["MRData"]["RaceTable"]["Races"][0]["Results"]
    except (KeyError, IndexError, TypeError):
        return None
    if not res:
        return None
    rid = bf.race_id_for(season, rnd)
    rows = [bf._result_row(season, rnd, rid, r) for r in res]
    for row in rows:
        row["provisional"] = False
        # Distinct from backfill's plain "ergast" (Jolpica-only, no FastF1 data behind it):
        # only this path may mark a round done without FastF1 artifacts. See _round_done.
        row["source"] = OVERRIDE_SOURCE
    n = bf.supa_upsert("f1_race_result", rows, "season,round,driver_id")
    keep = {r["driver_id"] for r in rows if r.get("driver_id")}
    have = {r["driver_id"] for r in
            (bf.supa_select("f1_race_result", "driver_id", season=season, round=rnd) or [])}
    extra = sorted(have - keep)
    if extra:
        ids = ",".join(extra)
        _delete_rows("f1_race_result", season=f"eq.{season}", round=f"eq.{rnd}",
                     driver_id=f"in.({ids})")
        _delete_rows("f1_driver_standing", season=f"eq.{season}", round=f"gte.{rnd}",
                     driver_id=f"in.({ids})")
        print(f"  results {season} R{rnd}: removed {len(extra)} driver row(s) Jolpica "
              f"doesn't list: {ids}")
    print(f"  results {season} R{rnd}: overwritten from Jolpica ({n} rows)")
    return n


def _reverify_after_reingest(season, rnd):
    """After a forced re-ingest: if FastF1 STILL disagrees with Jolpica, overwrite from
    Jolpica; if it still disagrees after that, record it so main exits nonzero."""
    try:
        if _results_diverge(season, rnd) is not True:
            return
        print(f"== {season} R{rnd} == still differs from Jolpica after re-ingest; "
              f"overwriting from Jolpica")
        _overwrite_results_from_jolpica(season, rnd)
        if bf.DRY_RUN:   # nothing was written, so a second look would only repeat the first
            print(f"  [dry-run] would overwrite {season} R{rnd} from Jolpica; not recorded")
            return
        if _results_diverge(season, rnd) is True:
            RESULT_DIVERGENCE[(season, rnd)] = "warehouse results still differ from Jolpica"
    except Exception as e:  # noqa: BLE001
        RESULT_DIVERGENCE[(season, rnd)] = f"re-verification failed: {e}"


def _recheck_pitstops(season, rnd):
    """On a done, recent round: re-sync pit stops when Jolpica has corrected them since.
    Best-effort, never fatal (a stale pit-stop list must not block the run)."""
    try:
        if _recently_completed(season, rnd) and _pitstops_diverge(season, rnd) is True:
            print(f"== {season} R{rnd} == Jolpica pit stops differ from the warehouse; re-syncing")
            _overwrite_pitstops_from_jolpica(season, rnd)
    except Exception as e:  # noqa: BLE001
        print(f"== {season} R{rnd} == pit-stop re-check skipped ({e})")


def ingest_round(season, rnd):
    if (season, rnd) in IDENTITY_ERRORS:
        print(f"== {season} R{rnd} == identity guard rejected this round; not ingesting")
        return
    fresh = False
    if not FORCE and _round_done(season, rnd):
        _recheck_pitstops(season, rnd)
        if not _needs_penalty_recheck(season, rnd):
            _cache()
            print(f"== {season} R{rnd} == already ingested, skip (--force to redo)")
            return
        print(f"== {season} R{rnd} == Jolpica results differ from the warehouse "
              f"(post-race change); re-ingesting")
        fresh = True
    tmp = _cache(fresh=fresh)
    try:
        if _ingest_round_sessions(season, rnd) and fresh:
            _reverify_after_reingest(season, rnd)
    finally:
        if isinstance(tmp, str):
            import shutil
            shutil.rmtree(tmp, ignore_errors=True)


def _ingest_round_sessions(season, rnd):
    """Load + write every timed session of a round. False when the round was skipped."""
    if not FORCE and not _round_has_happened(season, rnd):
        print(f"== {season} R{rnd} == hasn't run yet; skip (saves Ergast rate budget)")
        return False
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
            try:
                # FastF1 rows are only a stand-in until Jolpica publishes the official list.
                _overwrite_pitstops_from_jolpica(season, rnd)
            except Exception as e:  # noqa: BLE001
                print(f"  pitstops Jolpica overwrite failed: {e}")
            # enrichment reuses its own loads (weather/messages/laps)
            for fn in (lambda: enrich.ingest_weather(season, rnd, "R"),
                       lambda: enrich.ingest_overtakes(season, rnd, "R"),
                       lambda: enrich.ingest_race_control(season, rnd, "R")):
                try:
                    fn()
                except Exception as e:  # noqa: BLE001
                    print(f"  enrich failed: {e}")
    return True


def _s(v):
    import pandas as pd
    if v is None or (not isinstance(v, str) and pd.isna(v)):
        return None
    t = str(v).strip()
    # FastF1 can hand back the literal STRING "nan" for an unresolved Ergast id, which
    # pd.isna() does not catch — it became a junk driver_id="nan" row.
    return None if _junk_id(t) else t


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
    if IDENTITY_ERRORS:
        bad = ", ".join(f"R{rnd}: {why}" for (_, rnd), why in sorted(IDENTITY_ERRORS.items()))
        raise SystemExit(f"IDENTITY GUARD FAILED for {len(IDENTITY_ERRORS)} round(s) — "
                         f"nothing was written for them: {bad}")
    if RESULT_DIVERGENCE:
        bad = ", ".join(f"R{rnd}: {why}" for (_, rnd), why in sorted(RESULT_DIVERGENCE.items()))
        raise SystemExit(f"RESULT DIVERGENCE for {len(RESULT_DIVERGENCE)} round(s) — "
                         f"warehouse still differs from Jolpica after re-ingest + overwrite: {bad}")


if __name__ == "__main__":
    main()
