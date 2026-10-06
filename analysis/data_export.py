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
  data/{season}/{round}/pitstops.json       <- get_pitstops(p_season, p_round)
  data/{season}/{round}/laps.json           <- get_laps(p_season, p_round)

The frontend fetches these first and falls through to the RPC on a 404, so a file is
written only when the RPC returns non-empty data (a round with no results yet gets no
file, and the browser keeps hitting the RPC for it — which is exactly today's behaviour).
Files are re-written on every run (idempotent): provisional results and standings are
refreshed as the warehouse changes, and a short Cache-Control keeps browsers/CDN from
pinning a stale copy for more than a few minutes.

SOURCES
-------
The warehouse RPCs are the default source. Jolpica (the Ergast successor) serves the same
Ergast shape, so `--source jolpica` can publish these files with no database at all, and
the default `--source auto` switches to it the moment the RPCs are unavailable — which is
what keeps new rounds appearing while the Supabase project is restricted (402 on a
Free-plan quota breach) or paused.

Jolpica FILLS GAPS ONLY: it never overwrites a file the warehouse already published.
That is not caution for its own sake — the two sources genuinely disagree. Their per-race
points differ (Gasly is on 50 in the warehouse and 41 on Jolpica after round 13), and the
warehouse figures are the ones consistent with its own f1_race_result rows AND with every
Deep Dive chart, replay and telemetry blob, all generated from the same FastF1 data.
Mixing the two would leave a round's charts disagreeing with its own standings table.
Jolpica's 2026 calendar is also poorer: it drops two sprint weekends and carries a
garbled round-16 name. So the fallback publishes a round the warehouse never got to, and
leaves everything else exactly as it was. Pass --overwrite to override that.

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
JOLPICA_PAUSE = 0.6   # polite inter-request delay (Jolpica rate-limits a bulk backfill)
JOLPICA_TRIES = 6


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
def jolpica(path, limit=100, offset=None):
    """GET a Jolpica document (path WITHOUT .json). None on 404 / persistent failure."""
    url = f"{JOLPICA_BASE}/f1/{path}.json"
    params = {"limit": limit}
    if offset:
        params["offset"] = offset
    last = None
    for attempt in range(JOLPICA_TRIES):
        try:
            r = requests.get(url, params=params, timeout=30)
            if r.status_code == 404:
                return None
            if r.status_code == 429 or r.status_code >= 500:
                # A bulk backfill trips Jolpica's sustained rate limit (a full season of
                # laps is ~250 requests). 1.5 s was far too impatient: a whole season
                # silently came back empty. Honour Retry-After, else back off hard.
                wait = float(r.headers.get("Retry-After") or 0) or min(5 * 3 ** attempt, 120)
                last = f"HTTP {r.status_code}"
                print(f"  (jolpica {path}: {last}, waiting {wait:.0f}s)")
                time.sleep(wait)
                continue
            r.raise_for_status()
            time.sleep(JOLPICA_PAUSE)
            return r.json()
        except requests.RequestException as e:
            last = str(e)
            time.sleep(min(5 * 3 ** attempt, 120))
    print(f"  (jolpica {path}: giving up after {JOLPICA_TRIES} tries — {last})")
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


def _race_table(doc):
    """Jolpica's whole RaceTable — get_pitstops returns this shape, not a bare race."""
    table = (doc or {}).get("MRData", {}).get("RaceTable")
    return table if (table or {}).get("Races") else None


def jolpica_laps(season, rnd):
    """Every lap timing for a round, reassembled: Jolpica caps a page at 100 timings.

    Returns get_laps()'s shape — {"Races": [race]} with race["Laps"] complete — or None.
    """
    merged, header, offset = {}, None, 0
    while True:
        doc = jolpica(f"{season}/{rnd}/laps", limit=100, offset=offset)
        races = ((doc or {}).get("MRData", {}).get("RaceTable") or {}).get("Races")
        if not races:
            break
        race = races[0]
        if header is None:
            header = {k: v for k, v in race.items() if k != "Laps"}
        for lap in race.get("Laps") or []:
            merged.setdefault(lap["number"], []).extend(lap.get("Timings") or [])
        total = int((doc.get("MRData") or {}).get("total") or 0)
        offset += 100
        if offset >= total:
            break
    if not merged:
        return None
    header["Laps"] = [{"number": n, "Timings": merged[n]}
                      for n in sorted(merged, key=lambda x: int(x))]
    return {"Races": [header]}


def derive_standings(season, rounds):
    """(driver_rows, constructor_rows) summed from the round files we actually publish.

    Standings are the one export that MUST change after every race, so the gap-fill rule
    that protects results is wrong for them: after round 14 the site showed the new race
    result beside a championship table still frozen on round 13.

    Taking Jolpica's standings instead would import its historical points, which disagree
    with ours (Gasly 50 vs 41 after round 13) and with every chart we have rendered. So
    add up our own published rounds: the table then always reconciles with the results
    pages next to it, whatever the mix of warehouse and Jolpica rounds behind them.
    """
    drivers, teams = {}, {}
    for rnd in rounds:
        for fname, key in (("results.json", "Results"), ("sprint.json", "SprintResults")):
            doc = index_export._get_json("data", f"{season}/{rnd}/{fname}")
            rows = (doc or {}).get(key) or []
            for row in rows:
                drv, con = row.get("Driver") or {}, row.get("Constructor") or {}
                did, cid = drv.get("driverId"), con.get("constructorId")
                if not did:
                    continue
                pts = float(row.get("points") or 0)
                # Ergast counts RACE wins only, not sprint wins.
                won = 1 if (key == "Results" and str(row.get("position")) == "1") else 0
                d = drivers.setdefault(did, {"Driver": drv, "Constructors": [], "points": 0.0, "wins": 0})
                d["Driver"], d["points"], d["wins"] = drv, d["points"] + pts, d["wins"] + won
                if con and con not in d["Constructors"]:
                    # Ergast lists every team a driver raced for, current one last.
                    d["Constructors"] = [c for c in d["Constructors"] if c.get("constructorId") != cid] + [con]
                if cid:
                    t = teams.setdefault(cid, {"Constructor": con, "points": 0.0, "wins": 0})
                    t["Constructor"], t["points"], t["wins"] = con, t["points"] + pts, t["wins"] + won

    def rank(items, key_name):
        out = []
        for i, (_, v) in enumerate(sorted(items, key=lambda kv: (-kv[1]["points"], -kv[1]["wins"])), 1):
            row = {"position": str(i), "positionText": str(i),
                   "points": f"{v['points']:.1f}", "wins": str(v["wins"])}
            row[key_name] = v[key_name]
            if key_name == "Driver":
                row["Constructors"] = v["Constructors"]
            out.append(row)
        return out

    return rank(drivers.items(), "Driver"), rank(teams.items(), "Constructor")


def _standings(field):
    def unwrap(doc):
        lists = _mrdata(doc, "StandingsTable", "StandingsLists")
        return (lists[0].get(field) if lists else None) or []
    return unwrap


def fetch(source, rpc_name, rpc_params, jol_path, unwrap, jolpica_fn=None):
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
    return jolpica_fn() if jolpica_fn else unwrap(jolpica(jol_path))


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


# Constructor display names differ too: the warehouse says "Red Bull Racing" /
# "Racing Bulls" / "Alpine" where Jolpica says "Red Bull" / "RB F1 Team" /
# "Alpine F1 Team". constructorId matches, so only the label drifts — but a
# Jolpica-sourced round rendered next to a warehouse-sourced one shows two different
# names for the same team. Carry the canonical labels over and rewrite them on the way
# out, which also keeps the map intact for the next run.
CONSTRUCTOR_NAMES = {}
OVERWRITE = False


def load_constructor_names(season):
    out = {}
    for row in index_export._get_json("data", f"{season}/constructorStandings.json") or []:
        c = (row or {}).get("Constructor") or {}
        if c.get("constructorId") and c.get("name"):
            out[c["constructorId"]] = c["name"]
    if out:
        print(f"  constructor labels: {len(out)} carried over from the previous export")
    return out


def apply_constructor_names(node):
    """Rewrite every Constructor label in a payload to the canonical one, in place."""
    if not CONSTRUCTOR_NAMES:
        return node
    if isinstance(node, list):
        for item in node:
            apply_constructor_names(item)
    elif isinstance(node, dict):
        cid = node.get("constructorId")
        if cid and "name" in node and cid in CONSTRUCTOR_NAMES:
            node["name"] = CONSTRUCTOR_NAMES[cid]
        for value in node.values():
            if isinstance(value, (list, dict)):
                apply_constructor_names(value)
    return node


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


def exists_on_cdn(path):
    doc = index_export._get_json("data", path)
    # An absence marker is not real data: Jolpica gap-fill should still be allowed to
    # replace it if the round later turns out to have results after all.
    if isinstance(doc, dict) and doc.get("absent") is True:
        return False
    return doc is not None


def put_json(path, payload):
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    url = bs.put("data", path, body, "application/json", gzip_body=True,
                 cache_control=CACHE_CONTROL)
    print(f"  wrote {url}  ({len(body):,} B raw)")
    return url


# A round that has run but genuinely has no sprint (most of them) used to produce no
# sprint.json at all. The browser read that 404 as "not exported yet" and fell through to
# the database on EVERY page view — ~27k wasted RPCs a month, the single largest source of
# load on a project that had just been quota-restricted. Publishing an explicit marker
# turns the miss into an answer: "this round ran, there is no sprint, stop asking".
#
# Only written once the round's own results exist, so a race that simply has not happened
# yet still 404s and still falls through, which is correct — its data is coming.
ABSENT_MARKER = {"absent": True}


def write_absent(path, why):
    put_json(path, dict(ABSENT_MARKER, reason=why))


def _nested_rows(payload, key):
    """A RaceTable-shaped payload whose Races[0][key] has rows."""
    races = (payload or {}).get("Races") if isinstance(payload, dict) else None
    rows = races[0].get(key) if races else None
    return isinstance(rows, list) and len(rows) > 0


def export_extras(season, rnd, source):
    """pitstops.json + laps.json — RaceTable-shaped, so they need their own emptiness test."""
    wrote = 0
    for name, fname, key, fetcher in (
        ("get_pitstops", "pitstops.json", "PitStops",
         lambda: _race_table(jolpica(f"{season}/{rnd}/pitstops", limit=200))),
        ("get_laps", "laps.json", "Laps", lambda: jolpica_laps(season, rnd)),
    ):
        if ACTIVE_SOURCE == "jolpica" and not OVERWRITE and exists_on_cdn(f"{season}/{rnd}/{fname}"):
            print(f"  keep data/{season}/{rnd}/{fname} (warehouse copy — Jolpica fills gaps only)")
            continue
        payload = fetch(source, name, {"p_season": season, "p_round": rnd}, None, None,
                        jolpica_fn=fetcher)
        if not _nested_rows(payload, key):
            if exists_on_cdn(f"{season}/{rnd}/results.json"):
                write_absent(f"{season}/{rnd}/{fname}", f"no {key} for this round")
                wrote += 1
            else:
                print(f"  skip data/{season}/{rnd}/{fname} (round not run yet)")
            continue
        if ACTIVE_SOURCE == "jolpica":
            payload = apply_constructor_names(payload)
        put_json(f"{season}/{rnd}/{fname}", payload)
        wrote += 1
    return wrote


def export_round(season, rnd, source):
    wrote = 0
    # Seed from what is already published: in Jolpica gap-fill mode the loop `continue`s
    # past an existing results.json, so waiting to learn "the round ran" from this run's
    # own write would never fire and no absence marker would ever be written.
    round_has_run = exists_on_cdn(f"{season}/{rnd}/results.json")
    for name, fname, key, jol in (
        ("get_race_results", "results.json", "Results", "results"),
        ("get_qualifying", "qualifying.json", "QualifyingResults", "qualifying"),
        ("get_sprint", "sprint.json", "SprintResults", "sprint"),
    ):
        race = fetch(source, name, {"p_season": season, "p_round": rnd},
                     f"{season}/{rnd}/{jol}", _first_race)
        if ACTIVE_SOURCE == "jolpica":
            if not OVERWRITE and exists_on_cdn(f"{season}/{rnd}/{fname}"):
                print(f"  keep data/{season}/{rnd}/{fname} (warehouse copy — Jolpica fills gaps only)")
                continue
            race = apply_constructor_names(apply_circuit(race))
        if not has_rows(race, key):
            # results.json is first in the loop, so by the time we reach qualifying/sprint
            # we know whether the round has actually been run.
            if round_has_run:
                write_absent(f"{season}/{rnd}/{fname}", f"no {key} for this round")
                wrote += 1
            else:
                print(f"  skip data/{season}/{rnd}/{fname} (round not run yet)")
            continue
        if fname == "results.json":
            round_has_run = True
        put_json(f"{season}/{rnd}/{fname}", race)
        wrote += 1
    return wrote


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--season", type=int, default=datetime.now(timezone.utc).year)
    ap.add_argument("--round", type=int, default=None,
                    help="export only this round (season files are always written)")
    ap.add_argument("--overwrite", action="store_true",
                    help="let the Jolpica fallback replace files the warehouse published "
                         "(off by default — the two sources disagree on points)")
    ap.add_argument("--source", choices=("auto", "db", "jolpica"), default="auto",
                    help="auto (default): warehouse RPCs, falling back to Jolpica if they "
                         "are unavailable; db: RPCs only; jolpica: no database at all")
    args = ap.parse_args()
    season = args.season

    global ACTIVE_SOURCE
    ACTIVE_SOURCE = "jolpica" if args.source == "jolpica" else "db"
    print(f"data_export: season {season} -> {bs.public_base()}/data/{season}/  (source: {args.source})")

    # ── season-level files ────────────────────────────────────────────────────
    global CIRCUIT_BY_ROUND, CONSTRUCTOR_NAMES, OVERWRITE
    OVERWRITE = args.overwrite
    if args.source != "db":
        CIRCUIT_BY_ROUND = load_circuit_overrides(season)
        CONSTRUCTOR_NAMES = load_constructor_names(season)

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
        if ACTIVE_SOURCE == "jolpica":
            # Standings are re-derived, never gap-filled: see derive_standings(). Deferred
            # until the round list is known, below.
            continue
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

    if ACTIVE_SOURCE == "jolpica":
        # Every round the season has, not just the ones being exported this run — the
        # table is cumulative.
        all_rounds = sorted({int(r["round"]) for r in schedule
                             if isinstance(r, dict) and str(r.get("round", "")).isdigit()})
        drv_rows, con_rows = derive_standings(season, all_rounds)
        for rows, fname in ((drv_rows, "driverStandings.json"), (con_rows, "constructorStandings.json")):
            if is_empty(rows):
                print(f"  skip data/{season}/{fname} (no round results to sum)")
                continue
            print(f"  derived {fname} from {len(all_rounds)} published round(s)")
            put_json(f"{season}/{fname}", apply_constructor_names(rows))

    total = 0
    for rnd in rounds:
        print(f"round {rnd}:")
        total += export_round(season, rnd, args.source)
        total += export_extras(season, rnd, args.source)
    print(f"data_export: done — {total} round file(s) written across {len(rounds)} round(s) "
          f"[source: {ACTIVE_SOURCE}]")


if __name__ == "__main__":
    try:
        main()
    except WarehouseUnavailable as e:
        sys.exit(f"data_export: {e} (use --source auto or --source jolpica to publish anyway)")
