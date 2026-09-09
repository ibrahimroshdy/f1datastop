#!/usr/bin/env python3
"""Actions gate for the race-day reconcile: is there anything worth ingesting right now?

The 30-minute weekend cron exists to pick up a session's results minutes after the flag.
Outside that window each tick still paid ~2 min of Python/FastF1 setup to then skip every
round — 60 ticks a weekend. This stdlib check (~5 s, before setup) says "yes" only when a
timed session started within the last --hours (default 8: covers a session finishing and
Ergast publishing) — the 6-hourly baseline run is unconditional and catches anything late.
Prints `run` or `skip`. Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
"""
import argparse
import json
import os
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

TIMED = ("FP1", "FP2", "FP3", "Q", "SQ", "SS", "S", "R")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", type=int, default=datetime.now(timezone.utc).year)
    ap.add_argument("--hours", type=float, default=8.0)
    a = ap.parse_args()
    url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    now = datetime.now(timezone.utc)
    since = (now - timedelta(hours=a.hours)).isoformat()
    q = urllib.parse.urlencode({"select": "round,session_type,date_start", "season": f"eq.{a.season}",
                                "date_start": f"gte.{since}", "limit": "50"})
    req = urllib.request.Request(f"{url}/rest/v1/f1_session?{q}",
                                 headers={"apikey": key, "Authorization": f"Bearer {key}"})
    rows = json.load(urllib.request.urlopen(req, timeout=30))
    live = [r for r in rows if r.get("session_type") in TIMED
            and datetime.fromisoformat(r["date_start"].replace("Z", "+00:00")) <= now]
    print("run" if live else "skip")
    for r in live:
        print(f"  R{r['round']} {r['session_type']} started {r['date_start']}")


if __name__ == "__main__":
    main()
