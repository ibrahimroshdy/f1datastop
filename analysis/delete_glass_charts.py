#!/usr/bin/env python3
"""Delete the dropped 'glass' Deep Dive chart variant — Storage images and index rows.

The glass theme rendered a transparent PNG so the frosted card could show through. It
reads as broken (and downloads badly), so it was removed: the app's glass mode now shows
the dark chart. This purges what the earlier --theme all runs uploaded.

Reads the glass rows' storage paths from analysis_charts, deletes those objects from the
`charts` bucket, then deletes the rows. Idempotent — safe to re-run.

    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python delete_glass_charts.py
    # add --dry-run to list what would be deleted without touching anything
"""
import os
import sys

import requests

BUCKET = "charts"


def _env():
    try:
        return os.environ["SUPABASE_URL"].rstrip("/"), os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    except KeyError as e:
        raise SystemExit(f"Missing env {e}. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.")


def _glass_paths(url, key):
    """Every storage_path for theme='glass', paged through PostgREST."""
    paths, offset, page = [], 0, 1000
    while True:
        r = requests.get(
            f"{url}/rest/v1/analysis_charts",
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
            params={"select": "storage_path", "theme": "eq.glass",
                    "limit": page, "offset": offset},
            timeout=30,
        )
        r.raise_for_status()
        rows = r.json()
        paths += [row["storage_path"] for row in rows if row.get("storage_path")]
        if len(rows) < page:
            break
        offset += page
    return paths


def main():
    dry = "--dry-run" in sys.argv
    url, key = _env()
    paths = _glass_paths(url, key)
    print(f"glass rows: {len(paths)}")
    if not paths:
        print("nothing to delete.")
        return 0
    if dry:
        for p in paths[:10]:
            print(f"  would delete {p}")
        print(f"  ... and {max(0, len(paths) - 10)} more")
        print("dry run — no changes made.")
        return 0

    # Storage: bulk-delete in chunks (the object endpoint takes a list of prefixes).
    deleted = 0
    for i in range(0, len(paths), 100):
        chunk = paths[i:i + 100]
        r = requests.delete(
            f"{url}/storage/v1/object/{BUCKET}",
            headers={"apikey": key, "Authorization": f"Bearer {key}",
                     "Content-Type": "application/json"},
            json={"prefixes": chunk}, timeout=60,
        )
        if not r.ok:
            print(f"  ! storage delete failed {r.status_code}: {r.text[:200]}")
        else:
            deleted += len(chunk)
            print(f"  storage: {deleted}/{len(paths)} objects removed")

    # Index: drop the glass rows.
    r = requests.delete(
        f"{url}/rest/v1/analysis_charts?theme=eq.glass",
        headers={"apikey": key, "Authorization": f"Bearer {key}",
                 "Prefer": "return=minimal"},
        timeout=60,
    )
    r.raise_for_status()
    print(f"index: deleted glass rows.")
    print("done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
