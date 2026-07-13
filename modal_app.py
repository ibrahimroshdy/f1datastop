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
            "circuits_out", "circuits_out/**", "**/circuits_out/**",
            # the local virtualenv is `venv/` (no dot) here — ship none of it
            ".venv", ".venv/**", "**/.venv/**",
            "venv", "venv/**", "**/venv/**",
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


# ── Scheduled: reconcile the CURRENT season into the warehouse ───────────────
# Every 6h, all week. ingest.py (FastF1-only) skips rounds already ingested, so
# this whole-season pass only loads FastF1 for new rounds — cheap, and self-heals
# any gap a missed run would leave.
@app.function(schedule=modal.Cron("0 */6 * * *"), **COMMON)
def backfill_current() -> None:
    from datetime import datetime, timezone
    year = datetime.now(timezone.utc).year
    _run("ingest.py", "--season", str(year))


# ── Scheduled: regenerate + upload charts for the latest race ────────────────
@app.function(schedule=modal.Cron("30 */3 * * 5,6,0"), **COMMON)
def generate_latest() -> None:
    _run("generate.py", "--latest", "--session", "R", "--format", "all")


# ── One season, its own container ────────────────────────────────────────────
# Own container = own IP (own Ergast 500-calls/h budget) + own timeout. This is
# why backfill_range fans out per season instead of looping in one container:
# a single container serialising 8 fresh seasons blew both the Ergast hourly cap
# (mid-2022) and Modal's timeout (2024 R9). 2h/season is ample for 24 rounds.
SEASON = {**COMMON, "timeout": 7200}

# Orchestrators only fan out with .map()/.starmap() and then idle-wait for their
# parallel children. Give them a long timeout so they outlive the slowest child
# (a season can take SEASON's full 2h). COMMON's 1h was silently killing
# multi-season runs mid-flight and cancelling the children with it.
ORCH = {**COMMON, "timeout": 21600}  # 6h — pure wait, no compute


@app.function(**SEASON)
def ingest_season(season: int, force: bool = False) -> None:
    # force=True redoes every round incl. enrichment — use to refill a season
    # whose race data landed but whose weather/overtake pass got rate-limited
    # (e.g. 2025, where a shared-budget run exhausted 500/h before enrichment).
    args = ["ingest.py", "--season", str(season)]
    if force:
        args.append("--force")
    _run(*args)


# ── Manual: backfill a season range on demand (FastF1-only, 2018+) ───────────
# Fans out one container per season (parallel). ingest.py skips rounds already
# ingested, so re-running only fills gaps (e.g. 2022 R15+, 2024 R9+).
@app.function(**ORCH)
def backfill_range(from_season: int = 2018, to_season: int = 2026) -> None:
    seasons = list(range(from_season, to_season + 1))
    list(ingest_season.map(seasons))  # per-season fan-out; wait for all


# ── Manual: charts for one specific event (by name OR round number) ──────────
@app.function(**COMMON)
def generate_event(season: int, event: str = "", round: int = 0,
                   session: str = "R", fmt: str = "all") -> None:
    args = ["generate.py", "--season", str(season), "--session", session, "--format", fmt]
    if round:
        args += ["--round", str(round)]
    elif event:
        args += ["--event", event]
    else:
        raise SystemExit("generate_event: provide --event NAME or --round N")
    _run(*args)


# ── Manual: regenerate ALL charts for a season (loops rounds) ────────────────
# generate.py overwrites existing charts, so this re-bakes every chart — used to
# roll out new chart features (e.g. Safety Car / VSC / red-flag overlays) across a
# whole season. Rounds that haven't run yet fail-and-skip. 2h timeout per season.
@app.function(**SEASON)
def generate_season(season: int, rounds: int = 24, session: str = "R", fmt: str = "all") -> None:
    done = 0
    for r in range(1, rounds + 1):
        try:
            _run("generate.py", "--season", str(season), "--round", str(r),
                 "--session", session, "--format", fmt)
            done += 1
        except Exception as e:  # noqa: BLE001
            print(f"  R{r}: skipped ({e})")
    print(f"Done. charts generated for {done} rounds of {season}.")


# ── Manual: regenerate charts across a season range (per-season fan-out) ─────
# e.g.  modal run modal_app.py::generate_range --from-season 2025 --to-season 2026
@app.function(**ORCH)
def generate_range(from_season: int = 2025, to_season: int = 2026,
                   session: str = "R", fmt: str = "all") -> None:
    seasons = list(range(from_season, to_season + 1))
    list(generate_season.map(seasons))  # one container per season; wait for all


# ── Manual: export interactive telemetry (per-lap JSON → Storage) for a season ─
# Populates f1_telemetry_index so the FastF1 telemetry + track-map charts have
# data. Loops every round; rounds that haven't run yet just fail-and-skip.
@app.function(**SEASON)
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


# ── Scheduled: keep the CURRENT season's telemetry filled ────────────────────
# Every 6h (offset 30m from backfill_current). telemetry_export.py skips rounds
# already in f1_telemetry_index and no-ops on rounds that haven't run yet, so a
# whole-season pass is cheap and self-heals gaps (why 6/9 were missing before).
@app.function(schedule=modal.Cron("30 */6 * * *"), **COMMON)
def export_telemetry_current() -> None:
    from datetime import datetime, timezone
    year = datetime.now(timezone.utc).year
    done = 0
    for r in range(1, 25):
        try:
            _run("telemetry_export.py", "--season", str(year), "--round", str(r), "--session", "R")
            done += 1
        except Exception as e:  # noqa: BLE001
            print(f"  R{r}: skipped ({e})")
    print(f"Done. telemetry pass for {year}: {done} rounds attempted.")


# ── Manual: export circuit geometry (track map + corners + straights) ────────
# One blob per circuit per season → Storage bucket `circuits` + f1_circuit_geometry.
# Loops every round; rounds that haven't run yet fail-and-skip. NOTE: 2026 has no
# DRS zones (regs dropped DRS) — straights are computed from full-throttle stretches.
@app.function(**SEASON)
def export_circuits(season: int, rounds: int = 24, force: bool = False) -> None:
    done = 0
    for r in range(1, rounds + 1):
        try:
            args = ["circuit_geometry_export.py", "--season", str(season), "--round", str(r)]
            if force:
                args.append("--force")  # re-export (e.g. after the rotation-orientation fix)
            _run(*args)
            done += 1
        except Exception as e:  # noqa: BLE001
            print(f"  R{r}: skipped ({e})")
    print(f"Done. circuit geometry exported for {done} rounds of {season}.")


# ── Scheduled: keep the CURRENT season's circuit geometry filled ─────────────
# Every 6h (offset 45m). circuit_geometry_export.py skips circuits already indexed
# and no-ops on rounds that haven't run yet, so a whole-season pass is cheap.
@app.function(schedule=modal.Cron("45 */6 * * *"), **COMMON)
def export_circuits_current() -> None:
    from datetime import datetime, timezone
    year = datetime.now(timezone.utc).year
    done = 0
    for r in range(1, 25):
        try:
            _run("circuit_geometry_export.py", "--season", str(year), "--round", str(r))
            done += 1
        except Exception as e:  # noqa: BLE001
            print(f"  R{r}: skipped ({e})")
    print(f"Done. circuit geometry pass for {year}: {done} rounds attempted.")


# ── Manual: backfill circuit geometry across a season range (2018+ = FastF1 floor) ─
# Fans out one container per season (own IP + own timeout), same rationale as
# backfill_range. circuit_geometry_export.py skips circuits already indexed, so
# re-running only fills gaps. FastF1 telemetry/position data starts in 2018.
@app.function(**ORCH)
def backfill_circuits(from_season: int = 2018, to_season: int = 2026, force: bool = False) -> None:
    seasons = list(range(from_season, to_season + 1))
    list(export_circuits.starmap([(s, 24, force) for s in seasons]))  # per-season fan-out


# ── Manual: export GPS car-dot race replays (full-race position → Storage) ────
# One blob per circuit per season → bucket `replays` + f1_race_replay. Powers the
# Track Replay component. Loops rounds; rounds that haven't run / lack position
# data fail-and-skip. Post-race historical (FastF1), NOT live.
@app.function(**SEASON)
def export_race_replays(season: int, rounds: int = 24, force: bool = False, session: str = "R") -> None:
    done = 0
    for r in range(1, rounds + 1):
        try:
            args = ["race_replay_export.py", "--season", str(season), "--round", str(r), "--session", session]
            if force:
                args.append("--force")  # re-export stale blobs (schema/window changes)
            _run(*args)
            done += 1
        except Exception as e:  # noqa: BLE001
            print(f"  R{r} {session}: skipped ({e})")
    print(f"Done. {session} replays exported for {done} rounds of {season}.")


# ── Scheduled: keep the CURRENT season's replays filled (every 6h, offset 50m) ─
@app.function(schedule=modal.Cron("50 */6 * * *"), **COMMON)
def export_race_replays_current() -> None:
    from datetime import datetime, timezone
    year = datetime.now(timezone.utc).year
    done = 0
    for r in range(1, 25):
        try:
            _run("race_replay_export.py", "--season", str(year), "--round", str(r))
            done += 1
        except Exception as e:  # noqa: BLE001
            print(f"  R{r}: skipped ({e})")
    print(f"Done. race-replay pass for {year}: {done} rounds attempted.")


# ── Manual: backfill replays across a season range (per-season fan-out) ───────
# e.g.  modal run modal_app.py::backfill_replays --from-season 2024 --to-season 2026
@app.function(**ORCH)
def backfill_replays(from_season: int = 2018, to_season: int = 2026, force: bool = False, session: str = "R") -> None:
    seasons = list(range(from_season, to_season + 1))
    # starmap so `force`/`session` reach each per-season container
    list(export_race_replays.starmap([(s, 24, force, session) for s in seasons]))


# ── Manual: backfill Race + Quali + Sprint replays across a season range (one shot) ─
# e.g.  modal run modal_app.py::backfill_all_sessions --from-season 2024 --to-season 2026 --force
# Fans out one container per (season, session). Sprint/quali rounds without data
# fail-and-skip; practice is not replayed by design.
@app.function(**ORCH)
def backfill_all_sessions(from_season: int = 2024, to_season: int = 2026, force: bool = False) -> None:
    combos = [
        (s, 24, force, sess)
        for s in range(from_season, to_season + 1)
        for sess in ("R", "Q", "S")
    ]
    list(export_race_replays.starmap(combos))


@app.local_entrypoint()
def main() -> None:
    """`modal run modal_app.py` → backfill the current 4-season window once."""
    backfill_range.remote(2023, 2026)
