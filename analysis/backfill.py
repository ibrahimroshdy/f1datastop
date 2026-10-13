#!/usr/bin/env python3
"""
Canonical data backfill for f1datastop — pulls Jolpica (Ergast-compatible) and
writes canonical `f1_*` rows to Supabase via the PostgREST REST API.

This is the Python sibling of the `f1-ingest` edge function: it runs the SAME
idempotent UPSERT pipeline offline (the analysis venv already has requests /
pandas / fastf1), so the window [currentYear-3 .. currentYear] + all future
scheduled rounds of the current season can be seeded LOCAL-first. Older seasons
are intentionally NOT backfilled — the live proxy serves them.

Authority (mirrors the canonical translation layer):
  - Jolpica/Ergast  -> identity, schedule, results, qualifying, sprint,
                       pitstops, laps, standings  (AUTHORITATIVE)

Every write is an UPSERT on the table's UNIQUE natural key (see
supabase/migrations/20260624120000_f1_warehouse.sql), so re-runs converge and
are no-ops on unchanged data. Coverage / freshness is recorded per
(domain, season, round[, session_type]) in `f1_sync_state`.

Env (same as generate.py):
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
Optional:
  JOLPICA_BASE  (default https://api.jolpi.ca/ergast)

Usage:
  # one season, all completed rounds + future schedule rows
  python backfill.py --season 2025

  # a window (dependency-correct, dimensions before facts)
  python backfill.py --from-season 2023 --to-season 2026

  # a single round
  python backfill.py --season 2025 --round 12

  # only the latest completed round of the current season (cron-friendly)
  python backfill.py --latest

  # restrict to specific domains, dry-run
  python backfill.py --season 2025 --domains schedule,results,laps
  python backfill.py --season 2025 --dry-run

See the "Backfill" section of analysis/README.md for the full runbook.
"""
import argparse

import classification
import os
import re
import sys
import time
import datetime as dt

import requests

# ── Config ───────────────────────────────────────────────────────────────────
JOLPICA_BASE = os.environ.get("JOLPICA_BASE", "https://api.jolpi.ca/ergast").rstrip("/")
WINDOW_YEARS = 3  # current + last 3 seasons => [currentYear-3 .. currentYear]
PAGE_LIMIT = 100  # Ergast/Jolpica max page size
REQUEST_PAUSE = 0.35  # polite inter-request delay (rate-safe, sequential)
HTTP_TIMEOUT = 30

ALL_DOMAINS = [
    "schedule", "entities", "results", "qualifying", "sprint",
    "pitstops", "laps", "driver_standings", "constructor_standings",
]
# OpenF1 enrichment is retired and its code removed: weather/overtakes/race-control come from
# FastF1 via ff1_ingest, and the f1_weather / f1_overtake / ... tables were reshaped
# (season, round, session_type, ...). Selecting it is an error rather than a silent no-op.
RETIRED_DOMAINS = {"openf1"}

DRY_RUN = False
FORCE = False  # when True, re-ingest rounds even if sync_state says they're complete

# A round counts as fully ingested once these fact domains are 'complete' in
# f1_sync_state — used to skip already-done rounds on a reconcile run.
ROUND_COMPLETE_DOMAINS = {"results", "qualifying", "laps"}


# ── HTTP helpers ─────────────────────────────────────────────────────────────
def _env():
    try:
        url = os.environ["SUPABASE_URL"].rstrip("/")
        key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    except KeyError as e:
        raise SystemExit(f"Missing env {e}. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.")
    return url, key


def jolpica_fetch(path, limit=None, offset=None):
    """GET a Jolpica/Ergast JSON document (path WITHOUT the .json suffix).

    Returns (doc, state): state is "ok" (doc is the JSON), "absent" (404 — genuinely not
    there) or "unavailable" (429/5xx/timeouts after retries — says nothing about the data).
    Callers that compare against Jolpica must treat "unavailable" as "can't verify", never
    as a mismatch."""
    params = {}
    if limit is not None:
        params["limit"] = limit
    if offset is not None:
        params["offset"] = offset
    url = f"{JOLPICA_BASE}/f1/{path}.json"
    for attempt in range(4):
        try:
            r = requests.get(url, params=params, timeout=HTTP_TIMEOUT)
            if r.status_code == 404:
                return None, "absent"  # genuinely absent
            if r.status_code in (429, 500, 502, 503, 521, 522) or r.status_code >= 500:
                time.sleep(1.5 * (attempt + 1))  # transient -> backoff + retry
                continue
            r.raise_for_status()
            time.sleep(REQUEST_PAUSE)
            return r.json(), "ok"
        except (requests.RequestException, ValueError):
            time.sleep(1.5 * (attempt + 1))
    return None, "unavailable"


def jolpica_get(path, limit=None, offset=None):
    """jolpica_fetch without the state: the document, or None (absent OR unavailable)."""
    return jolpica_fetch(path, limit=limit, offset=offset)[0]


def supa_upsert(table, rows, on_conflict, *, returning="minimal"):
    """UPSERT rows into a PostgREST table on its UNIQUE natural key.

    Mirrors generate.py's upsert_index(): POST with
    Prefer: resolution=merge-duplicates. Returns the number of rows sent.
    """
    if not rows:
        return 0
    # Dedup within the batch on the conflict key — PostgREST rejects a single
    # command that touches the same on_conflict tuple twice ("ON CONFLICT DO
    # UPDATE command cannot affect row a second time"). Keep the last occurrence.
    conflict_cols = [c.strip() for c in on_conflict.split(",") if c.strip()]
    if conflict_cols:
        deduped = {}
        for row in rows:
            deduped[tuple(row.get(c) for c in conflict_cols)] = row
        rows = list(deduped.values())
    if DRY_RUN:
        print(f"    [dry-run] upsert {len(rows)} -> {table} (on_conflict={on_conflict})")
        return len(rows)
    url, key = _env()
    headers = {
        "Authorization": f"Bearer {key}", "apikey": key,
        "Content-Type": "application/json",
        "Prefer": f"resolution=merge-duplicates,return={returning}",
    }
    # PostgREST handles batch upserts; chunk to keep payloads sane.
    sent = 0
    for i in range(0, len(rows), 500):
        chunk = rows[i:i + 500]
        r = requests.post(
            f"{url}/rest/v1/{table}?on_conflict={on_conflict}",
            headers=headers, json=chunk, timeout=60,
        )
        if not r.ok:
            raise RuntimeError(f"upsert {table} failed {r.status_code}: {r.text[:500]}")
        sent += len(chunk)
    return sent


def supa_select(table, select="*", **filters):
    """Lightweight GET against PostgREST (used for FK lookups, e.g. race_id)."""
    if DRY_RUN and table.startswith("f1_race"):
        return []  # race_id unknown in dry-run; callers tolerate None
    url, key = _env()
    headers = {"Authorization": f"Bearer {key}", "apikey": key}
    params = {"select": select}
    for k, v in filters.items():
        params[k] = f"eq.{v}"
    r = requests.get(f"{url}/rest/v1/{table}", headers=headers, params=params, timeout=30)
    if not r.ok:
        raise RuntimeError(f"select {table} failed {r.status_code}: {r.text[:300]}")
    return r.json()


# ── parsing helpers ──────────────────────────────────────────────────────────
def to_int(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def to_num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


_PIT_DURATION = re.compile(r"^\s*(?:(\d+):)?(\d+(?:\.\d+)?)\s*$")


def parse_pit_duration(v):
    """Jolpica pit stop duration in seconds. Accepts plain seconds ("23.591") and
    minutes:seconds ("1:21.474", "35:54.149" for red-flag stops). None when unparseable."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return round(float(v), 3) if v == v else None
    m = _PIT_DURATION.match(str(v))
    if not m:
        return None
    mins, secs = m.groups()
    return round(int(mins or 0) * 60 + float(secs), 3)


_LAP_STATUS = re.compile(r"^\+\d+\s+Lap")


def derive_dnf(status, position_text=None):
    """DNF from Jolpica positionText when present (BUG-005: a "Retired" driver can be
    classified, a "Lapped" one can be NC, a DNS is neither); else the old status rule
    (classified if 'Finished', 'Lapped' or '+N Lap(s)')."""
    return classification.is_dnf(position_text, status)


def slugify(*parts):
    s = "-".join(p for p in parts if p)
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s or None


def race_id_for(season, rnd):
    """Resolve f1_race.id (surrogate PK) for FK columns; None if not present."""
    rows = supa_select("f1_race", select="id", season=season, round=rnd)
    return rows[0]["id"] if rows else None


# ── sync_state ───────────────────────────────────────────────────────────────
def mark_sync(domain, season, round_=None, session_type=None, *,
              status="complete", row_count=0, upstream_total=None,
              expected=None, error=None, source="ergast"):
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    row = {
        "domain": domain, "season": season,
        "round": round_, "session_type": session_type,
        "status": status, "source": source,
        "row_count": row_count, "upstream_total": upstream_total,
        "expected_count": expected, "last_attempt_at": now,
        "last_error": error,
    }
    if status == "complete":
        row["last_success_at"] = now
        row["next_retry_at"] = None
    # f1_sync_state natural key allows NULL round/session_type; PostgREST upsert
    # treats NULLs in the conflict target correctly with merge-duplicates.
    supa_upsert("f1_sync_state", [row],
                "domain,season,round,session_type", returning="minimal")


# ── DIMENSIONS ───────────────────────────────────────────────────────────────
def backfill_schedule(season):
    """Ergast /{year} -> f1_season + f1_circuit + f1_race + f1_session."""
    doc = jolpica_get(f"{season}")
    if not doc:
        mark_sync("schedule", season, status="empty", error="no schedule")
        return []
    races = doc["MRData"]["RaceTable"].get("Races", [])
    supa_upsert("f1_season", [{
        "year": season, "has_results": False, "race_count": len(races),
        "source": "ergast",
    }], "year")

    circuits, race_rows = {}, []
    for rc in races:
        circ = rc.get("Circuit", {})
        cid = circ.get("circuitId")
        if cid and cid not in circuits:
            loc = circ.get("Location", {})
            circuits[cid] = {
                "circuit_id": cid, "name": circ.get("circuitName"),
                "locality": loc.get("locality"), "country": loc.get("country"),
                "lat": to_num(loc.get("lat")), "lng": to_num(loc.get("long")),
                "url": circ.get("url"), "source": "ergast",
            }
        race_rows.append({
            "season": season, "round": to_int(rc.get("round")),
            "race_name": rc.get("raceName"), "circuit_id": cid,
            "date": rc.get("date"), "time": rc.get("time"), "url": rc.get("url"),
            "sprint_weekend": "Sprint" in rc,
            "source": "ergast", "raw": rc,
            "ingested_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        })
    supa_upsert("f1_circuit", list(circuits.values()), "circuit_id")
    supa_upsert("f1_race", race_rows, "season,round")

    # Sessions: one row per present sub-object + the race itself.
    sub_map = [
        ("FirstPractice", "FP1"), ("SecondPractice", "FP2"),
        ("ThirdPractice", "FP3"), ("Qualifying", "Q"),
        ("SprintQualifying", "SQ"), ("SprintShootout", "SQ"), ("Sprint", "S"),
    ]
    sess_rows = []
    for rc in races:
        rnd = to_int(rc.get("round"))
        for key, stype in sub_map:
            if key in rc:
                sess_rows.append({
                    "season": season, "round": rnd, "session_type": stype,
                    "session_name": key,
                    "scheduled_date": rc[key].get("date"),
                    "scheduled_time": rc[key].get("time"), "source": "ergast",
                })
        sess_rows.append({
            "season": season, "round": rnd, "session_type": "R",
            "session_name": "Race", "scheduled_date": rc.get("date"),
            "scheduled_time": rc.get("time"), "source": "ergast",
        })
    supa_upsert("f1_session", sess_rows, "season,round,session_type")

    mark_sync("schedule", season, status="complete",
              row_count=len(race_rows), upstream_total=len(races))
    print(f"  schedule {season}: {len(race_rows)} races, {len(sess_rows)} sessions, "
          f"{len(circuits)} circuits")
    return races


def _upsert_driver(driver):
    """Upsert a driver dimension row from an Ergast Driver sub-object."""
    did = driver.get("driverId")
    if not did:
        return
    slug = slugify(driver.get("givenName"), driver.get("familyName")) or did
    supa_upsert("f1_driver", [{
        "ergast_id": did,
        "given_name": driver.get("givenName") or did,
        "family_name": driver.get("familyName") or "",
        "code": driver.get("code"),
        "permanent_number": driver.get("permanentNumber"),
        "nationality": driver.get("nationality"),
        "date_of_birth": driver.get("dateOfBirth"),
        "slug": slug,
    }], "ergast_id")


def _upsert_constructor(con):
    cid = con.get("constructorId")
    if not cid:
        return
    slug = slugify(con.get("name")) or cid
    supa_upsert("f1_constructor", [{
        "ergast_id": cid, "name": con.get("name") or cid,
        "nationality": con.get("nationality"), "slug": slug,
    }], "ergast_id")


def backfill_entities(season):
    """Expand f1_driver / f1_constructor to full season coverage (not just the
    22-row current grid) from driverStandings + constructorStandings."""
    n_d = n_c = 0
    ds = jolpica_get(f"{season}/driverStandings")
    if ds:
        lists = ds["MRData"]["StandingsTable"].get("StandingsLists", [])
        for sl in lists:
            for s in sl.get("DriverStandings", []):
                _upsert_driver(s.get("Driver", {}))
                for con in s.get("Constructors", []):
                    _upsert_constructor(con)
                n_d += 1
    cs = jolpica_get(f"{season}/constructorStandings")
    if cs:
        lists = cs["MRData"]["StandingsTable"].get("StandingsLists", [])
        for sl in lists:
            for s in sl.get("ConstructorStandings", []):
                _upsert_constructor(s.get("Constructor", {}))
                n_c += 1
    mark_sync("entities", season, status="complete", row_count=n_d + n_c)
    print(f"  entities {season}: {n_d} drivers, {n_c} constructors upserted")


# ── ERGAST FACTS (per round) ─────────────────────────────────────────────────
def _result_row(season, rnd, race_id, res, *, sprint=False):
    drv = res.get("Driver", {})
    con = res.get("Constructor", {})
    _upsert_driver(drv)
    _upsert_constructor(con)
    fl = res.get("FastestLap", {}) or {}
    avg = fl.get("AverageSpeed", {}) or {}
    tm = res.get("Time", {}) or {}
    row = {
        "race_id": race_id, "season": season, "round": rnd,
        "driver_id": drv.get("driverId"), "constructor_id": con.get("constructorId"),
        "car_number": to_int(res.get("number")),
        "position": to_int(res.get("position")),
        "position_text": res.get("positionText"),
        "points": to_num(res.get("points")), "grid": to_int(res.get("grid")),
        "laps": to_int(res.get("laps")), "status": res.get("status"),
        "is_dnf": derive_dnf(res.get("status"), res.get("positionText")),
        "time_millis": to_int(tm.get("millis")), "time_text": tm.get("time"),
        "fastest_lap_number": to_int(fl.get("lap")),
        "fastest_lap_time": (fl.get("Time") or {}).get("time"),
        "source": "ergast", "raw": res,
    }
    if not sprint:
        row["fastest_lap_rank"] = to_int(fl.get("rank"))
        row["fastest_lap_avg_speed"] = to_num(avg.get("speed"))
        row["fastest_lap_speed_units"] = avg.get("units")
    return row


def backfill_results(season, rnd, race_id):
    doc = jolpica_get(f"{season}/{rnd}/results")
    races = doc["MRData"]["RaceTable"].get("Races", []) if doc else []
    if not races:
        mark_sync("results", season, rnd, status="partial", error="no results yet")
        return 0
    rows = [_result_row(season, rnd, race_id, r) for r in races[0].get("Results", [])]
    n = supa_upsert("f1_race_result", rows, "season,round,driver_id")
    mark_sync("results", season, rnd, status="complete", row_count=n)
    return n


def backfill_qualifying(season, rnd, race_id):
    doc = jolpica_get(f"{season}/{rnd}/qualifying")
    races = doc["MRData"]["RaceTable"].get("Races", []) if doc else []
    if not races:
        mark_sync("qualifying", season, rnd, status="partial", error="no qualifying yet")
        return 0
    rows = []
    for q in races[0].get("QualifyingResults", []):
        drv = q.get("Driver", {})
        con = q.get("Constructor", {})
        _upsert_driver(drv)
        _upsert_constructor(con)
        rows.append({
            "race_id": race_id, "season": season, "round": rnd,
            "driver_id": drv.get("driverId"), "constructor_id": con.get("constructorId"),
            "car_number": to_int(q.get("number")), "position": to_int(q.get("position")),
            "q1": q.get("Q1"), "q2": q.get("Q2"), "q3": q.get("Q3"),
            "source": "ergast", "raw": q,
        })
    n = supa_upsert("f1_qualifying_result", rows, "season,round,driver_id")
    mark_sync("qualifying", season, rnd, status="complete", row_count=n)
    return n


def backfill_sprint(season, rnd, race_id):
    doc = jolpica_get(f"{season}/{rnd}/sprint")
    races = doc["MRData"]["RaceTable"].get("Races", []) if doc else []
    if not races:
        mark_sync("sprint", season, rnd, status="not_applicable")
        return 0
    rows = [_result_row(season, rnd, race_id, r, sprint=True)
            for r in races[0].get("SprintResults", [])]
    n = supa_upsert("f1_sprint_result", rows, "season,round,driver_id")
    mark_sync("sprint", season, rnd, status="complete", row_count=n)
    return n


def backfill_pitstops(season, rnd, race_id):
    rows, offset, total = [], 0, None
    while True:
        doc = jolpica_get(f"{season}/{rnd}/pitstops", limit=PAGE_LIMIT, offset=offset)
        if not doc:
            break
        total = to_int(doc["MRData"].get("total"))
        races = doc["MRData"]["RaceTable"].get("Races", [])
        if not races:
            break
        stops = races[0].get("PitStops", [])
        for ps in stops:
            rows.append({
                "race_id": race_id, "season": season, "round": rnd,
                "driver_id": ps.get("driverId"), "stop": to_int(ps.get("stop")),
                "lap": to_int(ps.get("lap")), "time_local": ps.get("time"),
                "duration_seconds": parse_pit_duration(ps.get("duration")), "source": "ergast",
            })
        offset += PAGE_LIMIT
        if total is None or offset >= total:
            break
    if not rows:
        mark_sync("pitstops", season, rnd, status="not_applicable")
        return 0
    n = supa_upsert("f1_pit_stop", rows, "season,round,driver_id,stop")
    mark_sync("pitstops", season, rnd, status="complete", row_count=n, upstream_total=total)
    return n


def _parse_lap_doc(doc, race_id, season, rnd):
    """Flatten a Jolpica /laps page into canonical f1_lap rows."""
    out = []
    races = doc["MRData"]["RaceTable"].get("Races", []) if doc else []
    if not races:
        return out
    for lap in races[0].get("Laps", []):
        lapno = to_int(lap.get("number"))
        for t in lap.get("Timings", []):
            out.append({
                "race_id": race_id, "season": season, "round": rnd,
                "session_type": "R", "lap_number": lapno, "driver_id": t.get("driverId"),
                "position": to_int(t.get("position")), "time_text": t.get("time"),
                "source": "ergast",
            })
    return out


def fmt_duration_ms(ms):
    """Absolute race/session duration -> Ergast 'H:MM:SS.mmm' (or 'M:SS.mmm' under an hour).

    NOT the same as a lap time: _fmt_laptime() has no hour field, so a 1 h 51 m race came
    out as "111:15.281" instead of "1:51:15.281" for every race winner.
    """
    if ms is None:
        return None
    ms = int(ms)
    if ms <= 0:
        return None
    hours, rem = divmod(ms, 3_600_000)
    minutes, rem = divmod(rem, 60_000)
    seconds = rem / 1000.0
    if hours:
        return f"{hours}:{minutes:02d}:{seconds:06.3f}"
    return f"{minutes}:{seconds:06.3f}"


def fmt_gap_ms(ms):
    """Gap behind the winner -> Ergast form: '3.857' under a minute, else '1:03.857'.

    No leading '+' (callers add it) and no leading '0:' — Ergast/Jolpica write "+3.857",
    so emitting "+0:03.857" made our rows differ from any Jolpica-sourced round.
    """
    if ms is None:
        return None
    ms = int(ms)
    if ms <= 0:
        return None
    minutes, rem = divmod(ms, 60_000)
    seconds = rem / 1000.0
    if minutes:
        return f"{minutes}:{seconds:06.3f}"
    return f"{seconds:.3f}"


def _fmt_laptime(td):
    """Timedelta -> Ergast-style 'M:SS.mmm' lap time (None if missing)."""
    try:
        import pandas as pd
        if td is None or pd.isna(td):
            return None
        total = td.total_seconds()
    except Exception:
        return None
    if total <= 0:
        return None
    m = int(total // 60)
    return f"{m}:{total - m * 60:06.3f}"


def _laps_from_fastf1(season, rnd, race_id):
    """Laps from FastF1 official timing (cached, NOT Jolpica-throttled).
    FastF1 SessionResults.DriverId is the Ergast driverId, so f1_lap.driver_id
    stays consistent with results/qualifying. Returns row count, or -1 when
    FastF1 is unavailable for this round (caller falls back to Jolpica)."""
    try:
        import fastf1
        import pandas as pd
    except Exception:
        return -1
    try:
        cache = os.environ.get("FASTF1_CACHE", ".fastf1cache")
        os.makedirs(cache, exist_ok=True)
        fastf1.Cache.enable_cache(cache)
    except Exception:
        pass
    try:
        s = fastf1.get_session(season, rnd, "R")
        s.load(telemetry=False, weather=False, messages=False)
    except Exception as e:  # noqa: BLE001
        print(f"    fastf1 laps unavailable ({e}); falling back to Jolpica")
        return -1
    res, laps = getattr(s, "results", None), getattr(s, "laps", None)
    if res is None or laps is None or len(laps) == 0:
        return -1
    abbr2id = {}
    for _, r in res.iterrows():
        did, ab = r.get("DriverId"), r.get("Abbreviation")
        if did and ab:
            abbr2id[ab] = did
    rows = []
    for _, lap in laps.iterrows():
        did = abbr2id.get(lap.get("Driver"))
        lapno = lap.get("LapNumber")
        if not did or pd.isna(lapno):
            continue
        pos = lap.get("Position")
        rows.append({
            "race_id": race_id, "season": season, "round": rnd,
            "session_type": "R", "lap_number": int(lapno), "driver_id": did,
            "position": int(pos) if pd.notna(pos) else None,
            "time_text": _fmt_laptime(lap.get("LapTime")),
            "source": "fastf1",
        })
    if not rows:
        return -1
    return supa_upsert("f1_lap", rows, "season,round,session_type,driver_id,lap_number")


def backfill_laps(season, rnd, race_id):
    """Laps via FastF1 first (official timing, cached, dodges Jolpica's burst
    throttle); fall back to Jolpica /laps when FastF1 has no data for the round."""
    n = _laps_from_fastf1(season, rnd, race_id)
    if n >= 0:
        mark_sync("laps", season, rnd, status="complete", row_count=n, source="fastf1")
        return n
    return _laps_from_jolpica(season, rnd, race_id)


def _laps_from_jolpica(season, rnd, race_id):
    """Server-side pagination over /laps. Sequential + polite: Jolpica throttles
    bursts hard (observed ~75s penalty), so concurrent paging is counter-
    productive. Page 0 gives the total; subsequent pages walk the offset."""
    first = jolpica_get(f"{season}/{rnd}/laps", limit=PAGE_LIMIT, offset=0)
    if not first:
        mark_sync("laps", season, rnd, status="partial", error="no laps yet")
        return 0
    total = to_int(first["MRData"].get("total"))
    rows = _parse_lap_doc(first, race_id, season, rnd)
    offset = PAGE_LIMIT
    while total and offset < total:
        doc = jolpica_get(f"{season}/{rnd}/laps", limit=PAGE_LIMIT, offset=offset)
        page_rows = _parse_lap_doc(doc, race_id, season, rnd)
        if not page_rows:
            break
        rows.extend(page_rows)
        offset += PAGE_LIMIT
    if not rows:
        mark_sync("laps", season, rnd, status="partial", error="no laps yet")
        return 0
    n = supa_upsert("f1_lap", rows, "season,round,session_type,driver_id,lap_number")
    status = "complete" if (total is None or len(rows) >= total) else "partial"
    mark_sync("laps", season, rnd, status=status, row_count=n, upstream_total=total)
    return n


# ── STANDINGS (per season, final round) ──────────────────────────────────────
def backfill_driver_standings(season):
    doc = jolpica_get(f"{season}/driverStandings")
    lists = doc["MRData"]["StandingsTable"].get("StandingsLists", []) if doc else []
    if not lists:
        mark_sync("driver_standings", season, status="partial")
        return 0
    sl = lists[0]
    rnd = to_int(sl.get("round"))
    rows = []
    for s in sl.get("DriverStandings", []):
        drv = s.get("Driver", {})
        cons = s.get("Constructors", [])
        # current constructor = LAST element (mirror adapters.getPrimaryConstructor)
        cid = cons[-1].get("constructorId") if cons else None
        rows.append({
            "season": season, "round": rnd, "driver_id": drv.get("driverId"),
            "constructor_id": cid, "position": to_int(s.get("position")),
            "position_text": s.get("positionText"), "points": to_num(s.get("points")),
            "wins": to_int(s.get("wins")), "source": "ergast",
        })
    n = supa_upsert("f1_driver_standing", rows, "season,round,driver_id")
    mark_sync("driver_standings", season, rnd, status="complete", row_count=n)
    return n


def backfill_constructor_standings(season):
    doc = jolpica_get(f"{season}/constructorStandings")
    lists = doc["MRData"]["StandingsTable"].get("StandingsLists", []) if doc else []
    if not lists:
        mark_sync("constructor_standings", season, status="partial")
        return 0
    sl = lists[0]
    rnd = to_int(sl.get("round"))
    rows = []
    for s in sl.get("ConstructorStandings", []):
        con = s.get("Constructor", {})
        rows.append({
            "season": season, "round": rnd, "constructor_id": con.get("constructorId"),
            "position": to_int(s.get("position")), "position_text": s.get("positionText"),
            "points": to_num(s.get("points")), "wins": to_int(s.get("wins")),
            "source": "ergast",
        })
    n = supa_upsert("f1_constructor_standing", rows, "season,round,constructor_id")
    mark_sync("constructor_standings", season, rnd, status="complete", row_count=n)
    return n


# ── orchestration ────────────────────────────────────────────────────────────
def round_is_completed(rc):
    """A round counts as completed once its race date has arrived (UTC,
    inclusive of race day). Using `<` excluded same-day races, so a round
    stayed `not_applicable` all of race day even after results were published.
    backfill_results marks empty fetches `partial` (retryable), so attempting an
    as-yet-unpublished same-day race is safe — it just retries until data lands."""
    try:
        d = dt.date.fromisoformat(rc.get("date"))
    except (TypeError, ValueError):
        return False
    return d <= dt.datetime.now(dt.timezone.utc).date()


def backfill_round(season, rc, domains):
    rnd = to_int(rc.get("round"))
    rid = race_id_for(season, rnd)
    completed = round_is_completed(rc)
    label = rc.get("raceName", f"R{rnd}")
    if not completed:
        # Future round: nothing to fetch yet; mark fact domains not_applicable.
        for dom in ("results", "qualifying", "sprint", "pitstops", "laps"):
            if dom in domains:
                mark_sync(dom, season, rnd, status="not_applicable")
        print(f"  round {rnd:>2} {label}: future — facts marked not_applicable")
        return
    print(f"  round {rnd:>2} {label}: ingesting facts")
    if "results" in domains:
        backfill_results(season, rnd, rid)
    if "qualifying" in domains:
        backfill_qualifying(season, rnd, rid)
    if "sprint" in domains and "Sprint" in rc:
        backfill_sprint(season, rnd, rid)
    elif "sprint" in domains:
        mark_sync("sprint", season, rnd, status="not_applicable")
    if "pitstops" in domains:
        backfill_pitstops(season, rnd, rid)
    if "laps" in domains:
        backfill_laps(season, rnd, rid)


def completed_rounds_in_db(season):
    """Rounds whose core fact-domains (results, qualifying, laps) are all marked
    'complete' in f1_sync_state. Used to skip already-ingested rounds."""
    try:
        rows = supa_select("f1_sync_state", "round,domain,status", season=season)
    except Exception:  # noqa: BLE001
        return set()
    by_round = {}
    for r in rows or []:
        if (r.get("status") == "complete"
                and r.get("domain") in ROUND_COMPLETE_DOMAINS
                and r.get("round") is not None):
            by_round.setdefault(int(r["round"]), set()).add(r["domain"])
    return {rnd for rnd, doms in by_round.items() if ROUND_COMPLETE_DOMAINS <= doms}


def backfill_season(season, domains, only_round=None):
    print(f"== Season {season} ==")
    # 1. Spine: schedule (always needed to enumerate rounds + resolve race_id)
    races = backfill_schedule(season) if ("schedule" in domains or True) else []
    if not races:
        races = []
        doc = jolpica_get(f"{season}")
        if doc:
            races = doc["MRData"]["RaceTable"].get("Races", [])

    # 2. Dimensions: expand drivers/constructors for the season
    if "entities" in domains:
        backfill_entities(season)

    # 3. Per-round facts (dependency-correct order inside backfill_round).
    # Skip rounds already 'complete' in sync_state so a whole-season reconcile
    # is cheap (only un-ingested/new rounds hit the rate-limited sources).
    round_domains = domains & {"results", "qualifying", "sprint", "pitstops", "laps"}
    if round_domains:
        done = set() if (FORCE or only_round is not None) else completed_rounds_in_db(season)
        skipped = 0
        for rc in races:
            rnd = to_int(rc.get("round"))
            if only_round is not None and rnd != only_round:
                continue
            if rnd in done:
                skipped += 1
                continue
            backfill_round(season, rc, round_domains)
        if skipped:
            print(f"  ({skipped} completed rounds skipped via sync_state; --force to re-ingest)")

    # 4. Standings (season-level)
    if "driver_standings" in domains:
        backfill_driver_standings(season)
    if "constructor_standings" in domains:
        backfill_constructor_standings(season)

    # mark the season as having results once any round is complete
    if any(round_is_completed(rc) for rc in races):
        supa_upsert("f1_season", [{"year": season, "has_results": True,
                                   "source": "ergast"}], "year")


def latest_completed_round(season):
    doc = jolpica_get(f"{season}")
    if not doc:
        return None
    races = doc["MRData"]["RaceTable"].get("Races", [])
    done = [to_int(r.get("round")) for r in races if round_is_completed(r)]
    return max(done) if done else None


def main():
    ap = argparse.ArgumentParser(description="Backfill canonical f1_* warehouse tables.")
    cur = dt.datetime.now(dt.timezone.utc).year
    ap.add_argument("--season", type=int, help="single season")
    ap.add_argument("--from-season", type=int, help="window start (inclusive)")
    ap.add_argument("--to-season", type=int, help="window end (inclusive)")
    ap.add_argument("--round", type=int, help="single round (requires --season)")
    ap.add_argument("--latest", action="store_true",
                    help="only the latest completed round of the current season")
    ap.add_argument("--domains", default="all",
                    help="comma-separated subset of: " + ",".join(ALL_DOMAINS))
    ap.add_argument("--force", action="store_true",
                    help="re-ingest rounds even if sync_state marks them complete")
    ap.add_argument("--dry-run", action="store_true",
                    help="fetch + print row counts, do not write to Supabase")
    args = ap.parse_args()

    global DRY_RUN, FORCE
    DRY_RUN = args.dry_run
    FORCE = args.force
    if not DRY_RUN:
        _env()  # fail fast if env missing

    if args.domains == "all":
        domains = set(ALL_DOMAINS)
    else:
        domains = {d.strip() for d in args.domains.split(",") if d.strip()}
        retired = domains & RETIRED_DOMAINS
        if retired:
            raise SystemExit(f"Retired domains (no longer ingested): {', '.join(sorted(retired))}")
        unknown = domains - set(ALL_DOMAINS)
        if unknown:
            raise SystemExit(f"Unknown domains: {', '.join(sorted(unknown))}")

    # Resolve the season window.
    if args.latest:
        season = cur
        rnd = latest_completed_round(season)
        if rnd is None:
            print("No completed race this season.")
            return 0
        print(f"Latest completed: {season} round {rnd}")
        backfill_season(season, domains, only_round=rnd)
        # standings are season-level; run them too for --latest
        return 0

    if args.season is not None:
        seasons = [args.season]
    elif args.from_season is not None or args.to_season is not None:
        lo = args.from_season or (cur - WINDOW_YEARS)
        hi = args.to_season or cur
        seasons = list(range(lo, hi + 1))
    else:
        seasons = list(range(cur - WINDOW_YEARS, cur + 1))  # default window

    # Guard: warn (don't hard-fail) on out-of-window seasons; user may force it.
    for s in seasons:
        if s < cur - WINDOW_YEARS:
            print(f"WARNING: {s} is older than the [{cur - WINDOW_YEARS}..{cur}] "
                  f"window; the live proxy normally serves it.")

    print(f"Backfilling seasons {seasons[0]}..{seasons[-1]} "
          f"domains={sorted(domains)} dry_run={DRY_RUN}")
    for s in seasons:
        backfill_season(s, domains, only_round=args.round if args.season else None)

    print("Done. Verify coverage with:")
    print("  SELECT domain, status, count(*) FROM f1_sync_state "
          "GROUP BY domain, status ORDER BY domain;")
    return 0


if __name__ == "__main__":
    sys.exit(main())
