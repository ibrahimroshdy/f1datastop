#!/usr/bin/env python3
"""Drain pending f1_telemetry_requests (Pit Wall any-lap telemetry).

Run by GitHub Actions (pr-ci.yml). A Supabase DB trigger (`dispatch_ci_request`) starts a pipeline per
request, with a low-frequency schedule as a backstop. It claims pending rows, exports that one driver+lap
telemetry blob (telemetry_export.py --lap), then writes the blob URL back on each row.

Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (FASTF1_CACHE optional)
"""
import os
import re
import subprocess
import sys
from datetime import datetime, timezone

import requests as rq

SESSIONS = ("FP1", "FP2", "FP3", "Q", "SQ", "SS", "S", "R")
_DRIVER_RE = re.compile(r"^[A-Z]{3}$")
_SEASON_MIN, _SEASON_MAX = 1950, 2100
_ROUND_MIN, _ROUND_MAX = 1, 30
_LAP_MIN, _LAP_MAX = 0, 200


def _base():
    v = os.environ.get("SUPABASE_URL")
    if not v:
        raise SystemExit("process_telemetry_requests: missing env SUPABASE_URL")
    return v.rstrip("/")


def _key():
    v = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not v:
        raise SystemExit("process_telemetry_requests: missing env SUPABASE_SERVICE_ROLE_KEY")
    return v


def _headers():
    k = _key()
    return {"apikey": k, "Authorization": f"Bearer {k}", "Content-Type": "application/json"}


def _cache():
    return os.environ.get("FASTF1_CACHE", ".fastf1cache")


def _limit():
    try:
        return int(os.environ.get("REQUEST_LIMIT", "8"))
    except ValueError:
        raise SystemExit("process_telemetry_requests: REQUEST_LIMIT must be an integer")


def _validate(req):
    """Return an error note if the row is invalid, else None."""
    sess = req.get("session", "R")
    if sess not in SESSIONS:
        return f"invalid session {sess!r} (expected one of {','.join(SESSIONS)})"
    try:
        season = int(req["season"])
    except (KeyError, TypeError, ValueError):
        return f"invalid season {req.get('season')!r}"
    if not (_SEASON_MIN <= season <= _SEASON_MAX):
        return f"season {season} out of range {_SEASON_MIN}..{_SEASON_MAX}"
    try:
        rnd = int(req["round"])
    except (KeyError, TypeError, ValueError):
        return f"invalid round {req.get('round')!r}"
    if not (_ROUND_MIN <= rnd <= _ROUND_MAX):
        return f"round {rnd} out of range {_ROUND_MIN}..{_ROUND_MAX}"
    drv = str(req.get("driver", "")).strip().upper()
    if not _DRIVER_RE.match(drv):
        return f"invalid driver {req.get('driver')!r} (expected ^[A-Z]{{3}}$)"
    try:
        lap = int(req.get("lap_number"))
    except (TypeError, ValueError):
        return f"invalid lap_number {req.get('lap_number')!r}"
    if not (_LAP_MIN <= lap <= _LAP_MAX):
        return f"lap_number {lap} out of range {_LAP_MIN}..{_LAP_MAX}"
    return None


def _now():
    return datetime.now(timezone.utc).isoformat()


def _run(script, *args):
    env = {**os.environ, "FASTF1_CACHE": _cache()}
    print(f"$ python {script} {' '.join(args)}", flush=True)
    subprocess.run([sys.executable, "-u", script, *args], env=env, check=True)


def _patch(rid, body):
    rq.patch(
        f"{_base()}/rest/v1/f1_telemetry_requests",
        params={"id": f"eq.{rid}"},
        headers={**_headers(), "Prefer": "return=minimal"},
        json={**body, "updated_at": _now()},
        timeout=30,
    )


def main():
    base, headers, limit = _base(), _headers(), _limit()
    r = rq.get(
        f"{base}/rest/v1/f1_telemetry_requests",
        params={"status": "eq.pending", "order": "created_at.asc", "limit": str(limit)},
        headers=headers,
        timeout=30,
    )
    r.raise_for_status()
    pending = r.json()
    if not pending:
        print("no pending telemetry requests")
        return
    print(f"process_telemetry_requests: {len(pending)} pending")
    for req in pending:
        try:
            rid = req["id"] if isinstance(req, dict) else "?"
        except Exception:
            print("  ?: skipping row without id")
            continue
        try:
            if not isinstance(req, dict):
                print("  ?: skipping non-object row")
                continue
            note = _validate(req)
            if note:
                try:
                    _patch(rid, {"status": "error", "error": note[:400]})
                except Exception as pe:  # noqa: BLE001
                    print(f"  {rid}: invalid ({note}; status write failed: {pe})")
                else:
                    print(f"  {rid}: invalid ({note})")
                continue
            drv = str(req.get("driver", "")).strip().upper()
            lap = int(req.get("lap_number"))
            _patch(rid, {"status": "processing"})
            try:
                _run(
                    "telemetry_export.py", "--season", str(req["season"]), "--round", str(req["round"]),
                    "--session", req.get("session", "R"), "--drivers", drv, "--lap", str(lap),
                )
                ir = rq.get(
                    f"{base}/rest/v1/f1_telemetry_index",
                    params={
                        "season": f"eq.{req['season']}", "round": f"eq.{req['round']}",
                        "session": f"eq.{req.get('session', 'R')}",
                        "driver_code": f"eq.{drv}", "lap_number": f"eq.{lap}",
                        "select": "public_url", "limit": "1",
                    },
                    headers=headers, timeout=30,
                )
                rows = ir.json() if ir.ok else []
                purl = rows[0]["public_url"] if rows else None
                _patch(rid, {
                    "status": "done" if purl else "error", "public_url": purl,
                    "error": None if purl else "no telemetry produced (lap/data unavailable)",
                })
                print(f"  {rid}: {'done' if purl else 'no output'}")
            except Exception as e:  # noqa: BLE001
                try:
                    _patch(rid, {"status": "error", "error": str(e)[:400]})
                except Exception as pe:  # noqa: BLE001 — never crash the daemon
                    print(f"  {rid}: error {e} (status write failed: {pe})")
                else:
                    print(f"  {rid}: error {e}")
        except Exception as e:  # noqa: BLE001 — invalid row shape must not kill the loop
            try:
                _patch(rid, {"status": "error", "error": f"invalid request: {e}"[:400]})
            except Exception:
                pass
            print(f"  ?: error {e}")


if __name__ == "__main__":
    main()
