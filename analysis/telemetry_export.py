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

import fastf1
import numpy as np
import pandas as pd
import requests

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


def _already_exported(season, rnd, session_code):
    """True if f1_telemetry_index already has rows for this session — lets a
    whole-season cron pass skip finished rounds before the costly FastF1 load."""
    try:
        url, key = _env()
        r = requests.get(
            f"{url}/rest/v1/f1_telemetry_index",
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
            params={"season": f"eq.{season}", "round": f"eq.{rnd}",
                    "session": f"eq.{session_code}", "select": "driver_code", "limit": "30"},
            timeout=30,
        )
        # Require a substantially-complete session (>=10 drivers), so a partial
        # or broken export (e.g. 1 row) is re-run instead of counted as done.
        return r.ok and len(r.json()) >= 10
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


def export_session(season, rnd, session_code, drivers=None, upload=True, force=False):
    if upload and not force and _already_exported(season, rnd, session_code):
        print(f"  {season} R{rnd} {session_code}: already exported, skip (--force to redo)")
        return []
    s = fastf1.get_session(season, rnd, session_code)
    try:
        s.load(telemetry=True, weather=False, messages=False)
    except Exception as e:  # noqa: BLE001 — future/unpublished round: skip, don't crash
        print(f"  {season} R{rnd} {session_code}: load failed ({e}); skip")
        return []
    res = s.results
    abbr2id = {r.get("Abbreviation"): r.get("DriverId") for _, r in res.iterrows()}
    abbr2team = {r.get("Abbreviation"): r.get("TeamName") for _, r in res.iterrows()}
    abbr2color = {r.get("Abbreviation"): r.get("TeamColor") for _, r in res.iterrows()}

    picks = drivers or list(s.laps["Driver"].dropna().unique())
    written = []
    for drv in picks:
        dl = s.laps.pick_drivers(drv) if hasattr(s.laps, "pick_drivers") else s.laps[s.laps["Driver"] == drv]
        if dl is None or len(dl) == 0:
            continue
        lap = dl.pick_fastest()
        if lap is None or pd.isna(lap.get("LapNumber")):
            continue
        try:
            tel = lap.get_telemetry().add_distance()
        except Exception as e:  # noqa: BLE001
            print(f"  {drv}: telemetry failed ({e})")
            continue
        channels = _resample(tel)
        if not channels:
            continue
        color = abbr2color.get(drv)
        blob = {
            "season": season, "round": rnd, "session": session_code,
            "driver": drv, "driver_id": abbr2id.get(drv),
            "team": abbr2team.get(drv),
            "team_color": f"#{color}" if color and not str(color).startswith("#") else color,
            "lap_number": int(lap["LapNumber"]),
            "lap_time": _fmt_laptime(lap.get("LapTime")),
            "compound": str(lap.get("Compound")) if lap.get("Compound") else None,
            "samples": SAMPLES, "channels": channels,
            "metrics": _metrics(channels),
        }
        path = f"{season}/{rnd:02d}/{session_code}/{drv}_{blob['lap_number']}.json"
        _emit(blob, path, upload)
        written.append((drv, blob["lap_number"], blob["metrics"].get("top_speed")))
        print(f"  {drv}: lap {blob['lap_number']} {blob['lap_time']} "
              f"top {blob['metrics'].get('top_speed')}km/h -> {path}")
    print(f"Done. {len(written)} driver laps exported "
          f"({'uploaded' if upload else 'local only'}).")
    return written


def _emit(blob, path, upload):
    data = json.dumps(blob, separators=(",", ":")).encode()
    if not upload:
        local = os.path.join("telemetry_out", path)
        os.makedirs(os.path.dirname(local), exist_ok=True)
        with open(local, "wb") as f:
            f.write(data)
        return
    url, key = _env()
    r = requests.post(
        f"{url}/storage/v1/object/{BUCKET}/{path}",
        headers={"Authorization": f"Bearer {key}", "apikey": key,
                 "Content-Type": "application/json", "x-upsert": "true"},
        data=data, timeout=60,
    )
    if not r.ok:
        raise RuntimeError(f"upload {path} failed {r.status_code}: {r.text[:300]}")
    public_url = f"{url}/storage/v1/object/public/{BUCKET}/{path}"
    idx = {
        "season": blob["season"], "round": blob["round"], "session": blob["session"],
        "driver_id": blob["driver_id"], "driver_code": blob["driver"],
        "lap_number": blob["lap_number"], "lap_type": "fastest",
        "storage_path": path, "public_url": public_url,
        "top_speed": blob["metrics"].get("top_speed"), "source": "fastf1",
    }
    ir = requests.post(
        f"{url}/rest/v1/f1_telemetry_index?on_conflict=season,round,session,driver_code,lap_number",
        headers={"Authorization": f"Bearer {key}", "apikey": key,
                 "Content-Type": "application/json",
                 "Prefer": "resolution=merge-duplicates,return=minimal"},
        json=[idx], timeout=30,
    )
    if not ir.ok:
        raise RuntimeError(f"index upsert failed {ir.status_code}: {ir.text[:300]}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", type=int, required=True)
    ap.add_argument("--round", type=int)
    ap.add_argument("--event")
    ap.add_argument("--session", default="R")
    ap.add_argument("--drivers", help="comma-separated codes, e.g. NOR,LEC,VER")
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
    if rnd is None:
        sys.exit("Provide --round or --event")

    drivers = [d.strip().upper() for d in args.drivers.split(",")] if args.drivers else None
    print(f"Telemetry export {args.season} R{rnd} {args.session} "
          f"({'all drivers' if not drivers else ','.join(drivers)})")
    export_session(args.season, rnd, args.session, drivers,
                   upload=not args.no_upload, force=args.force)


if __name__ == "__main__":
    main()
