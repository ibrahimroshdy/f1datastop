"""Session start times from the CDN schedule (stdlib only) — shared by the Actions gates.

Reads `data/{season}/schedule.json` (Ergast-shaped, written by data_export.py) from the
public CDN so the gates work with no database credentials and keep working while Supabase
is restricted. Session codes match f1_session.session_type: FP1 FP2 FP3 Q SQ SS S R.
"""
import json
import os
import urllib.request
from datetime import datetime, timezone

DEFAULT_HOST = "https://cdn.f1datastop.com"
_KEYS = (("FirstPractice", "FP1"), ("SecondPractice", "FP2"), ("ThirdPractice", "FP3"),
         ("Qualifying", "Q"), ("SprintQualifying", "SQ"), ("SprintShootout", "SS"), ("Sprint", "S"))


def cdn_host():
    return (os.environ.get("BLOB_PUBLIC_BASE") or DEFAULT_HOST).rstrip("/")


def fetch_json(path, timeout=20):
    """GET {host}/data/{path} with a cache-buster (the edge caches these for 5 min)."""
    sep = "&" if "?" in path else "?"
    url = f"{cdn_host()}/data/{path}{sep}t={int(datetime.now().timestamp())}"
    req = urllib.request.Request(url, headers={"Accept": "application/json", "Accept-Encoding": "identity",
                                               "User-Agent": "f1datastop-actions/1.0 (+https://www.f1datastop.com)"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def _ts(obj):
    d, t = (obj or {}).get("date"), (obj or {}).get("time")
    if not d:
        return None
    return datetime.fromisoformat(f"{d}T{(t or '00:00:00Z').replace('Z', '+00:00')}")


def sessions(season):
    """[(round:int, code:str, start:datetime UTC)] for every timed session on the CDN schedule."""
    races = fetch_json(f"{season}/schedule.json")
    if isinstance(races, dict):  # tolerate an MRData envelope
        races = races.get("MRData", {}).get("RaceTable", {}).get("Races", [])
    out = []
    for race in races:
        rnd = int(race.get("round") or 0)
        if not rnd:
            continue
        for key, code in _KEYS:
            start = _ts(race.get(key))
            if start:
                out.append((rnd, code, start))
        start = _ts(race)
        if start:
            out.append((rnd, "R", start))
    return out


def now_utc():
    return datetime.now(timezone.utc)
