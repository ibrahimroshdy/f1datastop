#!/usr/bin/env python3
"""
FastF1 circuit-geometry exporter for f1datastop.

Draws a *real* track map from telemetry instead of a static SVG: the fastest lap's
X/Y position trace is the outline, and FastF1's get_circuit_info() supplies numbered
corners + marshal sectors in the SAME coordinate frame — so corners land exactly on
the track with no registration/alignment math (the failure mode of overlaying
circuit_info onto the bundled bacinger SVG, which lives in a different frame).

"Straights" are computed from full-throttle stretches of the fastest lap. There are
NO DRS zones: 2026 regulations dropped DRS entirely (active aero replaces it), and
no clean programmatic feed exists for the new override zones — so we don't fake them.

Like telemetry_export.py, the heavy point arrays are decimated and written as one
compact JSON blob to Supabase Storage (bucket `circuits`), with a discovery row
upserted into `f1_circuit_geometry`. React fetches the blob and renders the map.

Storage layout:
    circuits/{season}/{circuit_id}.json

Env for upload (same as telemetry_export.py):
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

Usage:
    # local dry-run, write JSON under ./circuits_out/ (no upload, no DB lookup)
    python circuit_geometry_export.py --season 2025 --event Austria --no-upload

    # extract + upload for a specific round
    python circuit_geometry_export.py --season 2025 --round 11
"""
import argparse
import json
import os
import re
import sys

import fastf1
import numpy as np
import pandas as pd

import f1_proxy  # noqa: F401 — repoints livetiming at the proxy when configured
import requests

OUTLINE_POINTS = 360   # track-outline samples after distance-resampling
MIN_STRAIGHT_M = 250   # a full-throttle stretch shorter than this isn't a "straight"
FULL_THROTTLE = 97     # Throttle >= this (and not braking) = flat-out. A touch below
                       # 100 because 2026 active-aero cars don't always sit at max.
BRIDGE_GAP_M = 45      # merge two flat runs split only by a momentary lift (< this,
                       # no braking) so one real straight isn't fragmented + dropped
BUCKET = "circuits"


def _env():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (use --no-upload to skip)")
    return url.rstrip("/"), key


def _slug(s):
    return re.sub(r"[^a-z0-9]+", "_", str(s).lower()).strip("_")


def _lookup_circuit(season, rnd):
    """Resolve (circuit_id, circuit_name) from the warehouse so the geometry keys
    join cleanly to f1_race / f1_circuit. Returns (None, None) if unavailable."""
    try:
        url, key = _env()
        r = requests.get(
            f"{url}/rest/v1/f1_race",
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
            params={"season": f"eq.{season}", "round": f"eq.{rnd}",
                    "select": "circuit_id,f1_circuit(name)", "limit": "1"},
            timeout=30,
        )
        if r.ok and r.json():
            row = r.json()[0]
            name = (row.get("f1_circuit") or {}).get("name")
            return row.get("circuit_id"), name
    except Exception:  # noqa: BLE001
        pass
    return None, None


def _already_exported(season, circuit_id):
    try:
        url, key = _env()
        r = requests.get(
            f"{url}/rest/v1/f1_circuit_geometry",
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
            params={"season": f"eq.{season}", "circuit_id": f"eq.{circuit_id}",
                    "select": "id", "limit": "1"},
            timeout=30,
        )
        return r.ok and len(r.json()) >= 1
    except Exception:  # noqa: BLE001
        return False


def _rotate(x, y, deg):
    """Rotate X/Y by FastF1's circuit rotation so the map is oriented as broadcast.
    Uses FastF1's canonical rotation matrix (xy @ [[cos,sin],[-sin,cos]]); the
    negated-angle form mirrors the layout (Spa etc. came out reversed)."""
    a = float(deg) / 180.0 * np.pi
    return x * np.cos(a) - y * np.sin(a), x * np.sin(a) + y * np.cos(a)


def _outline(tel, rot):
    """Decimate the fastest-lap position trace to OUTLINE_POINTS evenly-spaced-by-
    distance [x, y, d] points, rotated into display orientation."""
    dist = tel["Distance"].to_numpy(dtype=float)
    if len(dist) < 2 or dist[-1] <= dist[0]:
        return None
    x, y = _rotate(tel["X"].to_numpy(dtype=float), tel["Y"].to_numpy(dtype=float), rot)
    grid = np.linspace(dist[0], dist[-1], OUTLINE_POINTS)
    gx = np.interp(grid, dist, x)
    gy = np.interp(grid, dist, y)
    return [[round(float(a), 1), round(float(b), 1), round(float(d), 1)]
            for a, b, d in zip(gx, gy, grid)]


def _corners(circuit_info, rot):
    out = []
    df = getattr(circuit_info, "corners", None)
    if df is None or len(df) == 0:
        return out
    for _, c in df.iterrows():
        x, y = _rotate(float(c["X"]), float(c["Y"]), rot)
        out.append({
            "n": int(c["Number"]),
            "letter": (str(c["Letter"]) if c.get("Letter") else "") or "",
            "x": round(x, 1), "y": round(y, 1),
            "d": round(float(c["Distance"]), 1) if "Distance" in c else None,
            "angle": round(float(c["Angle"]), 1) if "Angle" in c else None,
        })
    return out


def _marshal_sectors(circuit_info, rot):
    out = []
    df = getattr(circuit_info, "marshal_sectors", None)
    if df is None or len(df) == 0:
        return out
    for _, m in df.iterrows():
        x, y = _rotate(float(m["X"]), float(m["Y"]), rot)
        out.append({
            "n": int(m["Number"]) if "Number" in m and not pd.isna(m["Number"]) else None,
            "x": round(x, 1), "y": round(y, 1),
            "d": round(float(m["Distance"]), 1) if "Distance" in m else None,
        })
    return out


def _straights(tel):
    """Contiguous full-throttle (and not-braking) stretches of >= MIN_STRAIGHT_M,
    as {start_d, end_d, length}. Sorted longest-first. NOT DRS zones — 2026 has none."""
    dist = tel["Distance"].to_numpy(dtype=float)
    thr = tel["Throttle"].to_numpy(dtype=float) if "Throttle" in tel.columns else None
    if thr is None or len(dist) < 2:
        return []
    brk = (tel["Brake"].to_numpy() if "Brake" in tel.columns
           else np.zeros(len(dist))).astype(float)
    flat = (thr >= FULL_THROTTLE) & (brk < 0.5)
    # raw contiguous flat-out runs (index spans)
    raw = []
    i, n = 0, len(flat)
    while i < n:
        if flat[i]:
            j = i
            while j + 1 < n and flat[j + 1]:
                j += 1
            raw.append([i, j])
            i = j + 1
        else:
            i += 1
    # bridge runs separated only by a momentary lift — a short, brake-free gap — so a
    # single flat-out straight isn't fragmented into sub-MIN pieces and lost. A real
    # corner is longer than BRIDGE_GAP_M and/or involves braking, so it won't merge.
    merged = []
    for a, b in raw:
        if merged:
            pa, pb = merged[-1]
            gap = float(dist[a] - dist[pb])
            gap_brake = float(brk[pb:a + 1].max()) if a > pb else 0.0
            if 0 <= gap <= BRIDGE_GAP_M and gap_brake < 0.5:
                merged[-1][1] = b
                continue
        merged.append([a, b])
    # merged index-spans → distance runs
    runs = [{"start_d": float(dist[a]), "end_d": float(dist[b]),
             "length": float(dist[b] - dist[a])} for a, b in merged]
    # Lap-boundary wrap: the start/finish (pit) straight is split across the lap's
    # start line into an end-of-lap piece + a start-of-lap piece — each often just
    # under MIN, so BOTH get dropped and a real straight vanishes (this is what put
    # Spa at 4 not 5). If the lap is flat-out at both ends they are the same physical
    # straight, so join them into one before the length filter.
    if (len(runs) >= 2 and runs[0]["start_d"] <= 5.0
            and runs[-1]["end_d"] >= float(dist[-1]) - 5.0):
        head, tail = runs[0], runs[-1]
        runs = ([{"start_d": tail["start_d"], "end_d": head["end_d"],
                  "length": tail["length"] + head["length"]}]
                + runs[1:-1])
    out = [{"start_d": round(r["start_d"], 1), "end_d": round(r["end_d"], 1),
            "length": round(r["length"], 1)}
           for r in runs if r["length"] >= MIN_STRAIGHT_M]
    out.sort(key=lambda r: r["length"], reverse=True)
    return out


def export_circuit(season, rnd, upload=True, force=False):
    circuit_id, circuit_name = (None, None)
    if upload:
        circuit_id, circuit_name = _lookup_circuit(season, rnd)

    # The track outline is the same circuit regardless of session, so build it from
    # whichever session has data — Race first (canonical), then Q / practice / sprint.
    # This lets geometry export mid-weekend (e.g. after FP1, before the race) instead of
    # being stuck on "R", which doesn't exist yet. get_session raises for a round that
    # doesn't exist; load() fails on sessions FastF1 has no telemetry for — both skip.
    s = None
    for sess in ("R", "Q", "FP1", "FP2", "FP3", "S", "SQ", "SS"):
        try:
            cand = fastf1.get_session(season, rnd, sess)
            cand.load(telemetry=True, weather=False, messages=False)
            if cand.laps is not None and len(cand.laps) > 0:
                s = cand
                if sess != "R":
                    print(f"  {season} R{rnd}: building geometry from {sess} (R unavailable)")
                break
        except Exception:  # noqa: BLE001
            continue
    if s is None:
        print(f"  {season} R{rnd}: no session with lap data; skip")
        return None

    # Fall back to the event's own naming when the warehouse lookup is unavailable
    # (e.g. --no-upload local runs).
    if not circuit_id:
        loc = s.event.get("Location") or s.event.get("EventName") or f"r{rnd}"
        circuit_id = _slug(loc)
        circuit_name = circuit_name or s.event.get("EventName")

    if upload and not force and _already_exported(season, circuit_id):
        print(f"  {season} {circuit_id}: already exported, skip (--force to redo)")
        return None

    lap = s.laps.pick_fastest()
    if lap is None or pd.isna(lap.get("LapNumber")):
        print(f"  {season} R{rnd}: no fastest lap; skip")
        return None
    try:
        tel = lap.get_telemetry().add_distance()
    except Exception as e:  # noqa: BLE001
        print(f"  {season} R{rnd}: telemetry failed ({e}); skip")
        return None

    ci = s.get_circuit_info()
    rot = getattr(ci, "rotation", 0.0) or 0.0

    outline = _outline(tel, rot)
    if not outline:
        print(f"  {season} R{rnd}: empty outline; skip")
        return None
    corners = _corners(ci, rot)
    straights = _straights(tel)
    xs = [p[0] for p in outline]
    ys = [p[1] for p in outline]

    blob = {
        "season": season, "round": rnd,
        "circuit_id": circuit_id, "circuit_name": circuit_name,
        "rotation": round(float(rot), 2),
        "bounds": {"min_x": round(min(xs), 1), "max_x": round(max(xs), 1),
                   "min_y": round(min(ys), 1), "max_y": round(max(ys), 1)},
        "outline": outline,
        "corners": corners,
        "marshal_sectors": _marshal_sectors(ci, rot),
        "straights": straights,
        "source": "fastf1",
    }
    path = f"{season}/{circuit_id}.json"
    _emit(blob, path, upload)
    print(f"  {season} R{rnd} {circuit_id}: {len(outline)} pts, "
          f"{len(corners)} corners, {len(straights)} straights -> {path}")
    return blob


def _emit(blob, path, upload):
    data = json.dumps(blob, separators=(",", ":")).encode()
    if not upload:
        local = os.path.join("circuits_out", path)
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
        "season": blob["season"], "round": blob["round"],
        "circuit_id": blob["circuit_id"], "circuit_name": blob["circuit_name"],
        "storage_path": path, "public_url": public_url,
        "corner_count": len(blob["corners"]), "straight_count": len(blob["straights"]),
        "rotation": blob["rotation"], "source": "fastf1",
    }
    ir = requests.post(
        f"{url}/rest/v1/f1_circuit_geometry?on_conflict=season,circuit_id",
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
    ap.add_argument("--no-upload", action="store_true")
    ap.add_argument("--force", action="store_true",
                    help="re-export even if already in f1_circuit_geometry")
    args = ap.parse_args()

    cache = os.environ.get("FASTF1_CACHE", ".fastf1cache")
    os.makedirs(cache, exist_ok=True)
    fastf1.Cache.enable_cache(cache)

    rnd = args.round
    if args.event:
        rnd = int(fastf1.get_event(args.season, args.event)["RoundNumber"])
    if rnd is None:
        sys.exit("Provide --round or --event")

    print(f"Circuit geometry export {args.season} R{rnd}")
    export_circuit(args.season, rnd, upload=not args.no_upload, force=args.force)


if __name__ == "__main__":
    main()
