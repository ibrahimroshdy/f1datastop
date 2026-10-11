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


def _gh_headers(tok):
    return {"Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {tok}",
            "X-GitHub-Api-Version": "2022-11-28"}


def _gh_get(path, tok, params=None):
    """GET a GitHub API path. Returns (json_or_None, note_or_None).

    Every call logs its HTTP status to stderr so CI logs show exactly why
    the digest reports n/a (missing token, API error, empty runs)."""
    url = f"https://api.github.com{path}"
    try:
        r = requests.get(url, params=params or {}, headers=_gh_headers(tok), timeout=30)
    except requests.exceptions.RequestException as e:
        note = f"unreachable ({type(e).__name__})"
        print(f"digest: GitHub API {path} -> {note}", file=sys.stderr, flush=True)
        return None, note
    print(f"digest: GitHub API {path} params={params or {}} -> HTTP {r.status_code}",
          file=sys.stderr, flush=True)
    if not r.ok:
        return None, f"actions API HTTP {r.status_code}"
    try:
        return r.json(), None
    except ValueError:
        return None, "actions API non-JSON response"


def _gh_token():
    return os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")


def github_actions_status():
    """(summary_line_or_None, note). Reads the last PR CI runs for the repo.

    Public repos get unlimited Actions minutes, so there is no spend to track —
    this reports pipeline health instead: the latest conclusion per branch event.
    Needs GH_TOKEN (or GITHUB_TOKEN); returns (None, note) when unset.
    Endpoint note: /repos/{repo}/actions/workflows/pr-ci.yml/runs accepts the
    workflow *file name* as the workflow_id (verified against the API docs);
    the file lives at .github/workflows/pr-ci.yml.
    """
    tok = _gh_token()
    if not tok:
        note = "set GH_TOKEN to track"
        print(f"digest: GitHub API skipped: {note}", file=sys.stderr, flush=True)
        return None, note
    repo = os.environ.get("GH_REPO", "ibrahimroshdy/f1datastop")
    data, note = _gh_get(f"/repos/{repo}/actions/workflows/pr-ci.yml/runs",
                         tok, {"per_page": 10})
    if data is None:
        return None, note
    runs = [w for w in (data.get("workflow_runs") or [])
            if w.get("event") in ("pull_request", "push")][:5]
    if not runs:
        return None, "no PR/push runs yet"
    parts = [f"{w.get('head_branch', '?')}: {w.get('conclusion') or w.get('status')}" for w in runs]
    failed = sum(1 for w in runs if w.get("conclusion") not in ("success", "skipped"))
    emoji = ":rotating_light:" if failed >= 2 else (":warning:" if failed == 1 else ":white_check_mark:")
    return f"{emoji} Actions PR CI (last {len(runs)}): " + "; ".join(parts), None


_PIPELINE_JOBS = ("reconcile", "charts", "assets", "queue", "digest")


def pipeline_status():
    """(summary_line_or_None, note). Latest scheduled run's per-job outcomes.

    All pipeline jobs (reconcile/charts/assets/queue/digest) live in the same
    pr-ci.yml workflow, so per-job state comes from the run's jobs API, not
    the workflow-runs list. One extra call, only for the latest schedule run.
    """
    tok = _gh_token()
    if not tok:
        return None, "set GH_TOKEN to track"
    repo = os.environ.get("GH_REPO", "ibrahimroshdy/f1datastop")
    data, note = _gh_get(f"/repos/{repo}/actions/workflows/pr-ci.yml/runs",
                         tok, {"per_page": 10, "event": "schedule"})
    if data is None:
        return None, note
    sched = [w for w in (data.get("workflow_runs") or []) if w.get("event") == "schedule"]
    if not sched:
        return None, "no scheduled runs yet"
    latest = sched[0]
    jobs_data, note = _gh_get(f"/repos/{repo}/actions/runs/{latest['id']}/jobs",
                              tok, {"per_page": 30})
    if jobs_data is None:
        return None, note
    by_name = {j.get("name"): (j.get("conclusion") or j.get("status")) for j in jobs_data.get("jobs", [])}
    parts = [f"{name}:{by_name.get(name, '?')}" for name in _PIPELINE_JOBS if name in by_name]
    if not parts:
        return None, f"run {latest['id']}: jobs n/a"
    failed = sum(1 for name in _PIPELINE_JOBS
                 if by_name.get(name) not in (None, "success", "skipped", "?") and name in by_name)
    emoji = ":rotating_light:" if failed >= 2 else (":warning:" if failed == 1 else ":white_check_mark:")
    return (f"{emoji} Pipeline sched #{latest.get('run_number', '?')} "
            f"({latest.get('conclusion') or latest.get('status')}): " + " ".join(parts)), None


def queue_depth():
    """(summary_line_or_None, note). Pending rows in the two request tables.

    Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (service role: the tables
    aren't publicly readable). Missing creds -> (None, note), never a crash.
    """
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return None, "no Supabase creds"
    out = {}
    try:
        for table in ("f1_chart_requests", "f1_telemetry_requests"):
            r = requests.get(
                f"{url.rstrip('/')}/rest/v1/{table}",
                params={"status": "eq.pending", "select": "id", "limit": "1"},
                headers={"apikey": key, "Authorization": f"Bearer {key}",
                         "Prefer": "count=exact"},
                timeout=30)
            if not r.ok:
                return None, f"{table} HTTP {r.status_code}"
            total = (r.headers.get("Content-Range", "").split("/")[-1] or "?")
            out[table] = total
    except requests.exceptions.RequestException as e:
        return None, f"unreachable ({type(e).__name__})"
    n_chart, n_tel = out["f1_chart_requests"], out["f1_telemetry_requests"]
    try:
        pending = int(n_chart) + int(n_tel)
    except ValueError:
        pending = None
    emoji = ":warning:" if (pending or 0) >= 5 else ":white_check_mark:"
    return f"{emoji} Queue pending: charts={n_chart} telemetry={n_tel}", None


def main():
    r2_gb, per = r2_usage()
    db, db_status = db_mb()
    gh_line, gh_note = github_actions_status()
    lines = [f"*f1datastop free-tier digest* — {dt.datetime.utcnow():%Y-%m-%d} UTC",
             f"{badge(r2_gb/LIM_R2_GB)} R2 storage: *{r2_gb:.2f} / {LIM_R2_GB:.0f} GB* — " + ", ".join(f"{k} {v:.2f}" for k, v in per.items()),
             (f"{badge(db/LIM_DB_MB)} Supabase DB: *{db:.0f} / {LIM_DB_MB:.0f} MB*" if db is not None
              else f":rotating_light: Supabase: *{db_status}* — site is serving from the CDN indexes; ingest paused")]
    if gh_line is None:
        # Never a bare 'n/a': the note says WHY (missing token, API error, empty).
        lines.append(f":grey_question: Actions: n/a ({gh_note})")
    else:
        lines.append(gh_line)
        pipe_line, pipe_note = pipeline_status()
        lines.append(pipe_line if pipe_line is not None else f":grey_question: Pipeline: n/a ({pipe_note})")
        q_line, q_note = queue_depth()
        lines.append(q_line if q_line is not None else f":grey_question: Queue: n/a ({q_note})")
    text = "\n".join(lines)
    print(text)
    hook = os.environ.get("SLACK_ALERTS_WEBHOOK")
    if hook:
        requests.post(hook, json={"text": text}, timeout=15)
    return 0


if __name__ == "__main__":
    sys.exit(main())
