#!/usr/bin/env python3
"""Drain pending f1_telemetry_requests (Pit Wall any-lap telemetry).

Standalone version of the former Modal `process_telemetry_requests` cron. Triggered by a
Supabase DB webhook via GitHub `repository_dispatch` (one run per request), or on a
low-frequency schedule as a backstop. It claims pending rows, exports that one driver+lap
telemetry blob (telemetry_export.py --lap), then writes the blob URL back on each row.

Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (FASTF1_CACHE optional)
"""
import os
import subprocess
import sys
from datetime import datetime, timezone

import requests as rq

BASE = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
CACHE = os.environ.get("FASTF1_CACHE", ".fastf1cache")
LIMIT = int(os.environ.get("REQUEST_LIMIT", "8"))


def _now():
    return datetime.now(timezone.utc).isoformat()


def _run(script, *args):
    env = {**os.environ, "FASTF1_CACHE": CACHE}
    print(f"$ python {script} {' '.join(args)}", flush=True)
    subprocess.run([sys.executable, "-u", script, *args], env=env, check=True)


def _patch(rid, body):
    rq.patch(
        f"{BASE}/rest/v1/f1_telemetry_requests",
        params={"id": f"eq.{rid}"},
        headers={**H, "Prefer": "return=minimal"},
        json={**body, "updated_at": _now()},
        timeout=30,
    )


def main():
    r = rq.get(
        f"{BASE}/rest/v1/f1_telemetry_requests",
        params={"status": "eq.pending", "order": "created_at.asc", "limit": str(LIMIT)},
        headers=H,
        timeout=30,
    )
    r.raise_for_status()
    pending = r.json()
    if not pending:
        print("no pending telemetry requests")
        return
    print(f"process_telemetry_requests: {len(pending)} pending")
    for req in pending:
        rid = req["id"]
        drv = str(req.get("driver", "")).strip().upper()
        lap = req.get("lap_number")
        if not drv or lap is None:
            _patch(rid, {"status": "error", "error": "missing driver or lap"})
            continue
        _patch(rid, {"status": "processing"})
        try:
            _run(
                "telemetry_export.py", "--season", str(req["season"]), "--round", str(req["round"]),
                "--session", req.get("session", "R"), "--drivers", drv, "--lap", str(lap),
            )
            ir = rq.get(
                f"{BASE}/rest/v1/f1_telemetry_index",
                params={
                    "season": f"eq.{req['season']}", "round": f"eq.{req['round']}",
                    "session": f"eq.{req.get('session', 'R')}",
                    "driver_code": f"eq.{drv}", "lap_number": f"eq.{lap}",
                    "select": "public_url", "limit": "1",
                },
                headers=H, timeout=30,
            )
            rows = ir.json() if ir.ok else []
            purl = rows[0]["public_url"] if rows else None
            _patch(rid, {
                "status": "done" if purl else "error", "public_url": purl,
                "error": None if purl else "no telemetry produced (lap/data unavailable)",
            })
            print(f"  {rid}: {'done' if purl else 'no output'}")
        except Exception as e:  # noqa: BLE001
            _patch(rid, {"status": "error", "error": str(e)[:400]})
            print(f"  {rid}: error {e}")


if __name__ == "__main__":
    main()
