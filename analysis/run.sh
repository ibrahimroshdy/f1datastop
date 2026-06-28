#!/usr/bin/env bash
# Generate all charts for one race locally. PNGs land in analysis/out/.
#
# Usage:
#   ./run.sh                          latest completed race (current season), Race
#   ./run.sh 2026 Barcelona           2026 Barcelona GP, Race  (race by NAME)
#   ./run.sh 2026 Barcelona Q         qualifying
#   ./run.sh 2026 7                   by round number
#   ./run.sh 2026 Barcelona R all       all four sizes (landscape/twitter/instagram/story)
#   ./run.sh 2026 Barcelona R all logo  all sizes, team logos on the y-axis
#
# 4th arg format: landscape (default) | twitter | instagram | story | both | all
# 5th arg labels: text (default) | logo  (team logos instead of names on team charts)
# Output: out/<year>/<round>-<Grand Prix>/<session>/<format>/<chart>.png
# First time only:  python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
set -euo pipefail
cd "$(dirname "$0")"
if [ -d venv ]; then source venv/bin/activate;
elif [ -d .venv ]; then source .venv/bin/activate;
fi

FMT="${4:-landscape}"; LABELS="${5:-logo}"

if [ $# -eq 0 ]; then
  python generate.py --latest --session R --no-upload --format "$FMT" --team-labels "$LABELS"
else
  SEASON="$1"; RACE="${2:?need a race name or round number}"; SESSION="${3:-R}"
  if [[ "$RACE" =~ ^[0-9]+$ ]]; then
    python generate.py --season "$SEASON" --round "$RACE" --session "$SESSION" --no-upload --format "$FMT" --team-labels "$LABELS"
  else
    python generate.py --season "$SEASON" --event "$RACE" --session "$SESSION" --no-upload --format "$FMT" --team-labels "$LABELS"
  fi
fi

echo "✓ charts in $(pwd)/out"
command -v open >/dev/null 2>&1 && open out || true
