"""Session start times from f1-proxy (or CDN fallback) — shared by the Actions gates.

A proxy answer only counts when it is usable: an `error` field, a non-OK status, or zero
races is a FAILURE and falls back to the CDN schedule. If the fallback is also empty or
unreadable, `sessions()` raises — callers (charts_todo) then fail loudly instead of
treating "no schedule" as "nothing to do".

Reads schedule via f1-proxy (Ergast/Jolpica) so gates work with no database credentials
and keep working while Supabase is restricted. Session codes match f1_session.session_type:
FP1 FP2 FP3 Q SQ SS S R.
"""
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone

PROXY_BASE = os.environ.get("F1_PROXY_URL", "https://www.f1datastop.com").rstrip("/")
DEFAULT_HOST = "https://cdn.f1datastop.com"
_KEYS = (("FirstPractice", "FP1"), ("SecondPractice", "FP2"), ("ThirdPractice", "FP3"),
         ("Qualifying", "Q"), ("SprintQualifying", "SQ"), ("SprintShootout", "SS"), ("Sprint", "S"))


def _proxy_headers():
    """Headers for f1-proxy call (uses anon key)."""
    anon = os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")
    return {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "f1datastop-actions/1.0 (+https://www.f1datastop.com)",
        **({"Authorization": f"Bearer {anon}"} if anon else {}),
    }


def _post_json(url, payload):
    """POST JSON and return parsed response."""
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={**_proxy_headers(), "Accept-Encoding": "identity"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


class ScheduleUnavailable(RuntimeError):
    """No usable schedule from the proxy or the CDN."""


def parse_proxy_response(resp):
    """Races from an f1-proxy envelope {data, cached, cacheKey, status, error}.

    Raises ValueError when the envelope reports a failure (error field, non-2xx status)
    or carries no races — an empty body is never a valid "empty season".
    """
    if not isinstance(resp, dict):
        raise ValueError(f"proxy returned non-object response ({type(resp).__name__})")
    if resp.get("error"):
        raise ValueError(f"proxy error: {resp['error']}")
    status = resp.get("status")
    if isinstance(status, int) and not 200 <= status < 300:
        raise ValueError(f"proxy status {status}")
    data = resp.get("data")
    if isinstance(data, dict):
        races = data.get("MRData", {}).get("RaceTable", {}).get("Races", [])
    elif isinstance(data, list):
        races = data
    else:
        races = []
    if not races:
        raise ValueError("proxy returned zero races")
    return races


def fetch_proxy_schedule(season: int):
    """Fetch schedule via f1-proxy (Ergast path). Raises on any unusable answer."""
    payload = {"source": "ergast", "path": f"/f1/{season}.json"}
    return parse_proxy_response(_post_json(PROXY_BASE, payload))


def cdn_host():
    return (os.environ.get("BLOB_PUBLIC_BASE") or "https://cdn.f1datastop.com").rstrip("/")


def fetch_json(path):
    """GET `data/{path}` from the CDN and return parsed JSON.

    Shared by the Actions gates (charts_todo, circuit_geometry_export,
    race_replay_export) so every caller builds the URL the same way.
    Raises (e.g. urllib.error.HTTPError 404) on a miss — callers decide
    whether a miss is a fallback or a skip.
    """
    host = cdn_host()
    url = f"{host}/data/{path.lstrip('/')}"
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "Accept-Encoding": "identity",
            "User-Agent": "f1datastop-actions/1.0 (+https://www.f1datastop.com)",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def _ts(obj):
    d, t = (obj or {}).get("date"), (obj or {}).get("time")
    if not d:
        return None
    return datetime.fromisoformat(f"{d}T{(t or '00:00:00Z').replace('Z', '+00:00')}")


def sessions(season):
    """[(round:int, code:str, start:datetime UTC)] for every timed session."""
    try:
        races = fetch_proxy_schedule(season)
    except Exception as e:  # noqa: BLE001
        print(f"[cdn_schedule] proxy fetch failed: {e}, falling back to CDN schedule", file=sys.stderr)
        # Fallback to CDN static schedule (may be stale)
        races = _fetch_cdn_schedule(season)
        if not races:
            raise ScheduleUnavailable(
                f"no usable {season} schedule: proxy failed ({e}) and CDN schedule is empty/unreadable")
    out = []
    for race in races:
        rnd = int(race.get("round") or 0)
        if not rnd:
            continue
        for key, code in (("FirstPractice", "FP1"), ("SecondPractice", "FP2"),
                          ("ThirdPractice", "FP3"), ("Qualifying", "Q"),
                          ("SprintQualifying", "SQ"), ("SprintShootout", "SS"),
                          ("Sprint", "S")):
            start = _ts(race.get(key))
            if start:
                out.append((rnd, code, start))
        start = _ts(race)
        if start:
            out.append((rnd, "R", start))
    return out


def _fetch_cdn_schedule(season):
    """Fallback: read static schedule.json from CDN."""
    try:
        data = fetch_json(f"{season}/schedule.json")
    except Exception as e:  # noqa: BLE001
        print(f"[cdn_schedule] CDN schedule fetch failed: {e}", file=sys.stderr)
        return []
    if isinstance(data, dict):
        return data.get("MRData", {}).get("RaceTable", {}).get("Races", [])
    return data if isinstance(data, list) else []


def now_utc():
    return datetime.now(timezone.utc)