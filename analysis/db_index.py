"""Best-effort Supabase index writes for the asset exporters.

The CDN indexes (index_export.py, derived from the R2 bucket) are what the site reads;
the Postgres tables (analysis_charts, f1_telemetry_index, f1_race_replay,
f1_circuit_geometry) are kept as a secondary copy for SQL-side joins and the request
queues. A write there must therefore never fail an export: the blob is already on R2 and
the CDN index step at the end of the workflow will pick it up. When Supabase is
unreachable or restricted (402 on a Free-plan quota breach) the first failure disables
further attempts for the rest of the process, so a run doesn't pay a timeout per row.
"""
import os

import requests

_disabled = None  # reason string once writes are switched off


def upsert(table, on_conflict, rows, timeout=60):
    """POST rows to `table` with merge-duplicates. Returns True on success, False otherwise."""
    global _disabled
    if _disabled:
        return False
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        _disabled = "no SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"
        print(f"  (db index: {_disabled} — CDN index only)")
        return False
    try:
        r = requests.post(
            f"{url}/rest/v1/{table}?on_conflict={on_conflict}",
            headers={"Authorization": f"Bearer {key}", "apikey": key,
                     "Content-Type": "application/json",
                     "Prefer": "resolution=merge-duplicates,return=minimal"},
            json=rows if isinstance(rows, list) else [rows], timeout=timeout,
        )
        if r.ok:
            return True
        detail = f"{r.status_code} {r.text[:160]}"
    except requests.exceptions.RequestException as e:  # noqa: BLE001
        detail = type(e).__name__
    _disabled = f"{table} upsert failed ({detail})"
    print(f"  (db index: {_disabled} — continuing; CDN index is authoritative)")
    return False
