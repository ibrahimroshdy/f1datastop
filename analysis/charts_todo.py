#!/usr/bin/env python3
"""Which (round, session) pairs need Deep Dive charts right now? — the Actions gate.

The chart workflow used to load every session of two rounds through FastF1 on every cron
tick (16 heavy loads, ~45 min) even when nothing new had happened, which is what burned
5,000 Actions minutes in a month. This gate is cheap (CDN reads only, no FastF1 session
load) and prints one `round session` per line for sessions that:
  1. have finished — scheduled start + grace (date_end isn't populated), and
  2. are missing charts — the session lacks a dark landscape row with a thumbnail for
     some REQUIRED chart (thumb_path is the "rendered by the current pipeline" marker, so
     pre-thumbnail history gets picked up once). The required set comes from generate.py's
     own registry (required_charts_for_session = charts_for_session minus OPTIONAL_CHARTS,
     the charts that can legitimately render nothing); this module keeps no list of its
     own. A partially rendered session (e.g. an interrupted run) is picked up again — one
     chart is not "complete" — but a session missing only optional charts is complete.
An empty result means the job should exit immediately. Any error (schedule or index
unreadable AND no fallback) exits nonzero — never a silent "all complete".
Stdout carries only `<round> <session>` lines; diagnostics go to stderr.

Dependencies: pipeline.yml installs analysis/requirements.txt before this runs, so the
registry is simply imported from generate.py. If that import fails (a local run without
FastF1/matplotlib installed) the same registry assignments are evaluated from the
generate.py source instead — a convenience for local runs, not something CI relies on.
Reads the CDN schedule and the CDN chart index (no database); SUPABASE_URL /
SUPABASE_SERVICE_ROLE_KEY are only the fallback when the CDN is unreachable.
Args: --season, --grace-hours (default 3), --window-days (7).
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

import cdn_schedule
import standings_fp
from datetime import datetime, timedelta, timezone

TIMED = ("FP1", "FP2", "FP3", "Q", "SQ", "SS", "S", "R")
SOCIAL = ("_twitter", "_instagram", "_story")


def expected_charts(session):
    """Chart keys a session of this type must have to count as complete: generate.py's
    bulk set minus its OPTIONAL_CHARTS (charts that can legitimately render nothing).

    Imports generate.py's registry (pipeline.yml installs its deps first). If that import
    fails — a local run without FastF1/matplotlib — the same assignments are evaluated
    straight from the generate.py source (stdlib only): one source of truth, never a copy.
    """
    try:
        import generate
        return set(generate.required_charts_for_session(session))
    except ImportError:
        ns = _registry_from_source()
        return set(ns["charts_for_session"](session)) - set(ns["OPTIONAL_CHARTS"])


def _registry_from_source():
    import ast
    src_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "generate.py")
    with open(src_path, encoding="utf-8") as f:
        tree = ast.parse(f.read())
    wanted = ("_PACE_CHARTS", "_QUALI_CHARTS", "_RACE_CHARTS", "SESSION_CHARTS", "OPTIONAL_CHARTS")
    ns = {}
    for node in tree.body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1 \
                and isinstance(node.targets[0], ast.Name) and node.targets[0].id in wanted:
            code = compile(ast.Expression(node.value), src_path, "eval")
            ns[node.targets[0].id] = eval(code, {}, dict(ns))  # noqa: S307 — set/dict literals + `|` of our own file
    missing = [w for w in wanted if w not in ns]
    if missing:
        raise RuntimeError(f"generate.py registry not found: {missing}")
    ns["charts_for_session"] = lambda code: ns["SESSION_CHARTS"].get((code or "R").upper(), ns["_RACE_CHARTS"])
    return ns


def get(url, key, table, params):
    q = urllib.parse.urlencode(params)
    req = urllib.request.Request(f"{url}/rest/v1/{table}?{q}",
                                 headers={"apikey": key, "Authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def _finished_sessions(season, grace_hours, window_days):
    """[(round, session)] that ended within the window — CDN schedule, Supabase fallback."""
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=window_days)
    try:
        rows = [(r, c, st) for r, c, st in cdn_schedule.sessions(season) if st >= since]
        source = "cdn"
    except Exception as e:  # noqa: BLE001 — CDN file missing: fall back to the warehouse
        print(f"(schedule: CDN unavailable ({e}); using Supabase)", file=sys.stderr)
        url = os.environ["SUPABASE_URL"].rstrip("/")
        key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        rows = []
        for s in get(url, key, "f1_session", {
                "select": "round,session_type,date_start", "season": f"eq.{season}",
                "date_start": f"gte.{since.isoformat()}", "order": "date_start.asc", "limit": "200"}):
            if s.get("date_start"):
                rows.append((int(s["round"]), s["session_type"],
                             datetime.fromisoformat(s["date_start"].replace("Z", "+00:00"))))
        source = "supabase"
    ended = [(r, c) for r, c, st in rows if c in TIMED and now >= st + timedelta(hours=grace_hours)]
    return ended, source


def _is_landscape(chart_type):
    return not any(t in chart_type for t in SOCIAL)


def _done_types(rows):
    """chart_type keys that count as published: dark, landscape, with a thumbnail."""
    return {r.get("chart_type", "") for r in rows
            if r.get("theme", "dark") == "dark" and r.get("thumb_path")
            and _is_landscape(r.get("chart_type", ""))}


def _is_complete(published, session):
    """True when `published` (chart_type keys) covers the session's full expected set."""
    return not (expected_charts(session) - set(published))


def _has_charts(season, rnd, session, latest=False):
    """True when the CDN chart index has the session's FULL expected chart set and its
    standings charts still match the current standings (BUG-003)."""
    try:
        rows = cdn_schedule.fetch_json(f"index/charts/{season}/{rnd:02d}/{session}.json")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return False
        raise
    if not _is_complete(_done_types(rows), session):
        return False
    # The season-level standings export only describes the newest round.
    return not (latest and session in ("R", "S") and _standings_stale(season, rows))


def _fetch_text(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": "f1datastop-actions/1.0 (+https://www.f1datastop.com)"})
    with urllib.request.urlopen(req, timeout=20) as r:  # noqa: S310 — our own CDN
        return r.read().decode().strip()


def _standings_stale(season, rows):
    """True when the session's standings charts were drawn from different standings than
    the current CDN export (or carry no fingerprint at all). Only the newest round's charts
    are comparable to the season-level export, so callers pass the index rows of one
    session; a read error is treated as "not stale" (never loop re-rendering on an outage)."""
    path = next((r.get("storage_path") for r in rows
                 if r.get("chart_type") == "championship" and r.get("theme", "dark") == "dark"),
                None)
    if not path:
        return False
    try:
        d = cdn_schedule.fetch_json(f"{season}/driverStandings.json")
        c = cdn_schedule.fetch_json(f"{season}/constructorStandings.json")
        want = standings_fp.fingerprint(d, c)
        fp_url = path.split("/landscape/")[0] + "/" + standings_fp.FP_NAME
        try:
            have = _fetch_text(f"{cdn_schedule.cdn_host().rstrip('/')}/charts/{fp_url}")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return True   # rendered before fingerprints existed: re-check once
            raise
    except Exception as e:  # noqa: BLE001
        print(f"(standings check skipped: {e})", file=sys.stderr)
        return False
    return have != want


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", type=int, default=datetime.now(timezone.utc).year)
    ap.add_argument("--grace-hours", type=float, default=3.0,
                    help="a session counts as finished this long after date_start")
    ap.add_argument("--window-days", type=int, default=7,
                    help="only look at sessions that started within this many days")
    a = ap.parse_args()

    ended, source = _finished_sessions(a.season, a.grace_hours, a.window_days)
    if not ended:
        return 0

    # "Done" = the CDN index (index_export.py, rebuilt from R2 after every render) lists a
    # dark landscape chart with a thumbnail. No database involved; the old analysis_charts
    # query only runs if the CDN itself is unreachable.
    try:
        latest = max((r for r, _ in ended), default=None)
        done = {(r, sess) for r, sess in ended
                if _has_charts(a.season, r, sess, latest=(r == latest))}
    except Exception as e:  # noqa: BLE001
        print(f"(chart index: CDN unavailable ({e}); using Supabase)", file=sys.stderr)
        url = os.environ["SUPABASE_URL"].rstrip("/")
        key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        rounds = sorted({r for r, _ in ended})
        have = get(url, key, "analysis_charts", {
            "select": "round,session,chart_type", "season": f"eq.{a.season}",
            "round": f"in.({','.join(map(str, rounds))})", "theme": "eq.dark",
            "thumb_path": "not.is.null", "limit": "5000"})
        by_session = {}
        for h in have:
            by_session.setdefault((int(h["round"]), h["session"]), []).append(h)
        done = {k for k, rows in by_session.items() if _is_complete(_done_types(rows), k[1])}
    for r, sess in ended:
        if (r, sess) not in done:
            print(f"{r} {sess}")
    return 0


def run():
    try:
        return main()
    except Exception as e:  # noqa: BLE001 — surface as a failed gate, never "all complete"
        print(f"charts_todo: ERROR {type(e).__name__}: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(run())
