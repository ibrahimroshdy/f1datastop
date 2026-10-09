#!/usr/bin/env python3
"""Drain pending f1_chart_requests (Deep Dive custom charts).

Run by CircleCI. A Supabase DB trigger (`dispatch_ci_request`) starts a pipeline per
request, with a low-frequency schedule as a backstop. It claims pending rows, runs generate.py with the
requested drivers, then writes the result URL back on each row. The web UI is unchanged:
it inserts the request and polls analysis_charts / the row's status.

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
        f"{BASE}/rest/v1/f1_chart_requests",
        params={"id": f"eq.{rid}"},
        headers={**H, "Prefer": "return=minimal"},
        json={**body, "updated_at": _now()},
        timeout=30,
    )


def main():
    r = rq.get(
        f"{BASE}/rest/v1/f1_chart_requests",
        params={"status": "eq.pending", "order": "created_at.asc", "limit": str(LIMIT)},
        headers=H,
        timeout=30,
    )
    r.raise_for_status()
    pending = r.json()
    if not pending:
        print("no pending chart requests")
        return
    print(f"process_chart_requests: {len(pending)} pending")
    for req in pending:
        rid = req["id"]
        codes = [str(d).strip().upper() for d in (req.get("drivers") or []) if str(d).strip()]
        # Two kinds of request share this queue: a custom driver pick (>=2 codes, keyed by
        # driver_key) and a plain "render this standard chart in <format>" download request
        # (no codes). A single code is neither.
        if len(codes) == 1:
            _patch(rid, {"status": "error", "error": "pick at least 2 drivers (or none for the standard chart)"})
            continue
        # Bulk runs pre-render only the landscape master + thumbnail; a request names the
        # single format/theme the user asked to download, so render exactly that one.
        fmt = req.get("format") or "landscape"
        theme = req.get("theme") or "dark"
        _patch(rid, {"status": "processing"})
        try:
            _run(
                "generate.py", "--season", str(req["season"]), "--round", str(req["round"]),
                "--session", req.get("session", "R"), "--only", req["chart"],
                *(["--drivers", ",".join(codes)] if codes else []),
                "--format", fmt, "--theme", theme,
            )
            dk = ("__" + "-".join(sorted(codes))) if codes else ""
            ct = req["chart"] + ("" if fmt == "landscape" else f"_{fmt}") + dk
            cr = rq.get(
                f"{BASE}/rest/v1/analysis_charts",
                params={
                    "season": f"eq.{req['season']}", "round": f"eq.{req['round']}",
                    "session": f"eq.{req.get('session', 'R')}",
                    "chart_type": f"eq.{ct}", "theme": f"eq.{theme}",
                    "select": "public_url", "limit": "1",
                },
                headers=H, timeout=30,
            )
            rows = cr.json() if cr.ok else []
            purl = rows[0]["public_url"] if rows else None
            _patch(rid, {
                "status": "done" if purl else "error", "public_url": purl,
                "error": None if purl else "no chart produced (driver data unavailable)",
            })
            print(f"  {rid}: {'done' if purl else 'no output'}")
        except Exception as e:  # noqa: BLE001
            _patch(rid, {"status": "error", "error": str(e)[:400]})
            print(f"  {rid}: error {e}")


if __name__ == "__main__":
    main()
