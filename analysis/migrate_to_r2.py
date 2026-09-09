#!/usr/bin/env python3
"""One-time move of every blob from Supabase Storage to Cloudflare R2.

Why: Supabase Storage hit ~10 GB against a 1 GB free-tier cap (charts 7.5 GB — every
chart stored in 4 formats x 2 themes; telemetry 1.9 GB of uncompressed per-lap JSON).
The system now pre-renders only a landscape master + thumbnail per chart, gzips JSON
blobs, and serves everything from R2 (10 GB free, zero egress). This script carries the
*existing* assets across and then purges Supabase.

Phases (run in order; each is idempotent and dry-runnable):

  --copy     Download from Supabase public URLs -> upload to R2. Applies the new policy
             while copying: charts landscape-only (social formats are on-demand now),
             telemetry per-lap blobs only for Q/SQ/SS/S/R, JSON gzip-compressed.
  --rewrite  Point the index tables at the new host (public_url = BLOB_PUBLIC_BASE/...),
             and delete analysis_charts rows for the social formats that no longer exist.
  --purge    Delete every object from the Supabase buckets (charts/telemetry/replays/
             circuits). Requires --i-am-sure. Do this LAST, after the site is verified.

Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY + the R2_*/BLOB_PUBLIC_BASE set used by
blob_store.py. Add --dry-run to any phase to only print what would happen.

    python migrate_to_r2.py --copy --dry-run
    python migrate_to_r2.py --copy
    python migrate_to_r2.py --rewrite
    python migrate_to_r2.py --purge --i-am-sure
"""
import argparse
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

import blob_store as bs

SOCIAL = re.compile(r"/(twitter|instagram|story)/")          # storage_path segment
SOCIAL_CT = re.compile(r"_(twitter|instagram|story)(?=__|$)")  # analysis_charts.chart_type
PRACTICE = re.compile(r"^\d{4}/\d{2}/FP\d/")                   # telemetry practice paths

# bucket -> (index table, json?)  — index tables carry storage_path + public_url
BUCKETS = {
    "charts":    ("analysis_charts",     False),
    "telemetry": ("f1_telemetry_index",  True),
    "replays":   ("f1_race_replay",      True),
    "circuits":  ("f1_circuit_geometry", True),
}


def _env():
    try:
        return os.environ["SUPABASE_URL"].rstrip("/"), os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    except KeyError as e:
        sys.exit(f"missing env {e}")


def _hdr(key):
    return {"apikey": key, "Authorization": f"Bearer {key}"}


def supabase_objects(url, key, bucket):
    """Every object name in a Supabase bucket, via storage.objects (paged)."""
    out, offset, page = [], 0, 1000
    while True:
        r = requests.post(f"{url}/storage/v1/object/list/{bucket}", headers=_hdr(key),
                          json={"prefix": "", "limit": page, "offset": offset,
                                "sortBy": {"column": "name", "order": "asc"}}, timeout=60)
        r.raise_for_status()
        rows = r.json()
        # list is one level; walk folders recursively
        for it in rows:
            if it.get("id") is None:            # folder
                out += _walk(url, key, bucket, it["name"])
            else:
                out.append(it["name"])
        if len(rows) < page:
            break
        offset += page
    return out


def _walk(url, key, bucket, prefix):
    out, offset, page = [], 0, 1000
    while True:
        r = requests.post(f"{url}/storage/v1/object/list/{bucket}", headers=_hdr(key),
                          json={"prefix": prefix, "limit": page, "offset": offset,
                                "sortBy": {"column": "name", "order": "asc"}}, timeout=60)
        r.raise_for_status()
        rows = r.json()
        for it in rows:
            name = f"{prefix}/{it['name']}"
            if it.get("id") is None:
                out += _walk(url, key, bucket, name)
            else:
                out.append(name)
        if len(rows) < page:
            break
        offset += page
    return out


def keep(bucket, path):
    """The new storage policy, applied while copying."""
    if bucket == "charts" and SOCIAL.search("/" + path):
        return False
    if bucket == "telemetry" and PRACTICE.match(path):
        return False
    return True


def copy_one(url, bucket, path, is_json, dry):
    if bs.exists(bucket, path):
        return "skip"
    if dry:
        return "would-copy"
    r = requests.get(f"{url}/storage/v1/object/public/{bucket}/{path}", timeout=120)
    if r.status_code == 404:
        return "missing"
    r.raise_for_status()
    ctype = "application/json" if is_json else ("image/webp" if path.endswith(".webp") else "image/png")
    bs.put(bucket, path, r.content, ctype, gzip_body=is_json)
    return "copied"


def phase_copy(args):
    url, key = _env()
    for bucket, (_, is_json) in BUCKETS.items():
        if args.bucket and bucket != args.bucket:
            continue
        names = supabase_objects(url, key, bucket)
        wanted = [n for n in names if keep(bucket, n)]
        print(f"[{bucket}] {len(names)} objects in Supabase, {len(wanted)} to carry over "
              f"({len(names) - len(wanted)} dropped by policy)")
        stats = {}
        with ThreadPoolExecutor(max_workers=args.workers) as ex:
            futs = {ex.submit(copy_one, url, bucket, n, is_json, args.dry_run): n for n in wanted}
            for i, f in enumerate(as_completed(futs), 1):
                try:
                    res = f.result()
                except Exception as e:  # noqa: BLE001
                    res = "error"; print(f"  ! {futs[f]}: {e}")
                stats[res] = stats.get(res, 0) + 1
                if i % 500 == 0:
                    print(f"  {bucket}: {i}/{len(wanted)} {stats}")
        print(f"[{bucket}] done {stats}")


def phase_rewrite(args):
    url, key = _env()
    base = bs.public_base()
    h = {**_hdr(key), "Content-Type": "application/json", "Prefer": "return=minimal"}
    for bucket, (table, _) in BUCKETS.items():
        if args.bucket and bucket != args.bucket:
            continue
        # PostgREST can't do UPDATE ... SET col = expr; use an RPC-free approach: page rows,
        # recompute, PATCH in batches keyed by primary key `id`.
        rows, offset, page = [], 0, 1000
        while True:
            r = requests.get(f"{url}/rest/v1/{table}", headers=_hdr(key),
                             params={"select": "id,storage_path,public_url", "limit": page, "offset": offset},
                             timeout=60)
            r.raise_for_status(); chunk = r.json(); rows += chunk
            if len(chunk) < page:
                break
            offset += page
        todo = [x for x in rows if x.get("storage_path") and not str(x.get("public_url", "")).startswith(base)]
        print(f"[{table}] {len(rows)} rows, {len(todo)} to repoint -> {base}/{bucket}/…")
        if args.dry_run:
            continue
        for x in todo:
            new = bs.public_url(bucket, x["storage_path"])
            rr = requests.patch(f"{url}/rest/v1/{table}", headers=h, params={"id": f"eq.{x['id']}"},
                                json={"public_url": new}, timeout=30)
            if not rr.ok:
                print(f"  ! {table} id={x['id']}: {rr.status_code} {rr.text[:120]}")
        # social-format chart rows point at files we deliberately didn't carry over
        if bucket == "charts":
            social = [x for x in rows if SOCIAL_CT.search(str(x.get("storage_path", "")))
                      or SOCIAL.search("/" + str(x.get("storage_path", "")))]
            print(f"[{table}] deleting {len(social)} social-format rows (now rendered on demand)")
            for x in social:
                requests.delete(f"{url}/rest/v1/{table}", headers=h, params={"id": f"eq.{x['id']}"}, timeout=30)


def phase_purge(args):
    if not args.i_am_sure:
        sys.exit("--purge deletes every object in the Supabase buckets; add --i-am-sure")
    url, key = _env()
    for bucket in BUCKETS:
        if args.bucket and bucket != args.bucket:
            continue
        names = supabase_objects(url, key, bucket)
        print(f"[{bucket}] {len(names)} objects to delete from Supabase")
        if args.dry_run:
            continue
        for i in range(0, len(names), 200):
            r = requests.delete(f"{url}/storage/v1/object/{bucket}",
                                headers={**_hdr(key), "Content-Type": "application/json"},
                                json={"prefixes": names[i:i + 200]}, timeout=120)
            if not r.ok:
                print(f"  ! delete batch {i}: {r.status_code} {r.text[:120]}")
            elif (i // 200) % 10 == 0:
                print(f"  {bucket}: {min(i + 200, len(names))}/{len(names)}")
        print(f"[{bucket}] purged")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--copy", action="store_true")
    ap.add_argument("--rewrite", action="store_true")
    ap.add_argument("--purge", action="store_true")
    ap.add_argument("--i-am-sure", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--bucket", choices=list(BUCKETS), help="limit to one bucket")
    ap.add_argument("--workers", type=int, default=16)
    a = ap.parse_args()
    if not (a.copy or a.rewrite or a.purge):
        ap.error("pick at least one of --copy / --rewrite / --purge")
    if a.copy:
        phase_copy(a)
    if a.rewrite:
        phase_rewrite(a)
    if a.purge:
        phase_purge(a)


if __name__ == "__main__":
    main()
