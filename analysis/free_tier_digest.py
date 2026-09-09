#!/usr/bin/env python3
"""Daily free-tier digest -> Slack. Zero-cost guardrail: every limit that could ever bill.

Measures (all read-only):
  R2 storage        vs 10 GB    (list_objects_v2 per prefix; Class B ops, ~30/day)
  Supabase DB size  vs 500 MB   (public.db_size_bytes(), service role)
  GitHub Actions    vs 2,000 min (billing usage API; needs GH_BILLING_TOKEN with "Plan: read";
                                  reported as n/a when the secret isn't set)
Warns (:warning:) at >= 70 % of any limit, :rotating_light: at >= 90 %.
Env: SLACK_ALERTS_WEBHOOK, R2_* + BLOB_PUBLIC_BASE, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
optional GH_BILLING_TOKEN, GH_USER (default ibrahimroshdy), GH_REPO (default f1datastop).
"""
import datetime as dt
import json
import os
import sys

import requests

import blob_store as bs

LIM_R2_GB, LIM_DB_MB, LIM_ACT_MIN = 10.0, 500.0, 2000.0


def r2_usage():
    tot, per = 0, {}
    pag = bs.client().get_paginator("list_objects_v2")
    for page in pag.paginate(Bucket=bs.bucket()):
        for o in page.get("Contents", []):
            pfx = o["Key"].split("/", 1)[0]
            per[pfx] = per.get(pfx, 0) + o["Size"]; tot += o["Size"]
    return tot / 1e9, {k: v / 1e9 for k, v in sorted(per.items(), key=lambda kv: -kv[1])}


def db_mb():
    url, key = os.environ["SUPABASE_URL"].rstrip("/"), os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    r = requests.post(f"{url}/rest/v1/rpc/db_size_bytes", headers={"apikey": key, "Authorization": f"Bearer {key}"}, json={}, timeout=30)
    r.raise_for_status(); return int(r.json()) / 1e6


def actions_minutes():
    tok = os.environ.get("GH_BILLING_TOKEN")
    if not tok:
        return None
    user, repo = os.environ.get("GH_USER", "ibrahimroshdy"), os.environ.get("GH_REPO", "f1datastop")
    r = requests.get(f"https://api.github.com/users/{user}/settings/billing/usage",
                     headers={"Authorization": f"Bearer {tok}", "Accept": "application/vnd.github+json"}, timeout=30)
    if not r.ok:
        return None
    month = dt.datetime.utcnow().strftime("%Y-%m")
    return sum(i["quantity"] for i in r.json().get("usageItems", [])
               if i.get("repositoryName") == repo and i.get("unitType") == "Minutes" and i["date"].startswith(month))


def badge(frac):
    return ":rotating_light:" if frac >= 0.9 else (":warning:" if frac >= 0.7 else ":white_check_mark:")


def main():
    r2_gb, per = r2_usage()
    db = db_mb()
    mins = actions_minutes()
    lines = [f"*f1datastop free-tier digest* — {dt.datetime.utcnow():%Y-%m-%d} UTC",
             f"{badge(r2_gb/LIM_R2_GB)} R2 storage: *{r2_gb:.2f} / {LIM_R2_GB:.0f} GB* — " + ", ".join(f"{k} {v:.2f}" for k, v in per.items()),
             f"{badge(db/LIM_DB_MB)} Supabase DB: *{db:.0f} / {LIM_DB_MB:.0f} MB*"]
    if mins is None:
        lines.append(":grey_question: GitHub Actions: n/a (set GH_BILLING_TOKEN secret with Plan:read to track)")
    else:
        lines.append(f"{badge(mins/LIM_ACT_MIN)} GitHub Actions: *{mins:.0f} / {LIM_ACT_MIN:.0f} min* this month")
    text = "\n".join(lines)
    print(text)
    hook = os.environ.get("SLACK_ALERTS_WEBHOOK")
    if hook:
        requests.post(hook, json={"text": text}, timeout=15)
    return 0


if __name__ == "__main__":
    sys.exit(main())
