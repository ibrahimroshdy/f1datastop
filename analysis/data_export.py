#!/usr/bin/env python3
"""Export season data from the warehouse RPCs to static JSON on R2.

The frontend's warehouse adapter (web/src/services/f1Warehouse.ts) used to call a Supabase
RPC for every schedule / results / standings read — roughly 100k Postgres RPC calls a
month for data that only changes a handful of times per race weekend. This script calls
the same RPCs ONCE (after each ingest) and stores what they return, byte-for-byte, as
gzip-compressed JSON on R2:

  data/{season}/schedule.json               <- get_schedule(p_season)
  data/{season}/driverStandings.json        <- get_driver_standings(p_season)   (latest)
  data/{season}/constructorStandings.json   <- get_constructor_standings(p_season)
  data/{season}/{round}/results.json        <- get_race_results(p_season, p_round)
  data/{season}/{round}/qualifying.json     <- get_qualifying(p_season, p_round)
  data/{season}/{round}/sprint.json         <- get_sprint(p_season, p_round)

The frontend fetches these first and falls through to the RPC on a 404, so a file is
written only when the RPC returns non-empty data (a round with no results yet gets no
file, and the browser keeps hitting the RPC for it — which is exactly today's behaviour).
Files are re-written on every run (idempotent): provisional results and standings are
refreshed as the warehouse changes, and a short Cache-Control keeps browsers/CDN from
pinning a stale copy for more than a few minutes.

Usage:
  python data_export.py --season 2026            # season files + every round with data
  python data_export.py --season 2026 --round 5  # season files + just round 5

Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (PostgREST) + the R2_* / BLOB_PUBLIC_BASE set
documented in analysis/blob_store.py.
"""
import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone

import requests

import blob_store as bs

# Short-lived: these objects change after every session, unlike the immutable chart /
# telemetry blobs. 5 min fresh, then serve-stale-while-revalidating for an hour.
CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=3600"


def _sb():
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not (url and key):
        sys.exit("data_export: missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY")
    return url, key


def rpc(name, params, retries=3):
    """POST /rest/v1/rpc/<name> and return the decoded jsonb payload."""
    url, key = _sb()
    headers = {"apikey": key, "Authorization": f"Bearer {key}",
               "Content-Type": "application/json"}
    last = None
    for attempt in range(retries):
        try:
            r = requests.post(f"{url}/rest/v1/rpc/{name}", headers=headers,
                              json=params, timeout=60)
            if r.status_code in (429, 502, 503, 504):
                last = f"HTTP {r.status_code}"
                time.sleep(2 ** attempt)
                continue
            r.raise_for_status()
            return r.json()
        except requests.RequestException as e:
            last = str(e)
            time.sleep(2 ** attempt)
    raise SystemExit(f"data_export: rpc {name} {params} failed: {last}")


def is_empty(value):
    """Mirror f1Warehouse.ts isEmpty(): null / [] / {} are a MISS."""
    if value is None:
        return True
    if isinstance(value, (list, dict)):
        return len(value) == 0
    return False


def has_rows(race, key):
    """A race header whose Results[]/QualifyingResults[]/SprintResults[] is empty means the
    round exists but isn't ingested — the frontend treats that as a miss, so don't publish."""
    if is_empty(race):
        return False
    rows = race.get(key) if isinstance(race, dict) else None
    return isinstance(rows, list) and len(rows) > 0


def put_json(path, payload):
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    url = bs.put("data", path, body, "application/json", gzip_body=True,
                 cache_control=CACHE_CONTROL)
    print(f"  wrote {url}  ({len(body):,} B raw)")
    return url


def export_round(season, rnd):
    wrote = 0
    for name, fname, key in (
        ("get_race_results", "results.json", "Results"),
        ("get_qualifying", "qualifying.json", "QualifyingResults"),
        ("get_sprint", "sprint.json", "SprintResults"),
    ):
        race = rpc(name, {"p_season": season, "p_round": rnd})
        if not has_rows(race, key):
            print(f"  skip data/{season}/{rnd}/{fname} (no {key})")
            continue
        put_json(f"{season}/{rnd}/{fname}", race)
        wrote += 1
    return wrote


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--season", type=int, default=datetime.now(timezone.utc).year)
    ap.add_argument("--round", type=int, default=None,
                    help="export only this round (season files are always written)")
    args = ap.parse_args()
    season = args.season

    print(f"data_export: season {season} -> {bs.public_base()}/data/{season}/")

    # ── season-level files ────────────────────────────────────────────────────
    schedule = rpc("get_schedule", {"p_season": season})
    if is_empty(schedule):
        sys.exit(f"data_export: get_schedule({season}) returned nothing — is the season ingested?")
    put_json(f"{season}/schedule.json", schedule)

    for name, fname in (("get_driver_standings", "driverStandings.json"),
                        ("get_constructor_standings", "constructorStandings.json")):
        rows = rpc(name, {"p_season": season, "p_round": None})
        if is_empty(rows):
            print(f"  skip data/{season}/{fname} (empty)")
            continue
        put_json(f"{season}/{fname}", rows)

    # ── per-round files ───────────────────────────────────────────────────────
    if args.round is not None:
        rounds = [args.round]
    else:
        rounds = sorted({int(r["round"]) for r in schedule if isinstance(r, dict) and "round" in r})

    total = 0
    for rnd in rounds:
        print(f"round {rnd}:")
        total += export_round(season, rnd)
    print(f"data_export: done — {total} round file(s) written across {len(rounds)} round(s)")


if __name__ == "__main__":
    main()
