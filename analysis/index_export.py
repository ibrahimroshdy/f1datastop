#!/usr/bin/env python3
"""Rebuild the chart / telemetry / replay / circuit indexes as static JSON on the CDN.

Why: every "what exists for this session?" read used to be a Postgres table or RPC
(analysis_charts, f1_telemetry_index, f1_race_replay, f1_circuit_geometry). The blobs
themselves already live on R2 and their keys are self-describing, so the index can be
derived from a bucket listing — no database in the read path, and nothing to lose when
Supabase is restricted or paused. The frontend reads these files first and only falls back
to Supabase when a file is missing.

Layout (all under the `data/` prefix, short cache so a fresh export shows within minutes):

  data/index/charts/{season}/{round:02d}/{session}.json   every theme/format variant
  data/index/telemetry/{season}/{round:02d}/{session}.json
  data/index/replays/{season}.json  + data/index/replays/all.json
  data/index/circuits/{season}.json + data/index/circuits/all.json

Rows carry exactly the columns the old tables exposed, so the frontend types are unchanged.

Charts need nothing but the key (title/description come from generate.py's registry).
Telemetry / replay / circuit rows need a few fields from inside the blob (driver_id,
lap_type, top_speed, frame counts…); those are read once and cached in the index, so a
rerun only opens blobs that are new since the last index (incremental, cheap to cron).

Usage:
  python index_export.py                      # every season found in the bucket, all kinds
  python index_export.py --season 2026        # one season
  python index_export.py --kind charts,telemetry --season 2026
  python index_export.py --rebuild            # ignore the existing index, re-read every blob
Env: R2_* / BLOB_PUBLIC_BASE (see blob_store.py). No Supabase credentials needed.
"""
import argparse
import gzip
import json
import os
import re
import sys
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor

import blob_store as bs

INDEX_CACHE = "public, max-age=300, stale-while-revalidate=3600"
KINDS = ("charts", "telemetry", "replays", "circuits")
SOCIAL = ("twitter", "instagram", "story")


# ── helpers ───────────────────────────────────────────────────────────────────
def _get_json(prefix, path):
    """Read a JSON object from the bucket (gzip-aware). None if missing/unreadable."""
    from botocore.exceptions import ClientError
    try:
        obj = bs.client().get_object(Bucket=bs.bucket(), Key=f"{prefix}/{path}")
    except ClientError as e:
        if e.response.get("Error", {}).get("Code") in ("404", "NoSuchKey", "NotFound"):
            return None
        raise
    raw = obj["Body"].read()
    if obj.get("ContentEncoding") == "gzip" or raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    try:
        return json.loads(raw)
    except ValueError:
        return None


def _put_index(path, rows):
    body = json.dumps(rows, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    bs.put("data", path, body, "application/json", gzip_body=True, cache_control=INDEX_CACHE)
    return len(body)


def _chart_registry():
    """(chart_type -> (title, description)) parsed from generate.py's CHARTS list.

    generate.py imports matplotlib/fastf1 at module load, which is far too heavy for an
    indexer, so read the registry out of the source text instead of importing it.
    """
    src = os.path.join(os.path.dirname(os.path.abspath(__file__)), "generate.py")
    reg = {}
    try:
        with open(src, encoding="utf-8") as f:
            text = f.read()
        block = text[text.index("CHARTS = ["):]
        block = block[:block.index("\n]")]
        for m in re.finditer(r'\(\s*"([a-z_0-9]+)",\s*"([^"]*)",\s*"([^"]*)",', block):
            reg[m.group(1)] = (m.group(2), m.group(3))
    except (OSError, ValueError):
        pass
    return reg


def _seasons(prefix):
    seen = set()
    for key, _ in bs.list_keys(prefix):
        head = key.split("/", 1)[0]
        if head.isdigit():
            seen.add(int(head))
    return sorted(seen)


# ── charts ────────────────────────────────────────────────────────────────────
_CHART_KEY = re.compile(
    r"^(?P<season>\d{4})/(?P<round>\d{2})-(?P<slug>[^/]+)/(?P<session>[A-Z0-9]+)/"
    r"(?:(?P<theme>light)/)?(?P<fmt>landscape|twitter|instagram|story)/"
    r"(?P<name>[^/]+?)(?P<thumb>\.thumb\.webp|\.png)$"
)


def index_charts(season, registry):
    """One file per (round, session): every theme/format row, mirroring analysis_charts."""
    masters, thumbs = {}, set()
    for key, _ in bs.list_keys("charts", f"{season}/"):
        m = _CHART_KEY.match(key)
        if not m:
            continue
        if m.group("thumb") == ".thumb.webp":
            thumbs.add(key[: -len(".thumb.webp")])
        else:
            masters[key[: -len(".png")]] = m
    by_session = defaultdict(list)
    for stem, m in masters.items():
        name = m.group("name")
        base, _, pair = name.partition("__")
        fmt = m.group("fmt")
        chart_type = base + ("" if fmt == "landscape" else f"_{fmt}") + (f"__{pair}" if pair else "")
        title, desc = registry.get(base, (base.replace("_", " ").title(), None))
        if pair and base == "driver_compare":
            title = f"{title} · {' vs '.join(pair.split('-'))}"
        storage_path = f"{stem}.png"
        thumb_path = f"{stem}.thumb.webp" if stem in thumbs else None
        row = {
            "id": storage_path,
            "season": int(m.group("season")), "round": int(m.group("round")),
            "session": m.group("session"), "theme": m.group("theme") or "dark",
            "chart_type": chart_type, "title": title, "description": desc,
            "storage_path": storage_path, "public_url": bs.public_url("charts", storage_path),
            "thumb_path": thumb_path,
        }
        by_session[(row["round"], row["session"])].append(row)
    written = 0
    for (rnd, sess), rows in sorted(by_session.items()):
        rows.sort(key=lambda r: (r["theme"], r["chart_type"]))
        _put_index(f"index/charts/{season}/{rnd:02d}/{sess}.json", rows)
        written += 1
    print(f"  charts {season}: {len(masters)} rows -> {written} session file(s)")
    return len(masters)


def chart_variants(season, rnd, session, require_thumb=True):
    """{(chart_type, theme)} already on R2 for a session — generate.py's --skip-existing.

    Lists `charts/{season}/{rnd:02d}-` once (one request per session), so it works with
    no database at all. With require_thumb, a master without its thumbnail doesn't count,
    so pre-thumbnail history is re-rendered once and picks up its thumb.
    """
    masters, thumbs = {}, set()
    for key, _ in bs.list_keys("charts", f"{season}/{rnd:02d}-"):
        m = _CHART_KEY.match(key)
        if not m or m.group("session") != session:
            continue
        if m.group("thumb") == ".thumb.webp":
            thumbs.add(key[: -len(".thumb.webp")])
        else:
            masters[key[: -len(".png")]] = m
    out = set()
    for stem, m in masters.items():
        if require_thumb and stem not in thumbs:
            continue
        base, _, pair = m.group("name").partition("__")
        fmt = m.group("fmt")
        ct = base + ("" if fmt == "landscape" else f"_{fmt}") + (f"__{pair}" if pair else "")
        out.add((ct, m.group("theme") or "dark"))
    return out


# ── telemetry ─────────────────────────────────────────────────────────────────
_TELEMETRY_KEY = re.compile(r"^(?P<season>\d{4})/(?P<round>\d{2})/(?P<session>[A-Z0-9]+)/(?P<code>[A-Z0-9]{2,4})_(?P<lap>\d+)\.json$")


def _telemetry_row(path, meta):
    blob = _get_json("telemetry", path)
    if not blob:
        return None
    return {
        "season": int(meta["season"]), "round": int(meta["round"]), "session": meta["session"],
        "driver_id": blob.get("driver_id"), "driver_code": blob.get("driver") or meta["code"],
        "lap_number": int(blob.get("lap_number") or meta["lap"]),
        "lap_type": blob.get("lap_type", "fastest"),
        "storage_path": path, "public_url": bs.public_url("telemetry", path),
        "top_speed": (blob.get("metrics") or {}).get("top_speed"),
        "source": blob.get("source", "fastf1"),
    }


def index_telemetry(season, rebuild=False, workers=16):
    keys = defaultdict(dict)  # (round, session) -> {path: meta}
    for key, _ in bs.list_keys("telemetry", f"{season}/"):
        m = _TELEMETRY_KEY.match(key)
        if m:
            keys[(int(m.group("round")), m.group("session"))][key] = m.groupdict()
    total = opened = 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for (rnd, sess), paths in sorted(keys.items()):
            idx_path = f"index/telemetry/{season}/{rnd:02d}/{sess}.json"
            existing = {} if rebuild else {
                r["storage_path"]: r for r in (_get_json("data", idx_path) or []) if r.get("storage_path")
            }
            rows = [existing[p] for p in paths if p in existing]
            missing = [p for p in paths if p not in existing]
            if missing:
                for row in pool.map(lambda p: _telemetry_row(p, paths[p]), missing):
                    if row:
                        rows.append(row)
                opened += len(missing)
            if not missing and len(existing) == len(paths):
                total += len(rows)
                continue  # unchanged since the last index
            rows.sort(key=lambda r: (r["driver_code"], r["lap_number"]))
            _put_index(idx_path, rows)
            total += len(rows)
    print(f"  telemetry {season}: {total} rows across {len(keys)} session(s), {opened} blob(s) read")
    return total


# ── replays / circuits (small; one file per season + a combined one) ──────────
_REPLAY_KEY = re.compile(r"^(?P<season>\d{4})/(?P<circuit>[^/_]+)(?:_(?P<session>[A-Z0-9]+))?\.json$")
_CIRCUIT_KEY = re.compile(r"^(?P<season>\d{4})/(?P<circuit>[^/]+)\.json$")


def _replay_row(path, meta):
    blob = _get_json("replays", path)
    if not blob:
        return None
    return {
        "season": int(blob.get("season") or meta["season"]), "round": blob.get("round"),
        "session": blob.get("session") or meta.get("session") or "R",
        "circuit_id": blob.get("circuit_id") or meta["circuit"], "circuit_name": blob.get("circuit_name"),
        "storage_path": path, "public_url": bs.public_url("replays", path),
        "driver_count": len(blob.get("drivers") or []), "frames": blob.get("frames"),
        "duration_s": blob.get("duration_s"), "rotation": blob.get("rotation"),
        "source": blob.get("source", "fastf1"),
    }


def _circuit_row(path, meta):
    blob = _get_json("circuits", path)
    if not blob:
        return None
    return {
        "season": int(blob.get("season") or meta["season"]), "round": blob.get("round"),
        "circuit_id": blob.get("circuit_id") or meta["circuit"], "circuit_name": blob.get("circuit_name"),
        "storage_path": path, "public_url": bs.public_url("circuits", path),
        "corner_count": len(blob.get("corners") or []), "straight_count": len(blob.get("straights") or []),
        "rotation": blob.get("rotation"), "source": blob.get("source", "fastf1"),
    }


def _index_small(kind, pattern, row_fn, seasons, rebuild=False, workers=8):
    # all.json spans every season; when only some seasons are re-indexed, keep the
    # other seasons' rows from the previous combined file instead of dropping them.
    seasons = list(seasons)
    combined = [r for r in (_get_json("data", f"index/{kind}/all.json") or [])
                if r.get("season") not in seasons]
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for season in seasons:
            paths = {}
            for key, _ in bs.list_keys(kind, f"{season}/"):
                m = pattern.match(key)
                if m:
                    paths[key] = m.groupdict()
            idx_path = f"index/{kind}/{season}.json"
            existing = {} if rebuild else {
                r["storage_path"]: r for r in (_get_json("data", idx_path) or []) if r.get("storage_path")
            }
            rows = [existing[p] for p in paths if p in existing]
            missing = [p for p in paths if p not in existing]
            for row in pool.map(lambda p: row_fn(p, paths[p]), missing):
                if row:
                    rows.append(row)
            rows.sort(key=lambda r: (r.get("round") or 0, r["circuit_id"], r.get("session") or ""))
            if missing or len(existing) != len(paths):
                _put_index(idx_path, rows)
            combined.extend(rows)
            print(f"  {kind} {season}: {len(rows)} rows ({len(missing)} new)")
    combined.sort(key=lambda r: (r.get("season") or 0, r.get("round") or 0, r["circuit_id"], r.get("session") or ""))
    _put_index(f"index/{kind}/all.json", combined)
    return len(combined)


# ── main ──────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--season", type=int, action="append", help="season(s); default: every season in the bucket")
    ap.add_argument("--kind", default=",".join(KINDS), help=f"comma list of {','.join(KINDS)}")
    ap.add_argument("--rebuild", action="store_true", help="ignore existing indexes; re-read every blob")
    ap.add_argument("--workers", type=int, default=16)
    a = ap.parse_args()
    kinds = [k.strip() for k in a.kind.split(",") if k.strip()]
    bad = [k for k in kinds if k not in KINDS]
    if bad:
        sys.exit(f"unknown kind(s): {bad}")

    if "charts" in kinds:
        registry = _chart_registry()
        for season in a.season or _seasons("charts"):
            index_charts(season, registry)
    if "telemetry" in kinds:
        for season in a.season or _seasons("telemetry"):
            index_telemetry(season, rebuild=a.rebuild, workers=a.workers)
    if "replays" in kinds:
        _index_small("replays", _REPLAY_KEY, _replay_row, a.season or _seasons("replays"), a.rebuild)
    if "circuits" in kinds:
        _index_small("circuits", _CIRCUIT_KEY, _circuit_row, a.season or _seasons("circuits"), a.rebuild)
    print("index_export: done")


if __name__ == "__main__":
    main()
