#!/usr/bin/env python3
"""Export race weather to static JSON on R2 — the CDN copy of get_weather().

Weather was the last tab still served only by a Postgres RPC, so it went blank the moment
the Supabase project was restricted (402 on every request). Unlike results or pit stops it
has no Ergast/Jolpica equivalent: the samples come from FastF1's timing stream. This
re-derives them from the same source the warehouse ingest uses and publishes them next to
the other season files, so the tab works with no database at all.

  data/{season}/{round}/weather_{session}.json   <- get_weather(p_season, p_round, p_session)

Rows carry exactly the columns the RPC returns (see DbWeatherRow in
web/src/services/warehouseEnrichment.ts), so the frontend types are unchanged:
  time_seconds, air_temp, track_temp, humidity, pressure, wind_speed, wind_direction, rainfall

Only race sessions are exported by default — that is all the warehouse itself holds
(f1_weather is 100% session_type='R'), and it is what both consumers ask for.

Usage:
  python weather_export.py --season 2026                 # every round with a finished race
  python weather_export.py --season 2026 --round 13      # one round
  python weather_export.py --season 2026 --force         # re-export rounds already on R2
Env: R2_* / BLOB_PUBLIC_BASE (see blob_store.py). No Supabase credentials needed.
"""
import argparse
import json
import sys
from datetime import datetime, timezone

import blob_store as bs
import cdn_schedule

CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=3600"
BUCKET = "data"


def path_for(season, rnd, session_code):
    return f"{season}/{rnd}/weather_{session_code}.json"


def build_rows(season, rnd, session_code):
    """[DbWeatherRow] from FastF1, or [] when the session has no weather stream."""
    import pandas as pd

    import backfill as bf
    import ff1_ingest as ff1

    session = ff1._load(season, rnd, session_code, weather=True)
    wx = getattr(session, "weather_data", None)
    if wx is None or len(wx) == 0:
        return []
    rows = []
    for _, w in wx.iterrows():
        t = w.get("Time")
        rain = w.get("Rainfall")
        rows.append({
            "time_seconds": round(float(t.total_seconds()), 3) if pd.notna(t) else None,
            "air_temp": ff1._num(w.get("AirTemp")),
            "track_temp": ff1._num(w.get("TrackTemp")),
            "humidity": ff1._num(w.get("Humidity")),
            "pressure": ff1._num(w.get("Pressure")),
            "wind_speed": ff1._num(w.get("WindSpeed")),
            "wind_direction": bf.to_int(w.get("WindDirection")),
            "rainfall": bool(rain) if pd.notna(rain) else None,
        })
    return rows


def export_round(season, rnd, session_code="R", force=False):
    path = path_for(season, rnd, session_code)
    if not force and bs.exists(BUCKET, path):
        print(f"  {season} R{rnd} {session_code}: already exported, skip (--force to redo)")
        return 0
    try:
        rows = build_rows(season, rnd, session_code)
    except Exception as e:  # noqa: BLE001 — a session that never ran, or a bad load
        print(f"  {season} R{rnd} {session_code}: {type(e).__name__}: {e}; skip")
        return 0
    if not rows:
        print(f"  {season} R{rnd} {session_code}: no weather samples; skip")
        return 0
    body = json.dumps(rows, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    url = bs.put(BUCKET, path, body, "application/json",
                 gzip_body=True, cache_control=CACHE_CONTROL)
    print(f"  {season} R{rnd} {session_code}: {len(rows)} samples -> {url} ({len(body):,} B raw)")
    return 1


def finished_rounds(season):
    """Rounds whose race has already started, newest first, from the CDN schedule."""
    now = cdn_schedule.now_utc()
    try:
        return sorted({r for r, code, start in cdn_schedule.sessions(season)
                       if code == "R" and start <= now}, reverse=True)
    except Exception as e:  # noqa: BLE001
        print(f"  (CDN schedule for {season} unavailable: {e}; using FastF1's)")
    # FastF1 already ships the calendar and we load it anyway, so a season whose static
    # schedule hasn't been exported yet (anything before the CDN backfill) still works.
    try:
        import fastf1
        import pandas as pd
        sched = fastf1.get_event_schedule(season, include_testing=False)
        cutoff = pd.Timestamp.utcnow().tz_localize(None)
        return sorted({int(r["RoundNumber"]) for _, r in sched.iterrows()
                       if pd.notna(r.get("EventDate")) and r["EventDate"] <= cutoff},
                      reverse=True)
    except Exception as e:  # noqa: BLE001
        sys.exit(f"weather_export: can't resolve rounds for {season} ({e}); pass --round")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--season", type=int, default=datetime.now(timezone.utc).year)
    ap.add_argument("--round", type=int, default=None)
    ap.add_argument("--session", default="R", help="session code (default R — the only one "
                                                  "the warehouse holds weather for)")
    ap.add_argument("--force", action="store_true", help="re-export rounds already on R2")
    a = ap.parse_args()

    rounds = [a.round] if a.round is not None else finished_rounds(a.season)
    print(f"weather_export: season {a.season}, {len(rounds)} round(s) -> "
          f"{bs.public_base()}/data/{a.season}/")
    wrote = sum(export_round(a.season, r, a.session, a.force) for r in rounds)
    print(f"weather_export: done — {wrote} file(s) written")


if __name__ == "__main__":
    main()
