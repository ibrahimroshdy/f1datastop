#!/usr/bin/env python3
"""
FastF1 telemetry exporter for f1datastop.

Telemetry (speed/throttle/brake/gear/DRS/RPM + X-Y track position) is data that
Ergast and OpenF1 don't give us. It's high-frequency, so we DON'T dump raw points
into Postgres — instead each lap is decimated to a fixed sample count and written
as one compact JSON blob to Supabase Storage (bucket `telemetry`), with a small
discovery row upserted into `f1_telemetry_index`. React fetches the blob for the
selected driver/lap and renders an interactive chart client-side.

Storage layout:
    telemetry/{season}/{round:02d}/{session}/{driver}_{lap}.json

Env for upload (same as generate.py / backfill.py):
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

Usage:
    # local dry-run, write JSON files under ./telemetry_out/ (no upload)
    python telemetry_export.py --season 2025 --event Austria --session R --no-upload

    # fastest lap per driver, upload to Supabase
    python telemetry_export.py --season 2025 --event Austria --session R

    # specific drivers
    python telemetry_export.py --season 2025 --event Austria --drivers NOR,LEC,VER
"""
import argparse
import json
import os
import sys
import time

import fastf1
import numpy as np
import pandas as pd

import f1_proxy  # noqa: F401 — repoints livetiming at the proxy when configured
import requests
import blob_store as bs
import db_index  # R2 uploads (see blob_store.py)

SAMPLES = 400  # points per lap after distance-resampling (~60-120KB JSON/lap)
BUCKET = "telemetry"

CHANNELS = {
    "Speed": "speed", "Throttle": "throttle", "Brake": "brake",
    "nGear": "gear", "RPM": "rpm", "DRS": "drs", "X": "x", "Y": "y",
}


def _env():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (use --no-upload to skip)")
    return url.rstrip("/"), key


def _session_keys(season, rnd, session_code):
    """{(driver_code, lap_number)} already on R2 for a session — one listing, no DB."""
    out = set()
    for key, _ in bs.list_keys(BUCKET, f"{season}/{rnd:02d}/{session_code}/"):
        name = key.rsplit("/", 1)[-1]
        if name.endswith(".json") and "_" in name:
            code, _, lap = name[:-5].rpartition("_")
            if lap.isdigit():
                out.add((code, int(lap)))
    return out


def _already_exported(season, rnd, session_code):
    """True if the session's telemetry is already on R2 — lets a whole-season cron pass
    skip finished rounds before the costly FastF1 load. Requires a substantially-complete
    session (>=10 drivers), so a partial export is re-run instead of counted as done."""
    try:
        return len({code for code, _ in _session_keys(season, rnd, session_code)}) >= 10
    except Exception:  # noqa: BLE001
        return False


def _fmt_laptime(td):
    if td is None or pd.isna(td):
        return None
    s = td.total_seconds()
    m = int(s // 60)
    return f"{m}:{s - m * 60:06.3f}"


def _resample(tel):
    """Resample a lap's telemetry to SAMPLES evenly-spaced points by distance."""
    dist = tel["Distance"].to_numpy(dtype=float)
    if len(dist) < 2 or dist[-1] <= dist[0]:
        return None
    grid = np.linspace(dist[0], dist[-1], SAMPLES)
    out = {"distance": [round(float(d), 1) for d in grid]}
    for src, dst in CHANNELS.items():
        if src not in tel.columns:
            continue
        col = tel[src].to_numpy(dtype=float)
        col = np.nan_to_num(col, nan=0.0)
        vals = np.interp(grid, dist, col)
        if dst in ("gear", "drs"):
            out[dst] = [int(round(v)) for v in vals]
        elif dst == "brake":
            out[dst] = [int(v > 0.5) for v in vals]  # FastF1 Brake is bool-ish
        else:
            out[dst] = [round(float(v), 1) for v in vals]
    return out


def _metrics(channels):
    spd = np.array(channels.get("speed", []), dtype=float)
    thr = np.array(channels.get("throttle", []), dtype=float)
    brk = np.array(channels.get("brake", []), dtype=float)
    if spd.size == 0:
        return {}
    # count distinct brake zones (rising edges)
    zones = int(np.sum((brk[1:] == 1) & (brk[:-1] == 0))) if brk.size else 0
    return {
        "top_speed": round(float(spd.max()), 1),
        "avg_speed": round(float(spd.mean()), 1),
        "full_throttle_pct": round(float((thr > 98).mean() * 100), 1) if thr.size else None,
        "brake_zones": zones,
    }


def _lap_already_exported(season, rnd, session_code, driver, lap_number):
    """True if this exact driver+lap blob is already on R2 — lets the on-demand any-lap
    path no-op when a lap has been generated before."""
    try:
        return bs.exists(BUCKET, f"{season}/{rnd:02d}/{session_code}/{driver}_{lap_number}.json")
    except Exception:  # noqa: BLE001
        return False


def _existing_laps(season, rnd, session_code):
    """Set of (driver_code, lap_number) already on R2 — one listing, so an --all-laps
    backfill can skip finished laps in-memory instead of a request each."""
    try:
        return _session_keys(season, rnd, session_code)
    except Exception:  # noqa: BLE001
        return set()


_LATEST_ROUND_CACHE = {}


def _round_has_happened(season, rnd):
    """Cheap future-round guard — skip races that haven't run yet BEFORE the costly
    FastF1 load (a bulk 24→1 backfill otherwise wastes 8 failed fetches per future round).
    Past seasons are fully complete; only the current/future season is gated, once per
    season (cached)."""
    from datetime import datetime, timezone
    if season < datetime.now(timezone.utc).year:
        return True
    if season not in _LATEST_ROUND_CACHE:
        try:
            _LATEST_ROUND_CACHE[season] = latest_completed_round(season) or 0
        except Exception:  # noqa: BLE001
            _LATEST_ROUND_CACHE[season] = 99
    # Allow the current weekend (latest + 1): its practice/quali/sprint sessions can have
    # run before the race date the "latest completed" check gates on.
    return rnd <= _LATEST_ROUND_CACHE[season] + 1


def _load_session(season, rnd, session_code):
    s = fastf1.get_session(season, rnd, session_code)
    s.load(telemetry=True, weather=False, messages=False)
    return s


def _driver_maps(res):
    return (
        {r.get("Abbreviation"): r.get("DriverId") for _, r in res.iterrows()},
        {r.get("Abbreviation"): r.get("TeamName") for _, r in res.iterrows()},
        {r.get("Abbreviation"): r.get("TeamColor") for _, r in res.iterrows()},
    )


def _build_blob(season, rnd, session_code, lap, drv, maps, lap_type="fastest"):
    """Resample one lap's telemetry into a compact blob (or None if unusable).
    Channels are whatever FastF1 exposes that season — DRS is absent in 2026, so we
    never assume it; the frontend renders only channels present."""
    abbr2id, abbr2team, abbr2color = maps
    try:
        tel = lap.get_telemetry().add_distance()
    except Exception as e:  # noqa: BLE001
        print(f"  {drv}: telemetry failed ({e})")
        return None
    channels = _resample(tel)
    if not channels:
        return None
    color = abbr2color.get(drv)
    return {
        "season": season, "round": rnd, "session": session_code,
        "driver": drv, "driver_id": abbr2id.get(drv),
        "team": abbr2team.get(drv),
        "team_color": f"#{color}" if color and not str(color).startswith("#") else color,
        "lap_number": int(lap["LapNumber"]),
        "lap_time": _fmt_laptime(lap.get("LapTime")),
        "compound": str(lap.get("Compound")) if lap.get("Compound") else None,
        "lap_type": lap_type,
        "samples": SAMPLES, "channels": channels,
        "metrics": _metrics(channels),
    }


def export_session(season, rnd, session_code, drivers=None, upload=True, force=False):
    if not force and not _round_has_happened(season, rnd):
        print(f"  {season} R{rnd} {session_code}: round hasn't run yet; skip")
        return []
    if upload and not force and _already_exported(season, rnd, session_code):
        print(f"  {season} R{rnd} {session_code}: already exported, skip (--force to redo)")
        return []
    try:
        s = _load_session(season, rnd, session_code)
    except Exception as e:  # noqa: BLE001 — missing session (Sprint on a non-sprint
        # round), or a future/unpublished/invalid round: skip cleanly, don't crash.
        print(f"  {season} R{rnd} {session_code}: not available ({e}); skip")
        return []
    maps = _driver_maps(s.results)
    try:
        picks = drivers or list(s.laps["Driver"].dropna().unique())
    except Exception:  # noqa: BLE001 — loaded but no lap data (recent/future round)
        print(f"  {season} R{rnd} {session_code}: no lap data; skip")
        return []
    written = []
    for drv in picks:
        dl = s.laps.pick_drivers(drv) if hasattr(s.laps, "pick_drivers") else s.laps[s.laps["Driver"] == drv]
        if dl is None or len(dl) == 0:
            continue
        lap = dl.pick_fastest()
        if lap is None or pd.isna(lap.get("LapNumber")):
            continue
        blob = _build_blob(season, rnd, session_code, lap, drv, maps, "fastest")
        if not blob:
            continue
        path = f"{season}/{rnd:02d}/{session_code}/{drv}_{blob['lap_number']}.json"
        _emit(blob, path, upload)
        written.append((drv, blob["lap_number"], blob["metrics"].get("top_speed")))
        print(f"  {drv}: lap {blob['lap_number']} {blob['lap_time']} "
              f"top {blob['metrics'].get('top_speed')}km/h -> {path}")
    print(f"Done. {len(written)} driver laps exported "
          f"({'uploaded' if upload else 'local only'}).")
    return written


def export_lap(season, rnd, session_code, driver, lap_number, upload=True, force=False):
    """Export ONE specific driver+lap — the on-demand any-lap path Pit Wall enqueues.
    No-ops if that lap is already indexed (unless force). Returns the storage path."""
    if upload and not force and _lap_already_exported(season, rnd, session_code, driver, lap_number):
        print(f"  {season} R{rnd} {session_code} {driver} L{lap_number}: already exported, skip")
        return None
    try:
        s = _load_session(season, rnd, session_code)
    except Exception as e:  # noqa: BLE001
        print(f"  {season} R{rnd} {session_code}: not available ({e}); skip")
        return None
    maps = _driver_maps(s.results)
    try:
        dl = s.laps.pick_drivers(driver) if hasattr(s.laps, "pick_drivers") else s.laps[s.laps["Driver"] == driver]
    except Exception:  # noqa: BLE001
        dl = None
    if dl is None or len(dl) == 0:
        print(f"  {driver}: no laps in session")
        return None
    sel = dl[dl["LapNumber"] == lap_number]
    if sel is None or len(sel) == 0:
        print(f"  {driver}: lap {lap_number} not found")
        return None
    lap = sel.iloc[0]
    blob = _build_blob(season, rnd, session_code, lap, driver, maps, "requested")
    if not blob:
        return None
    path = f"{season}/{rnd:02d}/{session_code}/{driver}_{blob['lap_number']}.json"
    _emit(blob, path, upload)
    print(f"  {driver}: lap {blob['lap_number']} {blob['lap_time']} -> {path}")
    return path


def export_all_laps(season, rnd, session_code, drivers=None, upload=True, force=False):
    """Export EVERY lap of EVERY driver (or --drivers subset) — the bulk per-lap
    backfill. Loads the session ONCE, then loops laps; the driver's fastest lap keeps
    lap_type='fastest' (so the default view still resolves), the rest are 'all'.
    Skips laps already indexed (unless --force)."""
    if not force and not _round_has_happened(season, rnd):
        print(f"  {season} R{rnd} {session_code}: round hasn't run yet; skip")
        return 0
    try:
        s = _load_session(season, rnd, session_code)
    except Exception as e:  # noqa: BLE001
        print(f"  {season} R{rnd} {session_code}: not available ({e}); skip")
        return 0
    maps = _driver_maps(s.results)
    try:
        picks = drivers or list(s.laps["Driver"].dropna().unique())
    except Exception:  # noqa: BLE001
        print(f"  {season} R{rnd} {session_code}: no lap data; skip")
        return 0
    existing = _existing_laps(season, rnd, session_code) if (upload and not force) else set()
    written = 0
    for drv in picks:
        dl = s.laps.pick_drivers(drv) if hasattr(s.laps, "pick_drivers") else s.laps[s.laps["Driver"] == drv]
        if dl is None or len(dl) == 0:
            continue
        fastest = dl.pick_fastest()
        fastest_n = int(fastest["LapNumber"]) if fastest is not None and not pd.isna(fastest.get("LapNumber")) else None
        n = 0
        for _, lap in dl.iterlaps():
            ln = lap.get("LapNumber")
            if pd.isna(ln):
                continue
            ln = int(ln)
            if (drv, ln) in existing:
                continue
            lap_type = "fastest" if ln == fastest_n else "all"
            blob = _build_blob(season, rnd, session_code, lap, drv, maps, lap_type)
            if not blob:
                continue
            path = f"{season}/{rnd:02d}/{session_code}/{drv}_{ln}.json"
            try:
                _emit(blob, path, upload)
            except Exception as e:  # noqa: BLE001 — one lap failing shouldn't kill the round
                print(f"    {drv} L{ln}: emit failed after retries ({e}); skipping (resumable)")
                continue
            written += 1
            n += 1
        print(f"  {drv}: {n} laps exported")
    print(f"Done. {written} laps exported ({'uploaded' if upload else 'local only'}).")
    return written


def _post_retry(url, *, tries=4, timeout=120, **kw):
    """POST with retry + backoff — Supabase storage occasionally read-times-out under a
    bulk backfill; one slow upload shouldn't kill the run."""
    last = None
    for i in range(tries):
        try:
            return requests.post(url, timeout=timeout, **kw)
        except requests.exceptions.RequestException as e:
            last = e
            wait = min(2 ** i, 15)
            print(f"    post retry {i + 1}/{tries} after {type(e).__name__}; sleep {wait}s")
            time.sleep(wait)
    raise last


def _emit(blob, path, upload):
    data = json.dumps(blob, separators=(",", ":")).encode()
    if not upload:
        local = os.path.join("telemetry_out", path)
        os.makedirs(os.path.dirname(local), exist_ok=True)
        with open(local, "wb") as f:
            f.write(data)
        return
    # R2, gzip-compressed (Content-Encoding: gzip -> browsers decode transparently).
    public_url = bs.put(BUCKET, path, data, "application/json", gzip_body=True)
    idx = {
        "season": blob["season"], "round": blob["round"], "session": blob["session"],
        "driver_id": blob["driver_id"], "driver_code": blob["driver"],
        "lap_number": blob["lap_number"], "lap_type": blob.get("lap_type", "fastest"),
        "storage_path": path, "public_url": public_url,
        "top_speed": blob["metrics"].get("top_speed"), "source": "fastf1",
    }
    # Secondary copy in Postgres — best effort. The CDN index (index_export.py) is
    # rebuilt from R2 at the end of the workflow and is what the site reads.
    db_index.upsert("f1_telemetry_index", "season,round,session,driver_code,lap_number", idx)


def latest_completed_round(year):
    """Round number of the most recent race that has already happened (mirrors
    generate.py) — lets the assets cron export the latest round without a hard-coded R."""
    sched = fastf1.get_event_schedule(year, include_testing=False)
    now = pd.Timestamp.utcnow().tz_localize(None)
    col = "Session5DateUtc" if "Session5DateUtc" in sched.columns else "EventDate"
    past = sched[pd.to_datetime(sched[col]).dt.tz_localize(None) < now]
    return None if past.empty else int(past.iloc[-1]["RoundNumber"])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", type=int, required=True)
    ap.add_argument("--round", type=int)
    ap.add_argument("--event")
    ap.add_argument("--session", default="R")
    ap.add_argument("--drivers", help="comma-separated codes, e.g. NOR,LEC,VER")
    ap.add_argument("--lap", type=int,
                    help="export ONE specific lap for a single --drivers code "
                         "(on-demand any-lap path for Pit Wall)")
    ap.add_argument("--all-laps", action="store_true",
                    help="export EVERY lap of every driver (bulk per-lap backfill)")
    ap.add_argument("--latest", action="store_true",
                    help="resolve --round to the latest completed race (for the assets cron)")
    ap.add_argument("--no-upload", action="store_true")
    ap.add_argument("--force", action="store_true",
                    help="re-export even if already in f1_telemetry_index")
    args = ap.parse_args()

    cache = os.environ.get("FASTF1_CACHE", ".fastf1cache")
    os.makedirs(cache, exist_ok=True)
    fastf1.Cache.enable_cache(cache)

    rnd = args.round
    if args.event:
        rnd = int(fastf1.get_event(args.season, args.event)["RoundNumber"])
    if rnd is None and args.latest:
        rnd = latest_completed_round(args.season)
        if rnd is None:
            print(f"No completed round yet for {args.season}; nothing to export.")
            return
    if rnd is None:
        sys.exit("Provide --round, --event, or --latest")

    drivers = [d.strip().upper() for d in args.drivers.split(",")] if args.drivers else None
    if args.lap is not None:
        if not drivers or len(drivers) != 1:
            sys.exit("--lap requires exactly one --drivers CODE")
        print(f"Telemetry export {args.season} R{rnd} {args.session} {drivers[0]} lap {args.lap}")
        export_lap(args.season, rnd, args.session, drivers[0], args.lap,
                   upload=not args.no_upload, force=args.force)
        return
    if args.all_laps:
        print(f"Telemetry export ALL LAPS {args.season} R{rnd} {args.session} "
              f"({'all drivers' if not drivers else ','.join(drivers)})")
        export_all_laps(args.season, rnd, args.session, drivers,
                        upload=not args.no_upload, force=args.force)
        return
    print(f"Telemetry export {args.season} R{rnd} {args.session} "
          f"({'all drivers' if not drivers else ','.join(drivers)})")
    export_session(args.season, rnd, args.session, drivers,
                   upload=not args.no_upload, force=args.force)


if __name__ == "__main__":
    main()
