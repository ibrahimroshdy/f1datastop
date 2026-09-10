#!/usr/bin/env python3
"""Which (round, session) pairs need Deep Dive charts right now? — the Actions gate.

The chart workflow used to load every session of two rounds through FastF1 on every cron
tick (16 heavy loads, ~45 min) even when nothing new had happened, which is what burned
5,000 Actions minutes in a month. This runs BEFORE the Python/FastF1 setup (stdlib only,
~10 s) and prints one `round session` per line for sessions that:
  1. have finished — f1_session.date_start + grace (date_end isn't populated), and
  2. have no published charts yet — no dark landscape analysis_charts row with a
     thumbnail for that session (thumb_path is the "rendered by the current pipeline"
     marker, so pre-thumbnail history gets picked up once).
An empty result means the job should exit immediately. Reads the CDN schedule and the
CDN chart index (no database); SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are only the
fallback when the CDN is unreachable. Args: --season, --grace-hours (default 3), --window-days (7).
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

import cdn_schedule
from datetime import datetime, timedelta, timezone

TIMED = ("FP1", "FP2", "FP3", "Q", "SQ", "SS", "S", "R")
SOCIAL = ("_twitter", "_instagram", "_story")


def get(url, key, table, params):
    q = urllib.parse.urlencode(params)
    req = urllib.request.Request(f"{url}/rest/v1/{table}?{q}",
                                 headers={"apikey": key, "Authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def _finished_sessions(season, grace_hours, window_days):
    """[(round, session)] that ended within the window — CDN schedule, Supabase fallback."""
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=window_days)
    try:
        rows = [(r, c, st) for r, c, st in cdn_schedule.sessions(season) if st >= since]
        source = "cdn"
    except Exception as e:  # noqa: BLE001 — CDN file missing: fall back to the warehouse
        print(f"(schedule: CDN unavailable ({e}); using Supabase)", file=sys.stderr)
        url = os.environ["SUPABASE_URL"].rstrip("/")
        key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        rows = []
        for s in get(url, key, "f1_session", {
                "select": "round,session_type,date_start", "season": f"eq.{season}",
                "date_start": f"gte.{since.isoformat()}", "order": "date_start.asc", "limit": "200"}):
            if s.get("date_start"):
                rows.append((int(s["round"]), s["session_type"],
                             datetime.fromisoformat(s["date_start"].replace("Z", "+00:00"))))
        source = "supabase"
    ended = [(r, c) for r, c, st in rows if c in TIMED and now >= st + timedelta(hours=grace_hours)]
    return ended, source


def _has_charts(season, rnd, session):
    """True when the CDN chart index for the session has a dark landscape row with a thumb."""
    try:
        rows = cdn_schedule.fetch_json(f"index/charts/{season}/{rnd:02d}/{session}.json")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return False
        raise
    return any(r.get("theme", "dark") == "dark" and r.get("thumb_path")
               and not any(t in r.get("chart_type", "") for t in SOCIAL) for r in rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", type=int, default=datetime.now(timezone.utc).year)
    ap.add_argument("--grace-hours", type=float, default=3.0,
                    help="a session counts as finished this long after date_start")
    ap.add_argument("--window-days", type=int, default=7,
                    help="only look at sessions that started within this many days")
    a = ap.parse_args()

    ended, source = _finished_sessions(a.season, a.grace_hours, a.window_days)
    if not ended:
        return 0

    # "Done" = the CDN index (index_export.py, rebuilt from R2 after every render) lists a
    # dark landscape chart with a thumbnail. No database involved; the old analysis_charts
    # query only runs if the CDN itself is unreachable.
    try:
        done = {(r, sess) for r, sess in ended if _has_charts(a.season, r, sess)}
    except Exception as e:  # noqa: BLE001
        print(f"(chart index: CDN unavailable ({e}); using Supabase)", file=sys.stderr)
        url = os.environ["SUPABASE_URL"].rstrip("/")
        key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        rounds = sorted({r for r, _ in ended})
        have = get(url, key, "analysis_charts", {
            "select": "round,session,chart_type", "season": f"eq.{a.season}",
            "round": f"in.({','.join(map(str, rounds))})", "theme": "eq.dark",
            "thumb_path": "not.is.null", "limit": "5000"})
        done = {(int(h["round"]), h["session"]) for h in have
                if not any(t in h["chart_type"] for t in SOCIAL)}
    for r, sess in ended:
        if (r, sess) not in done:
            print(f"{r} {sess}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
