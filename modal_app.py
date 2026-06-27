"""
Modal compute layer for f1datastop.

Modal runs the heavy Python (FastF1 + the backfill / chart pipeline) on a
schedule and writes to Supabase via REST — Supabase stays the DB + Storage +
serving layer; Modal is just the compute host. FastF1's on-disk cache lives on a
persistent Modal Volume so sessions are downloaded once, not every run.

One-time setup (local):
    pip install modal
    modal setup                                  # auth this machine
    modal secret create supabase \
        SUPABASE_URL=https://envqfquhkcbnitwlzepx.supabase.co \
        SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
    modal deploy modal_app.py                     # deploy the scheduled app

Manual one-off runs (no deploy needed):
    modal run modal_app.py::backfill_range --from-season 2023 --to-season 2026
    modal run modal_app.py::generate_latest
"""
import os
import subprocess
import sys

import modal

APP_DIR = "/root/analysis"
CACHE_DIR = "/cache"

# Image: the analysis venv deps + the repo's analysis/ tree (scripts, fonts).
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("fontconfig")  # let matplotlib see bundled brand fonts
    .pip_install_from_requirements("analysis/requirements.txt")
    # ship only the scripts + fonts — NOT the FastF1 cache / generated output /
    # venv (the cache lives on the Volume, mounted at /cache at runtime).
    .add_local_dir(
        "analysis", remote_path=APP_DIR,
        ignore=[
            ".fastf1cache", ".fastf1cache/**", "**/.fastf1cache/**",
            "out", "out/**", "**/out/**",
            "telemetry_out", "telemetry_out/**", "**/telemetry_out/**",
            ".venv", ".venv/**", "**/.venv/**",
            "__pycache__", "**/__pycache__/**", "**/*.pyc",
            "*.log",
        ],
    )
)

app = modal.App("f1datastop")

# Persistent FastF1 cache — download each session once, reuse across runs.
cache_vol = modal.Volume.from_name("f1-fastf1-cache", create_if_missing=True)
supabase_secret = modal.Secret.from_name("supabase")  # SUPABASE_URL + SERVICE_ROLE_KEY

COMMON = dict(
    image=image,
    volumes={CACHE_DIR: cache_vol},
    secrets=[supabase_secret],
    timeout=3600,
)


def _run(script: str, *args: str) -> None:
    """Run an analysis CLI script with the FastF1 cache pointed at the Volume."""
    env = {**os.environ, "FASTF1_CACHE": CACHE_DIR}
    print(f"$ python {script} {' '.join(args)}", flush=True)
    subprocess.run(
        [sys.executable, "-u", script, *args],
        cwd=APP_DIR, env=env, check=True,
    )
    cache_vol.commit()  # persist any newly downloaded FastF1 sessions


# ── Scheduled: pull the latest completed round into the warehouse ────────────
# Every 3h on race-weekend days (Fri/Sat/Sun UTC) so new sessions land fast;
# --latest only fetches the latest completed round and UPSERTs are idempotent,
# so the extra runs are cheap no-ops outside of fresh data.
@app.function(schedule=modal.Cron("0 */3 * * 5,6,0"), **COMMON)
def backfill_latest() -> None:
    _run("backfill.py", "--latest")


# ── Scheduled: regenerate + upload charts for the latest race ────────────────
@app.function(schedule=modal.Cron("30 */3 * * 5,6,0"), **COMMON)
def generate_latest() -> None:
    _run("generate.py", "--latest", "--session", "R", "--format", "all")


# ── Manual: backfill a season range on demand ────────────────────────────────
@app.function(**COMMON)
def backfill_range(from_season: int = 2023, to_season: int = 2026) -> None:
    _run("backfill.py", "--from-season", str(from_season), "--to-season", str(to_season))


# ── Manual: charts for one specific event ────────────────────────────────────
@app.function(**COMMON)
def generate_event(season: int, event: str, session: str = "R", fmt: str = "all") -> None:
    _run("generate.py", "--season", str(season), "--event", event,
         "--session", session, "--format", fmt)


# ── Manual: export interactive telemetry (per-lap JSON → Storage) for a season ─
# Populates f1_telemetry_index so the FastF1 telemetry + track-map charts have
# data. Loops every round; rounds that haven't run yet just fail-and-skip.
@app.function(**COMMON)
def export_telemetry(season: int, rounds: int = 24, session: str = "R") -> None:
    done = 0
    for r in range(1, rounds + 1):
        try:
            _run("telemetry_export.py", "--season", str(season),
                 "--round", str(r), "--session", session)
            done += 1
        except Exception as e:  # noqa: BLE001
            print(f"  R{r}: skipped ({e})")
    print(f"Done. telemetry exported for {done} rounds of {season}.")


@app.local_entrypoint()
def main() -> None:
    """`modal run modal_app.py` → backfill the current 4-season window once."""
    backfill_range.remote(2023, 2026)
