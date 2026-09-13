#!/usr/bin/env bash
# Create the `f1datastop` CircleCI context and fill it from the local env files.
#
# The pipeline moved to CircleCI on 2026-09-13 (.circleci/config.yml) because the GitHub
# account's included Actions minutes ran out. Every scheduled job references a context
# named `f1datastop`; this script creates it and stores the same values the GitHub repo
# secrets already hold, so the two stay in step.
#
# Values are read straight from analysis/.env.r2 and web/.env and piped to the CircleCI
# API — none are echoed, and nothing is written to disk.
#
# Prerequisites:
#   1. The project is set up at app.circleci.com/pipelines/github/ibrahimroshdy/f1datastop
#   2. A CircleCI personal API token in analysis/.env.r2 as:  CIRCLE_TOKEN=...
#      (CircleCI -> User Settings -> Personal API Tokens -> Create New Token)
#   3. The circleci CLI on PATH, or set CIRCLECI_CLI=/path/to/circleci
#
# Usage:  bash analysis/circleci_setup.sh
set -euo pipefail

ORG="gh/ibrahimroshdy"
CONTEXT="f1datastop"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI="${CIRCLECI_CLI:-$(command -v circleci || echo /tmp/ccibin/circleci)}"

[ -x "$CLI" ] || { echo "circleci CLI not found — set CIRCLECI_CLI=/path/to/circleci"; exit 1; }
[ -f "$HERE/.env.r2" ] || { echo "missing $HERE/.env.r2"; exit 1; }

set -a
# shellcheck disable=SC1091
. "$HERE/.env.r2"
set +a

# SUPABASE_URL lives in the web env, not .env.r2.
if [ -z "${SUPABASE_URL:-}" ] && [ -f "$HERE/../web/.env" ]; then
  SUPABASE_URL="$(grep -E '^VITE_SUPABASE_URL=' "$HERE/../web/.env" | cut -d= -f2- | tr -d '"'"'"'')"
  export SUPABASE_URL
fi

: "${CIRCLE_TOKEN:?add a CircleCI personal API token to analysis/.env.r2 as CIRCLE_TOKEN=...}"
export CIRCLE_TOKEN

# Everything the scheduled jobs read. F1_LIVETIMING_PROXY is deliberately omitted: it
# points at a Supabase edge function (currently 402), and CircleCI is not on Azure, so the
# direct F1 CDN fetch may just work. Add it only if a run reports "no data".
VARS=(
  R2_ACCOUNT_ID
  R2_ACCESS_KEY_ID
  R2_SECRET_ACCESS_KEY
  R2_BUCKET
  BLOB_PUBLIC_BASE
  SLACK_ALERTS_WEBHOOK
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
)

missing=()
for v in "${VARS[@]}"; do
  [ -n "$(printenv "$v" || true)" ] || missing+=("$v")
done
if [ ${#missing[@]} -gt 0 ]; then
  echo "ERROR: no local value for: ${missing[*]}"
  echo "       add them to analysis/.env.r2 (or web/.env for SUPABASE_URL) and re-run."
  exit 1
fi

echo "== context =="
if "$CLI" context list "$ORG" 2>/dev/null | grep -qw "$CONTEXT"; then
  echo "  $CONTEXT already exists"
else
  "$CLI" context create "$CONTEXT" --org "$ORG"
  echo "  created $CONTEXT"
fi

echo "== variables =="
for v in "${VARS[@]}"; do
  # --value is passed via the environment, so no secret appears in argv or the shell log.
  "$CLI" context secret set "$CONTEXT" --org "$ORG" --name "$v" --value "$(printenv "$v")" >/dev/null
  echo "  set $v"
done

echo
echo "== stored in the context now =="
"$CLI" context secret list "$CONTEXT" --org "$ORG" 2>/dev/null || true
echo
echo "Done. Trigger a run to confirm:"
echo "  https://app.circleci.com/pipelines/github/ibrahimroshdy/f1datastop"
