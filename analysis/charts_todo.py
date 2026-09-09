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
An empty result means the job should exit immediately. Env: SUPABASE_URL,
SUPABASE_SERVICE_ROLE_KEY. Args: --season, --grace-hours (default 3), --window-days (7).
"""
import argparse
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

TIMED = ("FP1", "FP2", "FP3", "Q", "SQ", "SS", "S", "R")
SOCIAL = ("_twitter", "_instagram", "_story")


def get(url, key, table, params):
    q = urllib.parse.urlencode(params)
    req = urllib.request.Request(f"{url}/rest/v1/{table}?{q}",
                                 headers={"apikey": key, "Authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", type=int, default=datetime.now(timezone.utc).year)
    ap.add_argument("--grace-hours", type=float, default=3.0,
                    help="a session counts as finished this long after date_start")
    ap.add_argument("--window-days", type=int, default=7,
                    help="only look at sessions that started within this many days")
    a = ap.parse_args()
    url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    now = datetime.now(timezone.utc)
    since = (now - timedelta(days=a.window_days)).isoformat()

    sessions = get(url, key, "f1_session", {
        "select": "round,session_type,date_start", "season": f"eq.{a.season}",
        "date_start": f"gte.{since}", "order": "date_start.asc", "limit": "200"})
    ended = []
    for s in sessions:
        if s["session_type"] not in TIMED or not s.get("date_start"):
            continue
        start = datetime.fromisoformat(s["date_start"].replace("Z", "+00:00"))
        if now >= start + timedelta(hours=a.grace_hours):
            ended.append((int(s["round"]), s["session_type"]))
    if not ended:
        return 0

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
