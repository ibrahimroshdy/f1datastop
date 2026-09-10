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

SOURCES
-------
The warehouse RPCs are the default source, but the payloads are Ergast-shaped and Jolpica
(the Ergast successor the warehouse itself is built from) serves the identical shape. So
`--source jolpica` produces the same files with no database at all, and the default
`--source auto` falls back to it the moment the RPCs are unavailable — which is what keeps
the site current while the Supabase project is restricted (402 on a Free-plan quota
breach) or paused. Jolpica adds a `url` field on Driver/Constructor that the RPCs omit;
it is inert extra data the frontend ignores.

Usage:
  python data_export.py --season 2026            # season files + every round with data
  python data_export.py --season 2026 --round 5  # season files + just round 5
  python data_export.py --season 2026 --source jolpica   # skip the warehouse entirely

Env: R2_* / BLOB_PUBLIC_BASE (see analysis/blob_store.py). SUPABASE_URL and
SUPABASE_SERVICE_ROLE_KEY are needed only for the `db` / `auto` sources; JOLPICA_BASE
overrides the Jolpica endpoint.
"""
import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone

import requests

import blob_store as bs
import index_export

# Short-lived: these objects change after every session, unlike the immutable chart /
# telemetry blobs. 5 min fresh, then serve-stale-while-revalidating for an hour.
CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=3600"


JOLPICA_BASE = os.environ.get("JOLPICA_BASE", "https://api.jolpi.ca/ergast").rstrip("/")
JOLPICA_PAUSE = 0.35  # polite inter-request delay


class WarehouseUnavailable(RuntimeError):
    """The serving RPCs can't be reached (missing creds, 402 restriction, network)."""


def _sb():
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not (url and key):
        raise WarehouseUnavailable("missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY")
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
            if r.status_code == 402:
                # Free-plan quota breach: the whole project is restricted. Retrying is
                # pointless — surface it so `auto` can switch to Jolpica immediately.
                raise WarehouseUnavailable(f"project restricted (402) on rpc {name}")
            if r.status_code in (429, 502, 503, 504):
                last = f"HTTP {r.status_code}"
                time.sleep(2 ** attempt)
                continue
            r.raise_for_status()
            return r.json()
        except requests.RequestException as e:
            last = str(e)
            time.sleep(2 ** attempt)
    raise WarehouseUnavailable(f"rpc {name} {params} failed: {last}")


# ── Jolpica source — same Ergast shape, no database ───────────────────────────
def jolpica(path, limit=100):
    """GET a Jolpica document (path WITHOUT .json). None on 404 / persistent failure."""
    url = f"{JOLPICA_BASE}/f1/{path}.json"
    last = None
    for attempt in range(4):
        try:
            r = requests.get(url, params={"limit": limit}, timeout=30)
            if r.status_code == 404:
                return None
            if r.status_code == 429 or r.status_code >= 500:
                last = f"HTTP {r.status_code}"
                time.sleep(1.5 * (attempt + 1))
                continue
            r.raise_for_status()
            time.sleep(JOLPICA_PAUSE)
            return r.json()
        except requests.RequestException as e:
            last = str(e)
            time.sleep(1.5 * (attempt + 1))
    print(f"  (jolpica {path}: {last})")
    return None


def _mrdata(doc, *path):
    """Walk MRData.<path...>, returning None if any hop is missing."""
    node = (doc or {}).get("MRData")
    for key in path:
        if node is None:
            return None
        node = node[key] if isinstance(node, list) else node.get(key)
    return node


# Each logical export: (RPC name, RPC params builder, Jolpica path builder, unwrapper).
def _races(doc):
    return _mrdata(doc, "RaceTable", "Races")


def _first_race(doc):
    races = _races(doc)
    return races[0] if races else None


def _standings(field):
    def unwrap(doc):
        lists = _mrdata(doc, "StandingsTable", "StandingsLists")
        return (lists[0].get(field) if lists else None) or []
    return unwrap


def fetch(source, rpc_name, rpc_params, jol_path, unwrap):
    """One logical read, honouring the selected source. Returns the payload or None.

    In `auto`, the first warehouse failure flips the whole run to Jolpica — a restricted
    project answers 402 on every request, so re-trying per file just wastes time.
    """
    global ACTIVE_SOURCE
    if ACTIVE_SOURCE == "db":
        try:
            return rpc(rpc_name, rpc_params)
        except WarehouseUnavailable as e:
            if source != "auto":
                raise
            print(f"  warehouse unavailable ({e}) — falling back to Jolpica for this run")
            ACTIVE_SOURCE = "jolpica"
    return unwrap(jolpica(jol_path))


ACTIVE_SOURCE = "db"

# ── circuit identity ─────────────────────────────────────────────────────────
# Jolpica and the warehouse disagree on circuit identity: Jolpica calls round 1
# "albert_park"/"Albert Park Grand Prix Circuit", the warehouse "melbourne"/"Melbourne".
# circuitId is a JOIN KEY — /circuits/:circuitId routes, circuit-history lookups and the
# R2 circuit-geometry / replay indexes are all keyed on the warehouse value — so a
# Jolpica-sourced export must not change it. The circuit for a round never changes, so
# carry the whole Circuit object over from the last good export.
CIRCUIT_BY_ROUND = {}


def load_circuit_overrides(season):
    """{round: Circuit} from the previous schedule.json, else circuitId from the R2 indexes."""
    out = {}
    prev = index_export._get_json("data", f"{season}/schedule.json")
    for race in prev or []:
        if isinstance(race, dict) and race.get("round") and race.get("Circuit"):
            out[int(race["round"])] = race["Circuit"]
    if out:
        print(f"  circuit identity: {len(out)} round(s) carried over from the previous export")
        return out
    for kind in ("circuits", "replays"):
        for row in index_export._get_json("data", f"index/{kind}/{season}.json") or []:
            rnd, cid = row.get("round"), row.get("circuit_id")
            if rnd and cid and int(rnd) not in out:
                out[int(rnd)] = {"circuitId": cid, "circuitName": row.get("circuit_name")}
    if out:
        print(f"  circuit identity: {len(out)} round(s) from the R2 asset indexes")
    else:
        print("  circuit identity: no prior data — using Jolpica's own circuit ids")
    return out


def apply_circuit(race):
    """Replace a Jolpica race's Circuit with the warehouse-identity one, if we have it."""
    if not (isinstance(race, dict) and CIRCUIT_BY_ROUND):
        return race
    circ = CIRCUIT_BY_ROUND.get(int(race.get("round") or 0))
    if circ:
        race["Circuit"] = circ
    return race


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


def export_round(season, rnd, source):
    wrote = 0
    for name, fname, key, jol in (
        ("get_race_results", "results.json", "Results", "results"),
        ("get_qualifying", "qualifying.json", "QualifyingResults", "qualifying"),
        ("get_sprint", "sprint.json", "SprintResults", "sprint"),
    ):
        race = fetch(source, name, {"p_season": season, "p_round": rnd},
                     f"{season}/{rnd}/{jol}", _first_race)
        if ACTIVE_SOURCE == "jolpica":
            race = apply_circuit(race)
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
    ap.add_argument("--source", choices=("auto", "db", "jolpica"), default="auto",
                    help="auto (default): warehouse RPCs, falling back to Jolpica if they "
                         "are unavailable; db: RPCs only; jolpica: no database at all")
    args = ap.parse_args()
    season = args.season

    global ACTIVE_SOURCE
    ACTIVE_SOURCE = "jolpica" if args.source == "jolpica" else "db"
    print(f"data_export: season {season} -> {bs.public_base()}/data/{season}/  (source: {args.source})")

    # ── season-level files ────────────────────────────────────────────────────
    global CIRCUIT_BY_ROUND
    if args.source != "db":
        CIRCUIT_BY_ROUND = load_circuit_overrides(season)

    schedule = fetch(args.source, "get_schedule", {"p_season": season}, f"{season}", _races)
    if ACTIVE_SOURCE == "jolpica":
        # The warehouse schedule comes from FastF1 and is strictly richer than Jolpica's:
        # Jolpica's 2026 calendar drops two sprint weekends and carries a garbled round-16
        # name. Session start times feed the Actions gates (analysis/cdn_schedule.py), so
        # never downgrade a schedule we already have — the calendar doesn't change during
        # an outage. Only publish Jolpica's if there is nothing to keep.
        prev = index_export._get_json("data", f"{season}/schedule.json")
        if prev:
            print(f"  schedule: keeping the existing export ({len(prev)} rounds) — "
                  f"richer than Jolpica's ({len(schedule or [])})")
            schedule = prev
        else:
            schedule = [apply_circuit(r) for r in (schedule or [])]
    if is_empty(schedule):
        sys.exit(f"data_export: no schedule for {season} from source '{args.source}'")
    put_json(f"{season}/schedule.json", schedule)

    for name, fname, jol, field in (
            ("get_driver_standings", "driverStandings.json", "driverStandings", "DriverStandings"),
            ("get_constructor_standings", "constructorStandings.json", "constructorStandings", "ConstructorStandings")):
        rows = fetch(args.source, name, {"p_season": season, "p_round": None},
                     f"{season}/{jol}", _standings(field))
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
        total += export_round(season, rnd, args.source)
    print(f"data_export: done — {total} round file(s) written across {len(rounds)} round(s) "
          f"[source: {ACTIVE_SOURCE}]")


if __name__ == "__main__":
    try:
        main()
    except WarehouseUnavailable as e:
        sys.exit(f"data_export: {e} (use --source auto or --source jolpica to publish anyway)")
