"""Classify upstream failures once, for every pipeline script.

  is_transient(exc)  network errors, timeouts, HTTP 429 / 5xx — worth retrying
  is_absent(exc)     upstream definitively has no such data (HTTP 404, FastF1
                     "not loaded / not available", "Session type … does not exist")

generate.py (retry + exit codes) and the assets exporters (telemetry / weather /
race-replay / circuit-geometry) share these so "skip" vs "fail" means the same thing
everywhere. `skip_or_fail` is the exporters' policy:

  * definitive absence                          -> skip (exit 0)
  * session not yet due (scheduled time ahead)  -> skip (exit 0)
  * anything else for a session that is due, or whose dueness is UNKNOWN because the
    schedule could not be read                  -> ExportFailure (callers exit nonzero)

Light on purpose: stdlib + requests only, so importing it never drags in matplotlib.
"""
import sys
from datetime import datetime, timedelta, timezone

import requests

# FastF1 exception classes (fastf1/exceptions.py, fastf1/_api.py) meaning "no such data".
_ABSENT_TYPE_NAMES = {"DataNotLoadedError", "NoLapDataError", "SessionNotAvailableError"}

DUE_GRACE_HOURS = 3.0
UNKNOWN = "unknown"  # session_is_due(): the schedule could not be read


class ExportFailure(RuntimeError):
    """An unexpected error for a session that should exist."""


def _exc_chain(exc):
    """The exception plus everything it was raised from / during (cycle-safe)."""
    seen = []
    while exc is not None and all(exc is not x for x in seen):
        seen.append(exc)
        exc = exc.__cause__ or exc.__context__
    return seen


def _http_status(exc):
    resp = getattr(exc, "response", None)
    return getattr(resp, "status_code", None)


def is_transient(exc):
    """True for failures worth retrying: network errors, timeouts, HTTP 429 / 5xx."""
    for e in _exc_chain(exc):
        if isinstance(e, (requests.ConnectionError, requests.Timeout,
                          ConnectionError, TimeoutError)):
            return True
        status = _http_status(e)
        if status is not None and (status == 429 or status >= 500):
            return True
    return False


def is_absent(exc):
    """True when upstream definitively has no such data (HTTP 404, FastF1 'not loaded')."""
    for e in _exc_chain(exc):
        if _http_status(e) == 404:
            return True
        if type(e).__name__ in _ABSENT_TYPE_NAMES:
            return True
        # fastf1.events: "Session type 'S' does not exist for this event" (e.g. a Sprint
        # asked of a non-sprint round).
        if isinstance(e, ValueError) and "does not exist" in str(e):
            return True
    return False


def session_is_due(season, rnd, code, now=None, grace_hours=DUE_GRACE_HOURS):
    """Should this session already exist upstream?

    True once its scheduled start + grace has passed; False before. None when the schedule
    says the session isn't part of that weekend (absent by definition). UNKNOWN when the
    schedule can't be read for the current/future season — that is NOT "not due": callers
    must not let a schedule outage hide a real failure. (Past seasons with an unreadable schedule are treated as due.)
    """
    now = now or datetime.now(timezone.utc)
    try:
        import cdn_schedule
        rows = cdn_schedule.sessions(season)
    except Exception as e:  # noqa: BLE001 — schedule unreadable
        if season < now.year:
            return True  # past seasons are complete; no schedule needed
        print(f"  schedule unreadable for {season} ({type(e).__name__}: {e}); "
              f"cannot tell whether R{rnd} {code} is due", file=sys.stderr)
        return UNKNOWN
    starts = [st for r, c, st in rows if r == int(rnd) and c == code]
    if not starts:
        return None
    return now >= min(starts) + timedelta(hours=grace_hours)


_UNSET = object()


def skip_or_fail(exc, label, season, rnd, code, now=None, due=_UNSET):
    """Apply the exporters' policy to a load error. Returns normally to mean "skip";
    raises ExportFailure for an unexpected error on a session that is due.

    `due` (True / False / None=not on the schedule / UNKNOWN) overrides the lookup."""
    if is_absent(exc):
        print(f"  {label}: not available ({type(exc).__name__}: {exc}); skip")
        return
    if due is _UNSET:
        due = session_is_due(season, rnd, code, now=now)
    if due is None:
        print(f"  {label}: session not on the schedule ({type(exc).__name__}: {exc}); skip")
        return
    if not due:
        print(f"  {label}: not due yet ({type(exc).__name__}: {exc}); skip")
        return
    kind = "transient upstream error" if is_transient(exc) else "unexpected error"
    why = ("a session that may exist (schedule unreadable, so it can't be ruled out)"
           if due == UNKNOWN else "a session that should exist")
    raise ExportFailure(f"{label}: {kind} for {why}: "
                        f"{type(exc).__name__}: {exc}") from exc


def report_failures(failures):
    """Print failures to stderr; returns the process exit code (1 if any)."""
    for f in failures:
        print(f"ERROR {f}", file=sys.stderr)
    return 1 if failures else 0
