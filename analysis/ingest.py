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
import sys

import backfill as bf   # supa_upsert, supa_select, _env, to_int, _fmt_laptime, race_id_for
import ff1_ingest as enrich

# FastF1 schedule session-name -> canonical code (fixes the dup/naming bug)
SESSION_CODE = {
    "Practice 1": "FP1", "Practice 2": "FP2", "Practice 3": "FP3",
    "Qualifying": "Q", "Sprint Qualifying": "SQ", "Sprint Shootout": "SQ",
    "Sprint": "S", "Race": "R",
}
# Sessions we ingest structured data for (FP handled on-demand by generate.py)
TIMED = {"Q", "S", "SQ", "R"}
POINTS_SESSIONS = ("R", "S")
FORCE = False  # re-ingest rounds even if already complete


def _cache():
    import fastf1
    cache = os.environ.get("FASTF1_CACHE", ".fastf1cache")
    os.makedirs(cache, exist_ok=True)
    fastf1.Cache.enable_cache(cache)


def _purge_season(table, season):
    """Delete a whole season's rows from a table (used to drop stale non-FastF1
    session rows before rewriting the clean set)."""
    if bf.DRY_RUN:
        return
    import requests
    url, key = bf._env()
    requests.delete(
        f"{url}/rest/v1/{table}",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        params={"season": f"eq.{season}"}, timeout=60,
    )


def _millis(td):
    import pandas as pd
    try:
        if td is None or pd.isna(td):
            return None
        return int(round(td.total_seconds() * 1000))
    except Exception:  # noqa: BLE001
        return None


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
    return not (s == "Finished" or ("Lap" in s and s.startswith("+")))


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
        rid = None  # resolved after f1_race upsert
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
def upsert_entities(session, season):
    drivers, constructors = {}, {}
    for _, r in session.results.iterrows():
        did = r.get("DriverId")
        if did:
            fam = _s(r.get("LastName"))
            drivers[str(did)] = {
                "ergast_id": str(did),
                "given_name": _s(r.get("FirstName")), "family_name": fam,
                "code": _s(r.get("Abbreviation")), "permanent_number": _s(r.get("DriverNumber")),
                "nationality": _s(r.get("CountryCode")),
                "headshot_url": _s(r.get("HeadshotUrl")),
                "slug": _slug(fam or str(did)),
                "active_season": season,
            }
        tid = r.get("TeamId")
        if tid:
            tc = _s(r.get("TeamColor"))
            nm = _s(r.get("TeamName"))
            constructors[str(tid)] = {
                "ergast_id": str(tid), "name": nm,
                "team_color_hex": ("#" + tc) if tc and not tc.startswith("#") else tc,
                "slug": _slug(nm or str(tid)),
                "active_season": season,
            }
    bf.supa_upsert("f1_driver", list(drivers.values()), "ergast_id")
    bf.supa_upsert("f1_constructor", list(constructors.values()), "ergast_id")


# ── results (race / qualifying / sprint) ──────────────────────────────────────
def _fastest_laps(session):
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
        abbr2id = enrich._abbr_to_id(session)
        ranked = sorted(best.items(), key=lambda kv: kv[1][0])
        for rank, (abbr, (sec, lp)) in enumerate(ranked, 1):
            out[abbr2id.get(str(abbr), str(abbr))] = (
                bf._fmt_laptime(lp.get("LapTime")), rank, _int(lp.get("LapNumber")))
    except Exception:  # noqa: BLE001
        pass
    return out


def ingest_results(session, season, rnd, code):
    rid = bf.race_id_for(season, rnd)
    fast = _fastest_laps(session) if code in ("R", "S") else {}
    rows = []
    for _, r in session.results.iterrows():
        did = _s(r.get("DriverId"))
        if not did:
            continue
        base = {
            "race_id": rid, "season": season, "round": rnd,
            "driver_id": did, "constructor_id": _s(r.get("TeamId")),
            "car_number": _int(r.get("DriverNumber")),
            "position": _int(r.get("Position")),
        }
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
            base.update({
                "position_text": _s(r.get("ClassifiedPosition")),
                "points": _num(r.get("Points")),
                "grid": _int(r.get("GridPosition")),
                "laps": _int(r.get("Laps")),
                "status": _s(r.get("Status")),
                "is_dnf": _dnf(r.get("Status")),
                "time_text": bf._fmt_laptime(r.get("Time")) if _int(r.get("Position")) == 1 else None,
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
    abbr2id = enrich._abbr_to_id(session)
    rows = []
    for _, lp in session.laps.iterrows():
        drv = lp.get("Driver")
        ln = _int(lp.get("LapNumber"))
        if drv is None or ln is None:
            continue
        rows.append({
            "race_id": rid, "season": season, "round": rnd, "session_type": code,
            "driver_id": abbr2id.get(str(drv), str(drv)),
            "lap_number": ln, "position": _int(lp.get("Position")),
            "time_text": bf._fmt_laptime(lp.get("LapTime")),
            "time_millis": _millis(lp.get("LapTime")),
            "source": "fastf1",
        })
    n = bf.supa_upsert("f1_lap", rows, "season,round,session_type,driver_id,lap_number")
    print(f"  laps {season} R{rnd} {code}: {n}")
    return n


# ── pit stops (derived from race laps) ────────────────────────────────────────
def ingest_pitstops(session, season, rnd):
    import pandas as pd
    rid = bf.race_id_for(season, rnd)
    abbr2id = enrich._abbr_to_id(session)
    rows = []
    for drv, dl in session.laps.groupby("Driver"):
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
                    "driver_id": abbr2id.get(str(drv), str(drv)),
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
    all_rows = rr + sr
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
            if did:
                dpts[did] = dpts.get(did, 0) + pts
                dteam[did] = cid
                if pos == 1:
                    dwins[did] = dwins.get(did, 0) + 1
            if cid:
                cpts[cid] = cpts.get(cid, 0) + pts
                if pos == 1:
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
    """A round is done once its race results are in the warehouse — lets the
    cron reconcile a whole season cheaply, only ingesting new rounds."""
    try:
        rows = bf.supa_select("f1_race_result", "driver_id",
                              season=season, round=rnd, source="fastf1")
        return bool(rows) and len(rows) >= 5
    except Exception:  # noqa: BLE001
        return False


def ingest_round(season, rnd):
    import datetime as dt
    _cache()
    if not FORCE and _round_done(season, rnd):
        print(f"== {season} R{rnd} == already ingested, skip (--force to redo)")
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
