#!/usr/bin/env python3
"""Reconcile f1_telemetry_index with what actually exists on R2.

After the Supabase→R2 move (and the Supabase bucket deletion racing the copy), the index
still lists every historical per-lap blob. Rows whose blob isn't on R2 — practice sessions
(dropped by policy) and laps lost in the race — are deleted so the Pit Wall shows "no
telemetry" instead of 404s; surviving rows are repointed to the CDN. Deleted sessions are
regenerated from FastF1 by telemetry_export.py, which re-inserts their rows.
Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY + the R2_* set. --dry-run to preview.
"""
import argparse, os, sys, requests
import blob_store as bs

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--dry-run", action="store_true"); a = ap.parse_args()
    url, key = os.environ["SUPABASE_URL"].rstrip("/"), os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    H = {"apikey": key, "Authorization": f"Bearer {key}"}
    on_r2 = {p for p, _ in bs.list_keys("telemetry")}
    print(f"blobs on R2: {len(on_r2)}")
    rows, off = [], 0
    while True:
        r = requests.get(f"{url}/rest/v1/f1_telemetry_index", headers=H,
                         params={"select": "id,storage_path,public_url,season,round,session", "limit": 1000, "offset": off,
                                 "order": "id.asc"}, timeout=60)
        r.raise_for_status(); chunk = r.json(); rows += chunk
        if len(chunk) < 1000: break   # PostgREST caps a page at 1000 rows (db-max-rows)
        off += 1000
    print(f"index rows: {len(rows)}")
    dead = [x for x in rows if x["storage_path"] not in on_r2]
    keep = [x for x in rows if x["storage_path"] in on_r2]
    base = bs.public_base()
    repoint = [x for x in keep if not str(x.get("public_url","")).startswith(base)]
    lost = {}
    for x in dead: lost[(x["season"], x["round"], x["session"])] = lost.get((x["season"], x["round"], x["session"]), 0) + 1
    print(f"rows to delete (no blob on R2): {len(dead)}  · rows to keep: {len(keep)}  · to repoint: {len(repoint)}")
    print("sessions losing rows (season, round, session): count —", len(lost), "sessions")
    if a.dry_run: return
    HJ = {**H, "Content-Type": "application/json", "Prefer": "return=minimal"}
    ids = [x["id"] for x in dead]
    for i in range(0, len(ids), 200):
        rr = requests.delete(f"{url}/rest/v1/f1_telemetry_index", headers=HJ, params={"id": f"in.({','.join(map(str, ids[i:i+200]))})"}, timeout=60)
        if not rr.ok: print("  ! delete batch", i, rr.status_code, rr.text[:120])
    print("deleted", len(ids))
    for x in repoint:
        rr = requests.patch(f"{url}/rest/v1/f1_telemetry_index", headers=HJ, params={"id": f"eq.{x['id']}"}, json={"public_url": bs.public_url("telemetry", x["storage_path"])}, timeout=30)
        if not rr.ok: print("  ! repoint", x["id"], rr.status_code)
    print("repointed", len(repoint))

if __name__ == "__main__": main()
