#!/usr/bin/env python3
"""Daily free-tier digest -> Slack. Zero-cost guardrail: every limit that could ever bill.

Measures (all read-only):
  R2 storage        vs 10 GB    (list_objects_v2 per prefix; Class B ops, ~30/day)
  Supabase DB size  vs 500 MB   (public.db_size_bytes(), service role)
  GitHub Actions    pr-ci.yml / queue.yml / pipeline.yml run health (Actions API; needs
                    GH_TOKEN or GITHUB_TOKEN; reported as n/a when the secret isn't set —
                    public repos get unlimited Actions minutes, so this tracks health,
                    not spend). Only failure / timed_out / startup_failure count as
                    failures; cancelled, skipped, in-progress and null conclusions do not.
                    Pipeline: last 24 h per job (latest conclusion + failure count).
  Dispatch          public.f1_dispatch_health() (service role): failed pg_cron -> GitHub dispatches
  Freshness         age of the last successful Pipeline reconcile job (alert > 12 h)
Backup clock: with DIGEST_MODE=backup (the pipeline.yml 41 7 schedule) the digest stays quiet
unless no digest succeeded in the last 20 h or dispatch is unhealthy.
Warns (:warning:) at >= 70 % of any limit, :rotating_light: at >= 90 %.
Env: SLACK_ALERTS_WEBHOOK, R2_* + BLOB_PUBLIC_BASE, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
optional GH_TOKEN (or GITHUB_TOKEN), GH_REPO (default ibrahimroshdy/f1datastop).
Every section is isolated: if one source is down the digest still posts, with that line
reporting the error.
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


FAILURE_CONCLUSIONS = frozenset({"failure", "timed_out", "startup_failure"})
WF_PR_CI, WF_PIPELINE, WF_QUEUE = "pr-ci.yml", "pipeline.yml", "queue.yml"
_PIPELINE_JOBS = ("reconcile", "charts", "assets", "digest")
MAX_JOB_FETCHES = 25


def is_failure(conclusion):
    """cancelled / skipped / in-progress (None) / success are NOT failures."""
    return conclusion in FAILURE_CONCLUSIONS


def count_failures(conclusions):
    return sum(1 for c in conclusions if is_failure(c))


def _emoji(failed):
    return ":rotating_light:" if failed >= 2 else (":warning:" if failed == 1 else ":white_check_mark:")


def _repo():
    return os.environ.get("GH_REPO", "ibrahimroshdy/f1datastop")


def _parse_ts(value):
    try:
        return dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _recent_runs(workflow, tok, hours=24, now=None, params=None):
    """(runs_within_window_or_None, note). Newest first."""
    data, note = _gh_get(f"/repos/{_repo()}/actions/workflows/{workflow}/runs", tok,
                         {"per_page": 100, **(params or {})})
    if data is None:
        return None, note
    since = (now or dt.datetime.now(dt.timezone.utc)) - dt.timedelta(hours=hours)
    runs = [w for w in (data.get("workflow_runs") or [])
            if (_parse_ts(w.get("created_at")) or since) >= since]
    return runs, None


def github_actions_status():
    """(summary_line_or_None, note). Last 5 PR CI runs (pr-ci.yml).

    Public repos get unlimited Actions minutes, so there is no spend to track —
    this reports pipeline health instead. Needs GH_TOKEN (or GITHUB_TOKEN);
    returns (None, note) when unset. The workflow *file name* is accepted as the
    workflow_id by /repos/{repo}/actions/workflows/{workflow_id}/runs.
    """
    tok = _gh_token()
    if not tok:
        note = "set GH_TOKEN to track"
        print(f"digest: GitHub API skipped: {note}", file=sys.stderr, flush=True)
        return None, note
    data, note = _gh_get(f"/repos/{_repo()}/actions/workflows/{WF_PR_CI}/runs",
                         tok, {"per_page": 10})
    if data is None:
        return None, note
    runs = [w for w in (data.get("workflow_runs") or [])
            if w.get("event") in ("pull_request", "push")][:5]
    if not runs:
        return None, "no PR/push runs yet"
    parts = [f"{w.get('head_branch', '?')}: {w.get('conclusion') or w.get('status')}" for w in runs]
    failed = count_failures(w.get("conclusion") for w in runs)
    return f"{_emoji(failed)} Actions PR CI (last {len(runs)}): " + "; ".join(parts), None


def summarize_pipeline(runs, jobs_by_run, total_runs=None):
    """Pure summary of Pipeline runs (newest first) -> one Slack line.

    runs: run dicts (id, conclusion, status, run_number); jobs_by_run: {run_id: [job dicts]}
    for the runs whose jobs were fetched. Per job: latest concluded result + failure count
    (failure / timed_out / startup_failure only).
    """
    latest, fails, seen = {}, {}, {}
    for run in runs:
        for j in jobs_by_run.get(run["id"], []):
            name, concl = j.get("name"), j.get("conclusion")
            seen[name] = seen.get(name, 0) + 1
            if name not in latest and concl is not None:
                latest[name] = concl
            if is_failure(concl):
                fails[name] = fails.get(name, 0) + 1
    names = [n for n in _PIPELINE_JOBS if n in seen] + sorted(n for n in seen if n not in _PIPELINE_JOBS)
    parts = [f"{n}:{latest.get(n, 'running')}" + (f"({fails[n]}✗)" if fails.get(n) else "") for n in names]
    run_failed = count_failures(r.get("conclusion") for r in runs)
    total = total_runs if total_runs is not None else len(runs)
    fetched = len(jobs_by_run)
    note = "" if fetched >= len(runs) else f" [jobs from {fetched}/{len(runs)} runs]"
    return (f"{_emoji(run_failed)} Pipeline 24h: {total} runs, {run_failed} failed — "
            + (" ".join(parts) or "no job data") + note)


def pipeline_status():
    """(summary_line_or_None, note). Pipeline (pipeline.yml) over the last 24 h.

    Per job: latest concluded result and how many runs it failed in the window.
    The jobs API is called for the newest runs plus every failed run, capped at
    MAX_JOB_FETCHES calls; the line says so when the cap truncates the detail.
    """
    tok = _gh_token()
    if not tok:
        return None, "set GH_TOKEN to track"
    runs, note = _recent_runs(WF_PIPELINE, tok)
    if runs is None:
        return None, note
    if not runs:
        return None, "no Pipeline runs in the last 24 h"
    pick = [r for r in runs[:3]] + [r for r in runs[3:] if is_failure(r.get("conclusion"))]
    jobs_by_run = {}
    for r in pick[:MAX_JOB_FETCHES]:
        jd, note = _gh_get(f"/repos/{_repo()}/actions/runs/{r['id']}/jobs", tok, {"per_page": 30})
        if jd is not None:
            jobs_by_run[r["id"]] = jd.get("jobs", [])
    fetched_runs = [r for r in runs if r["id"] in jobs_by_run]
    return summarize_pipeline(fetched_runs, jobs_by_run, total_runs=len(runs)), None


def queue_runs_status():
    """(summary_line_or_None, note). Queue (queue.yml) runs over the last 24 h."""
    tok = _gh_token()
    if not tok:
        return None, "set GH_TOKEN to track"
    runs, note = _recent_runs(WF_QUEUE, tok)
    if runs is None:
        return None, note
    if not runs:
        return None, "no Queue runs in the last 24 h"
    failed = count_failures(r.get("conclusion") for r in runs)
    last = runs[0].get("conclusion") or runs[0].get("status")
    return f"{_emoji(failed)} Queue workflow 24h: {len(runs)} runs, {failed} failed, latest {last}", None


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


RECONCILE_STALE_HOURS = 12.0   # baseline reconcile runs every 6 h; 2 missed ticks = stuck clock
DIGEST_RECENT_HOURS = 20.0     # backup clock stays quiet when a digest succeeded this recently
LOOKBACK_HOURS = 72
MAX_FRESHNESS_FETCHES = 10


def dispatch_health(hours=24):
    """(health_dict_or_None, note). public.f1_dispatch_health() via the service-role REST API."""
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return None, "no Supabase creds"
    try:
        r = requests.post(f"{url.rstrip('/')}/rest/v1/rpc/f1_dispatch_health",
                          headers={"apikey": key, "Authorization": f"Bearer {key}"},
                          json={"p_hours": hours}, timeout=30)
    except requests.exceptions.RequestException as e:
        return None, f"unreachable ({type(e).__name__})"
    if not r.ok:
        return None, f"f1_dispatch_health HTTP {r.status_code}"
    try:
        data = r.json()
    except ValueError:
        return None, "f1_dispatch_health non-JSON response"
    return (data, None) if isinstance(data, dict) else (None, "f1_dispatch_health unexpected response")


def dispatch_is_bad(health):
    """Any non-2xx dispatch response or failed f1ds-* cron run."""
    return bool(health.get("non_2xx")) or bool(health.get("failed_cron_runs"))


def dispatch_line(health, reconcile_stale=False):
    """Pure: one Slack line from the f1_dispatch_health JSON.

    Zero responses is only a green tick while reconcile is fresh: with zero responses AND a stale
    reconcile the clock may be dead (e.g. no token in Vault makes dispatch a silent no-op)."""
    window = health.get("window_hours")
    total, bad = health.get("responses") or 0, health.get("non_2xx") or 0
    cron_bad = health.get("failed_cron_runs") or 0
    text = f"{total} dispatches in {window} h, {bad} non-2xx"
    if bad and health.get("last_non_2xx_status") is not None:
        text += f" (last HTTP {health['last_non_2xx_status']})"
    elif bad:
        text += " (last: no response / timeout)"
    if cron_bad:
        text += f", {cron_bad} failed cron runs"
    if dispatch_is_bad(health):
        emoji = ":rotating_light:"
    elif total == 0 and reconcile_stale:
        emoji, text = ":warning:", text + " (no dispatches seen and reconcile is stale: is the clock running?)"
    else:
        emoji = ":white_check_mark:"
    last_ok = health.get("last_2xx_at")
    return f"{emoji} Dispatch: {text}" + (f"; last OK {last_ok}" if last_ok else "")


_RECONCILE_AGE = {}


def _reconcile_age():
    """(age_hours_or_None, note), fetched once per run (Dispatch and freshness lines share it)."""
    if "v" not in _RECONCILE_AGE:
        tok = _gh_token()
        _RECONCILE_AGE["v"] = last_success_age("reconcile", tok) if tok else (None, "set GH_TOKEN to track")
    return _RECONCILE_AGE["v"]


def _reconcile_is_stale():
    age, note = _reconcile_age()
    return age is None and note is None or (age is not None and age > RECONCILE_STALE_HOURS)


def dispatch_status():
    health, note = dispatch_health()
    if health is None:
        return None, note
    stale = False
    if not health.get("responses"):
        try:
            stale = _reconcile_is_stale()
        except Exception as e:  # noqa: BLE001 — the dispatch line must still render
            print(f"digest: reconcile age unavailable: {type(e).__name__}", file=sys.stderr, flush=True)
    return dispatch_line(health, reconcile_stale=stale), None


def age_hours(ts, now=None):
    parsed = _parse_ts(ts) if ts else None
    if parsed is None:
        return None
    return ((now or dt.datetime.now(dt.timezone.utc)) - parsed).total_seconds() / 3600.0


def freshness_line(age):
    """Pure: Pipeline-freshness line from the age (hours) of the last successful reconcile."""
    if age is None:
        return f":rotating_light: Pipeline freshness: no successful reconcile in the last {LOOKBACK_HOURS} h"
    emoji = ":rotating_light:" if age > RECONCILE_STALE_HOURS else ":white_check_mark:"
    return f"{emoji} Pipeline freshness: last successful reconcile {age:.1f} h ago"


def last_success_age(job_name, tok, now=None):
    """(age_hours_or_None, note). Age of the newest successful `job_name` job in Pipeline runs.

    Newest-first runs; jobs are fetched for at most MAX_FRESHNESS_FETCHES runs whose run
    conclusion is success. None means no such job was found (or the API failed: see note)."""
    runs, note = _recent_runs(WF_PIPELINE, tok, hours=LOOKBACK_HOURS, now=now)
    if runs is None:
        return None, note
    for run in [r for r in runs if r.get("conclusion") == "success"][:MAX_FRESHNESS_FETCHES]:
        jd, note = _gh_get(f"/repos/{_repo()}/actions/runs/{run['id']}/jobs", tok, {"per_page": 30})
        if jd is None:
            continue
        for j in jd.get("jobs", []):
            if j.get("name") == job_name and j.get("conclusion") == "success":
                return age_hours(j.get("completed_at"), now), None
    return None, None


def freshness_status():
    age, note = _reconcile_age()
    if age is None and note:
        return None, note
    return freshness_line(age), None


def backup_should_post(last_digest_age, dispatch_bad):
    """Pure: the backup clock posts only when no digest succeeded recently or dispatch is bad.

    An unknown digest age (no run found / API down) counts as 'no recent digest': fail loud."""
    return dispatch_bad or last_digest_age is None or last_digest_age > DIGEST_RECENT_HOURS


def _backup_decision():
    """(post?, reason) for the DIGEST_MODE=backup run."""
    health, _note = dispatch_health()
    bad = dispatch_is_bad(health) if health is not None else True  # unreadable health = unhealthy
    tok = _gh_token()
    age = last_success_age("digest", tok)[0] if tok else None
    return backup_should_post(age, bad), f"digest age={age}, dispatch bad={bad}"


def _section(label, fn):
    """Run one digest section; a failure becomes a line, never an abort."""
    try:
        return fn()
    except SystemExit as e:  # blob_store.bucket() sys.exit()s on missing R2 env
        print(f"digest: section {label} failed: SystemExit: {e}", file=sys.stderr, flush=True)
        return f":rotating_light: {label}: unavailable (SystemExit)"
    except Exception as e:  # noqa: BLE001 — KeyboardInterrupt still propagates
        print(f"digest: section {label} failed: {type(e).__name__}: {e}", file=sys.stderr, flush=True)
        return f":rotating_light: {label}: unavailable ({type(e).__name__})"


def _opt_line(label, fn):
    def run():
        line, note = fn()
        return line if line is not None else f":grey_question: {label}: n/a ({note})"
    return _section(label, run)


def _r2_line():
    r2_gb, per = r2_usage()
    return (f"{badge(r2_gb/LIM_R2_GB)} R2 storage: *{r2_gb:.2f} / {LIM_R2_GB:.0f} GB* — "
            + ", ".join(f"{k} {v:.2f}" for k, v in per.items()))


def _db_line():
    db, db_status = db_mb()
    if db is not None:
        return f"{badge(db/LIM_DB_MB)} Supabase DB: *{db:.0f} / {LIM_DB_MB:.0f} MB*"
    return f":rotating_light: Supabase: *{db_status}* — site is serving from the CDN indexes; ingest paused"


def build_digest():
    now = dt.datetime.now(dt.timezone.utc)
    lines = [f"*f1datastop free-tier digest* — {now:%Y-%m-%d} UTC",
             _section("R2 storage", _r2_line),
             _section("Supabase", _db_line),
             # Never a bare 'n/a': the note says WHY (missing token, API error, empty).
             _opt_line("Actions", github_actions_status),
             _opt_line("Pipeline", pipeline_status),
             _opt_line("Queue workflow", queue_runs_status),
             _opt_line("Queue", queue_depth),
             _opt_line("Dispatch", dispatch_status),
             _opt_line("Pipeline freshness", freshness_status)]
    return "\n".join(lines)


def main():
    backup = os.environ.get("DIGEST_MODE") == "backup"
    if backup:
        post, reason = _backup_decision()
        print(f"digest: backup clock: {reason} -> {'posting' if post else 'quiet'}", file=sys.stderr, flush=True)
        if not post:
            return 0
    text = build_digest()
    if backup:
        text = (f":rotating_light: *Backup clock fired: no successful digest in the last "
                f"{DIGEST_RECENT_HOURS:.0f} h, or dispatch is unhealthy.*\n" + text)
    print(text)
    hook = os.environ.get("SLACK_ALERTS_WEBHOOK")
    if hook:
        try:
            requests.post(hook, json={"text": text}, timeout=15).raise_for_status()
        except requests.exceptions.RequestException as e:
            print(f"digest: Slack post failed ({type(e).__name__})", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
