#!/usr/bin/env python3
"""Daily free-tier digest -> Slack. Zero-cost guardrail: every limit that could ever bill.

Measures (all read-only):
  R2 storage        vs 10 GB    (list_objects_v2 per prefix; Class B ops, ~30/day)
  Supabase DB size  vs 500 MB   (public.db_size_bytes(), service role)
  GitHub Actions    last PR CI conclusions (Actions API; needs GH_TOKEN or GITHUB_TOKEN;
                                   reported as n/a when the secret isn't set —
                                   public repos get unlimited Actions minutes, so this
                                   tracks health, not spend)
Warns (:warning:) at >= 70 % of any limit, :rotating_light: at >= 90 %.
Env: SLACK_ALERTS_WEBHOOK, R2_* + BLOB_PUBLIC_BASE, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
optional GH_TOKEN (or GITHUB_TOKEN), GH_REPO (default ibrahimroshdy/f1datastop).
"""
import datetime as dt
import json
import os
import sys

import requests

import blob_store as bs

LIM_R2_GB, LIM_DB_MB = 10.0, 500.0


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


def github_actions_status():
    """(summary_line, ok_bool). Reads the last PR CI runs for the repo.

    Public repos get unlimited Actions minutes, so there is no spend to track —
    this reports pipeline health instead: the latest conclusion per branch event.
    Needs GH_TOKEN (or GITHUB_TOKEN); returns (None, note) when unset.
    """
    tok = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if not tok:
        return None, "set GH_TOKEN to track"
    repo = os.environ.get("GH_REPO", "ibrahimroshdy/f1datastop")
    try:
        r = requests.get(f"https://api.github.com/repos/{repo}/actions/workflows/pr-ci.yml/runs",
                         params={"per_page": 5},
                         headers={"Accept": "application/vnd.github+json",
                                  "Authorization": f"Bearer {tok}",
                                  "X-GitHub-Api-Version": "2022-11-28"},
                         timeout=30)
        if not r.ok:
            return None, f"actions API HTTP {r.status_code}"
        runs = (r.json().get("workflow_runs") or [])[:5]
        if not runs:
            return None, "no runs yet"
        parts = [f"{w.get('head_branch', '?')}: {w.get('conclusion') or w.get('status')}" for w in runs]
        failed = sum(1 for w in runs if w.get("conclusion") not in ("success", "skipped"))
        emoji = ":rotating_light:" if failed >= 2 else (":warning:" if failed == 1 else ":white_check_mark:")
        return f"{emoji} Actions PR CI (last {len(runs)}): " + "; ".join(parts), True
    except requests.exceptions.RequestException as e:
        return None, f"unreachable ({type(e).__name__})"


def main():
    r2_gb, per = r2_usage()
    db, db_status = db_mb()
    gh_line, _ = github_actions_status()
    lines = [f"*f1datastop free-tier digest* — {dt.datetime.utcnow():%Y-%m-%d} UTC",
             f"{badge(r2_gb/LIM_R2_GB)} R2 storage: *{r2_gb:.2f} / {LIM_R2_GB:.0f} GB* — " + ", ".join(f"{k} {v:.2f}" for k, v in per.items()),
             (f"{badge(db/LIM_DB_MB)} Supabase DB: *{db:.0f} / {LIM_DB_MB:.0f} MB*" if db is not None
              else f":rotating_light: Supabase: *{db_status}* — site is serving from the CDN indexes; ingest paused")]
    if gh_line is None:
        lines.append(":grey_question: Actions: n/a")
    else:
        lines.append(gh_line)
    text = "\n".join(lines)
    print(text)
    hook = os.environ.get("SLACK_ALERTS_WEBHOOK")
    if hook:
        requests.post(hook, json={"text": text}, timeout=15)
    return 0


if __name__ == "__main__":
    sys.exit(main())
