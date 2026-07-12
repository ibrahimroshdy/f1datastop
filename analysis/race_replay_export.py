#!/usr/bin/env python3
"""
FastF1 full-race position exporter — powers the GPS car-dot race replay.

For every driver we resample their whole-race X/Y position (`session.pos_data`)
onto ONE shared time grid, rotated into the circuit's display orientation (same
frame the circuit-geometry track map uses), so the frontend can animate ~20 dots
along the real racing line and scrub the race by time. Off-track / not-yet-started
samples become null so a dot simply doesn't render for those frames.

Grid is trimmed to the RACE itself — green flag (`session_start_time`) to the
leader's chequered flag — using `SessionTime`, NOT the raw `pos_data` window
(which spans ~55 min of garage boot-up + cool-down and would bunch every car at
the origin). Frames are ~1.5s apart so the client's linear tween between samples
hugs the racing line instead of chording across corners.

SC / VSC / red-flag periods are detected from race-control messages and embedded
as time ranges (seconds from green) so the frontend can shade the scrubber and
flag the active period — the same safety context the deep-dive charts show.

This is post-race / historical (FastF1 batch) — NOT live. No OpenF1 live feed.

Storage layout:  replays/{season}/{circuit_id}.json  + index row in f1_race_replay.
Env (same as circuit_geometry_export.py): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

Usage:
    python race_replay_export.py --season 2024 --event Austria --no-upload
    python race_replay_export.py --season 2024 --round 11
"""
import argparse
import json
import os
import re
import sys
import unicodedata

import fastf1
import numpy as np
import pandas as pd
import requests

STEP_S = 1.5       # target seconds between shared time-grid samples
MAX_FRAMES = 4000  # cap blob size on long red-flagged races
BUCKET = "replays"


def _env():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (use --no-upload to skip)")
    return url.rstrip("/"), key


def _slug(s):
    return re.sub(r"[^a-z0-9]+", "_", str(s).lower()).strip("_")


def _ascii_key(s):
    """ASCII-safe Storage key. Supabase Storage rejects non-ASCII object keys, so
    DB circuit_ids like 'montréal' / 'são_paulo' must be folded ('montreal',
    'sao_paulo') for the path — the original circuit_id still rides in the blob +
    index, which is what the frontend matches on."""
    n = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode("ascii")
    n = re.sub(r"[^a-zA-Z0-9._-]+", "_", n).strip("_")
    return n or "circuit"


def _lookup_circuit(season, rnd):
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
            return row.get("circuit_id"), (row.get("f1_circuit") or {}).get("name")
    except Exception:  # noqa: BLE001
        pass
    return None, None


def _already_exported(season, circuit_id):
    try:
        url, key = _env()
        r = requests.get(
            f"{url}/rest/v1/f1_race_replay",
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
            params={"season": f"eq.{season}", "circuit_id": f"eq.{circuit_id}",
                    "select": "id", "limit": "1"},
            timeout=30,
        )
        return r.ok and len(r.json()) >= 1
    except Exception:  # noqa: BLE001
        return False


def _rotate(x, y, deg):
    # FastF1 canonical rotation (matches broadcast orientation); the negated-angle
    # form we had before mirrored the layout.
    a = float(deg) / 180.0 * np.pi
    return x * np.cos(a) - y * np.sin(a), x * np.sin(a) + y * np.cos(a)


def _race_window(session):
    """(race_start_s, race_end_s) in SessionTime seconds — green flag to the
    leader's chequered. Falls back to the lap-time span if session_start_time is
    missing (older FastF1 data)."""
    laps = session.laps
    try:
        start = float(session.session_start_time.total_seconds())
    except Exception:  # noqa: BLE001
        start = float(laps["LapStartTime"].min().total_seconds())
    end = float(laps["Time"].max().total_seconds())
    if not (end > start > 0):
        return None
    return start, end


def _t0_date(pos):
    """Absolute Timestamp for SessionTime=0 (so race-control Time — which is
    absolute — can be mapped onto the SessionTime clock)."""
    for df in pos.values():
        if df is not None and len(df) and "SessionTime" in df and "Date" in df:
            return df["Date"].iloc[0] - df["SessionTime"].iloc[0]
    return None


def safety_periods_time(session, t0_date, race_start, duration):
    """SC / VSC / red-flag periods as {kind, start_s, end_s} in seconds from the
    green flag. Mirrors generate.py's lap-domain state machine but keyed on the
    race-control message Time (absolute → SessionTime → seconds-from-green)."""
    try:
        rc = getattr(session, "race_control_messages", None)
        if rc is None or len(rc) == 0 or t0_date is None:
            return []
    except Exception:  # noqa: BLE001
        return []

    def to_s(t):
        if t is None or pd.isna(t):
            return None
        return (t - t0_date).total_seconds() - race_start  # seconds from green

    rows = []
    for _, m in rc.iterrows():
        s = to_s(m.get("Time"))
        if s is None:
            continue
        rows.append((s, str(m.get("Message") or "").upper(), str(m.get("Flag") or "").upper()))
    rows.sort(key=lambda r: r[0])

    def clamp(v):
        return max(0.0, min(duration, v))

    periods, sc, vsc, red = [], None, None, None
    for t, msg, flag in rows:
        virtual = "VIRTUAL SAFETY CAR" in msg or "VSC" in msg
        deploy = "DEPLOY" in msg
        ending = "ENDING" in msg or "IN THIS LAP" in msg
        # `flag` column authoritative; message fallback word-bounded so
        # "CHEQUERED FLAG" (contains "…RED FLAG") never trips a red band.
        if flag == "RED" or re.search(r"\bRED FLAG\b", msg):
            red = red or {"kind": "RED", "start": t, "end": t}
            continue
        if flag == "GREEN" or "GREEN" in msg or "TRACK CLEAR" in msg:
            for p in (red, vsc, sc):
                if p:
                    p["end"] = max(p["start"], t)
                    periods.append(p)
            red = vsc = sc = None
            continue
        if virtual:
            if deploy and not vsc:
                vsc = {"kind": "VSC", "start": t, "end": t}
            elif ending and vsc:
                vsc["end"] = max(vsc["start"], t)
                periods.append(vsc)
                vsc = None
            continue
        if "SAFETY CAR" in msg:
            if deploy and not sc:
                sc = {"kind": "SC", "start": t, "end": t}
            elif ending and sc:
                sc["end"] = max(sc["start"], t)
                periods.append(sc)
                sc = None
    for p in (sc, vsc, red):
        if p:
            p["end"] = duration
            periods.append(p)

    out = []
    for p in sorted(periods, key=lambda p: p["start"]):
        a, b = clamp(p["start"]), clamp(p["end"])
        if b - a >= 1.0:  # drop noise-thin bands
            out.append({"kind": p["kind"], "start_s": round(a, 1), "end_s": round(b, 1)})
    return out


def _secs(td):
    try:
        return None if pd.isna(td) else float(td.total_seconds())
    except Exception:  # noqa: BLE001
        return None


def _ms(td):
    s = _secs(td)
    return None if s is None else int(round(s * 1000))


_COMPOUND = {"SOFT": "S", "MEDIUM": "M", "HARD": "H", "INTERMEDIATE": "I", "WET": "W"}


def _compound(c):
    if c is None or (isinstance(c, float) and pd.isna(c)):
        return None
    return _COMPOUND.get(str(c).upper().strip(), str(c)[:1].upper() or None)


def _lap_timing(session, race_start):
    """Per-driver per-lap timing records (seconds from green) + progress metadata
    for live ordering, and the earliest start time of each lap (overtake timing)."""
    laps = getattr(session, "laps", None)
    recs, meta, lapstart = {}, {}, {}
    if laps is None or len(laps) == 0:
        return recs, meta, 90.0, lapstart
    for num, dl in laps.groupby("DriverNumber"):
        dl = dl.sort_values("LapNumber")
        rows, starts, durs, nums = [], [], [], []
        for _, lp in dl.iterrows():
            st = _secs(lp.get("LapStartTime"))
            if st is None:
                continue
            st -= race_start
            lt = _secs(lp.get("LapTime"))
            n = int(lp["LapNumber"])
            te = st + lt if lt else None
            tyl = lp.get("TyreLife")
            rows.append({
                "n": n, "ts": round(st, 1),
                "te": round(te, 1) if te is not None else None,
                "last": round(lt, 3) if lt else None,
                "s1": _ms(lp.get("Sector1Time")), "s2": _ms(lp.get("Sector2Time")),
                "s3": _ms(lp.get("Sector3Time")),
                "tyre": _compound(lp.get("Compound")),
                "tyl": int(tyl) if tyl is not None and not pd.isna(tyl) else None,
                "pit": bool(not pd.isna(lp.get("PitInTime")) or not pd.isna(lp.get("PitOutTime"))),
            })
            starts.append(st)
            durs.append(lt if lt else 0.0)
            nums.append(n)
            if n not in lapstart or st < lapstart[n]:
                lapstart[n] = st
        recs[str(num)] = rows
        meta[str(num)] = (np.array(starts), np.array(durs), np.array(nums))
    durs_flat = [d for (_s, dr, _n) in meta.values() for d in dr if d > 0]
    med_lap = float(np.median(durs_flat)) if durs_flat else 90.0
    return recs, meta, med_lap, lapstart


def _progress(t_grid, meta_entry):
    """Progress (completed laps + fraction of current lap) per grid time."""
    starts, durs, nums = meta_entry
    prog = np.full(len(t_grid), np.nan)
    if len(starts) == 0:
        return prog
    idx = np.searchsorted(starts, t_grid, side="right") - 1
    for k in range(len(t_grid)):
        i = idx[k]
        if i < 0 or i >= len(starts):
            continue
        d = durs[i]
        frac = 0.0 if d <= 0 else (t_grid[k] - starts[i]) / d
        frac = 0.0 if frac < 0 else (1.0 if frac > 1 else frac)
        prog[k] = (nums[i] - 1) + frac
    return prog


def _pos_gap(prog_list, med_lap):
    """Per-frame live position (rank of progress) + gap-to-leader (s)."""
    P = np.vstack(prog_list)  # (D, F)
    D, F = P.shape
    leader = np.nanmax(P, axis=0)
    gap = (leader[None, :] - P) * med_lap
    pos = np.full((D, F), np.nan)
    for f in range(F):
        col = P[:, f]
        valid = np.where(~np.isnan(col))[0]
        if valid.size == 0:
            continue
        order = valid[np.argsort(-col[valid], kind="stable")]
        pos[order, f] = np.arange(1, valid.size + 1)
    return pos, gap


def _drs_intervals(session, num, race_start, duration):
    """DRS-open time windows [t0, t1] (seconds from green) for one driver."""
    try:
        cd = session.car_data[num]
    except Exception:  # noqa: BLE001
        return []
    if cd is None or "DRS" not in cd or "SessionTime" not in cd:
        return []
    t = cd["SessionTime"].dt.total_seconds().to_numpy(dtype=float) - race_start
    openf = np.isin(cd["DRS"].to_numpy(), (10, 12, 14))  # FastF1: 10/12/14 = DRS active
    ivals, i, n = [], 0, len(t)
    while i < n:
        if openf[i]:
            j = i
            while j + 1 < n and openf[j + 1]:
                j += 1
            a, b = max(0.0, t[i]), min(duration, t[j])
            if b > a:
                ivals.append([round(a, 1), round(b, 1)])
            i = j + 1
        else:
            i += 1
    return ivals


def _race_control_feed(session, t0_date, race_start, duration):
    """Race-control messages as {t, kind, msg} (seconds from green)."""
    try:
        rc = getattr(session, "race_control_messages", None)
        if rc is None or len(rc) == 0 or t0_date is None:
            return []
    except Exception:  # noqa: BLE001
        return []
    out = []
    for _, m in rc.iterrows():
        tt = m.get("Time")
        if tt is None or pd.isna(tt):
            continue
        t = (tt - t0_date).total_seconds() - race_start
        if t < -5 or t > duration + 5:
            continue
        msg = str(m.get("Message") or "").strip()
        up = msg.upper()
        flag = str(m.get("Flag") or "").upper()
        if "VIRTUAL SAFETY CAR" in up or "VSC" in up:
            kind = "vsc"
        elif "SAFETY CAR" in up:
            kind = "sc"
        elif flag == "RED" or re.search(r"\bRED FLAG\b", up):
            kind = "red"
        elif "DRS" in up:
            kind = "drs"
        elif "YELLOW" in up or flag in ("YELLOW", "DOUBLE YELLOW"):
            kind = "yellow"
        elif flag == "GREEN" or "GREEN" in up or "TRACK CLEAR" in up:
            kind = "green"
        else:
            kind = "info"
        out.append({"t": round(max(0.0, t), 1), "kind": kind, "msg": msg[:120]})
    return out


def _overtakes_feed(season, rnd, lapstart):
    """Time-stamped passes from the get_overtakes RPC (lap -> lap-start time)."""
    try:
        url, key = _env()
    except SystemExit:
        return []
    try:
        r = requests.post(
            f"{url}/rest/v1/rpc/get_overtakes",
            headers={"apikey": key, "Authorization": f"Bearer {key}",
                     "Content-Type": "application/json"},
            json={"p_season": season, "p_round": rnd, "p_session": "R"},
            timeout=30,
        )
        rows = r.json() if r.ok else []
        # PostgREST returns the array directly; guard the wrapped {get_overtakes:[…]} shape too.
        if isinstance(rows, dict):
            rows = rows.get("get_overtakes") or []
        if isinstance(rows, list) and len(rows) == 1 and isinstance(rows[0], dict) and "get_overtakes" in rows[0]:
            rows = rows[0]["get_overtakes"] or []
        if not isinstance(rows, list):
            rows = []
    except Exception:  # noqa: BLE001
        return []
    out = []
    for o in rows:
        lap = o.get("lap_number")
        if lap is None:
            continue
        t = lapstart.get(int(lap))
        if t is None:
            continue
        out.append({"t": round(max(0.0, t), 1),
                    "by": o.get("overtaking_driver_id"),
                    "on": o.get("overtaken_driver_id")})
    out.sort(key=lambda x: x["t"])
    return out


def export_replay(season, rnd, upload=True, force=False):
    circuit_id, circuit_name = (None, None)
    if upload:
        circuit_id, circuit_name = _lookup_circuit(season, rnd)

    try:
        s = fastf1.get_session(season, rnd, "R")
        s.load(telemetry=True, weather=False, messages=True)
    except Exception as e:  # noqa: BLE001
        print(f"  {season} R{rnd}: unavailable ({e}); skip")
        return None

    if not circuit_id:
        circuit_id = _slug(s.event.get("Location") or s.event.get("EventName") or f"r{rnd}")
        circuit_name = circuit_name or s.event.get("EventName")

    if upload and not force and _already_exported(season, circuit_id):
        print(f"  {season} {circuit_id}: already exported, skip (--force to redo)")
        return None

    # Future / dataless races have no telemetry — get_circuit_info() then raises
    # DataNotLoadedError. Skip cleanly instead of a traceback.
    try:
        ci = s.get_circuit_info()
    except Exception as e:  # noqa: BLE001
        print(f"  {season} R{rnd}: no telemetry/circuit info ({type(e).__name__}); skip")
        return None
    rot = getattr(ci, "rotation", 0.0) or 0.0

    res = s.results
    num2id = {str(r.get("DriverNumber")): r.get("DriverId") for _, r in res.iterrows()}
    num2code = {str(r.get("DriverNumber")): r.get("Abbreviation") for _, r in res.iterrows()}
    num2color = {str(r.get("DriverNumber")): r.get("TeamColor") for _, r in res.iterrows()}

    pos = getattr(s, "pos_data", None)
    if not pos:
        print(f"  {season} R{rnd}: no position data; skip")
        return None

    win = _race_window(s)
    if win is None:
        print(f"  {season} R{rnd}: bad race window; skip")
        return None
    race_start, race_end = win
    duration = race_end - race_start
    frames = min(MAX_FRAMES, max(2, int(duration / STEP_S) + 1))
    grid = np.linspace(race_start, race_end, frames)  # SessionTime seconds
    t_grid = grid - race_start                          # seconds from green

    lap_recs, prog_meta, med_lap, lapstart = _lap_timing(s, race_start)

    kept, xs_all, ys_all = [], [], []
    for num, df in pos.items():
        did = num2id.get(str(num))
        if did is None or df is None or len(df) < 2 or "X" not in df or "SessionTime" not in df:
            continue
        secs = df["SessionTime"].dt.total_seconds().to_numpy(dtype=float)
        order = np.argsort(secs)  # SessionTime should be sorted, but be safe for np.interp
        secs = secs[order]
        rx, ry = _rotate(df["X"].to_numpy(dtype=float)[order],
                         df["Y"].to_numpy(dtype=float)[order], rot)
        gx = np.interp(grid, secs, rx, left=np.nan, right=np.nan)
        gy = np.interp(grid, secs, ry, left=np.nan, right=np.nan)
        xy = [
            None if (np.isnan(a) or np.isnan(b)) else [int(round(a)), int(round(b))]
            for a, b in zip(gx, gy)
        ]
        if not any(p is not None for p in xy):
            continue
        empty = (np.array([]), np.array([]), np.array([]))
        prog = _progress(t_grid, prog_meta.get(str(num), empty))
        color = num2color.get(str(num))
        kept.append({
            "num": str(num), "did": did, "code": num2code.get(str(num)),
            "number": int(num) if str(num).isdigit() else None,
            "team_color": f"#{color}" if color and not str(color).startswith("#") else color,
            "xy": xy, "prog": prog,
        })
        for p in xy:
            if p is not None:
                xs_all.append(p[0])
                ys_all.append(p[1])

    if not kept or not xs_all:
        print(f"  {season} R{rnd}: no usable driver traces; skip")
        return None

    # Per-frame live position + gap-to-leader from progress.
    pos_mat, gap_mat = _pos_gap([k["prog"] for k in kept], med_lap)

    drivers_out = []
    for i, k in enumerate(kept):
        prow = [None if np.isnan(v) else int(v) for v in pos_mat[i]]
        grow = [None if prow[j] is None else round(float(gap_mat[i][j]), 1) for j in range(frames)]
        drivers_out.append({
            "driver_id": k["did"], "code": k["code"], "number": k["number"],
            "team_color": k["team_color"], "xy": k["xy"],
            "pos": prow, "gap": grow,
            "laps": lap_recs.get(k["num"], []),
            # 2026 regs dropped DRS (active aero + battery override); FastF1's DRS
            # channel is all-zero for 2026, so skip it rather than emit empties.
            "drs": _drs_intervals(s, k["num"], race_start, duration) if season < 2026 else [],
        })

    t0 = _t0_date(pos)
    safety = safety_periods_time(s, t0, race_start, duration)
    rc_feed = _race_control_feed(s, t0, race_start, duration)
    ot_feed = _overtakes_feed(season, rnd, lapstart)

    blob = {
        "season": season, "round": rnd,
        "circuit_id": circuit_id, "circuit_name": circuit_name,
        "rotation": round(float(rot), 2),
        "frames": frames, "duration_s": round(duration, 1), "total_laps": len(lapstart),
        "bounds": {"min_x": min(xs_all), "max_x": max(xs_all),
                   "min_y": min(ys_all), "max_y": max(ys_all)},
        "times": [round(float(g), 1) for g in t_grid],
        "safety": safety,
        "rc": rc_feed,
        "overtakes": ot_feed,
        "drivers": drivers_out,
        "source": "fastf1",
    }
    path = f"{season}/{_ascii_key(circuit_id)}.json"
    _emit(blob, path, upload)
    print(f"  {season} R{rnd} {circuit_id}: {len(drivers_out)} drivers, {frames} frames, "
          f"{blob['duration_s']}s, {len(safety)} safety period(s) -> {path}")
    return blob


def _emit(blob, path, upload):
    data = json.dumps(blob, separators=(",", ":")).encode()
    if not upload:
        local = os.path.join("replays_out", path)
        os.makedirs(os.path.dirname(local), exist_ok=True)
        with open(local, "wb") as f:
            f.write(data)
        return
    url, key = _env()
    r = requests.post(
        f"{url}/storage/v1/object/{BUCKET}/{path}",
        headers={"Authorization": f"Bearer {key}", "apikey": key,
                 "Content-Type": "application/json", "x-upsert": "true"},
        data=data, timeout=120,
    )
    if not r.ok:
        raise RuntimeError(f"upload {path} failed {r.status_code}: {r.text[:300]}")
    public_url = f"{url}/storage/v1/object/public/{BUCKET}/{path}"
    idx = {
        "season": blob["season"], "round": blob["round"],
        "circuit_id": blob["circuit_id"], "circuit_name": blob["circuit_name"],
        "storage_path": path, "public_url": public_url,
        "driver_count": len(blob["drivers"]), "frames": blob["frames"],
        "duration_s": blob["duration_s"], "rotation": blob["rotation"], "source": "fastf1",
    }
    ir = requests.post(
        f"{url}/rest/v1/f1_race_replay?on_conflict=season,circuit_id",
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
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    cache = os.environ.get("FASTF1_CACHE", ".fastf1cache")
    os.makedirs(cache, exist_ok=True)
    fastf1.Cache.enable_cache(cache)

    rnd = args.round
    if args.event:
        rnd = int(fastf1.get_event(args.season, args.event)["RoundNumber"])
    if rnd is None:
        sys.exit("Provide --round or --event")

    print(f"Race replay export {args.season} R{rnd}")
    export_replay(args.season, rnd, upload=not args.no_upload, force=args.force)


if __name__ == "__main__":
    main()
