#!/usr/bin/env python3
"""Drain pending f1_chart_requests (Deep Dive custom charts).

Run by GitHub Actions (pr-ci.yml). A Supabase DB trigger (`dispatch_ci_request`) starts a pipeline per
request, with a low-frequency schedule as a backstop. It claims pending rows, runs generate.py with the
requested drivers, then writes the result URL back on each row. The web UI is unchanged:
it inserts the request and polls analysis_charts / the row's status.

Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (FASTF1_CACHE optional)
"""
import os
import re
import subprocess
import sys
from datetime import datetime, timezone

import requests as rq

SESSIONS = ("FP1", "FP2", "FP3", "Q", "SQ", "SS", "S", "R")
FORMATS = ("landscape", "twitter", "instagram", "story", "both", "all")
THEMES = ("dark", "light", "all")
_DRIVER_RE = re.compile(r"^[A-Z]{3}$")
_SEASON_MIN, _SEASON_MAX = 1950, 2100
_ROUND_MIN, _ROUND_MAX = 1, 30


def _base():
    v = os.environ.get("SUPABASE_URL")
    if not v:
        raise SystemExit("process_chart_requests: missing env SUPABASE_URL")
    return v.rstrip("/")


def _key():
    v = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not v:
        raise SystemExit("process_chart_requests: missing env SUPABASE_SERVICE_ROLE_KEY")
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
        raise SystemExit("process_chart_requests: REQUEST_LIMIT must be an integer")


def _chart_keys():
    """Valid chart keys parsed from generate.py's CHARTS registry (no heavy import)."""
    src = os.path.join(os.path.dirname(os.path.abspath(__file__)), "generate.py")
    keys = set()
    try:
        with open(src, encoding="utf-8") as f:
            text = f.read()
        block = text[text.index("CHARTS = ["):]
        block = block[:block.index("\n]")]
        for m in re.finditer(r'\(\s*"([a-z_0-9]+)",', block):
            keys.add(m.group(1))
    except (OSError, ValueError):
        pass
    return keys


def _validate(req):
    """Return an error note if the row is invalid, else None."""
    sess = req.get("session", "R")
    if sess not in SESSIONS:
        return f"invalid session {sess!r} (expected one of {','.join(SESSIONS)})"
    chart = req.get("chart")
    if not chart:
        return "missing chart"
    known = _chart_keys()
    if known and chart not in known:
        return f"unknown chart {chart!r}"
    fmt = req.get("format") or "landscape"
    if fmt not in FORMATS:
        return f"invalid format {fmt!r} (expected one of {','.join(FORMATS)})"
    theme = req.get("theme") or "dark"
    if theme not in THEMES:
        return f"invalid theme {theme!r} (expected one of {','.join(THEMES)})"
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
    codes = [str(d).strip().upper() for d in (req.get("drivers") or []) if str(d).strip()]
    for c in codes:
        if not _DRIVER_RE.match(c):
            return f"invalid driver code {c!r} (expected ^[A-Z]{{3}}$)"
    return None


def _now():
    return datetime.now(timezone.utc).isoformat()


def _run(script, *args):
    env = {**os.environ, "FASTF1_CACHE": _cache()}
    print(f"$ python {script} {' '.join(args)}", flush=True)
    subprocess.run([sys.executable, "-u", script, *args], env=env, check=True)


def _patch(rid, body):
    rq.patch(
        f"{_base()}/rest/v1/f1_chart_requests",
        params={"id": f"eq.{rid}"},
        headers={**_headers(), "Prefer": "return=minimal"},
        json={**body, "updated_at": _now()},
        timeout=30,
    )


def main():
    base, headers, limit = _base(), _headers(), _limit()
    r = rq.get(
        f"{base}/rest/v1/f1_chart_requests",
        params={"status": "eq.pending", "order": "created_at.asc", "limit": str(limit)},
        headers=headers,
        timeout=30,
    )
    r.raise_for_status()
    pending = r.json()
    if not pending:
        print("no pending chart requests")
        return
    print(f"process_chart_requests: {len(pending)} pending")
    for req in pending:
        try:
            rid = req["id"]
        except (KeyError, TypeError):
            print("  ?: skipping row without id")
            continue
        try:
            note = _validate(req)
            if note:
                _patch(rid, {"status": "error", "error": note[:400]})
                print(f"  {rid}: invalid ({note})")
                continue
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
                    f"{base}/rest/v1/analysis_charts",
                    params={
                        "season": f"eq.{req['season']}", "round": f"eq.{req['round']}",
                        "session": f"eq.{req.get('session', 'R')}",
                        "chart_type": f"eq.{ct}", "theme": f"eq.{theme}",
                        "select": "public_url", "limit": "1",
                    },
                    headers=headers, timeout=30,
                )
                rows = cr.json() if cr.ok else []
                purl = rows[0]["public_url"] if rows else None
                _patch(rid, {
                    "status": "done" if purl else "error", "public_url": purl,
                    "error": None if purl else "no chart produced (driver data unavailable)",
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
                rid = req.get("id", "?") if isinstance(req, dict) else "?"
                _patch(rid, {"status": "error", "error": f"invalid request: {e}"[:400]})
            except Exception:
                pass
            print(f"  ?: error {e}")


if __name__ == "__main__":
    main()
