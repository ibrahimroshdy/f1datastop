#!/usr/bin/env python3
"""FastF1-native enrichment ingest — Phase 1 of the FastF1-only migration.

Extracts, from a single FastF1 session load, the domains that used to come from
OpenF1 and writes them to the warehouse:

  - weather        -> f1_weather        (session.weather_data time series)
  - overtakes      -> f1_overtake       (computed from per-lap Position deltas)
  - race control   -> f1_race_control   (session.race_control_messages)

Reuses backfill.py's Supabase helpers so the write path / creds stay identical.

  python ff1_ingest.py --season 2024 --round 1 --session R
  python ff1_ingest.py --season 2024 --round 1 --session R --domains weather
  python ff1_ingest.py --season 2024 --round 1 --no-upload         # dry run
"""
import argparse
import os

import backfill as bf  # supa_upsert, _env, to_int, DRY_RUN

ENRICH_DOMAINS = ["weather", "overtakes", "race_control"]


def _purge(table, season, rnd, session_code):
    """Delete a session's rows so a re-ingest fully replaces them (idempotent,
    survives algorithm changes)."""
    if bf.DRY_RUN:
        return
    import requests
    url, key = bf._env()
    requests.delete(
        f"{url}/rest/v1/{table}",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        params={"season": f"eq.{season}", "round": f"eq.{rnd}",
                "session_type": f"eq.{session_code}"},
        timeout=60,
    )


def _load(season, rnd, session_code, *, weather=False, messages=False, laps=False):
    import fastf1
    cache = os.environ.get("FASTF1_CACHE", ".fastf1cache")
    os.makedirs(cache, exist_ok=True)
    fastf1.Cache.enable_cache(cache)
    s = fastf1.get_session(season, rnd, session_code)
    s.load(laps=laps, telemetry=False, weather=weather, messages=messages)
    return s


def _abbr_to_id(session):
    """Abbreviation -> ergast driver_id from session.results."""
    out = {}
    try:
        for _, r in session.results.iterrows():
            ab = r.get("Abbreviation")
            did = r.get("DriverId")
            if ab and did:
                out[str(ab)] = str(did)
    except Exception:  # noqa: BLE001
        pass
    return out


# ── weather ──────────────────────────────────────────────────────────────────
def ingest_weather(season, rnd, session_code):
    import pandas as pd
    s = _load(season, rnd, session_code, weather=True)
    wx = getattr(s, "weather_data", None)
    if wx is None or len(wx) == 0:
        print(f"  weather {season} R{rnd} {session_code}: none")
        return 0
    rows = []
    for _, w in wx.iterrows():
        t = w.get("Time")
        rows.append({
            "season": season, "round": rnd, "session_type": session_code,
            "time_seconds": round(float(t.total_seconds()), 3) if pd.notna(t) else None,
            "air_temp": _num(w.get("AirTemp")),
            "track_temp": _num(w.get("TrackTemp")),
            "humidity": _num(w.get("Humidity")),
            "pressure": _num(w.get("Pressure")),
            "wind_speed": _num(w.get("WindSpeed")),
            "wind_direction": bf.to_int(w.get("WindDirection")),
            "rainfall": bool(w.get("Rainfall")) if pd.notna(w.get("Rainfall")) else None,
            "source": "fastf1",
        })
    _purge("f1_weather", season, rnd, session_code)
    n = bf.supa_upsert("f1_weather", rows, "season,round,session_type,time_seconds")
    print(f"  weather {season} R{rnd} {session_code}: {n} samples")
    return n


# ── overtakes (computed from per-lap position) ────────────────────────────────
def ingest_overtakes(season, rnd, session_code="R"):
    import pandas as pd
    s = _load(season, rnd, session_code, laps=True)
    laps = s.laps
    if laps is None or len(laps) == 0:
        print(f"  overtakes {season} R{rnd}: no laps")
        return 0
    abbr2id = _abbr_to_id(s)

    # position[lap][driver_abbr] = position (int); pit_laps = (lap, driver) that
    # are pit in/out laps — their position swaps are pit-cycle artifacts, not
    # on-track overtakes, so exclude any pair touching one.
    by_lap = {}
    pit_laps = set()
    for _, lap in laps.iterrows():
        ln = bf.to_int(lap.get("LapNumber"))
        pos = lap.get("Position")
        drv = lap.get("Driver")
        if ln is None or drv is None or pd.isna(pos):
            continue
        by_lap.setdefault(ln, {})[str(drv)] = int(pos)
        if pd.notna(lap.get("PitInTime")) or pd.notna(lap.get("PitOutTime")):
            pit_laps.add((ln, str(drv)))

    def pitted(lap_a, lap_b, drv):
        return (lap_a, drv) in pit_laps or (lap_b, drv) in pit_laps

    rows = []
    laps_sorted = sorted(by_lap)
    for i in range(1, len(laps_sorted)):
        ln, prev_ln = laps_sorted[i], laps_sorted[i - 1]
        now, prev = by_lap[ln], by_lap[prev_ln]
        for a in now:
            # A on an out-lap gains many places from the pit cycle, not on track.
            if a not in prev or pitted(ln, prev_ln, a):
                continue
            for b in now:
                if a == b or b not in prev:
                    continue
                # B dropping because B pitted isn't A passing B on track.
                if pitted(ln, prev_ln, b):
                    continue
                # A was behind B last lap, ahead this lap -> A overtook B
                if prev[a] > prev[b] and now[a] < now[b]:
                    rows.append({
                        "season": season, "round": rnd, "session_type": session_code,
                        "lap_number": ln,
                        "overtaking_driver_id": abbr2id.get(a, a),
                        "overtaken_driver_id": abbr2id.get(b, b),
                        "position": now[a],
                        "source": "fastf1",
                    })
    _purge("f1_overtake", season, rnd, session_code)
    n = bf.supa_upsert(
        "f1_overtake", rows,
        "season,round,session_type,lap_number,overtaking_driver_id,overtaken_driver_id")
    print(f"  overtakes {season} R{rnd}: {n} events")
    return n


# ── race control ──────────────────────────────────────────────────────────────
def ingest_race_control(season, rnd, session_code="R"):
    import pandas as pd
    s = _load(season, rnd, session_code, messages=True)
    rc = getattr(s, "race_control_messages", None)
    if rc is None or len(rc) == 0:
        print(f"  race_control {season} R{rnd} {session_code}: none")
        return 0
    rows = []
    for _, m in rc.iterrows():
        t = m.get("Time")
        rows.append({
            "season": season, "round": rnd, "session_type": session_code,
            "time_utc": t.isoformat() if pd.notna(t) else None,
            "lap_number": bf.to_int(m.get("Lap")),
            "category": _s(m.get("Category")),
            "message": _s(m.get("Message")),
            "flag": _s(m.get("Flag")),
            "scope": _s(m.get("Scope")),
            "sector": bf.to_int(m.get("Sector")),
            "driver_number": bf.to_int(m.get("RacingNumber")),
            "source": "fastf1",
        })
    _purge("f1_race_control", season, rnd, session_code)
    n = bf.supa_upsert("f1_race_control", rows, "season,round,session_type,time_utc,message")
    print(f"  race_control {season} R{rnd} {session_code}: {n} messages")
    return n


def _num(v):
    import pandas as pd
    try:
        return round(float(v), 3) if pd.notna(v) else None
    except (TypeError, ValueError):
        return None


def _s(v):
    import pandas as pd
    if v is None or (not isinstance(v, str) and pd.isna(v)):
        return None
    s = str(v).strip()
    return s or None


def main():
    ap = argparse.ArgumentParser(description="FastF1-native enrichment ingest.")
    ap.add_argument("--season", type=int, required=True)
    ap.add_argument("--round", type=int, required=True)
    ap.add_argument("--session", default="R")
    ap.add_argument("--domains", default="all",
                    help="comma subset of: " + ",".join(ENRICH_DOMAINS))
    ap.add_argument("--no-upload", action="store_true")
    args = ap.parse_args()

    bf.DRY_RUN = args.no_upload
    if not bf.DRY_RUN:
        bf._env()

    domains = ENRICH_DOMAINS if args.domains == "all" else \
        [d.strip() for d in args.domains.split(",") if d.strip()]

    print(f"FastF1 enrichment {args.season} R{args.round} {args.session} -> {domains}")
    if "weather" in domains:
        try:
            ingest_weather(args.season, args.round, args.session)
        except Exception as e:  # noqa: BLE001
            print(f"  ! weather failed: {e}")
    if "overtakes" in domains and args.session == "R":
        try:
            ingest_overtakes(args.season, args.round, args.session)
        except Exception as e:  # noqa: BLE001
            print(f"  ! overtakes failed: {e}")
    if "race_control" in domains:
        try:
            ingest_race_control(args.season, args.round, args.session)
        except Exception as e:  # noqa: BLE001
            print(f"  ! race_control failed: {e}")


if __name__ == "__main__":
    main()
