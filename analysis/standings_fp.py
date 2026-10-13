"""Standings fingerprint shared by generate.py (writes it next to the standings charts)
and charts_todo.py (re-queues a round whose published standings charts no longer match).

BUG-003: championship/constructors charts are rendered once from the warehouse; a later
correction (penalty, Jolpica reconcile) never re-rendered them. Stdlib only."""
import hashlib

FP_NAME = "standings.fp"
STANDINGS_CHARTS = ("championship", "constructors")


def _rows(rows, kind):
    out = []
    for r in rows or []:
        ent = r.get("Driver" if kind == "d" else "Constructor") or {}
        key = ent.get("driverId" if kind == "d" else "constructorId")
        try:
            pts = float(r.get("points") or 0)
        except (TypeError, ValueError):
            pts = 0.0
        if key:
            out.append(f"{kind}:{key}:{pts:.1f}")
    return sorted(out)


def fingerprint(driver_rows, constructor_rows):
    """sha1 over sorted (id, points) of both tables (Ergast-shaped lists)."""
    body = "\n".join(_rows(driver_rows, "d") + _rows(constructor_rows, "c"))
    return hashlib.sha1(body.encode()).hexdigest()
