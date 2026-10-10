#!/usr/bin/env python3
"""Daily free-tier digest -> Slack. Zero-cost guardrail: every limit that could ever bill.

Measures (all read-only):
  R2 storage        vs 10 GB    (list_objects_v2 per prefix; Class B ops, ~30/day)
  Supabase DB size  vs 500 MB   (public.db_size_bytes(), service role)
  CircleCI credits  vs 30,000/mo (insights API; needs CIRCLE_TOKEN;
                                  reported as n/a when the secret isn't set)
Warns (:warning:) at >= 70 % of any limit, :rotating_light: at >= 90 %.
Env: SLACK_ALERTS_WEBHOOK, R2_* + BLOB_PUBLIC_BASE, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
optional CIRCLE_TOKEN, CIRCLE_PROJECT_SLUG (default gh/ibrahimroshdy/f1datastop).
"""
import datetime as dt
import json
import os
import sys

import requests

import blob_store as bs

LIM_R2_GB, LIM_DB_MB, LIM_CREDITS = 10.0, 500.0, 30000.0


def r2_usage():
    tot, per = 0, {}
    pag = bs.client().get_paginator("list_objects_v2")
    for page in pag.paginate(Bucket=bs.bucket()):
        for o in page.get("Contents", []):
            pfx = o["Key"].split("/", 1)[0]
            per[pfx] = per.get(pfx, 0) + o["Size"]; tot += o["Size"]
    return tot / 1e9, {k: v / 1e9 for k, v in sorted(per.items(), key=lambda kv: -kv[1])}


def db_mb():
    """(size_mb or None, status). A restricted/paused project answers 402 — report it
    rather than fail the digest (which would then be the only Slack message that day)."""
    url, key = os.environ["SUPABASE_URL"].rstrip("/"), os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    try:
        r = requests.post(f"{url}/rest/v1/rpc/db_size_bytes", headers={"apikey": key, "Authorization": f"Bearer {key}"}, json={}, timeout=30)
    except requests.exceptions.RequestException as e:
        return None, f"unreachable ({type(e).__name__})"
    if r.status_code == 402:
        return None, "RESTRICTED (402 — Free-plan quota; see Supabase billing)"
    if not r.ok:
        return None, f"error {r.status_code}"
    return int(r.json()) / 1e6, "ok"


def badge(frac):
    return ":rotating_light:" if frac >= 0.9 else (":warning:" if frac >= 0.7 else ":white_check_mark:")


def circleci_credits():
    """(credits_used_last_30d or None, note).

    The pipeline moved off GitHub Actions on 2026-09-13 after the account's shared 3,000
    included minutes ran out mid-race-weekend. CircleCI's free plan allows 30,000 credits
    a month and f1datastop is the only project on it, so the per-project insights figure
    is the whole bill. Insights lag a little behind a run, so a fresh project reads 0.
    """
    tok = os.environ.get("CIRCLE_TOKEN")
    if not tok:
        return None, "set CIRCLE_TOKEN to track"
    slug = os.environ.get("CIRCLE_PROJECT_SLUG", "gh/ibrahimroshdy/f1datastop")
    try:
        r = requests.get(f"https://circleci.com/api/v2/insights/{slug}/workflows",
                         params={"reporting-window": "last-30-days"}, auth=(tok, ""), timeout=30)
        if not r.ok:
            return None, f"insights HTTP {r.status_code}"
        items = r.json().get("items") or []
        return sum((w.get("metrics") or {}).get("total_credits_used") or 0 for w in items), "ok"
    except requests.exceptions.RequestException as e:
        return None, f"unreachable ({type(e).__name__})"


def main():
    r2_gb, per = r2_usage()
    db, db_status = db_mb()
    credits, cc_note = circleci_credits()
    lines = [f"*f1datastop free-tier digest* — {dt.datetime.utcnow():%Y-%m-%d} UTC",
             f"{badge(r2_gb/LIM_R2_GB)} R2 storage: *{r2_gb:.2f} / {LIM_R2_GB:.0f} GB* — " + ", ".join(f"{k} {v:.2f}" for k, v in per.items()),
             (f"{badge(db/LIM_DB_MB)} Supabase DB: *{db:.0f} / {LIM_DB_MB:.0f} MB*" if db is not None
              else f":rotating_light: Supabase: *{db_status}* — site is serving from the CDN indexes; ingest paused")]
    if credits is None:
        lines.append(f":grey_question: CircleCI: n/a ({cc_note})")
    else:
        lines.append(f"{badge(credits/LIM_CREDITS)} CircleCI: *{credits:,.0f} / {LIM_CREDITS:,.0f} credits* (last 30 days)")
    text = "\n".join(lines)
    print(text)
    hook = os.environ.get("SLACK_ALERTS_WEBHOOK")
    if hook:
        requests.post(hook, json={"text": text}, timeout=15)
    return 0


if __name__ == "__main__":
    sys.exit(main())
