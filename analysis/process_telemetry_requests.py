#!/usr/bin/env python3
"""Drain pending f1_telemetry_requests (Pit Wall any-lap telemetry).

Run by the GitHub Actions `queue` job (.github/workflows/queue.yml). A database trigger starts
that workflow on each new pending row; the */5 cron is a best-effort backstop. It claims batches
of pending rows until none remain (or the time budget is spent), exports that one driver+lap
telemetry blob (telemetry_export.py --lap), then writes the blob URL back on each row.

Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (FASTF1_CACHE, REQUEST_LIMIT batch size,
QUEUE_TIME_BUDGET_S drain budget in seconds — default 900 —,
QUEUE_STALE_PROCESSING_S age after which `processing` rows are reset — default 1800 — optional)
"""
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone

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


def _run(script, *args, timeout=None):
    env = {**os.environ, "FASTF1_CACHE": _cache()}
    print(f"$ python {script} {' '.join(args)}", flush=True)
    subprocess.run([sys.executable, "-u", script, *args], env=env, check=True, timeout=timeout)


def _patch(rid, body):
    r = rq.patch(
        f"{_base()}/rest/v1/f1_telemetry_requests",
        params={"id": f"eq.{rid}"},
        headers={**_headers(), "Prefer": "return=minimal"},
        json={**body, "updated_at": _now()},
        timeout=30,
    )
    r.raise_for_status()  # a rejected write (grant/RLS change) must not pass silently


# Per-run counters: rows that reached a terminal status, and status writes that failed.
_STATS = {"terminal": 0, "failures": 0}


def _write(rid, body):
    """Write a row's status. Never raises: a failed write is logged and counted (a run that
    cannot write statuses must not ask for a continuation run). Returns True on success."""
    if rid in (None, "?"):
        return False  # row without a usable id: nothing to address
    try:
        _patch(rid, body)
    except Exception as e:  # noqa: BLE001
        _STATS["failures"] += 1
        print(f"  {rid}: status write failed: {e}")
        return False
    if body.get("status") in ("done", "error"):
        _STATS["terminal"] += 1
    return True


def _stale_s():
    try:
        return float(os.environ.get("QUEUE_STALE_PROCESSING_S", "1800"))
    except ValueError:
        raise SystemExit("process_telemetry_requests: QUEUE_STALE_PROCESSING_S must be a number")


def _reset_stale(base, headers, stale_s):
    """Put rows stuck in `processing` (a killed job never wrote a result) back to `pending`.
    Claiming writes updated_at, so "stuck" = updated_at older than stale_s. Runs never overlap
    (workflow concurrency group), so any `processing` row this old belongs to a dead job."""
    cutoff = (datetime.now(timezone.utc) - timedelta(seconds=stale_s)).isoformat()
    try:
        r = rq.patch(
            f"{base}/rest/v1/f1_telemetry_requests",
            params={"status": "eq.processing", "updated_at": f"lt.{cutoff}"},
            headers={**headers, "Prefer": "return=representation"},
            json={"status": "pending", "updated_at": _now()},
            timeout=30,
        )
        r.raise_for_status()
        n = len(r.json())
    except Exception as e:  # noqa: BLE001 — recovery is best-effort; draining must still run
        print(f"process_telemetry_requests: stale reset failed: {e}")
        return 0
    if n:
        print(f"process_telemetry_requests: reset {n} stale processing row(s) to pending")
    return n


def _budget():
    try:
        return float(os.environ.get("QUEUE_TIME_BUDGET_S", "900"))
    except ValueError:
        raise SystemExit("process_telemetry_requests: QUEUE_TIME_BUDGET_S must be a number")


def _row_timeout():
    try:
        return float(os.environ.get("TELEMETRY_ROW_TIMEOUT_S", "180"))
    except ValueError:
        raise SystemExit("process_telemetry_requests: TELEMETRY_ROW_TIMEOUT_S must be a number")


def _set_output(key, value):
    """Append `key=value` to $GITHUB_OUTPUT (no-op outside Actions)."""
    path = os.environ.get("GITHUB_OUTPUT")
    if path:
        with open(path, "a", encoding="utf-8") as f:
            f.write(f"{key}={value}\n")


def _signal_leftover():
    """Tell the workflow that pending rows remain, so its last step starts the next Queue run."""
    path = os.environ.get("GITHUB_OUTPUT")
    if path:
        with open(path, "a", encoding="utf-8") as f:
            f.write("leftover=true\n")
    print("process_telemetry_requests: pending rows remain; asking for a continuation run")


def _has_leftover(base, headers, limit, seen):
    """True if a pending row that this run has not attempted is still waiting."""
    try:
        return any(isinstance(q, dict) and q.get("id") not in seen
                   for q in _fetch_pending(base, headers, limit))
    except Exception as e:  # noqa: BLE001 — a failed check must not fail the run
        print(f"process_telemetry_requests: leftover check failed: {e}")
        return False


def _fetch_pending(base, headers, limit):
    r = rq.get(
        f"{base}/rest/v1/f1_telemetry_requests",
        params={"status": "eq.pending", "order": "created_at.asc", "limit": str(limit)},
        headers=headers,
        timeout=30,
    )
    r.raise_for_status()
    return r.json()


def _drain():
    """Claim batches of REQUEST_LIMIT pending rows until none remain or the time budget
    (QUEUE_TIME_BUDGET_S) is spent. Before claiming each row it checks that the row could
    still finish inside the budget (elapsed + TELEMETRY_ROW_TIMEOUT_S <= budget), so the total runtime is
    bounded by the budget. If rows are left when it stops for budget reasons it signals
    `leftover=true` so the workflow can start the next Queue run."""
    base, headers, limit = _base(), _headers(), _limit()
    budget, row_timeout = _budget(), _row_timeout()
    if row_timeout > budget:
        raise SystemExit(
            f"process_telemetry_requests: TELEMETRY_ROW_TIMEOUT_S ({row_timeout:g} s) exceeds QUEUE_TIME_BUDGET_S ({budget:g} s); "
            "not even one row would fit"
        )
    deadline = time.monotonic() + budget
    state = {"budget_hit": False}

    def can_start():
        if time.monotonic() + row_timeout <= deadline:
            return True
        state["budget_hit"] = True
        return False

    _reset_stale(base, headers, _stale_s())
    seen = set()
    total = 0
    while True:
        pending = _fetch_pending(base, headers, limit)
        if not pending:
            if total == 0:
                print("no pending telemetry requests")
            return
        # A row whose status write failed stays pending; never re-run it in this invocation,
        # and stop when a batch holds nothing new (otherwise this would spin).
        batch = [q for q in pending if not (isinstance(q, dict) and q.get("id") in seen)]
        if not any(isinstance(q, dict) and q.get("id") is not None for q in batch):
            print("process_telemetry_requests: no new pending rows; stopping")
            return
        attempted = _process_batch(base, headers, batch, can_start)
        seen.update(attempted)
        total += len(attempted)
        if state["budget_hit"]:
            print(f"process_telemetry_requests: time budget reached after {total} rows")
            # Continue only if this run made progress and every status write worked; otherwise a
            # persistent write failure would chain runs forever (finite rows + progress = ends).
            if _STATS["failures"]:
                print(f"process_telemetry_requests: not requesting a continuation run (status writes failed)")
            elif _STATS["terminal"] and _has_leftover(base, headers, limit, seen):
                _signal_leftover()
            return


def main():
    _STATS.update(terminal=0, failures=0)
    try:
        _drain()
    finally:
        # Always report the count (also 0): the workflow's last step turns a non-zero value into
        # a failed job, which the free-tier digest counts. The script itself still exits 0 so the
        # next step and the continuation decision run.
        _set_output("write_failures", _STATS["failures"])
        if _STATS["failures"]:
            print(
                f"process_telemetry_requests: ERROR {_STATS['failures']} status write(s) failed "
                f"({_STATS['terminal']} row(s) finished); check the service-role grants/RLS "
                "on f1_telemetry_requests"
            )


def _process_batch(base, headers, pending, can_start):
    """Process rows in order; stop before a row that could not finish inside the budget.
    Returns the ids of the rows attempted."""
    attempted = []
    print(f"process_telemetry_requests: {len(pending)} pending")
    for req in pending:
        if not can_start():
            break
        if isinstance(req, dict) and req.get("id") is not None:
            attempted.append(req["id"])
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
                    _write(rid, {"status": "error", "error": note[:400]})
                except Exception as pe:  # noqa: BLE001
                    print(f"  {rid}: invalid ({note}; status write failed: {pe})")
                else:
                    print(f"  {rid}: invalid ({note})")
                continue
            drv = str(req.get("driver", "")).strip().upper()
            lap = int(req.get("lap_number"))
            if not _write(rid, {"status": "processing"}):
                continue  # not claimed (write failed); do not run work whose result cannot be recorded
            try:
                _run(
                    "telemetry_export.py", "--season", str(req["season"]), "--round", str(req["round"]),
                    "--session", req.get("session", "R"), "--drivers", drv, "--lap", str(lap),
                    timeout=_row_timeout(),
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
                _write(rid, {
                    "status": "done" if purl else "error", "public_url": purl,
                    "error": None if purl else "no telemetry produced (lap/data unavailable)",
                })
                print(f"  {rid}: {'done' if purl else 'no output'}")
            except subprocess.TimeoutExpired:
                msg = f"timed out after {_row_timeout():g} s — retry later"
                try:
                    _write(rid, {"status": "error", "error": msg})
                except Exception as pe:  # noqa: BLE001 — never crash the daemon
                    print(f"  {rid}: error {msg} (status write failed: {pe})")
                else:
                    print(f"  {rid}: error {msg}")
            except Exception as e:  # noqa: BLE001
                try:
                    _write(rid, {"status": "error", "error": str(e)[:400]})
                except Exception as pe:  # noqa: BLE001 — never crash the daemon
                    print(f"  {rid}: error {e} (status write failed: {pe})")
                else:
                    print(f"  {rid}: error {e}")
        except Exception as e:  # noqa: BLE001 — invalid row shape must not kill the loop
            try:
                _write(rid, {"status": "error", "error": f"invalid request: {e}"[:400]})
            except Exception:
                pass
            print(f"  ?: error {e}")

    return attempted


if __name__ == "__main__":
    main()
