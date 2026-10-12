#!/usr/bin/env python3
"""Check that the pg_cron clock and the GitHub workflows agree.

pg_cron (supabase/migrations/20261012140000_clock_robustness.sql) is the only scheduler; every
workflow is started through workflow_dispatch. This script fails loudly when:
  * a pg_cron entry in the migration differs from the documented schedule below (or one is
    missing or extra);
  * any workflow has a `schedule:` trigger (it would double-run with pg_cron) or a
    `github.event.schedule` condition, except the one once-a-day digest backup in pipeline.yml
    (cron `41 7 * * *`, the digest job `if:` matching that exact string);
  * a dispatched workflow is missing, lacks `workflow_dispatch`, or a dispatched input is not
    declared by it (for `choice` inputs, the value must be one of the options).
Exits 1 with a message per mismatch.
"""
import json
import re
import sys
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[2]
WORKFLOWS = REPO / ".github" / "workflows"
MIGRATION = REPO / "supabase" / "migrations" / "20261012140000_clock_robustness.sql"

# The documented schedule (UTC): jobname -> (cron, workflow file, dispatch inputs).
# Keep in sync with docs/pipeline.html, the one place that lists the schedules in plain words
# (this script does not read it, so update both together).
EXPECTED = {
    "f1ds-queue": ("*/5 * * * *", "queue.yml", {}),
    "f1ds-reconcile": ("7 */6 * * *", "pipeline.yml", {"job": "reconcile"}),
    "f1ds-reconcile-race": (
        "*/30 12,13,14,15,16,17,18,19,20,21 * * 5,6,0",
        "pipeline.yml",
        {"job": "reconcile", "gate": "true"},
    ),
    "f1ds-charts": ("15 */2 * * 5,6,0", "pipeline.yml", {"job": "charts"}),
    "f1ds-assets": ("25 6,12,18 * * 5,6,0", "pipeline.yml", {"job": "assets"}),
    "f1ds-digest": ("17 7 * * *", "pipeline.yml", {"job": "digest"}),
}

# The queue tick calls the guarded wrapper (dispatches queue.yml only when work is waiting).
QUEUE_IF_NEEDED_JOB = "f1ds-queue"

# The one GitHub `schedule:` allowed: the once-a-day digest backup (workflow file, cron, job).
BACKUP_WORKFLOW, BACKUP_CRON, BACKUP_JOB = "pipeline.yml", "41 7 * * *", "digest"
BACKUP_CONDITION = f"github.event.schedule == '{BACKUP_CRON}'"

ENTRY = re.compile(
    r"cron\.schedule\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*\$cron\$\s*SELECT\s+public\."
    r"(?:f1_dispatch_workflow\(\s*'([^']+)'\s*(?:,\s*'(\{[^']*\})'\s*)?\)"
    r"|(f1_dispatch_queue_if_needed)\(\s*\))\s*\$cron\$\s*\)",
    re.IGNORECASE,
)
SCHEDULE_LITERAL = re.compile(r"github\.event\.schedule")


def triggers_of(doc):
    on = doc.get(True, doc.get("on")) or {}  # PyYAML parses bare `on` as True
    if isinstance(on, str):
        return {on: None}
    if isinstance(on, list):
        return {k: None for k in on}
    return on


def migration_entries(text):
    """jobname -> (cron, workflow, inputs) for every cron.schedule() in the migration."""
    entries = {}
    for name, cron, workflow, raw, if_needed in ENTRY.findall(text):
        if if_needed:  # f1_dispatch_queue_if_needed() always dispatches queue.yml
            workflow = "queue.yml"
            if name != QUEUE_IF_NEEDED_JOB:
                workflow = f"<{if_needed} on {name}>"
        entries[name] = (cron, workflow, json.loads(raw) if raw else {})
    return entries


def schedule_errors(filename, text, doc):
    """Errors for the `schedule:` trigger / github.event.schedule use of one workflow.

    Exactly one exception: BACKUP_WORKFLOW may carry a single `schedule:` with BACKUP_CRON, and
    its BACKUP_JOB `if:` must contain BACKUP_CONDITION (the only github.event.schedule use)."""
    errors = []
    triggers = triggers_of(doc)
    literals = len(SCHEDULE_LITERAL.findall(text))
    if filename != BACKUP_WORKFLOW:
        if "schedule" in triggers:
            errors.append(f"{filename}: has a `schedule:` trigger; pg_cron is the only clock")
        if literals:
            errors.append(f"{filename}: references github.event.schedule; use workflow_dispatch inputs")
        return errors
    sched = triggers.get("schedule")
    if sched != [{"cron": BACKUP_CRON}]:
        errors.append(f"{filename}: `schedule:` must be exactly one cron '{BACKUP_CRON}' (digest backup), got {sched!r}")
    cond = str(((doc.get("jobs") or {}).get(BACKUP_JOB) or {}).get("if") or "")
    if BACKUP_CONDITION not in cond:
        errors.append(f"{filename}: job '{BACKUP_JOB}' `if:` must contain {BACKUP_CONDITION!r}")
    if literals != 1:
        errors.append(f"{filename}: github.event.schedule must appear exactly once (in the {BACKUP_JOB} job `if:`), found {literals}")
    return errors


def main():
    errors = []

    if not MIGRATION.is_file():
        errors.append(f"{MIGRATION.relative_to(REPO)} is missing")
        entries = {}
    else:
        text = re.sub(r"(?m)^\s*--.*$", "", MIGRATION.read_text())  # comments mention cron.schedule()
        entries = migration_entries(text)
        if text.lower().count("cron.schedule(") != len(ENTRY.findall(text)):
            errors.append("migration: a cron.schedule() call is not in the form the checker parses")
    for name in sorted(set(EXPECTED) - set(entries)):
        errors.append(f"migration: documented pg_cron job '{name}' is missing")
    for name in sorted(set(entries) - set(EXPECTED)):
        errors.append(f"migration: pg_cron job '{name}' is not a documented schedule")
    for name in sorted(set(EXPECTED) & set(entries)):
        if entries[name] != EXPECTED[name]:
            errors.append(f"migration: job '{name}' is {entries[name]!r}, documented {EXPECTED[name]!r}")

    docs = {}
    files = sorted(WORKFLOWS.glob("*.yml")) + sorted(WORKFLOWS.glob("*.yaml"))
    for path in files:
        text = path.read_text()
        doc = yaml.safe_load(text) or {}
        docs[path.name] = triggers_of(doc)
        errors.extend(schedule_errors(path.name, text, doc))

    for name, (_cron, workflow, inputs) in sorted(EXPECTED.items()):
        triggers = docs.get(workflow)
        if triggers is None:
            errors.append(f"{name}: dispatches {workflow}, which is not in .github/workflows")
            continue
        if "workflow_dispatch" not in triggers:
            errors.append(f"{name}: {workflow} has no workflow_dispatch trigger")
            continue
        declared = (triggers["workflow_dispatch"] or {}).get("inputs") or {}
        for key, value in inputs.items():
            spec = declared.get(key)
            if spec is None:
                errors.append(f"{name}: {workflow} does not declare input '{key}'")
            elif spec.get("type") == "choice" and value not in (spec.get("options") or []):
                errors.append(f"{name}: '{value}' is not an option of {workflow} input '{key}'")
            elif spec.get("type") == "boolean" and value not in ("true", "false"):
                errors.append(f"{name}: input '{key}' of {workflow} must be 'true' or 'false'")

    for e in errors:
        print(f"ERROR: {e}", file=sys.stderr)
    if errors:
        return 1
    print(f"OK: {len(entries)} pg_cron jobs match the documented schedule; only the digest backup schedule among {len(files)} workflows")
    return 0


if __name__ == "__main__":
    sys.exit(main())
