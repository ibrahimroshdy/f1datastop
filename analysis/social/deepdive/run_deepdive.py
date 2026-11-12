#!/usr/bin/env python3
"""Deep Dive auto-export: runs analysis/generate.py from this repo (--no-upload) and
fits every chart, uncropped, into the three F1 DataStop social sizes.

  python run_deepdive.py ROUND SESSION [--season 2026] [--charts a,b] [--out DIR] [--cache DIR]

SESSION: FP1 FP2 FP3 Q R (SQ and S also accepted).
Output:  DIR/<chart>_{x,ig,threads}.png, DIR defaults to DeepDive/<season>/<round>_<session> under
the current folder. FastF1 cache: --cache, else $FASTF1_CACHE, else analysis/.fastf1cache.
Run it with the Python that has analysis/requirements.txt installed; if fastf1 is missing and
F1DS_PYTHON names another interpreter, the script re-runs itself under that one.
x 1080x1350, ig 1080x1440, threads 1440x1920. Charts are scaled to fit and padded with the
shared theme background colour; never cropped, never overwritten (a clash gets _revYYYYMMDD).

Charts with no data are skipped. If none render, <out>/NO_DATA.txt is written
and the exit code is still 0.

grid_flow is never taken from generate.py. It is drawn by the site-style renderer
analysis/social/quali_to_race/quali_to_race.py in this repo (port of the website's
"Qualifying to Race" card), natively laid out for each size, from Jolpica qualifying and
race results. It needs a finished Grand Prix, so it is skipped for Q, sprint and practice.

Chart choice per session (from the repo's own session sets in generate.py):
  R            grid_flow, team_pace, driver_compare, teammate_pace, tyre_strategy, race_analysis
  S            team_pace, driver_compare, teammate_pace, tyre_strategy, race_analysis
  Q / SQ       driver_compare, teammate_pace, qualifying_breakdown
  FP1-FP3      driver_compare, teammate_pace
team_pace, tyre_strategy and race_analysis are race-only in the repo (race_analysis returns
nothing for qualifying and practice).

Layout is the repo's own. Only text is cleaned for the social rules: the footer's
website URL and the faint tiled URL watermark are dropped, and the dot separator is
replaced by a comma. Every drawn string is checked for | bullet dot URL before saving.
"""
import argparse, datetime, glob, os, re, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ANALYSIS = os.path.normpath(os.path.join(HERE, "..", ".."))           # this repo's analysis/
SOCIAL = os.path.dirname(HERE)

try:
    import fastf1  # noqa: F401
except ImportError:                    # re-run under the interpreter named by F1DS_PYTHON
    alt = os.environ.get("F1DS_PYTHON")
    if alt and os.path.realpath(sys.executable) != os.path.realpath(alt) and os.path.exists(alt):
        os.execv(alt, [alt] + sys.argv)
    raise

import matplotlib.text as mtext        # noqa: E402
from PIL import Image                  # noqa: E402

sys.path.insert(0, ANALYSIS)
sys.path.insert(0, os.path.join(SOCIAL, "quali_to_race"))
sys.path.insert(0, SOCIAL)
from common import design              # noqa: E402
import generate                        # noqa: E402  the repo's chart generator
import quali_to_race                   # noqa: E402  site-style grid_flow

BG = design.GROUND                    # site ground, the social background base
SIZES = design.SIZES
SITE_STYLE = {"grid_flow"}            # drawn by quali_to_race.py, not generate.py
CHARTS = {
    "S": ["team_pace", "driver_compare", "teammate_pace", "tyre_strategy", "race_analysis"],
    "R": ["grid_flow", "team_pace", "driver_compare", "teammate_pace", "tyre_strategy", "race_analysis"],
    "Q": ["driver_compare", "teammate_pace", "qualifying_breakdown"],
    "FP": ["driver_compare", "teammate_pace"],
}
STORY_ONLY = {"driver_compare", "race_analysis"}   # no 4:5 variant in generate.py, use 9:16
BANNED = re.compile(r"[|\u2022\u00b7]|f1datastop\.com|https?://|www\.", re.I)

def session_charts(s):
    s = s.upper()
    return CHARTS["R"] if s == "R" else CHARTS["S"] if s == "S" else CHARTS["Q"] if s in ("Q", "SQ", "SS") else CHARTS["FP"]


def install_text_rules(G):
    orig = mtext.Text.set_text
    seen = []

    def set_text(self, s):
        if s is not None:
            s = str(s)
            s = re.sub(r"\s*[\u2014-]\s*f1datastop\.com", "", s)
            s = s.replace(" \u00b7 ", ", ").replace("\u00b7", ",").replace("\u2022", ",")
            s = s.replace(" | ", ", ")
            seen.append(s)
        return orig(self, s)
    mtext.Text.set_text = set_text
    G.add_watermark = lambda fig: None        # tiled "f1datastop.com" grain
    return seen


def fit(im, size):
    W, H = size
    sc = min(W / im.width, H / im.height)
    r = im.resize((round(im.width * sc), round(im.height * sc)), Image.LANCZOS)
    out = Image.new("RGB", (W, H), BG)
    out.paste(r, ((W - r.width) // 2, (H - r.height) // 2))
    return out


def free_name(path):
    if not os.path.exists(path):
        return path
    base, ext = os.path.splitext(path)
    tag = datetime.date.today().strftime("_rev%Y%m%d")
    p, n = base + tag + ext, 2
    while os.path.exists(p):
        p, n = f"{base}{tag}_{n}{ext}", n + 1
    return p


def site_grid_flow(season, rnd, session, out):
    """Qualifying to Race chart in the website's design. Returns saved paths ([] = no data)."""
    if session != "R":
        return []
    try:
        race = quali_to_race.fetch(season, rnd)
    except Exception as e:  # noqa: BLE001  network or API error counts as no data
        print(f"! grid_flow: Jolpica fetch failed: {e}")
        return []
    if not race or not race.get("Results"):
        return []
    tmp = tempfile.mkdtemp(prefix="q2r_")
    made = []
    for src in quali_to_race.render_all(race, tmp, "grid_flow"):
        k = os.path.splitext(os.path.basename(src))[0].rsplit("_", 1)[1]
        dst = free_name(os.path.join(out, f"grid_flow_{k}.png"))
        os.replace(src, dst)
        made.append(dst)
    return made


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("round", type=int)
    ap.add_argument("session", type=str.upper, choices=["FP1", "FP2", "FP3", "Q", "SQ", "S", "R"])
    ap.add_argument("--season", type=int, default=2026)
    ap.add_argument("--charts", help="override the per-session chart list (comma separated)")
    ap.add_argument("--out", help="output folder (default DeepDive/<season>/<round>_<session> in the current folder)")
    ap.add_argument("--cache", help="FastF1 cache folder (default $FASTF1_CACHE or analysis/.fastf1cache)")
    design.add_settings_args(ap)
    a = ap.parse_args(); design.apply_settings(a)
    charts = a.charts.split(",") if a.charts else session_charts(a.session)
    out = os.path.abspath(a.out or os.path.join("DeepDive", str(a.season), f"{a.round}_{a.session}"))
    os.makedirs(out, exist_ok=True)
    cache = os.path.abspath(a.cache or os.environ.get("FASTF1_CACHE") or os.path.join(ANALYSIS, ".fastf1cache"))
    os.makedirs(cache, exist_ok=True)
    os.environ["FASTF1_CACHE"] = cache   # absolute: generate.py runs from a temp folder below

    site_made = site_grid_flow(a.season, a.round, a.session, out) if "grid_flow" in charts else []
    charts_g = [c for c in charts if c not in SITE_STYLE]

    seen = install_text_rules(generate)
    work = tempfile.mkdtemp(prefix="dd_")
    os.chdir(work)
    codes = []
    for fmt, keys in (("instagram", [c for c in charts_g if c not in STORY_ONLY]),
                      ("story", [c for c in charts_g if c in STORY_ONLY])):
        if not keys:
            continue
        sys.argv = ["generate.py", "--season", str(a.season), "--round", str(a.round),
                    "--session", a.session, "--no-upload", "--format", fmt, "--only", ",".join(keys)]
        try:
            codes.append(generate.main())
        except SystemExit as e:
            codes.append(e.code)
        except Exception as e:  # noqa: BLE001  a chart run that dies counts as no data
            print(f"! generate.py {fmt} run failed: {e}")
            codes.append(1)

    bad = sorted({s for s in seen if BANNED.search(s)})
    if bad:
        print("! banned text drawn, nothing saved:", bad)
        return 3
    made, missing = list(site_made), [] if site_made or "grid_flow" not in charts else ["grid_flow"]
    for c in charts_g:
        src = glob.glob(os.path.join(work, "out", "**", f"{c}.png"), recursive=True)
        if not src:
            missing.append(c)
            continue
        im = Image.open(src[0]).convert("RGB")
        for k, sz in SIZES.items():
            p = free_name(os.path.join(out, f"{c}_{k}.png"))
            fit(im, sz).save(p)
            if Image.open(p).size != sz:
                raise RuntimeError(f"{p} is not {sz[0]}x{sz[1]}")
            made.append(p)
    for p in made:
        print(p)
    if missing:
        print("skipped (no data for this session):", ", ".join(missing))
    if not made:
        mk = os.path.join(out, "NO_DATA.txt")
        with open(mk, "w") as f:
            f.write(f"{a.season} round {a.round} {a.session}: no chart had data at "
                    f"{datetime.datetime.now():%Y-%m-%d %H:%M} local time\n"
                    f"tried: {', '.join(charts)}\n")
        print("no charts for this session, wrote marker", mk)
    return 0


if __name__ == "__main__":
    sys.exit(main())
