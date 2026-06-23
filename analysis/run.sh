#!/usr/bin/env bash
# Generate all charts for one race locally. PNGs land in analysis/out/.
#
# Usage:
#   ./run.sh                     latest completed race (current season), Race
#   ./run.sh 2024 Monaco         2024 Monaco GP, Race  (race by NAME)
#   ./run.sh 2024 Monaco Q       qualifying
#   ./run.sh 2024 9              by round number
#
# First time only:  python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
set -euo pipefail
cd "$(dirname "$0")"
source .venv/bin/activate

if [ $# -eq 0 ]; then
  python generate.py --latest --session R --no-upload
else
  SEASON="$1"; RACE="${2:?need a race name or round number}"; SESSION="${3:-R}"
  if [[ "$RACE" =~ ^[0-9]+$ ]]; then
    python generate.py --season "$SEASON" --round "$RACE" --session "$SESSION" --no-upload
  else
    python generate.py --season "$SEASON" --event "$RACE" --session "$SESSION" --no-upload
  fi
fi

echo "✓ charts in $(pwd)/out"
command -v open >/dev/null 2>&1 && open out || true
