#!/usr/bin/env python3
"""Prune orphaned / outdated blobs from R2 — read-only by default.

Lists every key via blob_store and reports blobs that are either:
  1. unknown — not matching any known key pattern (charts / telemetry /
     replays / circuits / data shapes from index_export.py + data_export.py), or
  2. stale — charts/telemetry rows for seasons outside --keep-seasons
     (default: current + previous season).

Nothing is deleted unless --apply is passed. --dry-run is the default; it
only prints what WOULD be deleted. This is the safe inverse of the exporters:
unknown keys are usually failed/renamed uploads, stale keys are old seasons
the site no longer reads.

Usage:
  python prune_r2.py                                  # report only (dry-run)
  python prune_r2.py --season 2026                    # limit scan to a season
  python prune_r2.py --keep-seasons 2025 --keep-seasons 2026
  python prune_r2.py --apply                           # actually delete
Env: R2_* (see blob_store.py). No Supabase credentials needed.
Deps: stdlib + boto3 only (via blob_store).
"""
import argparse
import datetime as dt
import re
import sys

import blob_store as bs

# Known key shapes (storage_path WITHOUT the bucket prefix). Mirrors the
# exporter regexes in index_export.py plus the data_export.py layout.
_CHART = re.compile(
    r"^(?P<season>\d{4})/(?P<round>\d{2})-(?P<slug>[^/]+)/(?P<session>[A-Z0-9]+)/"
    r"(?:(?P<theme>light)/)?(?P<fmt>landscape|twitter|instagram|story)/"
    r"(?P<name>[^/]+?)(?P<thumb>\.thumb\.webp|\.png)$"
)
_TELEMETRY = re.compile(
    r"^(?P<season>\d{4})/(?P<round>\d{2})/(?P<session>[A-Z0-9]+)/(?P<code>[A-Z0-9]{2,4})_(?P<lap>\d+)\.json$"
)
_REPLAY = re.compile(r"^(?P<season>\d{4})/(?P<circuit>[^/_]+)(?:_(?P<session>[A-Z0-9]+))?\.json$")
_CIRCUIT = re.compile(r"^(?P<season>\d{4})/(?P<circuit>[^/]+)\.json$")
# data/ blobs: per-season datasets + per-round datasets + index files.
_DATA = re.compile(
    r"^(?:"
    r"(?P<season>\d{4})/(?:schedule|driverStandings|constructorStandings)\.json"
    r"|(?P<season2>\d{4})/(?P<round>\d+)/(?:results|qualifying|sprint|pitstops|laps)\.json"
    r"|index/(?:charts|telemetry)/\d{4}/\d{2}/[A-Z0-9]+\.json"
    r"|index/(?:replays|circuits)/(?:\d{4}|all)\.json"
    r")$"
)

_PATTERNS = {"charts": _CHART, "telemetry": _TELEMETRY, "replays": _REPLAY,
             "circuits": _CIRCUIT, "data": _DATA}

# Only charts/telemetry are season-pruned; replays/circuits/data are small
# and kept for every season.
SEASON_PRUNED = ("charts", "telemetry")


def _season_of(prefix, key):
    m = _PATTERNS[prefix].match(key)
    if not m:
        return None
    for g in ("season", "season2"):
        try:
            v = m.group(g)
        except IndexError:
            continue
        if v:
            try:
                return int(v)
            except ValueError:
                return None
    return None


def scan(prefixes, keep, only_season=None):
    """Return ([(prefix, key, size, reason)], total_bytes, total_keys)."""
    doomed = []
    total_bytes = total_keys = 0
    for prefix in prefixes:
        sub = f"{only_season}/" if only_season is not None and prefix in SEASON_PRUNED + ("replays", "circuits") else ""
        for key, size in bs.list_keys(prefix, sub):
            total_keys += 1
            total_bytes += size or 0
            if prefix == "data" and only_season is not None and not key.startswith(f"{only_season}/") and not key.startswith("index/"):
                continue
            if not _PATTERNS[prefix].match(key):
                doomed.append((prefix, key, size, "unknown-pattern"))
            elif prefix in SEASON_PRUNED:
                season = _season_of(prefix, key)
                if season is not None and season not in keep:
                    doomed.append((prefix, key, size, f"season-{season}-not-kept"))
    return doomed, total_bytes, total_keys


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    cur = dt.datetime.now(dt.timezone.utc).year
    ap.add_argument("--keep-seasons", type=int, action="append", default=None,
                    help="seasons to keep for charts/telemetry (default: current + previous)")
    ap.add_argument("--season", type=int, default=None,
                    help="limit the scan to one season (plus shared index files)")
    ap.add_argument("--prefix", default="charts,telemetry,replays,circuits,data",
                    help="comma-separated prefixes to scan")
    ap.add_argument("--dry-run", dest="dry_run", action="store_true", default=True,
                    help="report only (default)")
    ap.add_argument("--apply", dest="dry_run", action="store_false",
                    help="actually delete the listed blobs (required to delete)")
    a = ap.parse_args()

    keep = set(a.keep_seasons) if a.keep_seasons else {cur - 1, cur}
    prefixes = [p.strip() for p in a.prefix.split(",") if p.strip()]
    bad = [p for p in prefixes if p not in _PATTERNS]
    if bad:
        sys.exit(f"unknown prefix(es): {bad} (expected {sorted(_PATTERNS)})")

    doomed, total_bytes, total_keys = scan(prefixes, keep, only_season=a.season)
    doomed.sort()
    freed = sum(s or 0 for _, _, s, _ in doomed)
    print(f"prune_r2: scanned {total_keys} keys ({total_bytes / 1e6:.1f} MB) "
          f"under {prefixes}; keep-seasons={sorted(keep)}")
    for prefix, key, size, reason in doomed:
        print(f"  [{reason}] {prefix}/{key} ({(size or 0) / 1e3:.1f} KB)")
    if not doomed:
        print("prune_r2: nothing to prune")
        return 0
    if a.dry_run:
        print(f"prune_r2: DRY-RUN — would delete {len(doomed)} blobs "
              f"({freed / 1e6:.1f} MB). Re-run with --apply to delete.")
        return 0
    by_prefix = {}
    for prefix, key, _s, _r in doomed:
        by_prefix.setdefault(prefix, []).append(key)
    n = 0
    for prefix, keys in sorted(by_prefix.items()):
        n += bs.delete(prefix, keys)
        print(f"  deleted {len(keys)} from {prefix}/")
    print(f"prune_r2: deleted {n} blobs ({freed / 1e6:.1f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
