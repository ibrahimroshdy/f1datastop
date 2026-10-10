#!/usr/bin/env python3
"""Snapshot the warehouse serving RPCs as static JSON on the CDN (R2 `data/` prefix).

Why: every schedule / results / standings read used to be a Postgres RPC
(~100k calls a month for data that changes a few times per race weekend).
This snapshots EXACTLY what those RPCs return to `data/{season}/…` after every
ingest, so the browser reads a static file first (web/src/lib/cdnJson.ts) and
only falls back to the RPC on a miss (web/src/services/f1Warehouse.ts).

Layout (all under the `data/` prefix, short cache so fresh data shows fast):

  data/{season}/schedule.json
  data/{season}/{round}/results.json       (get_race_results)
  data/{season}/{round}/qualifying.json    (get_qualifying)
  data/{season}/{round}/sprint.json        (get_sprint, or {"absent": true})
  data/{season}/{round}/pitstops.json      (get_pitstops)
  data/{season}/{round}/laps.json          (get_laps)
  data/{season}/driverStandings.json       (get_driver_standings, latest)
  data/{season}/constructorStandings.json  (get_constructor_standings, latest)

Absence marker: a sprint file of {"absent": true} means "this round ran and
has no sprint" — the browser stops asking instead of querying Postgres on
every page view. A genuine 404 means "not exported yet, go ask". Other
domains publish nothing on an empty RPC (leave the 404) so the frontend
falls through to the proxy rather than serving an empty grid.

Usage:
  python data_export.py                      # seasons from --season or recent window
  python data_export.py --season 2026
  python data_export.py --season 2025 --season 2026 --round 12
  python data_export.py --season 2026 --domains schedule,results --dry-run
Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, R2_* / BLOB_PUBLIC_BASE (uploads).
Deps: stdlib + requests + boto3 only.
"""
import argparse
import datetime as dt
import json
import os
import sys

import requests as rq

import blob_store as bs

INDEX_CACHE = "public, max-age=300, stale-while-revalidate=3600"
HTTP_TIMEOUT = 30

ALL_DOMAINS = (
    "schedule", "results", "qualifying", "sprint",
    "pitstops", "laps", "driver_standings", "constructor_standings",
)
ROUND_DOMAINS = ("results", "qualifying", "sprint", "pitstops", "laps")

# RPC name + args builder per domain. Round domains take (season, round);
# season domains take (season,). Shapes mirror f1Warehouse.ts staticThenRpc().
_RPC = {
    "schedule": ("get_schedule", lambda s, r=None: {"p_season": s}),
    "results": ("get_race_results", lambda s, r: {"p_season": s, "p_round": r}),
    "qualifying": ("get_qualifying", lambda s, r: {"p_season": s, "p_round": r}),
    "sprint": ("get_sprint", lambda s, r: {"p_season": s, "p_round": r}),
    "pitstops": ("get_pitstops", lambda s, r: {"p_season": s, "p_round": r}),
    "laps": ("get_laps", lambda s, r: {"p_season": s, "p_round": r}),
    "driver_standings": ("get_driver_standings", lambda s, r=None: {"p_season": s, "p_round": None}),
    "constructor_standings": ("get_constructor_standings", lambda s, r=None: {"p_season": s, "p_round": None}),
}

# CDN path per domain. Round domains take (season, round); season ones (season,).
_PATH = {
    "schedule": lambda s, r=None: f"{s}/schedule.json",
    "results": lambda s, r: f"{s}/{r}/results.json",
    "qualifying": lambda s, r: f"{s}/{r}/qualifying.json",
    "sprint": lambda s, r: f"{s}/{r}/sprint.json",
    "pitstops": lambda s, r: f"{s}/{r}/pitstops.json",
    "laps": lambda s, r: f"{s}/{r}/laps.json",
    "driver_standings": lambda s, r=None: f"{s}/driverStandings.json",
    "constructor_standings": lambda s, r=None: f"{s}/constructorStandings.json",
}


def _env():
    try:
        url = os.environ["SUPABASE_URL"].rstrip("/")
        key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    except KeyError as e:
        raise SystemExit(f"data_export: missing env {e}. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.")
    return url, key


def rpc(fn, args):
    """Call a serving RPC via PostgREST; return the jsonb payload (may be None)."""
    url, key = _env()
    r = rq.post(
        f"{url}/rest/v1/rpc/{fn}",
        headers={"apikey": key, "Authorization": f"Bearer {key}",
                 "Content-Type": "application/json", "Accept": "application/json"},
        json=args,
        timeout=HTTP_TIMEOUT,
    )
    if r.status_code == 404:
        return None
    r.raise_for_status()
    try:
        return r.json()
    except ValueError:
        return None


def _is_empty(value):
    if value is None:
        return True
    if isinstance(value, list):
        return len(value) == 0
    if isinstance(value, dict):
        return len(value) == 0
    return False


def _is_absent_sprint(payload):
    """True when the sprint RPC says 'no sprint here' (empty SprintResults)."""
    if not isinstance(payload, dict):
        return False
    s = payload.get("SprintResults")
    return isinstance(s, list) and len(s) == 0


def _should_skip(domain, payload):
    """Decide publish / absence-marker / skip for an RPC payload.

    Returns (action, body) where action is 'put', 'absent' or 'skip'.
    Empty results/qualifying/pitstops/laps on a real round mean 'not ingested
    yet' — leave the 404 so the frontend falls through, never serve an empty
    grid. An empty sprint is a genuine answer (most rounds have none).
    """
    if payload is None or _is_empty(payload):
        if domain == "sprint":
            return "absent", {"absent": True}
        return "skip", None
    if domain == "sprint" and _is_absent_sprint(payload):
        return "absent", {"absent": True}
    if domain == "results":
        res = payload.get("Results") if isinstance(payload, dict) else None
        if isinstance(res, list) and len(res) == 0:
            return "skip", None
    if domain == "qualifying":
        q = payload.get("QualifyingResults") if isinstance(payload, dict) else None
        if isinstance(q, list) and len(q) == 0:
            return "skip", None
    if domain == "pitstops":
        races = payload.get("Races") if isinstance(payload, dict) else None
        pits = races[0].get("PitStops") if isinstance(races, list) and races else None
        if isinstance(pits, list) and len(pits) == 0:
            return "skip", None
    if domain == "laps":
        races = payload.get("Races") if isinstance(payload, dict) else None
        laps = races[0].get("Laps") if isinstance(races, list) and races else None
        if not isinstance(laps, list) or len(laps) == 0:
            return "skip", None
    return "put", payload


def _put(path, body):
    data = json.dumps(body, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    bs.put("data", path, data, "application/json", gzip_body=True, cache_control=INDEX_CACHE)
    return len(data)


def _rounds_of(schedule):
    rounds = []
    for race in schedule or []:
        try:
            rounds.append(int(race.get("round")))
        except (TypeError, ValueError, AttributeError):
            continue
    return sorted(set(rounds))


def export_season(season, domains, only_round=None, dry_run=False):
    print(f"== Season {season} ==")
    schedule = None
    if "schedule" in domains or True:
        # The schedule is always needed to enumerate rounds; publish it too
        # when the schedule domain is requested.
        try:
            fn, mk = _RPC["schedule"]
            schedule = rpc(fn, mk(season))
        except Exception as e:  # noqa: BLE001
            print(f"  schedule {season}: RPC failed ({e})")
            schedule = None
        if "schedule" in domains and not _is_empty(schedule):
            path = _PATH["schedule"](season)
            if dry_run:
                print(f"  [dry-run] put {path} ({len(schedule or [])} races)")
            else:
                n = _put(path, schedule)
                print(f"  put {path} ({n} bytes)")
    rounds = _rounds_of(schedule)
    if only_round is not None:
        rounds = [only_round]

    for domain in [d for d in ROUND_DOMAINS if d in domains]:
        fn, mk = _RPC[domain]
        for rnd in rounds:
            try:
                payload = rpc(fn, mk(season, rnd))
            except Exception as e:  # noqa: BLE001
                print(f"  {domain} {season} R{rnd}: RPC failed ({e})")
                continue
            action, body = _should_skip(domain, payload)
            path = _PATH[domain](season, rnd)
            if action == "skip":
                print(f"  skip {path} (empty — leaving 404 for fallback)")
            elif dry_run:
                print(f"  [dry-run] {action} {path}")
            else:
                n = _put(path, body)
                print(f"  {action} {path} ({n} bytes)")

    for domain in ("driver_standings", "constructor_standings"):
        if domain not in domains:
            continue
        fn, mk = _RPC[domain]
        try:
            payload = rpc(fn, mk(season))
        except Exception as e:  # noqa: BLE001
            print(f"  {domain} {season}: RPC failed ({e})")
            continue
        if _is_empty(payload):
            print(f"  skip {_PATH[domain](season)} (empty)")
            continue
        path = _PATH[domain](season)
        if dry_run:
            print(f"  [dry-run] put {path} ({len(payload)} rows)")
        else:
            n = _put(path, payload)
            print(f"  put {path} ({n} bytes)")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    cur = dt.datetime.now(dt.timezone.utc).year
    ap.add_argument("--season", type=int, action="append",
                    help="season(s); default: current year")
    ap.add_argument("--round", type=int, help="single round (requires --season)")
    ap.add_argument("--domains", default="all",
                    help="comma-separated subset of: " + ",".join(ALL_DOMAINS))
    ap.add_argument("--dry-run", action="store_true",
                    help="fetch + print actions, do not upload to R2")
    a = ap.parse_args()

    if a.domains == "all":
        domains = set(ALL_DOMAINS)
    else:
        domains = {d.strip() for d in a.domains.split(",") if d.strip()}
        unknown = domains - set(ALL_DOMAINS)
        if unknown:
            raise SystemExit(f"Unknown domains: {', '.join(sorted(unknown))}")

    if not a.dry_run:
        _env()  # fail fast if Supabase env missing
        bs.bucket()  # fail fast if R2 env missing (raises SystemExit)

    seasons = a.season or [cur]
    if a.round is not None and len(seasons) != 1:
        raise SystemExit("--round requires exactly one --season")
    for s in seasons:
        export_season(s, domains, only_round=a.round, dry_run=a.dry_run)
    print("data_export: done")


if __name__ == "__main__":
    sys.exit(main())
