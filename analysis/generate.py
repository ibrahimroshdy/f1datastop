#!/usr/bin/env python3
"""
FastF1 analysis generator for f1datastop — publication-quality, shareable
infographics (editorial 'paper' aesthetic, not dark/analytical).

Uploads PNGs to the Supabase `charts` bucket and upserts `analysis_charts`.
Env for upload: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

Usage:
  python generate.py --season 2024 --round 1 --session R --no-upload   # local
  python generate.py --latest                                          # CI

Exit codes (the CI gate relies on these):
  0  success, or nothing due (no completed round / nothing left to render)
  2  the session's data is not available upstream yet (definitive absence: session
     missing, or loaded with no lap data) — not an error, try again later
  1  failure: the session failed to load for any other reason, or ANY chart failed
Transient upstream errors (network, timeouts, HTTP 429/5xx) are retried with bounded
backoff first; only definitive absence short-circuits straight to exit 2.
"""
import argparse
import colorsys
import io
import os
import re
import sys
import time
import traceback
from functools import wraps
from typing import Any, Callable, Optional, TypeVar

import fastf1
import matplotlib
import numpy as np

import f1_proxy  # noqa: F401 — repoints livetiming at the proxy when configured
import pandas as pd
import requests
import blob_store as bs
import db_index
import index_export  # R2 uploads (see blob_store.py)
import standings_fp

matplotlib.use("Agg")
import matplotlib.font_manager as fm  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.collections import LineCollection  # noqa: E402
from matplotlib.ticker import FuncFormatter  # noqa: E402
from matplotlib.offsetbox import AnnotationBbox, OffsetImage  # noqa: E402
from matplotlib.markers import MarkerStyle  # noqa: E402
from PIL import Image, ImageDraw, ImageFilter  # noqa: E402

from io import BytesIO  # noqa: E402

try:
    from scipy.interpolate import make_interp_spline
    _HAVE_SCIPY = True
except Exception:
    _HAVE_SCIPY = False


# ── Retry / backoff utilities ────────────────────────────────────────────────
# Only TRANSIENT failures are retried: connection errors, timeouts, HTTP 429/5xx.
# A 404 or any "session not available / not loaded" error is a definitive answer,
# so it is raised immediately (never retried, never cached as a transient miss).
T = TypeVar("T")

# Classification lives in upstream_errors.py (shared with the assets exporters).
from upstream_errors import is_absent, is_transient  # noqa: E402,F401


def retry_with_backoff(
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    backoff_factor: float = 2.0,
    jitter: float = 0.1,
    max_total: float = 60.0,
    retry_if: Callable[[BaseException], bool] = is_transient,
) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """
    Decorator: retry with exponential backoff + jitter, transient failures only.

    Args:
        max_retries: Maximum number of retry attempts.
        base_delay / max_delay / backoff_factor / jitter: backoff shape (seconds).
        max_total: total sleep budget; a retry that would exceed it re-raises instead.
        retry_if: predicate on the exception; False means raise immediately.
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> T:
            import random
            delay = base_delay
            slept = 0.0
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as e:  # noqa: BLE001 — classified below
                    if attempt >= max_retries or not retry_if(e):
                        raise
                    actual = min(delay * (1 + random.uniform(-jitter, jitter)), max_delay)
                    if slept + actual > max_total:
                        raise
                    if os.environ.get("F1DATASTOP_DEBUG_RETRY"):
                        print(f"  [retry] {func.__name__} attempt {attempt + 1} failed: {e}; "
                              f"retrying in {actual:.1f}s")
                    time.sleep(actual)
                    slept += actual
                    delay *= backoff_factor
            raise RuntimeError("unreachable")  # pragma: no cover
        return wrapper
    return decorator


# Convenience decorators. HTTP helpers MUST let transient errors escape to these
# (raise_if_transient) — a blanket `except Exception: return None` makes them dead.
retry_requests = retry_with_backoff(max_retries=2, base_delay=1.0, max_delay=10.0, max_total=20.0)
retry_fastf1 = retry_with_backoff(max_retries=3, base_delay=2.0, max_delay=30.0, max_total=60.0)
retry_supabase = retry_with_backoff(max_retries=3, base_delay=1.5, max_delay=15.0, max_total=30.0)


def raise_if_transient(r):
    """Raise requests.HTTPError for 429/5xx so the retry decorators can see it."""
    if r.status_code == 429 or r.status_code >= 500:
        r.raise_for_status()


HERE = os.path.dirname(os.path.abspath(__file__))

# ── Palette (F1 DataStop) ───────────────────────────────────────────────────
# Only the SURFACE + INK + GRID change between themes; the brand and data colours
# (RED, GOLD, PURPLE, TEAM_COLORS, COMPOUND_COLORS, SECTOR_COLORS) are identity and
# stay fixed so a driver/team/tyre reads the same on every theme.
#
# Two solid themes only:
#   dark   solid near-black surface, light ink   (app 'dark' and 'dark-glass')
#   light  solid near-white surface, dark ink    (app 'light')
# A transparent "glass" render was tried and dropped — a transparent PNG reads as broken
# and downloads badly; the app's glass mode just shows the dark chart on its frosted card.
THEMES = {
    "dark":  {"paper": "#0A0B0F", "panel": "#14161C", "ink": "#F2F3F5",
              "subink": "#9A9CA6", "grid": "#23262E", "transparent": False},
    "light": {"paper": "#F6F7F9", "panel": "#FFFFFF", "ink": "#14161C",
              "subink": "#5B5F6B", "grid": "#E2E4EA", "transparent": False},
}

# Active-theme globals — swapped by apply_theme() before each render pass, exactly the
# way FMT is swapped per format. Charts reference these names directly, so nothing in a
# chart body needs to know which theme is active.
PAPER = PANEL = INK = SUBINK = GRID = None
TRANSPARENT = False


def apply_theme(name):
    """Point the palette globals at one theme. Call before rendering a pass."""
    global PAPER, PANEL, INK, SUBINK, GRID, TRANSPARENT
    t = THEMES.get(name, THEMES["dark"])
    PAPER, PANEL, INK, SUBINK, GRID = t["paper"], t["panel"], t["ink"], t["subink"], t["grid"]
    TRANSPARENT = t["transparent"]


apply_theme("dark")   # default until a pass sets otherwise

RED = "#E10600"       # app --primary (F1 red)
GOLD = "#E7B008"      # app --position-gold (45 93% 47%)

TEAM_COLORS = {
    "Red Bull Racing": "#3671C6", "Ferrari": "#E8002D", "Mercedes": "#00A19B",
    "McLaren": "#FF8000", "Aston Martin": "#229971", "Alpine": "#0093CC",
    "Williams": "#1868DB", "RB": "#6692FF", "Racing Bulls": "#6692FF",
    "Haas F1 Team": "#9C9FA2", "Kick Sauber": "#52E252", "Sauber": "#52E252",
    "Audi": "#52E252", "Cadillac": "#B6BABD",
}
COMPOUND_COLORS = {
    "SOFT": "#DA2837", "MEDIUM": "#E3B505", "HARD": "#C9C2B0",
    "INTERMEDIATE": "#3BAA34", "WET": "#1E6FB8", "UNKNOWN": "#9A9486",
}


def team_color(team):
    return TEAM_COLORS.get(str(team), "#7A7468")


def init_dynamic_styles(session):
    """Pull season-correct team + compound colours from FastF1 and update the
    palette dicts in place (the hardcoded values act as offline fallbacks)."""
    try:
        import fastf1.plotting as fp
    except Exception:
        return
    try:
        for t in session.results["TeamName"].dropna().unique():
            try:
                c = fp.get_team_color(t, session=session)
                if c and str(c).lower() not in ("#ffffff", "#000000"):
                    TEAM_COLORS[str(t)] = c if str(c).startswith("#") else f"#{c}"
            except Exception:
                pass
    except Exception:
        pass
    for comp in ("SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"):
        try:
            c = fp.get_compound_color(comp, session=session)
            if c:
                COMPOUND_COLORS[comp] = c if str(c).startswith("#") else f"#{c}"
        except Exception:
            pass


# ── Fonts ───────────────────────────────────────────────────────────────────
def _load_font(name):
    p = os.path.join(HERE, "fonts", name)
    if os.path.exists(p):
        fm.fontManager.addfont(p)
        return fm.FontProperties(fname=p)
    return fm.FontProperties()


# App type system: Clash Display (headings) + Geist (body) + Geist Mono (numerics)
FP_TITLE = _load_font("ClashDisplay-Semibold.ttf")   # display headings
FP_TITLE_M = _load_font("ClashDisplay-Medium.ttf")   # lighter display
FP_BODY = _load_font("Geist-Regular.ttf")            # body copy
FP_BODY_B = _load_font("Geist-Medium.ttf")           # emphasised body / textual labels
FP_BODY_SB = _load_font("Geist-SemiBold.ttf")        # wordmark / strong labels
FP_MONO = _load_font("GeistMono-Regular.ttf")        # numerics / readouts
FP_MONO_B = _load_font("GeistMono-Medium.ttf")       # emphasised numerics
plt.rcParams["font.family"] = FP_BODY.get_name()
plt.rcParams["svg.fonttype"] = "none"

_LOGO = None
_logo_path = os.path.join(HERE, "assets", "logo.png")
if os.path.exists(_logo_path):
    try:
        _LOGO = np.asarray(Image.open(_logo_path).convert("RGBA"))
    except Exception:
        _LOGO = None


# ── Figure / layout helpers ─────────────────────────────────────────────────
# ── Output formats per distribution channel ──────────────────────────────────
# FMT selects the active layout. Every layout anchor + per-chart magic number
# lives here so each channel re-flows (never squeezes).
FMT = "landscape"
DRIVERS = None  # optional set of driver abbreviations to feature (CLI --drivers)

# 16:9 anchors shared by landscape + twitter (same ratio, different pixels)
_WIDE = dict(
    ax=(0.12, 0.58), eyebrow_y=0.905, title_y=0.795, title_fs=40, underline_y=0.762,
    subtitle_y=0.728, subtitle_fs=15.5, brand_y=0.905, footer_y=0.045,
    legend_y=0.852, cbar=(0.63, 0.15, 0.22, 0.02), radar_rect=(0.34, 0.06, 0.34, 0.60),
    headshot_right=0.85, stack_dz=1.05, legend_x=0.60, gear_x=0.55,
)
# tall-portrait anchors shared by instagram(4:5) + story(9:16)
_TALL = dict(
    eyebrow_y=0.963, title_y=0.930, title_fs=42, underline_y=0.912,
    subtitle_y=0.892, subtitle_fs=16, brand_y=0.963, footer_y=0.028,
    legend_y=0.838, cbar=(0.30, 0.072, 0.40, 0.012), radar_rect=(0.18, 0.26, 0.64, 0.42),
    headshot_right=0.74, legend_x=0.42, gear_x=0.30,
)

LAYOUT = {
    "landscape": {**_WIDE, "figsize": (12.8, 7.2), "dpi": 200,
                  "car_zoom": 0.052, "logo_zoom": 0.26},
    "twitter":   {**_WIDE, "figsize": (12.8, 7.2), "dpi": 125,
                  "car_zoom": 0.033, "logo_zoom": 0.16},
    "instagram": {**_TALL, "figsize": (10.8, 13.5), "dpi": 100, "ax": (0.13, 0.60),
                  "stack_dz": 1.25, "car_zoom": 0.034, "logo_zoom": 0.40},
    "story":     {**_TALL, "figsize": (10.8, 19.2), "dpi": 100, "ax": (0.105, 0.695),
                  "stack_dz": 1.55, "car_zoom": 0.034, "logo_zoom": 0.45},
}
FORMAT_SUFFIX = {"landscape": "", "twitter": "-twitter",
                 "instagram": "-instagram", "story": "-story"}


def LY(key):
    return LAYOUT[FMT][key]


def editorial_fig(left=0.09, right=0.93):
    L = LAYOUT[FMT]
    fig = plt.figure(figsize=L["figsize"], dpi=L["dpi"])
    face = "none" if TRANSPARENT else PAPER
    fig.patch.set_facecolor(face)
    fig.patch.set_alpha(0.0 if TRANSPARENT else 1.0)
    b, h = L["ax"]
    ax = fig.add_axes([left, b, right - left, h])
    ax.set_facecolor(face)
    if TRANSPARENT:
        ax.patch.set_alpha(0.0)
    return fig, ax


def title_block(fig, eyebrow, title, subtitle=None):
    ey, ty, uy, sy, by = (LY("eyebrow_y"), LY("title_y"), LY("underline_y"),
                          LY("subtitle_y"), LY("brand_y"))
    # pit-wall red edge bar (F1 DataStop signature)
    fig.add_artist(plt.Rectangle((0, 0), 0.009, 1, transform=fig.transFigure, color=RED, zorder=10))
    # red eyebrow
    fig.text(0.066, ey, "   ".join(eyebrow.upper()), color=RED, fontsize=12.5,
             fontproperties=FP_MONO_B)
    fig.text(0.062, ty, title, color=INK, fontsize=LY("title_fs"), fontproperties=FP_TITLE)
    # red underline accent under the title
    fig.add_artist(plt.Line2D([0.066, 0.138], [uy, uy], transform=fig.transFigure,
                              color=RED, lw=4.5, solid_capstyle="round"))
    if subtitle:
        fig.text(0.066, sy, subtitle, color=SUBINK, fontsize=LY("subtitle_fs"), fontproperties=FP_BODY)
    # brand mark, top-right — logo + wordmark
    fig.text(0.928, by, "F1 DATASTOP", ha="right", va="center", color=INK, fontsize=12.5,
             fontproperties=FP_BODY_SB)
    if _LOGO is not None:
        ab = AnnotationBbox(OffsetImage(_LOGO, zoom=0.16), (0.952, by),
                            xycoords="figure fraction", frameon=False, zorder=11)
        fig.add_artist(ab)
    else:
        fig.add_artist(plt.Rectangle((0.941, by - 0.007), 0.011, 0.015, transform=fig.transFigure,
                                     color=RED, zorder=10))


def clean_axes(ax, xlabel=None, ylabel=None):
    for side in ("top", "right", "left"):
        ax.spines[side].set_visible(False)
    ax.spines["bottom"].set_color(GRID)
    ax.tick_params(colors=SUBINK, labelsize=11, length=0)
    ax.grid(axis="y", color=GRID, linewidth=1.0)
    ax.set_axisbelow(True)
    if xlabel:
        ax.set_xlabel(xlabel, color=SUBINK, fontsize=12, fontproperties=FP_BODY)
    if ylabel:
        ax.set_ylabel(ylabel, color=SUBINK, fontsize=12, fontproperties=FP_BODY)
    for lbl in ax.get_xticklabels() + ax.get_yticklabels():
        lbl.set_fontproperties(FP_MONO)


def smooth_xy(x, y, n=320):
    x = np.asarray(x, float)
    y = np.asarray(y, float)
    if not _HAVE_SCIPY or len(x) < 4:
        return x, y
    order = np.argsort(x)
    x, y = x[order], y[order]
    x, idx = np.unique(x, return_index=True)
    y = y[idx]
    if len(x) < 4:
        return x, y
    xs = np.linspace(x.min(), x.max(), n)
    try:
        return xs, make_interp_spline(x, y, k=3)(xs)
    except Exception:
        return x, y


def end_pill(ax, x, y, text, color):
    ax.annotate(
        text, (x, y), xytext=(12, 0), textcoords="offset points",
        va="center", ha="left", fontsize=12.5, fontproperties=FP_BODY_B, color=INK,
        bbox=dict(boxstyle="round,pad=0.35", fc=PANEL, ec=color, lw=2.2),
        zorder=6,
    )
    ax.scatter([x], [y], s=70, facecolor=PANEL, edgecolor=color, linewidth=2.4, zorder=6)


def end_tag(ax, x, y, code, color):
    """Compact line-end label (for dense charts like 20-driver position)."""
    ax.scatter([x], [y], s=24, facecolor=PANEL, edgecolor=color, linewidth=1.6, zorder=6)
    ax.annotate(code, (x, y), xytext=(8, 0), textcoords="offset points", va="center",
                ha="left", fontsize=8.5, fontproperties=FP_BODY_B, color=color, zorder=6)


def _hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


_HEADSHOT_CACHE = {}

@retry_requests
def _http_get_bytes(url, timeout):
    """GET url -> body bytes, or None on a definitive 404. Transient failures (network,
    429/5xx) raise so retry_requests can act; other 4xx raise HTTPError (not retried)."""
    r = requests.get(url, timeout=timeout)
    if r.status_code == 404:
        return None
    raise_if_transient(r)
    r.raise_for_status()
    return r.content


def _cached_image(cache, key, url, timeout, build):
    """Fetch+decode with a cache that only ever stores successes and definitive absence
    (404 / undecodable body). A transient failure returns None WITHOUT caching, so a later
    call retries instead of inheriting a one-off network blip."""
    if key in cache:
        return cache[key]
    try:
        body = _http_get_bytes(url, timeout)
    except Exception as e:  # noqa: BLE001 — cosmetic asset; degrade, don't cache
        print(f"  (image fetch failed, not cached: {url}: {e})", file=sys.stderr)
        return None
    if body is None:
        cache[key] = None
        return None
    try:
        out = build(body)
    except Exception:  # noqa: BLE001 — undecodable body is deterministic
        out = None
    cache[key] = out
    return out


def _build_headshot(content):
    img = Image.open(BytesIO(content)).convert("RGBA")
    w, h = img.size
    if h / w >= 1.5:
        # F1 full-body render -> crop the head + shoulders from the top centre
        sz = int(h * 0.185)
        x0 = max(0, int(w / 2 - sz / 2))
        y0 = int(h * 0.012)
        img = img.crop((x0, y0, x0 + sz, y0 + sz))
    else:
        s = min(w, h)
        img = img.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))
    img = img.resize((140, 140))
    # F1 cutouts have a transparent background -> put them on white
    bg = Image.new("RGBA", (140, 140), (255, 255, 255, 255))
    bg.paste(img, (0, 0), img)
    img = bg
    mask = Image.new("L", (140, 140), 0)
    ImageDraw.Draw(mask).ellipse((4, 4, 136, 136), fill=255)
    img.putalpha(mask)
    return img


def fetch_headshot(url):
    if not url or not isinstance(url, str):
        return None
    return _cached_image(_HEADSHOT_CACHE, url, url, 12, _build_headshot)


def headshot_disc(url, color, size=150):
    """Circular headshot with a glowing team-colour ring (RGBA array) or None."""
    base = fetch_headshot(url)
    if base is None:
        return None
    pad = 28
    W = size + pad * 2
    rgb = _hex_to_rgb(color)
    canvas = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    glow = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((pad - 6, pad - 6, pad + size + 6, pad + size + 6),
                                 outline=rgb + (255,), width=20)
    canvas.alpha_composite(glow.filter(ImageFilter.GaussianBlur(11)))
    canvas.alpha_composite(base.resize((size, size)), (pad, pad))
    ring = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse((pad, pad, pad + size, pad + size),
                                 outline=rgb + (255,), width=9)
    canvas.alpha_composite(ring)
    return np.asarray(canvas)


def headshot_label(ax, x, y, code, color, url, code_dx=78):
    arr = headshot_disc(url, color)
    if arr is None:
        end_pill(ax, x, y, code, color)
        return
    ab = AnnotationBbox(OffsetImage(arr, zoom=0.30), (x, y), xybox=(32, 0),
                        xycoords="data", boxcoords="offset points", frameon=False,
                        box_alignment=(0, 0.5), zorder=8)
    ax.add_artist(ab)
    ax.annotate(code, (x, y), xytext=(code_dx, 0), textcoords="offset points",
                va="center", ha="left", fontsize=13, fontproperties=FP_BODY_B,
                color=INK, zorder=8,
                bbox=dict(boxstyle="round,pad=0.22", facecolor=PAPER, edgecolor="none", alpha=0.82))


def headshot_legend_row(fig, items, y=None, x0=0.5, step=0.105):
    """items: (code, color, url) placed as a glowing headshot row in figure coords."""
    if y is None:
        y = LY("legend_y")
    x = x0
    for code, color, url in items:
        arr = headshot_disc(url, color)
        if arr is not None:
            fig.add_artist(AnnotationBbox(OffsetImage(arr, zoom=0.16), (x, y),
                                          xycoords="figure fraction", frameon=False, zorder=12))
        fig.text(x + 0.026, y, code, va="center", ha="left", color=INK, fontsize=12,
                 bbox=dict(boxstyle="round,pad=0.2", facecolor=PAPER, edgecolor="none", alpha=0.82),
                 fontproperties=FP_BODY_B)
        x += step


PURPLE = "#A855F7"   # app --fastest-lap (271 91% 68%)


def compound_legend(fig, y=None, fastest=False):
    if y is None:
        y = LY("legend_y")
    items = [("Soft", COMPOUND_COLORS["SOFT"]), ("Medium", COMPOUND_COLORS["MEDIUM"]),
             ("Hard", COMPOUND_COLORS["HARD"]), ("Inter", COMPOUND_COLORS["INTERMEDIATE"]),
             ("Wet", COMPOUND_COLORS["WET"])]
    if fastest:
        items.append(("Fastest lap", PURPLE))
    x = 0.43 if fastest else 0.50
    step = 0.085 if fastest else 0.088
    for label, col in items:
        fig.add_artist(plt.Rectangle((x, y - 0.009), 0.013, 0.02, transform=fig.transFigure,
                                     color=col, zorder=11))
        fig.text(x + 0.021, y, label, va="center", ha="left", color=INK, fontsize=11.5,
                 fontproperties=FP_BODY)
        x += step


TEAM_SLUG = {
    "red bull racing": "redbullracing", "red bull": "redbullracing",
    "ferrari": "ferrari", "mercedes": "mercedes", "mclaren": "mclaren",
    "aston martin": "astonmartin", "alpine": "alpine", "williams": "williams",
    "racing bulls": "racingbulls", "rb": "racingbulls", "alphatauri": "alphatauri",
    "audi": "audi", "kick sauber": "kicksauber", "sauber": "sauber",
    "alfa romeo": "alfaromeo", "haas f1 team": "haas", "haas": "haas",
    "cadillac": "cadillac",
}
_MEDIA = "https://media.formula1.com/image/upload"


def team_slug(team):
    t = (team or "").strip().lower()
    if not t:
        return None
    if t in TEAM_SLUG:
        return TEAM_SLUG[t]
    # Derive the F1 media slug: drop "f1 team"/"team", keep alphanumerics
    return re.sub(r"[^a-z0-9]", "", t.replace("f1 team", "").replace(" team", "")) or None


def f1_headshot_url(season, slug, code8):
    c = code8.lower()
    return f"{_MEDIA}/c_fill,w_720/q_auto/common/f1/{season}/{slug}/{c}/{season}{slug}{c}right.webp"


def f1_car_url(season, slug):
    return f"{_MEDIA}/c_lfill,w_1280/q_auto/common/f1/{season}/{slug}/{season}{slug}carright.webp"


def _code8_from_legacy(url):
    if not isinstance(url, str):
        return None
    m = re.search(r"/drivers/[A-Za-z]/([A-Za-z]{6}\d{2})_", url)
    return m.group(1) if m else None


_IMG_CACHE = {}


def fetch_image_rgba(url):
    """Fetch a raw RGBA image (no crop), cached. Returns np array or None."""
    if not url:
        return None
    return _cached_image(_IMG_CACHE, url, url, 12,
                         lambda b: np.asarray(Image.open(io.BytesIO(b)).convert("RGBA")))


def fetch_car(season, team):
    slug = team_slug(team)
    if not (season and slug):
        return None
    return fetch_image_rgba(f1_car_url(season, slug))


def place_team_cars(ax, team_rows, season, xfrac=0.965):
    """Place each team's season-correct car at the right edge of its row.
    team_rows: list of (team_name, y_data)."""
    zoom = LY("car_zoom")
    for team, y in team_rows:
        car = fetch_car(season, team)
        if car is not None:
            ax.add_artist(AnnotationBbox(OffsetImage(car, zoom=zoom), (xfrac, y),
                          xycoords=("axes fraction", "data"), frameon=False,
                          box_alignment=(0.5, 0.5), zorder=6))


TEAM_LABELS = "text"  # "text" or "logo" (set by CLI --team-labels)


def logo_slug(team):
    s = team_slug(team)
    return "haasf1team" if s == "haas" else s  # F1 logo path differs for Haas


def f1_logo_url(season, slug):
    return f"{_MEDIA}/c_fit,h_96/q_auto/common/f1/{season}/{slug}/{season}{slug}logowhite.webp"


def fetch_team_logo(season, team):
    slug = logo_slug(team)
    if not (season and slug):
        return None
    return fetch_image_rgba(f1_logo_url(season, slug))


def team_y_labels(ax, teams, ys, season, fontsize=11):
    """Team y-axis labels: text names, or (with --team-labels logo) season-correct
    team wordmark logos, all the same height."""
    ax.set_yticks(list(ys))
    if TEAM_LABELS == "logo":
        ax.set_yticklabels([""] * len(teams))
        zoom = LY("logo_zoom")
        for team, y in zip(teams, ys):
            logo = fetch_team_logo(season, team)
            if logo is not None:
                ax.add_artist(AnnotationBbox(OffsetImage(logo, zoom=zoom), (-0.02, y),
                              xycoords=("axes fraction", "data"), frameon=False,
                              box_alignment=(1.0, 0.5), zorder=8))
    else:
        ax.set_yticklabels(list(teams), fontproperties=FP_BODY_B, color=INK, fontsize=fontsize)


def driver_lookup(session):
    out = {}
    try:
        season = int(getattr(session.event, "year", 0)) or None
    except Exception:
        season = None
    try:
        for num, row in session.results.iterrows():
            legacy = row.get("HeadshotUrl")
            slug = team_slug(row.get("TeamName"))
            code8 = _code8_from_legacy(legacy)
            headshot = legacy
            if season and slug and code8:
                headshot = f1_headshot_url(season, slug, code8)
            info = {"abbr": row.get("Abbreviation"), "team": row.get("TeamName"),
                    "headshot": headshot, "headshot_legacy": legacy}
            out[str(num)] = info
            if info["abbr"]:
                out[str(info["abbr"])] = info
    except Exception:
        pass
    return out


F1_COUNTRY_ISO = {
    "Australia": "au", "China": "cn", "Japan": "jp", "Bahrain": "bh",
    "Saudi Arabia": "sa", "United States": "us", "USA": "us", "Italy": "it",
    "Monaco": "mc", "Spain": "es", "Canada": "ca", "Austria": "at",
    "United Kingdom": "gb", "Great Britain": "gb", "UK": "gb", "Hungary": "hu",
    "Belgium": "be", "Netherlands": "nl", "Azerbaijan": "az", "Singapore": "sg",
    "Mexico": "mx", "Brazil": "br", "Qatar": "qa", "United Arab Emirates": "ae",
    "UAE": "ae", "France": "fr", "Germany": "de", "Portugal": "pt", "Turkey": "tr",
}
_FLAG_CACHE = {}


def country_iso(country):
    """Country name -> ISO alpha-2 (lowercase). Dynamic via pycountry, with a
    small hardcoded fallback for offline use / F1-specific aliases."""
    c = (country or "").strip()
    if not c:
        return None
    try:
        import pycountry
        m = pycountry.countries.get(name=c)
        if m is None:
            m = pycountry.countries.search_fuzzy(c)[0]
        if m is not None:
            return m.alpha_2.lower()
    except Exception:
        pass
    return F1_COUNTRY_ISO.get(c)


def fetch_flag(country):
    iso = country_iso(country)
    if not iso:
        return None
    return _cached_image(_FLAG_CACHE, iso, f"https://flagcdn.com/w40/{iso}.png", 8,
                         lambda b: np.asarray(Image.open(io.BytesIO(b)).convert("RGBA")))


def footer(fig, meta):
    country = meta.get("country")
    circuit = meta.get("circuit") or meta.get("location")
    bits = [b for b in (circuit, country) if b] or [meta.get("event", "")]
    txt = f"{' · '.join(bits)} · {meta['year']} · {meta['session_name']}   —   f1datastop.com"
    yc = LY("footer_y")
    tx = 0.066
    flag = fetch_flag(country)
    if flag is not None:
        fig.add_artist(AnnotationBbox(OffsetImage(flag, zoom=0.28), (0.072, yc),
                       xycoords="figure fraction", frameon=False,
                       box_alignment=(0.5, 0.5), zorder=11))
        tx = 0.090
    fig.text(tx, yc, txt, va="center", color=SUBINK, fontsize=11, fontproperties=FP_BODY)


def add_watermark(fig):
    """Faint, full-coverage tiled wordmark — anti-theft 'security-paper' texture.
    Light weight + low opacity so it reads as subtle grain, not repeated words."""
    for j, yy in enumerate(np.arange(0.03, 1.02, 0.092)):
        x0 = -0.06 + (0.07 if j % 2 else 0.0)
        for xx in np.arange(x0, 1.04, 0.143):
            # Ink-coloured so the security grain reads on any surface — white is invisible
            # on the light theme; a hair more opacity there since dark-on-light needs it.
            fig.text(xx, yy, "f1datastop.com", color=INK,
                     alpha=0.022 if PAPER == THEMES["light"]["paper"] else 0.015,
                     fontsize=8.5, fontproperties=FP_BODY, rotation=16,
                     ha="left", va="center", zorder=20)


class ChartPNG(bytes):
    """Full-size PNG bytes with a small WebP `.thumb` riding along.

    Every chart function returns plain bytes; subclassing keeps all 33 of them (and every
    `len(png)` / `f.write(png)` caller) untouched while the uploader can also store the
    thumbnail the Deep Dive grid/list now render instead of the full 2560x1440 PNG."""
    thumb = None


THUMB_DPI = 36  # 12.8x7.2in figure -> ~460x260 px; grid cards are ~250 px wide


def _webp(png_bytes, quality=78):
    im = Image.open(io.BytesIO(png_bytes)).convert("RGB")
    out = io.BytesIO()
    im.save(out, "WEBP", quality=quality, method=4)
    return out.getvalue()


def fig_png(fig):
    # Thumbnail first — same figure at low dpi, no watermark (the tiled text is invisible
    # at this size and only bloats the file). ~25-35 KB vs ~450 KB for the master.
    thumb = None
    try:
        tb = io.BytesIO()
        fig.savefig(tb, format="png", facecolor=PAPER, transparent=False,
                    dpi=THUMB_DPI, bbox_inches=None, pad_inches=0)
        thumb = _webp(tb.getvalue())
    except Exception as e:  # noqa: BLE001 — a thumb failure must never lose the chart
        print(f"  (thumbnail failed: {e})")
    add_watermark(fig)
    buf = io.BytesIO()
    # Glass renders a transparent PNG so the frosted card shows through; the others bake
    # their solid surface so downloads/social cards look right standing alone.
    fig.savefig(buf, format="png",
                facecolor="none" if TRANSPARENT else PAPER,
                transparent=TRANSPARENT, dpi=200, bbox_inches=None, pad_inches=0)
    plt.close(fig)
    png = ChartPNG(buf.getvalue())
    png.thumb = thumb
    return png


def top_drivers_by_pace(laps, n=5):
    q = laps.pick_quicklaps() if hasattr(laps, "pick_quicklaps") else laps
    order = list(q.groupby("Driver")["LapTime"].min().sort_values().index)
    if DRIVERS:
        return [d for d in order if d in DRIVERS]  # selected drivers, pace order
    return order[:n]


# ── Safety car / VSC / red-flag shading ─────────────────────────────────────
def safety_periods(session):
    """SC/VSC/Red-flag lap ranges from race control messages.
    Returns list of dicts: {"kind": "SC"|"VSC"|"RED", "start": int, "end": int}."""
    try:
        rc = getattr(session, "race_control_messages", None)
        if rc is None or len(rc) == 0:
            return []
    except Exception:
        return []
    rows = []
    for _, m in rc.iterrows():
        lap = m.get("Lap")
        if lap is None or (isinstance(lap, float) and pd.isna(lap)):
            continue
        rows.append((int(lap), str(m.get("Message") or "").upper(), str(m.get("Flag") or "").upper(),
                     str(m.get("Time") or "")))
    rows.sort(key=lambda r: (r[0], r[3]))
    max_lap = max((r[0] for r in rows), default=1)
    periods, sc, vsc, red = [], None, None, None
    for lap, msg, flag, _ in rows:
        virtual = "VIRTUAL SAFETY CAR" in msg or "VSC" in msg
        deploy = "DEPLOY" in msg
        end = "ENDING" in msg or "IN THIS LAP" in msg
        # `flag` column is authoritative; the message fallback is word-bounded so
        # "CHEQUERED FLAG" (ends every race, contains "…RED FLAG") never trips it.
        if flag == "RED" or re.search(r"\bRED FLAG\b", msg):
            red = red or {"kind": "RED", "start": lap, "end": lap}; continue
        if (flag == "GREEN" or "GREEN" in msg or "TRACK CLEAR" in msg):
            for p, nm in ((red, "red"), (vsc, "vsc"), (sc, "sc")):
                if p: p["end"] = max(p["start"], lap); periods.append(p)
            red = vsc = sc = None; continue
        if virtual:
            if deploy and not vsc: vsc = {"kind": "VSC", "start": lap, "end": lap}
            elif end and vsc: vsc["end"] = max(vsc["start"], lap); periods.append(vsc); vsc = None
            continue
        if "SAFETY CAR" in msg:
            if deploy and not sc: sc = {"kind": "SC", "start": lap, "end": lap}
            elif end and sc: sc["end"] = max(sc["start"], lap); periods.append(sc); sc = None
    for p in (sc, vsc, red):
        if p: p["end"] = max(p["start"], max_lap); periods.append(p)
    return sorted(periods, key=lambda p: p["start"])


_SAFETY_COLOR = {"SC": "#F5B301", "VSC": "#F5B301", "RED": RED}


_SAFETY_LABEL = {"SC": "Safety Car", "VSC": "Virtual SC", "RED": "Red Flag"}


def shade_safety(ax, session):
    """Shade SC/VSC/red-flag lap ranges on a lap x-axis, tag each band, and draw a
    compact legend in the title band (right side, under the brand). No-op when the
    session has no safety periods. Returns the kinds seen."""
    import matplotlib.patches as mpatches

    periods = safety_periods(session)
    seen = set()
    # Blended transform: x in data (lap), y in axes fraction — robust to call order
    # (works before the series are plotted / autoscaled).
    xtr = ax.get_xaxis_transform()
    for p in periods:
        c = _SAFETY_COLOR[p["kind"]]
        ax.axvspan(p["start"] - 0.5, p["end"] + 0.5, facecolor=c, alpha=0.12, zorder=0,
                   hatch="///" if p["kind"] == "VSC" else None, lw=0)
        # hairline edges
        for xx in (p["start"] - 0.5, p["end"] + 0.5):
            ax.axvline(xx, color=c, alpha=0.32, lw=0.8, zorder=0.5)
        # kind tag at the band top
        ax.text((p["start"] + p["end"]) / 2.0, 0.975, p["kind"], transform=xtr,
                ha="center", va="top", color=c, alpha=0.95, fontsize=8.5,
                fontproperties=FP_BODY_B, zorder=3)
        seen.add(p["kind"])

    if seen:
        handles = [
            mpatches.Patch(facecolor=_SAFETY_COLOR[k], alpha=0.45, edgecolor="none",
                           hatch="///" if k == "VSC" else None, label=_SAFETY_LABEL[k])
            for k in ("SC", "VSC", "RED") if k in seen
        ]
        try:
            yleg = LY("subtitle_y")
        except Exception:  # noqa: BLE001
            yleg = 0.86
        leg = ax.figure.legend(
            handles=handles, loc="upper right", bbox_to_anchor=(0.928, yleg),
            ncol=len(handles), frameon=False, fontsize=9.5, handlelength=1.3,
            handleheight=1.05, columnspacing=1.2, borderaxespad=0.0, handletextpad=0.5,
        )
        for t in leg.get_texts():
            t.set_color(SUBINK)
    return seen


# ── Charts ──────────────────────────────────────────────────────────────────
def chart_speed_trace(session, meta):
    laps = session.laps
    fig, ax = editorial_fig(right=LY("headshot_right"))
    title_block(fig, "Fastest Lap", "Speed Trace", "Top five drivers · fastest lap")
    look = driver_lookup(session)
    ends = []
    plotted = 0
    seen = {}
    tmcol = {}
    for drv in top_drivers_by_pace(laps, 5):
        dl = laps[laps["Driver"] == drv]
        if dl.empty:
            continue
        lap = dl.pick_fastest()
        if lap is None or (hasattr(lap, "empty") and lap.empty):
            continue
        tel = lap.get_car_data().add_distance()
        c = teammate_color(lap["Team"], tmcol)
        ax.plot(tel["Distance"], tel["Speed"], color=c, lw=2.6,
                ls=style_for(lap["Team"], seen), solid_capstyle="round")
        ends.append((drv, c, (look.get(str(drv)) or {}).get("headshot")))
        plotted += 1
    # Headshot column on the right (top-down by pace), spread to avoid overlap
    if plotted:
        ymax = ax.get_ylim()[1]
        xmax = ax.get_xlim()[1]
        step = (ax.get_ylim()[1] - ax.get_ylim()[0]) * 0.14
        for i, (drv, c, url) in enumerate(ends):
            headshot_label(ax, xmax, ymax - step * (i + 0.6), drv, c, url)
    if not plotted:
        plt.close(fig)
        return None
    clean_axes(ax, "Distance (m)", "Speed (km/h)")
    footer(fig, meta)
    return fig_png(fig)


def chart_position_changes(session, meta):
    laps = session.laps
    fig, ax = editorial_fig()
    title_block(fig, "Race", "Position Changes", "Track position, lap by lap")
    shade_safety(ax, session)
    plotted = 0
    seen = {}
    for drv in session.drivers:
        dl = laps[laps["DriverNumber"] == drv].dropna(subset=["Position"])
        if dl.empty:
            continue
        abbr = dl["Driver"].iloc[0]
        if DRIVERS and abbr not in DRIVERS:
            continue
        team = dl["Team"].iloc[0]
        c = team_color(team)
        xs, ys = smooth_xy(dl["LapNumber"].values, dl["Position"].values)
        ax.plot(xs, ys, color=c, lw=2.4, ls=style_for(team, seen),
                solid_capstyle="round", alpha=0.95)
        last = dl.iloc[-1]
        end_tag(ax, last["LapNumber"], last["Position"], abbr, c)
        plotted += 1
    if not plotted:
        plt.close(fig)
        return None
    npos = max(int(laps["Position"].dropna().max() or 0), len(session.drivers))
    ax.set_ylim(npos + 0.6, 0.4)
    ax.set_yticks(pos_yticks(npos))
    clean_axes(ax, "Lap", "Position")
    footer(fig, meta)
    return fig_png(fig)


def chart_tyre_strategy(session, meta):
    laps = session.laps
    fig, ax = editorial_fig()
    title_block(fig, "Strategy", "Tyre Stints", "Compound usage per driver")
    shade_safety(ax, session)
    yt, yl = [], []
    row_i = 0
    for drv in session.drivers:
        dl = laps[laps["DriverNumber"] == drv]
        if dl.empty:
            continue
        abbr = dl["Driver"].iloc[0]
        if DRIVERS and abbr not in DRIVERS:
            continue
        for _, st in dl.groupby("Stint"):
            comp = str(st["Compound"].iloc[0]).upper()
            start = st["LapNumber"].min()
            length = st["LapNumber"].max() - start + 1
            ax.barh(row_i, length, left=start - 1, height=0.62,
                    color=COMPOUND_COLORS.get(comp, "#9A9486"),
                    edgecolor=PAPER, linewidth=1.4, zorder=3)
        yt.append(row_i)
        yl.append(abbr)
        row_i += 1
    if not yt:
        plt.close(fig)
        return None
    ax.set_yticks(yt)
    ax.set_yticklabels(yl, fontproperties=FP_BODY_B, color=INK, fontsize=10)
    ax.invert_yaxis()
    ax.grid(axis="y", linewidth=0)
    clean_axes(ax, "Lap", None)
    ax.grid(axis="x", color=GRID, linewidth=1.0)
    compound_legend(fig)
    footer(fig, meta)
    return fig_png(fig)


def chart_team_pace(session, meta):
    laps = session.laps.pick_quicklaps() if hasattr(session.laps, "pick_quicklaps") else session.laps
    laps = laps.copy()
    laps["s"] = laps["LapTime"].dt.total_seconds()
    med = laps.groupby("Team")["s"].median().dropna().sort_values()
    if med.empty:
        return None
    best = med.iloc[0]
    fig, ax = editorial_fig(left=0.17)
    title_block(fig, "Race Pace", "Gap to Fastest Team", "Median race-lap delta")
    teams = list(med.index)[::-1]
    span = float(med.max() - best) or 1.0
    season = meta.get("year")
    for i, t in enumerate(teams):
        delta = med[t] - best
        ax.barh(i, delta, height=0.6, color=team_color(t), zorder=3,
                edgecolor=PAPER, linewidth=1.2)
        ax.text(delta + span * 0.015, i,
                "BASE" if delta == 0 else f"+{delta:.2f}s",
                va="center", ha="left", fontsize=11, fontproperties=FP_MONO_B, color=INK)
    place_team_cars(ax, [(t, i) for i, t in enumerate(teams)], season)
    ax.set_xlim(-span * 0.02, span * 1.34)
    team_y_labels(ax, teams, range(len(teams)), season, 11)
    ax.grid(axis="y", linewidth=0)
    ax.grid(axis="x", color=GRID, linewidth=1.0)
    clean_axes(ax, "Seconds behind fastest team", None)
    footer(fig, meta)
    return fig_png(fig)


def chart_speed_distribution(session, meta):
    """Distribution of speed per team (pooled from each driver's fastest lap)."""
    laps = session.laps
    by_team = {}
    for drv in session.drivers:
        dl = laps[laps["DriverNumber"] == drv]
        if dl.empty:
            continue
        lap = dl.pick_fastest()
        if lap is None or (hasattr(lap, "empty") and lap.empty):
            continue
        try:
            spd = lap.get_car_data()["Speed"].dropna().values
        except Exception:
            continue
        spd = spd[spd > 50]
        if len(spd) < 30:
            continue
        team = lap["Team"]
        by_team.setdefault(team, []).append(spd)
    pooled = {t: np.concatenate(v) for t, v in by_team.items() if v}
    if len(pooled) < 2:
        return None
    teams = sorted(pooled, key=lambda t: np.percentile(pooled[t], 95))
    fig, ax = editorial_fig(left=0.17)
    title_block(fig, "Telemetry", "Speed Distribution", "Per team · fastest-lap car speed")
    data = [pooled[t] for t in teams]
    parts = ax.violinplot(data, orientation="horizontal", showextrema=False, widths=0.85)
    for body, t in zip(parts["bodies"], teams):
        body.set_facecolor(team_color(t))
        body.set_edgecolor(team_color(t))
        body.set_alpha(0.55)
        body.set_linewidth(1.5)
    for i, t in enumerate(teams):
        med = np.median(pooled[t])
        ax.scatter([med], [i + 1], s=46, color=team_color(t), zorder=5,
                   edgecolor=PAPER, linewidth=1.4)
    x0, x1 = ax.get_xlim()
    ax.set_xlim(x0, x1 + (x1 - x0) * 0.15)
    place_team_cars(ax, [(t, i + 1) for i, t in enumerate(teams)], meta.get("year"))
    team_y_labels(ax, teams, range(1, len(teams) + 1), meta.get("year"), 11)
    ax.grid(axis="y", linewidth=0)
    ax.grid(axis="x", color=GRID, linewidth=1.0)
    clean_axes(ax, "Speed (km/h)", None)
    footer(fig, meta)
    return fig_png(fig)


def chart_places_gained(session, meta):
    try:
        res = session.results.copy()
    except Exception:
        return None
    if "GridPosition" not in res or "Position" not in res:
        return None
    res = res.dropna(subset=["GridPosition", "Position"])
    res = res[res["GridPosition"] > 0]
    if DRIVERS:
        res = res[res["Abbreviation"].isin(DRIVERS)]
    if res.empty:
        return None
    res["delta"] = res["GridPosition"] - res["Position"]
    res = res.sort_values("delta")
    fig, ax = editorial_fig(left=0.10)
    title_block(fig, "Race", "Places Gained & Lost", "Grid position to finish")
    codes = list(res["Abbreviation"].values)
    deltas = res["delta"].values
    colors = ["#2BD46A" if d > 0 else ("#FF4136" if d < 0 else SUBINK) for d in deltas]
    ax.barh(range(len(codes)), deltas, color=colors, height=0.62, zorder=3,
            edgecolor=PAPER, linewidth=1.0)
    ax.axvline(0, color="#3A3D45", lw=1.4)
    for i, d in enumerate(deltas):
        ha = "left" if d >= 0 else "right"
        off = 0.35 if d >= 0 else -0.35
        ax.text(d + off, i, f"+{int(d)}" if d > 0 else str(int(d)), va="center", ha=ha,
                fontsize=10.5, fontproperties=FP_MONO_B, color=INK)
    ax.set_yticks(range(len(codes)))
    ax.set_yticklabels(codes, fontproperties=FP_BODY_B, color=INK, fontsize=10)
    ax.grid(axis="y", linewidth=0)
    ax.grid(axis="x", color=GRID, linewidth=1.0)
    clean_axes(ax, "Places gained (+) / lost (−)", None)
    footer(fig, meta)
    return fig_png(fig)


def chart_pace_tyre(session, meta):
    laps = session.laps.pick_quicklaps() if hasattr(session.laps, "pick_quicklaps") else session.laps
    laps = laps.copy()
    laps["s"] = laps["LapTime"].dt.total_seconds()
    laps = laps.dropna(subset=["s", "Team", "Compound"])
    if laps.empty or laps["Team"].nunique() < 2:
        return None
    order = list(laps.groupby("Team")["s"].median().sort_values().index)  # fastest first
    fastest = laps.loc[laps["s"].idxmin()]
    fl_team, fl_s = fastest["Team"], float(fastest["s"])
    fl_comp = COMPOUND_COLORS.get(str(fastest["Compound"]).upper(), "#999999")
    fig, ax = editorial_fig(left=0.17)
    title_block(fig, "Pace", "Race Pace by Tyre", "Lap-time spread per team · point colour = compound")
    data = [laps[laps["Team"] == t]["s"].values for t in order]
    parts = ax.violinplot(data, orientation="horizontal", showextrema=False, widths=0.9)
    for body, t in zip(parts["bodies"], order):
        body.set_facecolor(team_color(t))
        body.set_alpha(0.22)
        body.set_edgecolor(team_color(t))
        body.set_linewidth(1.3)
    for i, t in enumerate(order):
        sub = laps[laps["Team"] == t]
        svals = sub["s"].values
        rng = np.random.RandomState(i)
        ys = (i + 1) + (rng.rand(len(sub)) - 0.5) * 0.55
        cols = [COMPOUND_COLORS.get(str(c).upper(), "#999999") for c in sub["Compound"]]
        ax.scatter(svals, ys, c=cols, s=22, alpha=0.9,
                   edgecolor=PAPER, linewidth=0.5, zorder=5)
        if t == fl_team:
            idx = int(np.argmin(np.abs(svals - fl_s)))
            fy = ys[idx]
            ax.scatter([fl_s], [fy], marker=MarkerStyle("o", fillstyle="left"), s=95,
                       c=PURPLE, edgecolor=PAPER, linewidth=0.6, zorder=8)
            ax.scatter([fl_s], [fy], marker=MarkerStyle("o", fillstyle="right"), s=95,
                       c=fl_comp, edgecolor=PAPER, linewidth=0.6, zorder=8)
    x0, x1 = ax.get_xlim()
    ax.set_xlim(x0, x1 + (x1 - x0) * 0.13)
    place_team_cars(ax, [(t, i + 1) for i, t in enumerate(order)], meta.get("year"))
    team_y_labels(ax, order, range(1, len(order) + 1), meta.get("year"), 11)
    ax.invert_yaxis()
    ax.grid(axis="y", linewidth=0)
    ax.grid(axis="x", color=GRID, linewidth=1.0)
    clean_axes(ax, "Lap time", None)
    ax.xaxis.set_major_formatter(LAPTIME_FMT)
    compound_legend(fig, fastest=True)
    footer(fig, meta)
    return fig_png(fig)


def chart_throttle_brake(session, meta):
    laps = session.laps
    fl = laps.pick_fastest() if hasattr(laps, "pick_fastest") else None
    if fl is None or (hasattr(fl, "empty") and fl.empty):
        return None
    try:
        tel = fl.get_car_data().add_distance()
    except Exception:
        return None
    drv = fl["Driver"]
    c = team_color(fl["Team"])
    fig, ax = editorial_fig()
    title_block(fig, "Telemetry", "Throttle & Brake", f"Fastest lap · {drv}")
    d = tel["Distance"]
    ax.fill_between(d, 0, tel["Throttle"], color=c, alpha=0.55, lw=0)
    brake = tel["Brake"].astype(float)
    if brake.max() <= 1:
        brake = brake * 100
    ax.fill_between(d, 0, brake, color=RED, alpha=0.6, lw=0)
    ax.set_ylim(0, 105)
    clean_axes(ax, "Distance (m)", "Input %")
    fig.add_artist(plt.Rectangle((0.74, 0.843), 0.013, 0.02, transform=fig.transFigure, color=c, zorder=11))
    fig.text(0.762, 0.852, "Throttle", va="center", color=INK, fontsize=11.5, fontproperties=FP_BODY)
    fig.add_artist(plt.Rectangle((0.85, 0.843), 0.013, 0.02, transform=fig.transFigure, color=RED, zorder=11))
    fig.text(0.872, 0.852, "Brake", va="center", color=INK, fontsize=11.5, fontproperties=FP_BODY)
    footer(fig, meta)
    return fig_png(fig)


def chart_track_dominance(session, meta):
    laps = session.laps
    tels = {}
    for drv in top_drivers_by_pace(laps, 3):
        dl = laps[laps["Driver"] == drv]
        lap = dl.pick_fastest()
        if lap is None or (hasattr(lap, "empty") and lap.empty):
            continue
        try:
            t = lap.get_telemetry()
        except Exception:
            continue
        if "X" not in t or "Speed" not in t:
            continue
        tels[drv] = (t, team_color(lap["Team"]))
    if len(tels) < 2:
        return None
    ref = next(iter(tels.values()))[0]
    grid = np.linspace(0, ref["Distance"].max(), 700)
    rx = np.interp(grid, ref["Distance"], ref["X"])
    ry = np.interp(grid, ref["Distance"], ref["Y"])
    drv_list = list(tels.keys())
    speeds = np.vstack([np.interp(grid, tels[d][0]["Distance"], tels[d][0]["Speed"]) for d in drv_list])
    winner = np.argmax(speeds, axis=0)
    seg_colors = [tels[drv_list[i]][1] for i in winner]
    pts = np.array([rx, ry]).T.reshape(-1, 1, 2)
    segs = np.concatenate([pts[:-1], pts[1:]], axis=1)
    fig, ax = editorial_fig()
    title_block(fig, "Telemetry", "Track Dominance", "Fastest driver in each mini-sector")
    neon_lines(ax, segs, colors=seg_colors[:-1], lw=8)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.autoscale()
    ax.margins(0.06)
    look = driver_lookup(session)
    items = [(drv, tels[drv][1], (look.get(str(drv)) or {}).get("headshot")) for drv in drv_list]
    headshot_legend_row(fig, items, x0=0.58, step=0.13)
    footer(fig, meta)
    return fig_png(fig)


def chart_grid_flow(session, meta):
    res = session.results.copy().dropna(subset=["GridPosition", "Position"])
    res = res[res["GridPosition"] > 0]
    if res.empty:
        return None
    qpos = {}
    try:
        q = fastf1.get_session(meta["year"], meta["round"], "Q")
        q.load(laps=False, telemetry=False, weather=False, messages=False)
        for _, row in q.results.iterrows():
            if row.get("Abbreviation") and not pd.isna(row.get("Position")):
                qpos[row["Abbreviation"]] = int(row["Position"])
    except Exception:
        qpos = {}
    from matplotlib.path import Path as MPath
    from matplotlib.patches import PathPatch
    GAIN, LOSS, HELD = "#22C55E", "#EF4444", "#3B82F6"
    cols = [0, 1, 2]
    n = len(res)
    fig, ax = editorial_fig(left=0.10, right=0.90)
    title_block(fig, "Race", "Qualifying to Race",
                "Grid in the middle · every place gained and lost")

    def band(x0, y0, x1, y1, color, w=0.56, alpha=0.5):
        xm = (x0 + x1) / 2.0
        h = w / 2.0
        verts = [(x0, y0 - h), (xm, y0 - h), (xm, y1 - h), (x1, y1 - h),
                 (x1, y1 + h), (xm, y1 + h), (xm, y0 + h), (x0, y0 + h), (x0, y0 - h)]
        codes = [MPath.MOVETO, MPath.CURVE4, MPath.CURVE4, MPath.CURVE4,
                 MPath.LINETO, MPath.CURVE4, MPath.CURVE4, MPath.CURVE4, MPath.CLOSEPOLY]
        ax.add_patch(PathPatch(MPath(verts, codes), facecolor=color, edgecolor="none",
                               alpha=alpha, zorder=2))

    def seg_color(a, b):
        return GAIN if b < a else (LOSS if b > a else HELD)

    if DRIVERS:
        res = res[res["Abbreviation"].isin(DRIVERS)]
        if res.empty:
            return None
    node_col = [{}, {}, {}]  # position -> team colour, per column
    for _, row in res.iterrows():
        abbr = row.get("Abbreviation")
        grid = int(row["GridPosition"])
        fin = int(row["Position"])
        qp = qpos.get(abbr, grid)
        tc = team_color(row.get("TeamName"))
        node_col[0][qp] = tc
        node_col[1][grid] = tc
        node_col[2][fin] = tc
        band(0, qp, 1, grid, seg_color(qp, grid))
        band(1, grid, 2, fin, seg_color(grid, fin))
        ax.annotate(abbr, (0, qp), xytext=(-11, 0), textcoords="offset points",
                    va="center", ha="right", fontsize=8.5, color=tc,
                    fontproperties=FP_BODY_B, zorder=6)
        ax.annotate(abbr, (2, fin), xytext=(11, 0), textcoords="offset points",
                    va="center", ha="left", fontsize=8.5, color=tc,
                    fontproperties=FP_BODY_B, zorder=6)
    for ci, x in enumerate(cols):
        for p in range(1, n + 1):
            ax.add_patch(plt.Rectangle((x - 0.016, p - 0.30), 0.032, 0.60,
                                       color=node_col[ci].get(p, GRID), zorder=4))
    ax.set_xlim(-0.3, 2.3)
    ax.set_ylim(n + 0.7, 0.3)
    ax.set_xticks(cols)
    ax.set_xticklabels(["QUALIFYING", "GRID", "RACE"], fontproperties=FP_BODY_B, fontsize=12)
    ax.set_yticks(pos_yticks(n))
    for s in ("top", "right", "left", "bottom"):
        ax.spines[s].set_visible(False)
    ax.tick_params(colors=SUBINK, length=0, labelsize=11, labelleft=True, labelright=True)
    ax.grid(False)
    for lbl in ax.get_xticklabels():
        lbl.set_color(INK)
    ly = LY("legend_y")
    x0 = LY("legend_x")
    for label, col in (("Gained", GAIN), ("Lost", LOSS), ("Held", HELD)):
        fig.add_artist(plt.Rectangle((x0, ly - 0.006), 0.014, 0.016, transform=fig.transFigure,
                                     color=col, zorder=11))
        fig.text(x0 + 0.02, ly, label, color=SUBINK, fontsize=10, fontproperties=FP_BODY)
        x0 += 0.095
    footer(fig, meta)
    return fig_png(fig)


def chart_teammate_pace(session, meta):
    laps = session.laps.pick_quicklaps() if hasattr(session.laps, "pick_quicklaps") else session.laps
    laps = laps.copy()
    laps["s"] = laps["LapTime"].dt.total_seconds()
    laps = laps.dropna(subset=["s", "Team", "Driver"])
    if laps.empty:
        return None
    teams = [t for t in laps["Team"].unique()
             if laps[laps["Team"] == t]["Driver"].nunique() >= 2]
    if not teams:
        return None
    teams = sorted(teams, key=lambda t: laps[laps["Team"] == t]["s"].median())
    lo = float(np.percentile(laps["s"], 1.5))
    hi = float(np.percentile(laps["s"], 97))
    fig, ax = editorial_fig(left=0.13, right=0.87)
    title_block(fig, "Head to Head", "Teammate Duel", "Lap-time distribution · driver vs driver")
    for i, t in enumerate(teams):
        sub = laps[laps["Team"] == t]
        meds = sub.groupby("Driver")["s"].median().sort_values()
        d_fast, d_slow = meds.index[0], meds.index[1]
        a = sub[sub["Driver"] == d_fast]["s"].values
        b = sub[sub["Driver"] == d_slow]["s"].values
        col = team_color(t)
        for data, side, alpha, hatch in ((a, 1, 0.62, None), (b, -1, 0.30, "////")):
            if len(data) < 2:
                continue
            parts = ax.violinplot([data], positions=[i], orientation="horizontal", widths=0.92,
                                  showextrema=False)
            for body in parts["bodies"]:
                v = body.get_paths()[0].vertices
                v[:, 1] = np.clip(v[:, 1], i, None) if side > 0 else np.clip(v[:, 1], None, i)
                body.set_facecolor(col)
                body.set_alpha(alpha)
                body.set_edgecolor(col)
                body.set_linewidth(1.3)
                if hatch:
                    body.set_hatch(hatch)
        m_fast, m_slow = float(np.median(a)), float(np.median(b))
        ax.scatter([m_fast], [i + 0.15], s=46, color=col, edgecolor=PAPER, lw=1.2, zorder=6)
        ax.scatter([m_slow], [i - 0.15], s=46, color=PAPER, edgecolor=col, lw=1.7, zorder=6)
        ax.annotate(d_fast, (m_fast, i + 0.15), xytext=(7, 0), textcoords="offset points",
                    va="center", ha="left", fontsize=9, color=col,
                    fontproperties=FP_BODY_B, zorder=7)
        ax.annotate(d_slow, (m_slow, i - 0.15), xytext=(7, 0), textcoords="offset points",
                    va="center", ha="left", fontsize=9, color=SUBINK,
                    fontproperties=FP_BODY_B, zorder=7)
        ax.text(hi + 0.02, i, f"{d_fast} +{m_slow - m_fast:.2f}s", va="center", ha="right",
                fontsize=10, color=col, fontproperties=FP_BODY_B)
    team_y_labels(ax, teams, range(len(teams)), meta.get("year"), 9.5)
    ax.set_ylim(-0.7, len(teams) - 0.3)
    ax.invert_yaxis()
    rng_x = (hi + 0.08) - (lo - 0.3)
    ax.set_xlim(lo - 0.3, hi + 0.08 + rng_x * 0.13)
    place_team_cars(ax, [(t, i) for i, t in enumerate(teams)], meta.get("year"))
    ax.grid(axis="x", color=GRID, linewidth=1.0)
    ax.grid(axis="y", linewidth=0)
    clean_axes(ax, "Lap time", None)
    ax.xaxis.set_major_formatter(LAPTIME_FMT)
    ly = LY("legend_y")
    fx = LY("legend_x")
    fig.add_artist(plt.Rectangle((fx, ly - 0.006), 0.014, 0.015, transform=fig.transFigure,
                                 color=INK, alpha=0.75, zorder=11))
    fig.text(fx + 0.02, ly, "faster", color=SUBINK, fontsize=9.5, fontproperties=FP_BODY)
    fig.add_artist(plt.Rectangle((fx + 0.09, ly - 0.006), 0.014, 0.015, transform=fig.transFigure,
                                 fill=False, edgecolor=INK, hatch="////", linewidth=0.5, zorder=11))
    fig.text(fx + 0.11, ly, "teammate", color=SUBINK, fontsize=9.5, fontproperties=FP_BODY)
    footer(fig, meta)
    return fig_png(fig)


def chart_teammate_laps(session, meta):
    quick = session.laps.pick_quicklaps() if hasattr(session.laps, "pick_quicklaps") else session.laps
    quick = quick.copy()
    quick["s"] = quick["LapTime"].dt.total_seconds()
    quick = quick.dropna(subset=["s", "Team", "Driver", "LapNumber"])
    teams = [t for t in quick["Team"].unique()
             if quick[quick["Team"] == t]["Driver"].nunique() >= 2]
    if not teams:
        return None
    teams = sorted(teams, key=lambda t: quick[quick["Team"] == t]["s"].median())
    L = LAYOUT[FMT]
    fig = plt.figure(figsize=L["figsize"], dpi=L["dpi"])
    fig.patch.set_facecolor(PAPER)
    title_block(fig, "Head to Head", "Teammate Duel · Lap by Lap",
                "Each teammate's lap times through the race")
    portrait = FMT in ("story", "instagram")
    cols = 2 if portrait else 3
    rows = int(np.ceil(len(teams) / cols))
    bx0, bw = 0.075, 0.86
    by0, bh = L["ax"][0], L["ax"][1]
    gx, gy = 0.035, 0.075
    cw = (bw - gx * (cols - 1)) / cols
    ch = (bh - gy * (rows - 1)) / rows
    ymin = float(quick["s"].quantile(0.02))
    ymax = float(quick["s"].quantile(0.93))
    lmax = int(quick["LapNumber"].max())
    for idx, t in enumerate(teams):
        r, c = idx // cols, idx % cols
        axx = bx0 + c * (cw + gx)
        axy = by0 + bh - (r + 1) * ch - r * gy
        ax = fig.add_axes([axx, axy, cw, ch])
        ax.set_facecolor(PAPER)
        shade_safety(ax, session)
        sub = quick[quick["Team"] == t]
        col = team_color(t)
        meds = sub.groupby("Driver")["s"].median().sort_values()
        pair = list(meds.index[:2])
        series = {}
        for di, drv in enumerate(pair):
            d = sub[sub["Driver"] == drv].sort_values("LapNumber")
            if d.empty:
                continue
            series[drv] = d
            ls = "-" if di == 0 else (0, (4, 2))
            xs, ys = smooth_xy(d["LapNumber"].values, d["s"].values)
            ax.plot(xs, ys, color=col, lw=1.8, ls=ls, alpha=0.95, solid_capstyle="round")
            fl = d.loc[d["s"].idxmin()]
            ax.scatter([fl["LapNumber"]], [fl["s"]], s=24, color=col,
                       edgecolor=PAPER, lw=0.9, zorder=6)
            ax.annotate(drv, (d["LapNumber"].values[-1], d["s"].values[-1]),
                        xytext=(4, 0), textcoords="offset points", va="center", ha="left",
                        fontsize=7.5, color=INK, fontproperties=FP_BODY_B, zorder=7,
                        bbox=dict(boxstyle="round,pad=0.15", facecolor=PAPER, edgecolor="none", alpha=0.8))
        # fastest lap of the pair + who led more laps head-to-head
        note = t
        if len(series) == 2:
            a, b = pair
            besta, bestb = series[a]["s"].min(), series[b]["s"].min()
            fastest = a if besta <= bestb else b
            sa = series[a].set_index("LapNumber")["s"]
            sb = series[b].set_index("LapNumber")["s"]
            common = sa.index.intersection(sb.index)
            awins = int((sa[common] < sb[common]).sum())
            bwins = len(common) - awins
            lead, ln = (a, awins) if awins >= bwins else (b, bwins)
            ax.text(0.985, 0.035,
                    f"FL {fastest} {fmt_laptime(min(besta, bestb))}   ·   {lead} faster {ln}/{len(common)} laps",
                    transform=ax.transAxes, ha="right", va="bottom", fontsize=6.6,
                    color=SUBINK, fontproperties=FP_BODY, zorder=8,
                    bbox=dict(boxstyle="round,pad=0.22", facecolor=PAPER, edgecolor=GRID, lw=0.6, alpha=0.92))
        ax.set_xlim(0, lmax + 8)
        # extra headroom at the slow (bottom) end so the FL / head-to-head footnote
        # chip sits in clear space and never collides with a lap line
        ax.set_ylim(ymax + (ymax - ymin) * 0.16, ymin)
        ax.set_title(note, fontproperties=FP_BODY_B, color=INK, fontsize=10, pad=4, loc="left")
        ax.grid(color=GRID, linewidth=0.7)
        ax.set_axisbelow(True)
        for s in ax.spines.values():
            s.set_visible(False)
        ax.tick_params(colors=SUBINK, length=0, labelsize=7.5)
        if c == 0:
            ax.yaxis.set_major_formatter(LAPTIME_FMT)
        else:
            ax.set_yticklabels([])
    footer(fig, meta)
    return fig_png(fig)


LINESTYLES = ["-", (0, (6, 2)), (0, (1, 1.7)), (0, (4, 1.5, 1, 1.5))]


def style_for(team, seen):
    """Distinct line style per same-team driver: solid, dashed, dotted...
    Mutates `seen` (dict team->count)."""
    k = seen.get(team, 0)
    seen[team] = k + 1
    return LINESTYLES[min(k, len(LINESTYLES) - 1)]


def _hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _rgb_hex(rgb):
    return "#{:02X}{:02X}{:02X}".format(*(max(0, min(255, int(c))) for c in rgb))


def _hue_shift(hexc, dh, dl=0.0):
    """Rotate hue by dh (fraction of the colour wheel) and nudge lightness by dl.
    Hue rotation is what survives the neon glow: neon_lines blooms each segment in its
    OWN colour, so two teammates that differ only in lightness bloom the same hue and
    merge into one ribbon. Shifting the hue makes the glow itself a different colour."""
    r, g, b = (c / 255 for c in _hex_rgb(hexc))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    h = (h + dh) % 1.0
    l = max(0.0, min(1.0, l + dl))
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    return _rgb_hex((r * 255, g * 255, b * 255))


# Candidate (hue rotation, lightness nudge) pairs for a 2nd/3rd same-team driver. Teammates
# sharing the team colour is the #1 complaint on track-dominance ribbons, and a pure lightness
# tint washes out under the neon glow — so we rotate the hue ~±36° (e.g. Mercedes teal -> blue
# or green), with lightness as a secondary separator. Both directions are offered so the
# picker can steer AWAY from other teams' colours (Ferrari-red rotated toward orange would
# otherwise collide with McLaren).
TEAMMATE_CANDS = [(0.10, 0.14), (-0.11, -0.10)]


def _hue_of(hexc):
    r, g, b = (c / 255 for c in _hex_rgb(hexc))
    return colorsys.rgb_to_hls(r, g, b)[0]


def _hue_dist(a, b):
    d = abs(a - b) % 1.0
    return min(d, 1.0 - d)


def teammate_color(team, seen):
    """First same-team driver keeps the pure team colour; the next gets a hue-rotated
    variant, choosing the rotation that sits farthest from every OTHER team's colour so a
    shifted teammate never collides with a different team sharing the destination hue.
    Mutates `seen` (dict team->count), mirroring style_for."""
    k = seen.get(team, 0)
    seen[team] = k + 1
    base = team_color(team)
    if k == 0:
        return base
    others = [_hue_of(c) for t, c in TEAM_COLORS.items()
              if str(t) != str(team) and str(c).startswith("#")]
    best, best_clear = base, -1.0
    for dh, dl in TEAMMATE_CANDS:
        cand = _hue_shift(base, dh * k, dl if k < 2 else -dl)
        clear = min((_hue_dist(_hue_of(cand), o) for o in others), default=1.0)
        if clear > best_clear:
            best_clear, best = clear, cand
    return best


def neon_lines(ax, segs, array=None, colors=None, cmap=None, lw=8, glow=1.0):
    """Line segments with a neon glow halo (trendy 'pulse' look).

    `glow` (0..1) scales the halo spread and opacity. 1.0 = the full bloom, right for a
    ground-level ribbon on empty space. Drop it (~0.4) on the dense isometric stacks, where
    a fat halo swallows the track line — the complaint being you can't read the track under
    the colour. The bright core keeps its width; only the surrounding haze tightens."""
    for glw, ga in ((lw * 3.6, 0.06), (lw * 2.5, 0.09), (lw * 1.6, 0.13)):
        glw = lw + (glw - lw) * glow  # shrink halo toward the core as glow falls
        g = LineCollection(segs, linewidths=glw, capstyle="round", joinstyle="round", alpha=ga * glow)
        if cmap is not None:
            g.set_cmap(cmap)
            g.set_array(array)
        else:
            g.set_color(colors)
        ax.add_collection(g)
    main = LineCollection(segs, linewidths=lw, capstyle="round", joinstyle="round")
    if cmap is not None:
        main.set_cmap(cmap)
        main.set_array(array)
    else:
        main.set_color(colors)
    ax.add_collection(main)
    return main


def fmt_laptime(s, _pos=None):
    """Seconds -> 'M:SS.mmm' for lap-time axes (e.g. 95.3 -> '1:35.300')."""
    try:
        s = float(s)
    except (TypeError, ValueError):
        return ""
    if np.isnan(s):
        return ""
    m = int(s // 60)
    sec = s - m * 60
    return f"{m}:{sec:06.3f}" if m else f"{sec:.3f}"


LAPTIME_FMT = FuncFormatter(fmt_laptime)


def pos_yticks(n):
    """Position ticks that always include 1 and the final position N
    (handles 20-car grids and the 2026 22-car grid alike)."""
    ticks = [1] + list(range(5, n + 1, 5))
    if ticks[-1] != n:
        ticks.append(n)
    return ticks


def place_headshot_column(ax, ends):
    """Evenly-spaced headshot column at the right edge — avoids overlap when
    line endpoints cluster. `ends` is ordered top-to-bottom."""
    if not ends:
        return
    lo, hi = sorted(ax.get_ylim())
    xmax = ax.get_xlim()[1]
    span = hi - lo
    step = span * 0.145
    for i, (drv, c, url) in enumerate(ends):
        if ax.yaxis_inverted():
            y = lo + span * 0.06 + step * i
        else:
            y = hi - span * 0.06 - step * i
        headshot_label(ax, xmax, y, drv, c, url)


# FastF1's four speed measurements. Only SpeedST is an actual speed trap — the other
# three are speeds recorded as the car crosses a timing line, so what they represent
# depends entirely on where that circuit's lines sit. Spa is the clearest example: the
# S1 line is at the end of the Kemmel straight (~318 km/h, near-duplicating the speed
# trap on the same straight) while the S2 and finish lines read ~215 km/h because they
# sit in slow parts of the lap. Labelling those "Inter 1 / Inter 2 / Finish" under a
# "Speed Trap Matrix" heading implied four comparable top speeds, which they are not.
SPEED_TRAPS = (
    ("SpeedI1", "S1 Line"),
    ("SpeedI2", "S2 Line"),
    ("SpeedFL", "Finish Line"),
    ("SpeedST", "Speed Trap"),
)


def chart_top_speed(session, meta):
    """Every driver's best speed at each of the session's four timing lines, all laps.

    The old version read one number: the max speed on each driver's single fastest lap.
    That threw away the rest of the session and answered the wrong question — a driver's
    true top speed usually comes on a tow or a different stint, not their best lap. This
    takes the maximum across ALL laps at each measurement point, which is what timing
    screens actually show.

    Only the speed-trap column is a top speed by construction; the other three are
    "how fast were you crossing this line", and the lines move from circuit to circuit
    (see SPEED_TRAPS). Hence the column labels name the lines rather than implying four
    equivalent traps, and the ordering keys off the real speed trap.

    Cell shading is scaled within each column (slowest → fastest), so a column sitting in
    a slow part of the lap still shows who was quickest through it.
    """
    laps = session.laps
    rows = []
    for drv in session.drivers:
        dl = laps[laps["DriverNumber"] == drv]
        if dl.empty:
            continue
        code = dl["Driver"].iloc[0]
        if DRIVERS and code not in DRIVERS:
            continue
        vals = []
        for col, _ in SPEED_TRAPS:
            try:
                v = float(dl[col].max())
            except Exception:
                v = float("nan")
            vals.append(v)
        if all(pd.isna(v) for v in vals):
            continue
        rows.append({"code": code, "vals": vals})

    if len(rows) < 2:
        return None

    # Headline ordering is the speed trap itself, falling back to whatever we have.
    def _key(r):
        v = r["vals"][3]
        return v if not pd.isna(v) else max([x for x in r["vals"] if not pd.isna(x)] or [0])

    rows.sort(key=_key, reverse=True)

    ncol = len(SPEED_TRAPS)
    col_max, col_min = [], []
    for c in range(ncol):
        vv = [r["vals"][c] for r in rows if not pd.isna(r["vals"][c])]
        col_max.append(max(vv) if vv else float("nan"))
        col_min.append(min(vv) if vv else float("nan"))

    fig, ax = editorial_fig(left=0.10, right=0.90)
    # This is the only chart that mounts its tick labels on TOP of the axes, so they land
    # in the title block's airspace and crowd the subtitle. Drop the axes ceiling to open
    # a gap. Fraction of the axes height, not an absolute figure offset, so it holds for
    # the taller instagram/story canvases too.
    _p = ax.get_position()
    ax.set_position([_p.x0, _p.y0, _p.width, _p.height * 0.955])
    title_block(fig, "Telemetry", "Timing Line Speeds",
                "Best across every lap at each timing line — line placement varies by circuit")

    for i, r in enumerate(rows):
        y = len(rows) - 1 - i
        for c in range(ncol):
            v = r["vals"][c]
            if pd.isna(v):
                continue
            lo, hi = col_min[c], col_max[c]
            norm = 0.0 if hi <= lo else (v - lo) / (hi - lo)
            is_best = v >= hi
            ax.add_patch(plt.Rectangle(
                (c + 0.04, y - 0.42), 0.92, 0.84,
                facecolor=PURPLE if is_best else RED,
                alpha=1.0 if is_best else 0.10 + 0.55 * norm,
                edgecolor=PAPER, linewidth=1.2, zorder=3,
            ))
            ax.text(c + 0.5, y, f"{v:.0f}", va="center", ha="center", fontsize=10,
                    fontproperties=FP_BODY_B,
                    color="#FFFFFF" if (is_best or norm > 0.55) else INK, zorder=4)

    ax.set_xlim(0, ncol)
    ax.set_ylim(-0.6, len(rows) - 0.4)
    ax.set_xticks([c + 0.5 for c in range(ncol)])
    ax.set_xticklabels([lbl for _, lbl in SPEED_TRAPS],
                       fontproperties=FP_BODY_B, color=INK, fontsize=10)
    ax.xaxis.set_ticks_position("top")
    ax.tick_params(axis="x", pad=8)
    ax.set_yticks(range(len(rows)))
    ax.set_yticklabels([r["code"] for r in reversed(rows)],
                       fontproperties=FP_BODY_B, color=INK, fontsize=10)
    ax.grid(False)
    for side in ("top", "right", "bottom", "left"):
        ax.spines[side].set_visible(False)
    ax.tick_params(length=0)
    clean_axes(ax, None, None)
    ax.set_xlabel("")
    footer(fig, meta)
    return fig_png(fig)


def chart_lap_down(session, meta):
    """When backmarkers get lapped — laps-down heatmap, driver × lap.

    Each cell shades how many laps behind the leader a driver is on that lap. A row stays
    dark while on the lead lap, then lights amber the lap it goes a lap down and deepens if
    it loses more — so the colour onset IS the lap they were lapped. Retired drivers stop
    with a hatched cell. Reads the one thing the gap chart can't: the exact lapping lap.
    """
    laps = session.laps[["Driver", "LapNumber", "Time"]].dropna(subset=["Time", "LapNumber"]).copy()
    if laps.empty:
        return None
    import bisect
    laps["t"] = laps["Time"].dt.total_seconds()
    lmax = int(laps["LapNumber"].max())
    if lmax < 2:
        return None
    # Leader clock: earliest completion time of each lap (first car to reach it), lap 1..lmax
    # ascending — so bisect over it gives "how many laps the leader has completed by time t".
    lead_sorted = list(laps.groupby("LapNumber")["t"].min().reindex(range(1, lmax + 1)).ffill().values)

    def leader_laps_by(t):
        return bisect.bisect_right(lead_sorted, t)

    # Finish order (leader on top); each driver's per-lap completion times.
    try:
        order = [a for a in session.results.sort_values("Position")["Abbreviation"].values
                 if a in set(laps["Driver"])]
    except Exception:  # noqa: BLE001
        order = list(laps["Driver"].unique())
    if DRIVERS:
        order = [d for d in order if d in DRIVERS]
    if len(order) < 2:
        return None

    # Laps-down is measured at each driver's OWN lap crossing: when they complete lap N at
    # time t, they are leader_laps_by(t) - N laps behind. A few seconds' same-lap gap gives
    # 0 (both cars have the same completed-lap count) — comparing at the leader's crossing
    # instead would wrongly read every trailing car as a lap down from lap one.
    grid = []
    any_lapped = False
    for code in order:
        times = sorted(laps[laps["Driver"] == code]["t"].tolist())
        if not times:
            continue
        events = {}  # laps_down level -> leader lap when first reached
        for n, t in enumerate(times, start=1):
            down = leader_laps_by(t) - n
            if down >= 1 and down not in events:
                events[down] = leader_laps_by(t)
                any_lapped = True
        # Colour the row up to the leader's lap when this driver last crossed the line;
        # a lapped finisher crosses near race end (row nearly full), a retiree stops early
        # (row hatches out) — so no separate DNF lookup is needed.
        l_last = min(lmax, leader_laps_by(times[-1]))
        row = []
        for L in range(1, lmax + 1):
            if L > l_last:
                row.append(None)
            else:
                row.append(max((lvl for lvl, ll in events.items() if ll <= L), default=0))
        grid.append((code, row, l_last))
    if not any_lapped:
        return None  # nobody was lapped (e.g. a red-flag-shortened race) — nothing to show

    # Shade ramp: 0 = near-panel, 1/2/3+ warm through to red.
    def cell_color(v):
        if v is None:
            return None
        if v <= 0:
            return PANEL
        if v == 1:
            return "#E7B008"   # gold
        if v == 2:
            return "#E8590C"   # orange
        return RED

    fig, ax = editorial_fig(left=0.085, right=0.975)
    title_block(fig, "Race", "Lapped Drivers",
                "Laps behind the leader through the race — the colour onset is the lap they were lapped")

    n = len(grid)
    for i, (code, row, last_lap) in enumerate(grid):
        y = n - 1 - i  # leader at top
        for L in range(1, lmax + 1):
            v = row[L - 1]
            x = L - 1
            if v is None:
                # retired — faint hatched cell
                ax.add_patch(plt.Rectangle((x, y - 0.42), 1, 0.84, facecolor="none",
                             edgecolor=GRID, linewidth=0.4, hatch="////", zorder=2))
                continue
            ax.add_patch(plt.Rectangle((x, y - 0.42), 1, 0.84, facecolor=cell_color(v),
                         edgecolor=PAPER, linewidth=0.5, zorder=3))
        # mark the first lap this driver went a lap down
        first = next((L for L in range(1, lmax + 1) if (row[L - 1] or 0) >= 1), None)
        if first:
            # Dark label — it always sits on a warm (amber/orange/red) cell, so a near-black
            # numeral reads on every theme.
            ax.text(first - 0.5, y, str(first), va="center", ha="center", fontsize=7,
                    fontproperties=FP_MONO_B, color="#0A0B0F", zorder=5)

    ax.set_xlim(0, lmax)
    ax.set_ylim(-0.7, n - 0.3)
    ax.set_yticks(range(n))
    ax.set_yticklabels([g[0] for g in reversed(grid)], fontproperties=FP_BODY_B,
                       color=INK, fontsize=9)
    step = 5 if lmax > 30 else 2
    xt = list(range(0, lmax + 1, step))
    ax.set_xticks([t + 0.0 for t in xt])
    ax.set_xticklabels([str(t) if t > 0 else "1" for t in xt], fontproperties=FP_MONO,
                       color=SUBINK, fontsize=8)
    ax.set_xlabel("Lap", fontproperties=FP_BODY, color=SUBINK, fontsize=9)
    for side in ("top", "right", "bottom", "left"):
        ax.spines[side].set_visible(False)
    ax.tick_params(length=0)
    ax.grid(False)

    # legend
    labels = [("Lead lap", PANEL), ("1 lap down", "#E7B008"),
              ("2 down", "#E8590C"), ("3+ down", RED)]
    handles = [plt.Rectangle((0, 0), 1, 1, facecolor=c, edgecolor=GRID, linewidth=0.6)
               for _, c in labels]
    leg = ax.legend(handles, [t for t, _ in labels], loc="lower right", frameon=False,
                    fontsize=8, ncol=4, bbox_to_anchor=(1.0, -0.16))
    for t in leg.get_texts():
        t.set_color(SUBINK)
        t.set_fontproperties(FP_BODY_B)

    footer(fig, meta)
    return fig_png(fig)


def chart_gap_to_leader(session, meta):
    laps = session.laps
    df = laps[["Driver", "LapNumber", "Time", "Team"]].dropna(subset=["Time", "LapNumber"]).copy()
    if df.empty:
        return None
    df["t"] = df["Time"].dt.total_seconds()
    leader = df.groupby("LapNumber")["t"].min()
    df["gap"] = df["t"] - df["LapNumber"].map(leader)
    try:
        order = [a for a in session.results["Abbreviation"].values]
        order = [d for d in order if d in DRIVERS] if DRIVERS else order[:6]
    except Exception:
        order = list(DRIVERS) if DRIVERS else list(df["Driver"].unique())[:6]
    look = driver_lookup(session)
    fig, ax = editorial_fig(right=LY("headshot_right"))
    title_block(fig, "Race", "Gap to Leader", "Time behind the lead, lap by lap")
    shade_safety(ax, session)
    ends = []
    seen = {}
    for drv in order:
        sub = df[df["Driver"] == drv].sort_values("LapNumber")
        if sub.empty:
            continue
        team = sub["Team"].iloc[0]
        c = team_color(team)
        ax.plot(sub["LapNumber"], sub["gap"], color=c, lw=2.4,
                ls=style_for(team, seen), solid_capstyle="round")
        ends.append((drv, c, (look.get(str(drv)) or {}).get("headshot")))
    if not ends:
        plt.close(fig)
        return None
    ax.invert_yaxis()
    clean_axes(ax, "Lap", "Gap (s)")
    place_headshot_column(ax, ends)
    footer(fig, meta)
    return fig_png(fig)


def chart_lap_evolution(session, meta):
    quick = session.laps.pick_quicklaps() if hasattr(session.laps, "pick_quicklaps") else session.laps
    quick = quick.copy()
    quick["s"] = quick["LapTime"].dt.total_seconds()
    look = driver_lookup(session)
    fig, ax = editorial_fig(right=LY("headshot_right"))
    title_block(fig, "Pace", "Lap-Time Evolution", "Race pace through the stints · top five")
    shade_safety(ax, session)
    ends = []
    seen = {}
    for drv in top_drivers_by_pace(session.laps, 5):
        sub = quick[quick["Driver"] == drv].sort_values("LapNumber")
        if sub.empty:
            continue
        team = sub["Team"].iloc[0]
        c = team_color(team)
        xs, ys = smooth_xy(sub["LapNumber"].values, sub["s"].values)
        ax.plot(xs, ys, color=c, lw=2.2, alpha=0.92,
                ls=style_for(team, seen), solid_capstyle="round")
        ends.append((drv, c, (look.get(str(drv)) or {}).get("headshot")))
    if not ends:
        plt.close(fig)
        return None
    clean_axes(ax, "Lap", "Lap time")
    ax.yaxis.set_major_formatter(LAPTIME_FMT)
    place_headshot_column(ax, ends)
    footer(fig, meta)
    return fig_png(fig)


def chart_speed_map(session, meta):
    fl = session.laps.pick_fastest() if hasattr(session.laps, "pick_fastest") else None
    if fl is None or (hasattr(fl, "empty") and fl.empty):
        return None
    try:
        t = fl.get_telemetry()
    except Exception:
        return None
    if "X" not in t or "Speed" not in t:
        return None
    x = t["X"].to_numpy()
    y = t["Y"].to_numpy()
    spd = t["Speed"].to_numpy()
    pts = np.array([x, y]).T.reshape(-1, 1, 2)
    segs = np.concatenate([pts[:-1], pts[1:]], axis=1)
    fig, ax = editorial_fig()
    title_block(fig, "Telemetry", "Speed Map", f"Fastest lap · {fl['Driver']}")
    lc = neon_lines(ax, segs, array=spd[:-1], cmap="inferno", lw=8)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.autoscale()
    ax.margins(0.06)
    cax = fig.add_axes(LY("cbar"))
    cb = fig.colorbar(lc, cax=cax, orientation="horizontal")
    cb.set_label("Speed (km/h)", color=SUBINK, fontsize=10, fontproperties=FP_BODY)
    cb.ax.tick_params(colors=SUBINK, labelsize=9)
    cb.outline.set_edgecolor(GRID)
    footer(fig, meta)
    return fig_png(fig)


def chart_gear_map(session, meta):
    gear_colors = ["#666666", "#E10600", "#FF7A00", "#FFC400", "#8BD000",
                   "#00B3A4", "#1E90FF", "#8A6BFF", "#C84CFF"]
    fl = session.laps.pick_fastest() if hasattr(session.laps, "pick_fastest") else None
    if fl is None or (hasattr(fl, "empty") and fl.empty):
        return None
    try:
        t = fl.get_telemetry()
    except Exception:
        return None
    if "X" not in t or "nGear" not in t:
        return None
    x = t["X"].to_numpy()
    y = t["Y"].to_numpy()
    g = t["nGear"].to_numpy().astype(int)
    pts = np.array([x, y]).T.reshape(-1, 1, 2)
    segs = np.concatenate([pts[:-1], pts[1:]], axis=1)
    cols = [gear_colors[min(max(int(v), 0), 8)] for v in g[:-1]]
    fig, ax = editorial_fig()
    title_block(fig, "Telemetry", "Gears", f"Gear selection · {fl['Driver']} · fastest lap")
    neon_lines(ax, segs, colors=cols, lw=8)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.autoscale()
    ax.margins(0.06)
    ly = LY("legend_y")
    x0 = LY("gear_x")
    for gg in range(2, 9):
        fig.add_artist(plt.Rectangle((x0, ly - 0.009), 0.013, 0.02, transform=fig.transFigure,
                                     color=gear_colors[gg], zorder=11))
        fig.text(x0 + 0.017, ly, str(gg), va="center", color=INK, fontsize=10.5,
                 fontproperties=FP_BODY)
        x0 += 0.052
    footer(fig, meta)
    return fig_png(fig)


def chart_driver_radar(session, meta):
    laps = session.laps
    metrics = ["Top speed", "Avg speed", "Throttle", "Braking", "Consistency"]
    look = driver_lookup(session)
    drivers = []
    for drv in top_drivers_by_pace(laps, 6):
        dl = laps[laps["Driver"] == drv]
        lap = dl.pick_fastest()
        if lap is None or (hasattr(lap, "empty") and lap.empty):
            continue
        try:
            cd = lap.get_car_data()
        except Exception:
            continue
        spd = cd["Speed"]
        thr = cd["Throttle"]
        brk = cd["Brake"].astype(float)
        if brk.max() <= 1:
            brk = brk * 100
        m = [min(spd.max() / 360 * 100, 100), min(spd.mean() / 250 * 100, 100),
             float(thr.mean()), float((brk > 20).mean() * 100),
             max(0.0, 100 - min(spd.std() / spd.mean() * 100, 100))]
        drivers.append((drv, m, team_color(dl["Team"].iloc[0]),
                        (look.get(str(drv)) or {}).get("headshot")))
    if len(drivers) < 2:
        return None
    nmet = len(metrics)
    ang = np.linspace(0, 2 * np.pi, nmet, endpoint=False).tolist()
    ang += ang[:1]
    L = LAYOUT[FMT]
    fig = plt.figure(figsize=L["figsize"], dpi=L["dpi"])
    fig.patch.set_facecolor(PAPER)
    title_block(fig, "Telemetry", "Driver Radar", "Performance profile · fastest lap · one card per driver")
    portrait = FMT in ("story", "instagram")
    cols = 2 if portrait else 3
    rows = int(np.ceil(len(drivers) / cols))
    bx0, bw = 0.06, 0.88
    by0, bh = L["ax"][0], L["ax"][1]
    gx, gy = 0.02, 0.115
    cw = (bw - gx * (cols - 1)) / cols
    ch = (bh - gy * (rows - 1)) / rows
    side = min(cw, ch) * 0.80
    for idx, (drv, m, col, url) in enumerate(drivers):
        r, c = idx // cols, idx % cols
        cx = bx0 + c * (cw + gx) + cw / 2
        cyy = by0 + bh - (r + 1) * ch - r * gy + ch / 2 - 0.012
        ax = fig.add_axes([cx - side / 2, cyy - side / 2, side, side], polar=True)
        ax.set_facecolor(PAPER)
        ax.set_theta_offset(np.pi / 2)
        ax.set_theta_direction(-1)
        ax.set_xticks(ang[:-1])
        ax.set_xticklabels(metrics, color=SUBINK, fontproperties=FP_BODY, fontsize=7)
        ax.set_yticks([25, 50, 75, 100])
        ax.set_yticklabels([])
        ax.set_ylim(0, 100)
        ax.grid(color=GRID, linewidth=0.7)
        ax.spines["polar"].set_color(GRID)
        d = m + m[:1]
        ax.plot(ang, d, color=col, lw=2.0)
        ax.fill(ang, d, color=col, alpha=0.30)
        disc = headshot_disc(url, col)
        ty = cyy + side / 2 + 0.03
        if disc is not None:
            fig.add_artist(AnnotationBbox(OffsetImage(disc, zoom=0.18 if portrait else 0.14),
                          (cx - 0.028, ty), xycoords="figure fraction", frameon=False, zorder=12))
        fig.text(cx + 0.012, ty, drv, va="center", ha="left", color=INK,
                 fontsize=12, fontproperties=FP_BODY_B)
    footer(fig, meta)
    return fig_png(fig)


def chart_dominance_stack(session, meta):
    laps = session.laps
    grid = rx = ry = None
    drivers = []        # (drv, color)
    speed_rows = []     # median speed per track point, across all the driver's quick laps
    tmcol = {}          # teammate tint counter (same-team drivers get distinct shades)
    for drv in top_drivers_by_pace(laps, 3):
        dl = laps[laps["Driver"] == drv]
        ql = dl.pick_quicklaps() if hasattr(dl, "pick_quicklaps") else dl
        stack = []
        for _, lap in ql.iterlaps():
            try:
                cd = lap.get_car_data().add_distance()
            except Exception:
                continue
            if "Speed" not in cd or "Distance" not in cd or cd.empty:
                continue
            if grid is None:  # lock the track geometry from the first usable lap
                try:
                    tel = lap.get_telemetry()
                    if not all(k in tel for k in ("X", "Y", "Distance")):
                        continue
                    grid = np.linspace(0, float(tel["Distance"].max()), 700)
                    rx = np.interp(grid, tel["Distance"], tel["X"])
                    ry = np.interp(grid, tel["Distance"], tel["Y"])
                except Exception:
                    grid = None
                    continue
            stack.append(np.interp(grid, cd["Distance"], cd["Speed"]))
        if not stack:
            continue
        drivers.append((drv, teammate_color(dl["Team"].iloc[0], tmcol)))
        speed_rows.append(np.median(np.vstack(stack), axis=0))
    if len(drivers) < 2 or grid is None:
        return None
    speeds = np.vstack(speed_rows)
    winner = np.argmax(speeds, axis=0)
    cx0 = (rx.max() + rx.min()) / 2
    cy0 = (ry.max() + ry.min()) / 2
    half = max(rx.max() - rx.min(), ry.max() - ry.min()) / 2 or 1.0
    nx = (rx - cx0) / half
    ny = (ry - cy0) / half
    shear, tilt, squash = 0.55, 0.18, 0.42

    def iso(px, py):
        return px + shear * py, -tilt * px + squash * py

    sx, sy = iso(nx, ny)
    dz_step = LY("stack_dz") * (sy.max() - sy.min()) * 0.85
    idxs = list(range(len(drivers)))[::-1]
    n = len(idxs)
    fig, ax = editorial_fig()
    title_block(fig, "Telemetry", "Dominance Stack",
                "Median pace across all race laps · who is quickest at each point of the track")
    pad = 0.18
    box = np.array([[-1 - pad, -1 - pad], [1 + pad, -1 - pad],
                    [1 + pad, 1 + pad], [-1 - pad, 1 + pad]])
    bsx, bsy = iso(box[:, 0], box[:, 1])
    look = driver_lookup(session)
    lx = bsx.min() - 0.45
    shx, shy = 0.10, 0.14
    for k, di in enumerate(idxs):
        frac = k / (n - 1) if n > 1 else 1.0
        dz = k * dz_step
        col = drivers[di][1]
        for mul, a in ((1.0, 0.20), (1.7, 0.10), (2.4, 0.05)):
            ax.add_patch(plt.Polygon(np.column_stack([bsx + shx * mul, bsy - shy * mul + dz]),
                         closed=True, facecolor="#000000", edgecolor="none", alpha=a, zorder=10 * k))
        ax.add_patch(plt.Polygon(np.column_stack([bsx, bsy + dz]), closed=True,
                     facecolor=PANEL, alpha=0.30, edgecolor=col, lw=1.6,
                     joinstyle="round", zorder=10 * k + 1))
        pp = np.array([sx, sy + dz]).T.reshape(-1, 1, 2)
        segs = np.concatenate([pp[:-1], pp[1:]], axis=1)
        ax.add_collection(LineCollection(segs, colors="#565C66", linewidths=3.2 + 1.2 * frac,
                          capstyle="round", zorder=10 * k + 2))
        wmask = winner[:-1] == di
        if wmask.any():
            neon_lines(ax, segs[wmask], colors=[col] * int(wmask.sum()),
                       lw=4.5 + 1.3 * frac, glow=0.4)
            for c in ax.collections[-4:]:
                c.set_zorder(10 * k + 3)
        ay = bsy.mean() + dz
        drv = drivers[di][0]
        disc = headshot_disc((look.get(str(drv)) or {}).get("headshot"), col)
        if disc is not None:
            ax.add_artist(AnnotationBbox(OffsetImage(disc, zoom=0.20), (lx, ay),
                          xycoords="data", frameon=False, zorder=300))
        else:
            ax.add_patch(plt.Rectangle((lx - 0.04, ay - 0.04), 0.08, 0.08, color=col, zorder=300))
        ax.annotate(drv, (lx, ay), xytext=(30, 6), textcoords="offset points",
                    va="center", ha="left", fontsize=13, fontproperties=FP_BODY_B,
                    color=INK, zorder=300,
                    bbox=dict(boxstyle="round,pad=0.2", facecolor=PAPER, edgecolor="none", alpha=0.82))
        ax.annotate(f"quickest on {round(100 * wmask.mean())}% of the lap", (lx, ay), xytext=(30, -10),
                    textcoords="offset points", va="center", ha="left", fontsize=10,
                    fontproperties=FP_BODY, color=SUBINK, zorder=300)
    # registration connectors tying the same corner across every layer
    sm = np.convolve(speeds[0], np.ones(9) / 9, mode="same")
    chosen = []
    for j in np.argsort(sm):
        if all(abs(int(j) - c) > 700 // 8 for c in chosen):
            chosen.append(int(j))
        if len(chosen) == 3:
            break
    for j in chosen:
        ax.plot([sx[j], sx[j]], [sy[j], sy[j] + (n - 1) * dz_step], color=SUBINK,
                lw=1.0, alpha=0.5, zorder=200)
        for k in range(n):
            ax.scatter([sx[j]], [sy[j] + k * dz_step], s=18, facecolor=PAPER,
                       edgecolor=SUBINK, lw=1.0, zorder=201)
    ax.set_aspect("equal")
    ax.axis("off")
    allx = np.concatenate([bsx + shx * 2.4, sx])
    ally = np.concatenate([bsy - shy * 2.4, sy + (n - 1) * dz_step])
    ax.set_xlim(lx - 0.25, allx.max() + 0.30)
    ax.set_ylim(ally.min() - 0.25, ally.max() + 0.25)
    for artist in list(ax.collections) + list(ax.patches):
        artist.set_clip_on(False)
    footer(fig, meta)
    return fig_png(fig)


def chart_dominance_flat(session, meta):
    """Flat 'who is fastest where' track map — every micro-segment of the lap
    coloured by the driver with the highest median speed there, plus a per-driver
    share legend. Wide, frame-filling composition (legend left, track centre-right)."""
    laps = session.laps
    grid = rx = ry = None
    drivers = []        # (drv, color)
    speed_rows = []     # median speed per track point across the driver's quick laps
    tmcol = {}          # teammate tint counter (same-team drivers get distinct shades)
    for drv in top_drivers_by_pace(laps, 3):
        dl = laps[laps["Driver"] == drv]
        ql = dl.pick_quicklaps() if hasattr(dl, "pick_quicklaps") else dl
        stack = []
        for _, lap in ql.iterlaps():
            try:
                cd = lap.get_car_data().add_distance()
            except Exception:
                continue
            if "Speed" not in cd or "Distance" not in cd or cd.empty:
                continue
            if grid is None:  # lock track geometry from the first usable lap
                try:
                    tel = lap.get_telemetry()
                    if not all(k in tel for k in ("X", "Y", "Distance")):
                        continue
                    grid = np.linspace(0, float(tel["Distance"].max()), 700)
                    rx = np.interp(grid, tel["Distance"], tel["X"])
                    ry = np.interp(grid, tel["Distance"], tel["Y"])
                except Exception:
                    grid = None
                    continue
            stack.append(np.interp(grid, cd["Distance"], cd["Speed"]))
        if not stack:
            continue
        drivers.append((drv, teammate_color(dl["Team"].iloc[0], tmcol)))
        speed_rows.append(np.median(np.vstack(stack), axis=0))
    if len(drivers) < 2 or grid is None:
        return None
    speeds = np.vstack(speed_rows)
    winner = np.argmax(speeds, axis=0)

    # normalise the track to a unit box centred on the origin
    cx0 = (rx.max() + rx.min()) / 2
    cy0 = (ry.max() + ry.min()) / 2
    half = max(rx.max() - rx.min(), ry.max() - ry.min()) / 2 or 1.0
    nx = (rx - cx0) / half
    ny = (ry - cy0) / half

    fig, ax = editorial_fig()
    title_block(fig, "Telemetry", "Track Dominance",
                "Median race pace · who is quickest at each point of the lap")

    P = np.column_stack([nx, ny]).reshape(-1, 1, 2)
    segs = np.concatenate([P[:-1], P[1:]], axis=1)
    seg_cols = [drivers[int(winner[i])][1] for i in range(len(segs))]
    # base track shadow, then the winner-coloured neon ribbon on top
    ax.add_collection(LineCollection(segs, colors=GRID, linewidths=8.5,
                      capstyle="round", joinstyle="round", zorder=1))
    # a soft colour glow for depth, then a CRISP thin winner-coloured ribbon on
    # top — the old neon blur (lw 9 + 3 halos to 32px) hid the dominance
    # boundaries; this keeps each driver's segments readable on the track.
    ax.add_collection(LineCollection(segs, colors=seg_cols, linewidths=11,
                      capstyle="round", joinstyle="round", alpha=0.15, zorder=2))
    ax.add_collection(LineCollection(segs, colors=seg_cols, linewidths=4.6,
                      capstyle="round", joinstyle="round", zorder=3))
    # start / finish tick
    ax.scatter([nx[0]], [ny[0]], s=90, facecolor=PAPER, edgecolor=INK, lw=1.6, zorder=40)
    ax.annotate("S/F", (nx[0], ny[0]), xytext=(0, 13), textcoords="offset points",
                ha="center", va="bottom", fontsize=8.5, color=SUBINK,
                fontproperties=FP_MONO_B, zorder=40)

    ax.set_aspect("equal")
    ax.axis("off")

    # driver-share legend — headshot + code + % of lap fastest (most-dominant first)
    look = driver_lookup(session)
    lx = nx.min() - 1.5
    order = sorted(range(len(drivers)), key=lambda i: -float((winner == i).mean()))
    ytop = ny.max()
    for row, di in enumerate(order):
        drv, col = drivers[di]
        pct = round(100 * float((winner == di).mean()))
        ay = ytop - row * 0.5
        disc = headshot_disc((look.get(str(drv)) or {}).get("headshot"), col)
        if disc is not None:
            ax.add_artist(AnnotationBbox(OffsetImage(disc, zoom=0.20), (lx, ay),
                          xycoords="data", frameon=False, zorder=300))
        else:
            ax.add_patch(plt.Rectangle((lx - 0.05, ay - 0.05), 0.10, 0.10, color=col, zorder=300))
        ax.annotate(drv, (lx, ay), xytext=(30, 7), textcoords="offset points",
                    va="center", ha="left", fontsize=13, fontproperties=FP_BODY_B,
                    color=INK, zorder=300)
        ax.annotate(f"quickest on {pct}% of the lap", (lx, ay), xytext=(30, -9),
                    textcoords="offset points", va="center", ha="left", fontsize=10,
                    fontproperties=FP_BODY, color=SUBINK, zorder=300)

    ax.set_xlim(lx - 0.35, nx.max() + 0.35)
    ax.set_ylim(ny.min() - 0.35, ny.max() + 0.55)
    for artist in list(ax.collections) + list(ax.patches):
        artist.set_clip_on(False)
    footer(fig, meta)
    return fig_png(fig)


def chart_strategy_history(years_data, circuit, meta):
    """Multi-year strategy infographic for one circuit: per-year winner stint
    bars + pit markers, field stop-mix, weather + winner. years_data newest-last."""
    yd = sorted(years_data, key=lambda d: d["year"], reverse=True)  # newest top
    if len(yd) < 2:
        return None
    L = LAYOUT[FMT]
    fig = plt.figure(figsize=L["figsize"], dpi=L["dpi"])
    fig.patch.set_facecolor(PAPER)
    title_block(fig, "Strategy", "Strategy Through the Years",
                f"{circuit} · how it's been won · tyres, stops & weather")
    by0, bh = L["ax"]
    n = len(yd)
    maxlaps = max(d["total_laps"] for d in yd)
    # stint timeline axis (centre) + stop-mix axis (right)
    sax = fig.add_axes([0.30, by0, 0.48, bh])
    max_ = fig.add_axes([0.82, by0, 0.11, bh])
    sax.set_facecolor(PAPER)
    max_.set_facecolor(PAPER)
    # distinct from compound colours (so stop-counts don't read as tyres)
    stopcols = {0: "#8C929B", 1: "#2BD46A", 2: "#3B82F6", 3: "#FF8000", 4: "#B100E8"}
    for i, d in enumerate(yd):
        y = n - 1 - i
        for si, (comp, start, length) in enumerate(d["stints"]):
            sax.barh(y, length, left=start - 1, height=0.56,
                     color=COMPOUND_COLORS.get(comp, "#9A9486"),
                     edgecolor=PAPER, linewidth=1.1, zorder=3)
            if si > 0:
                sax.scatter([start - 1], [y], marker="v", s=40, color=INK,
                            edgecolor=PAPER, linewidth=0.7, zorder=6)
        # left block: year + winner + weather + stops
        wx_icon = "WET" if d["wet"] else (f"{round(d['track_temp'])}°" if d["track_temp"] else "")
        yc = _hist_yfrac(y, n, by0, bh)
        fig.text(0.060, yc + 0.020, str(d["year"]),
                 color=INK, fontproperties=FP_TITLE, fontsize=20, va="center")
        fig.text(0.060, yc - 0.004, d["winner"],
                 color=d["winner_color"], fontproperties=FP_BODY_B, fontsize=14, va="center")
        fig.text(0.060, yc - 0.026,
                 f"{wx_icon} · {d['stops']}-stop", color=SUBINK,
                 fontproperties=FP_BODY, fontsize=10, va="center")
        # right: field stop-mix stacked bar (share of field per stop count)
        total = sum(d["mix"].values()) or 1
        left = 0.0
        for stops in sorted(d["mix"]):
            frac = d["mix"][stops] / total
            max_.barh(y, frac, left=left, height=0.56,
                      color=stopcols.get(stops, SUBINK), edgecolor=PAPER, linewidth=0.8, zorder=3)
            left += frac
        max_.text(1.04, y, f"{d['avg']:.1f}", transform=max_.get_yaxis_transform(),
                  va="center", ha="left", color=INK, fontproperties=FP_BODY_B, fontsize=10)
    for ax in (sax, max_):
        ax.set_ylim(-0.6, n - 0.4)
        for s in ax.spines.values():
            s.set_visible(False)
        ax.set_yticks([])
    sax.set_xlim(0, maxlaps + 1)
    sax.grid(axis="x", color=GRID, linewidth=0.9)
    sax.set_axisbelow(True)
    sax.tick_params(colors=SUBINK, length=0, labelsize=9)
    sax.set_xlabel("Lap", color=SUBINK, fontproperties=FP_BODY, fontsize=11)
    max_.set_xlim(0, 1)
    max_.set_xticks([])
    max_.set_title("field stops", color=SUBINK, fontproperties=FP_BODY, fontsize=9, pad=4)
    compound_legend(fig)
    # stop-mix legend (chips) bottom-right, clear of the footer text
    fy = LY("footer_y")
    fig.text(0.60, fy, "field stops:", color=SUBINK, fontsize=9, fontproperties=FP_BODY, va="center")
    lx = 0.665
    for stops, lab in ((1, "1"), (2, "2"), (3, "3"), (4, "4")):
        fig.add_artist(plt.Rectangle((lx, fy - 0.007), 0.011, 0.014, transform=fig.transFigure,
                                     color=stopcols[stops], zorder=11))
        fig.text(lx + 0.014, fy, lab, color=SUBINK, fontsize=9, fontproperties=FP_BODY, va="center")
        lx += 0.034
    footer(fig, meta)
    return fig_png(fig)


def _hist_yfrac(y, n, by0, bh):
    """Figure-fraction y for row index y (0..n-1) within the ax band."""
    return by0 + bh * ((y + 0.5) / n)


def chart_race_strategy(session, meta):
    laps = session.laps
    if laps is None or len(laps) == 0:
        return None
    try:
        order = [a for a in session.results["Abbreviation"].values if a]
    except Exception:
        order = list(laps["Driver"].dropna().unique())
    if DRIVERS:
        order = [d for d in order if d in DRIVERS]
    order = order[:14]
    if not order:
        return None
    L = LAYOUT[FMT]
    fig = plt.figure(figsize=L["figsize"], dpi=L["dpi"])
    fig.patch.set_facecolor(PAPER)
    title_block(fig, "Strategy", "Race Strategy Board",
                "Tyre stints · pit windows · track weather")
    left = 0.16
    w = 0.93 - left
    by0, bh = L["ax"]
    sax = fig.add_axes([left, by0, w, bh * 0.66])
    wax = fig.add_axes([left, by0 + bh * 0.76, w, bh * 0.22])
    sax.set_facecolor(PAPER)
    wax.set_facecolor(PAPER)
    lmax = int(laps["LapNumber"].max())

    # tyre stints + pit markers
    for i, drv in enumerate(order):
        dl = laps[laps["Driver"] == drv].sort_values("LapNumber")
        if dl.empty:
            continue
        for si, (_, st) in enumerate(dl.groupby("Stint")):
            comp = str(st["Compound"].iloc[0]).upper()
            start = st["LapNumber"].min()
            length = st["LapNumber"].max() - start + 1
            sax.barh(i, length, left=start - 1, height=0.62,
                     color=COMPOUND_COLORS.get(comp, "#9A9486"),
                     edgecolor=PAPER, linewidth=1.2, zorder=3)
            if si > 0:
                sax.scatter([start - 1], [i], marker="v", s=44, color=INK,
                            edgecolor=PAPER, linewidth=0.8, zorder=6)
    sax.set_yticks(range(len(order)))
    sax.set_yticklabels(order, fontproperties=FP_BODY_B, color=INK, fontsize=10)
    sax.set_ylim(-0.7, len(order) - 0.3)
    sax.invert_yaxis()
    sax.set_xlim(0, lmax + 1)
    sax.grid(axis="x", color=GRID, linewidth=1.0)
    sax.grid(axis="y", linewidth=0)
    sax.set_axisbelow(True)
    for s in ("top", "right", "left"):
        sax.spines[s].set_visible(False)
    sax.spines["bottom"].set_color(GRID)
    sax.tick_params(colors=SUBINK, length=0, labelsize=9)
    sax.set_xlabel("Lap", color=SUBINK, fontproperties=FP_BODY, fontsize=12)

    # weather strip, aligned to the lap axis. weather_data is a FastF1 property
    # that RAISES (DataNotLoadedError) when the weather load failed — getattr's
    # default only swallows AttributeError, so guard explicitly and degrade to a
    # strategy board without the temp/rain overlay rather than crashing the chart.
    try:
        wx = session.weather_data
    except Exception:
        wx = None
    if wx is not None and len(wx):
        lt = laps.groupby("LapNumber")["Time"].median()
        validlaps = [int(l) for l in sorted(lt.index) if pd.notna(lt[l])]
        xs = [lt[l].total_seconds() for l in validlaps]
        wt = wx["Time"].dt.total_seconds().to_numpy()

        def interp(col):
            return np.interp(xs, wt, wx[col].astype(float).to_numpy())

        try:
            track = interp("TrackTemp")
            air = interp("AirTemp")
            wax.plot(validlaps, track, color="#FF8000", lw=2.2, label="Track °C")
            wax.plot(validlaps, air, color="#36A2E8", lw=2.2, label="Air °C")
            lo, hi = wax.get_ylim()
            rain = interp("Rainfall")
            if (rain > 0).any():
                wax.fill_between(validlaps, lo, hi, where=rain > 0,
                                 color="#1E6FB8", alpha=0.20, step="mid", zorder=1)
                wax.text(0.012, 0.86, "RAIN", transform=wax.transAxes, color="#5AA9E6",
                         fontsize=8.5, fontproperties=FP_BODY_B, va="top")
            wax.set_ylim(lo, hi)
            leg = wax.legend(loc="upper right", frameon=False, fontsize=9, ncol=2,
                             handlelength=1.2)
            for t in leg.get_texts():
                t.set_color(INK)
        except Exception:
            pass
    wax.set_xlim(0, lmax + 1)
    wax.set_xticklabels([])
    wax.set_ylabel("°C", color=SUBINK, fontproperties=FP_BODY, fontsize=10)
    for s in ("top", "right"):
        wax.spines[s].set_visible(False)
    wax.spines["left"].set_color(GRID)
    wax.spines["bottom"].set_color(GRID)
    wax.tick_params(colors=SUBINK, length=0, labelsize=8)
    wax.grid(axis="y", color=GRID, linewidth=0.7)
    wax.set_axisbelow(True)

    compound_legend(fig)
    footer(fig, meta)
    return fig_png(fig)


def chart_parallax_stack(session, meta):
    laps = session.laps
    drivers = []
    for drv in top_drivers_by_pace(laps, 3):
        dl = laps[laps["Driver"] == drv]
        lap = dl.pick_fastest()
        if lap is None or (hasattr(lap, "empty") and lap.empty):
            continue
        try:
            t = lap.get_telemetry()
        except Exception:
            continue
        if not all(k in t for k in ("X", "Y", "Speed", "Distance")):
            continue
        lt = lap["LapTime"]
        ltxt = fmt_laptime(lt.total_seconds()) if pd.notna(lt) else ""
        drivers.append((drv, t, team_color(lap["Team"]), ltxt))
    if len(drivers) < 2:
        return None
    ref = drivers[0][1]  # fastest lap = shared geometry reference
    grid = np.linspace(0, ref["Distance"].max(), 700)
    rx = np.interp(grid, ref["Distance"], ref["X"])
    ry = np.interp(grid, ref["Distance"], ref["Y"])
    speeds = [np.interp(grid, t["Distance"], t["Speed"]) for _, t, _, _ in drivers]
    vmin = min(s.min() for s in speeds)
    vmax = max(s.max() for s in speeds)
    cx0 = (rx.max() + rx.min()) / 2
    cy0 = (ry.max() + ry.min()) / 2
    half = max(rx.max() - rx.min(), ry.max() - ry.min()) / 2 or 1.0
    nx = (rx - cx0) / half
    ny = (ry - cy0) / half
    shear, tilt, squash = 0.55, 0.18, 0.42

    def iso(px, py):
        return px + shear * py, -tilt * px + squash * py

    sx, sy = iso(nx, ny)
    dz_step = LY("stack_dz") * (sy.max() - sy.min()) * 0.85
    idxs = list(range(len(drivers)))[::-1]  # slowest first (bottom)
    n = len(idxs)
    fig, ax = editorial_fig()
    title_block(fig, "Telemetry", "Parallax Stack", "Three fastest laps · stacked by pace")
    pad = 0.18
    box = np.array([[-1 - pad, -1 - pad], [1 + pad, -1 - pad],
                    [1 + pad, 1 + pad], [-1 - pad, 1 + pad]])
    bsx, bsy = iso(box[:, 0], box[:, 1])
    tab_x, tab_y0 = iso(-1 - pad, 1 + pad)
    look = driver_lookup(session)
    top_lc = None
    shx, shy = 0.10, 0.14
    lx = bsx.min() - 0.45
    for k, di in enumerate(idxs):
        frac = k / (n - 1) if n > 1 else 1.0
        dz = k * dz_step
        col = drivers[di][2]
        for mul, a in ((1.0, 0.20), (1.7, 0.10), (2.4, 0.05)):
            ax.add_patch(plt.Polygon(np.column_stack([bsx + shx * mul, bsy - shy * mul + dz]),
                         closed=True, facecolor="#000000", edgecolor="none", alpha=a, zorder=10 * k))
        ax.add_patch(plt.Polygon(np.column_stack([bsx, bsy + dz]), closed=True,
                     facecolor=PANEL, alpha=0.30, edgecolor=col, lw=1.6,
                     joinstyle="round", zorder=10 * k + 1))
        pts = np.array([sx, sy + dz]).T.reshape(-1, 1, 2)
        segs = np.concatenate([pts[:-1], pts[1:]], axis=1)
        lc = neon_lines(ax, segs, array=speeds[di][:-1], cmap="inferno",
                        lw=4.5 + 1.7 * frac, glow=0.45)
        for c in ax.collections[-4:]:
            try:
                c.set_clim(vmin, vmax)
            except Exception:
                pass
            c.set_zorder(10 * k + 3)
        lc.set_alpha(0.55 + 0.45 * frac)
        top_lc = lc
        ay = bsy.mean() + dz
        drv = drivers[di][0]
        disc = headshot_disc((look.get(str(drv)) or {}).get("headshot"), col)
        if disc is not None:
            ax.add_artist(AnnotationBbox(OffsetImage(disc, zoom=0.20), (lx, ay),
                          xycoords="data", frameon=False, zorder=300))
        else:
            ax.add_patch(plt.Rectangle((lx - 0.04, ay - 0.04), 0.08, 0.08, color=col, zorder=300))
        ax.annotate(drv, (lx, ay), xytext=(30, 6), textcoords="offset points",
                    va="center", ha="left", fontsize=13, fontproperties=FP_BODY_B,
                    color=INK, zorder=300,
                    bbox=dict(boxstyle="round,pad=0.2", facecolor=PAPER, edgecolor="none", alpha=0.82))
        ax.annotate(drivers[di][3], (lx, ay), xytext=(30, -10), textcoords="offset points",
                    va="center", ha="left", fontsize=10, fontproperties=FP_BODY,
                    color=SUBINK, zorder=300)
    sm = np.convolve(speeds[0], np.ones(9) / 9, mode="same")
    chosen = []
    for j in np.argsort(sm):
        if all(abs(int(j) - c) > 700 // 8 for c in chosen):
            chosen.append(int(j))
        if len(chosen) == 3:
            break
    for j in chosen:
        ax.plot([sx[j], sx[j]], [sy[j], sy[j] + (n - 1) * dz_step], color=SUBINK,
                lw=1.0, alpha=0.45, zorder=200)
        for k in range(n):
            ax.scatter([sx[j]], [sy[j] + k * dz_step], s=18, facecolor=PAPER,
                       edgecolor=SUBINK, lw=1.0, zorder=201)
    ax.set_aspect("equal")
    ax.axis("off")
    allx = np.concatenate([bsx + shx * 2.4, sx])
    ally = np.concatenate([bsy - shy * 2.4, sy + (n - 1) * dz_step])
    ax.set_xlim(lx - 0.25, allx.max() + 0.30)
    ax.set_ylim(ally.min() - 0.25, ally.max() + 0.25)
    for artist in list(ax.collections) + list(ax.patches):
        artist.set_clip_on(False)
    cax = fig.add_axes(LY("cbar"))
    cb = fig.colorbar(top_lc, cax=cax, orientation="horizontal")
    cb.set_label("Speed (km/h)", color=SUBINK, fontsize=10, fontproperties=FP_BODY)
    cb.ax.tick_params(colors=SUBINK, labelsize=9)
    cb.outline.set_edgecolor(GRID)
    footer(fig, meta)
    return fig_png(fig)


# ── Race Analysis poster — the whole race story in one board ─────────────────
# A dense 16:9 composite (the old f1datastop-bot "storyline", rebuilt in the app
# type system + Deep Carbon palette): result cluster · position evolution ·
# tyre strategy · places gained/lost · on-track passes · undercut scorecard ·
# gap to leader. Whole-field, per-race (not driver-picked).
_GAIN = "#2BD46A"
_LOSS = "#FF4136"


def _fmt_gap(td):
    """Timedelta gap -> '+S.sss' / '+M:SS.mmm'. Blank for NaT or absurd (absolute) values."""
    try:
        s = float(td.total_seconds())
    except Exception:
        return ""
    if np.isnan(s) or s <= 0 or s > 3600:   # >1h => an absolute time, not a gap
        return ""
    m = int(s // 60)
    sec = s - m * 60
    return f"+{m}:{sec:06.3f}" if m else f"+{sec:.3f}"


def _stint_starts(dl):
    """Out-lap (start lap) of every stint after the first — i.e. real pit stops."""
    try:
        starts = sorted(int(st["LapNumber"].min()) for _, st in dl.groupby("Stint"))
    except Exception:
        return []
    return starts[1:]


def _on_track_passes(laps):
    """Per-driver on-track pass count, keyed by driver abbreviation.
    Counts lap-over-lap position gains but EXCLUDES lap 1 (the start-line shuffle)
    and each driver's pit out-lap + settle lap (the pit cycle, not a pass) — the two
    biggest false positives in the naive lap-delta method the old bot shipped. Same
    method the warehouse `get_overtakes` RPC uses, computed here for correct keying."""
    counts = {}
    for drv, dl in laps.groupby("Driver"):
        dl = dl.dropna(subset=["Position"]).sort_values("LapNumber")
        if len(dl) < 2:
            continue
        skip = set()
        for L in _stint_starts(dl):
            skip.add(L)
            skip.add(L + 1)
        prev = None
        c = 0
        for _, row in dl.iterrows():
            ln = int(row["LapNumber"])
            pos = row["Position"]
            if prev is not None and pd.notna(pos) and ln > 1 and ln not in skip:
                gain = int(prev) - int(pos)
                if gain > 0:
                    c += gain
            prev = pos
        counts[str(drv)] = c
    return counts


def _pit_swings(laps):
    """Net track positions won/lost through each pit stop (the undercut signal).
    For a stop with out-lap L: pre = position two laps before the box, post = position
    two laps after rejoining (once the rival's stop has cycled). net>0 = gained places
    through the stop. Returns [(driver, stop_lap, net), ...] sorted by |net| desc."""
    out = []
    for drv, dl in laps.groupby("Driver"):
        dl = dl.dropna(subset=["Position"]).sort_values("LapNumber")
        pos_by_lap = {int(r["LapNumber"]): int(r["Position"]) for _, r in dl.iterrows()}
        if not pos_by_lap:
            continue
        last = max(pos_by_lap)
        for L in _stint_starts(dl):
            pre = pos_by_lap.get(L - 2, pos_by_lap.get(L - 1))
            post = pos_by_lap.get(min(L + 2, last), pos_by_lap.get(min(L + 1, last)))
            if pre is None or post is None:
                continue
            out.append((str(drv), L, pre - post))
    out.sort(key=lambda x: abs(x[2]), reverse=True)
    return out


def _ra_axstyle(ax, xlabel=None, ylabel=None):
    for s in ("top", "right", "left"):
        ax.spines[s].set_visible(False)
    ax.spines["bottom"].set_color(GRID)
    ax.tick_params(colors=SUBINK, labelsize=7.5, length=0)
    ax.set_axisbelow(True)
    for lbl in ax.get_xticklabels() + ax.get_yticklabels():
        lbl.set_fontproperties(FP_MONO)
    if xlabel:
        ax.set_xlabel(xlabel, color=SUBINK, fontsize=8.5, fontproperties=FP_BODY)
    if ylabel:
        ax.set_ylabel(ylabel, color=SUBINK, fontsize=8.5, fontproperties=FP_BODY)


def _ra_ptitle(fig, x, y, text):
    fig.text(x, y, text.upper(), color=RED, fontsize=10.5, fontproperties=FP_MONO_B, va="bottom")


def _ra_shade(ax, session):
    for p in safety_periods(session):
        c = _SAFETY_COLOR[p["kind"]]
        ax.axvspan(p["start"] - 0.5, p["end"] + 0.5, facecolor=c, alpha=0.11, zorder=0,
                   hatch="///" if p["kind"] == "VSC" else None, lw=0)


def _ra_empty(ax, msg):
    ax.axis("off")
    ax.text(0.5, 0.5, msg, ha="center", va="center", transform=ax.transAxes,
            color=SUBINK, fontsize=8, fontproperties=FP_BODY)


def _ra_position(ax, session, laps):
    """Hero: every driver's track position lap-by-lap, with SC/VSC bands, pit ticks,
    the fastest-lap star, DNF crosses and line-end codes."""
    _ra_shade(ax, session)
    total = int(laps["LapNumber"].max())
    fl_drv = fl_lap = None
    try:
        fl = laps.pick_fastest()
        if fl is not None and not (hasattr(fl, "empty") and fl.empty):
            fl_drv, fl_lap = str(fl["Driver"]), int(fl["LapNumber"])
    except Exception:
        pass
    # actual retirements from the classification (a heavily-lapped FINISHER also has
    # last_lap < total, so lap count alone would wrongly cross them out).
    dnf = set()
    try:
        for _, r in session.results.iterrows():
            st = str(r.get("Status", ""))
            ab = str(r.get("Abbreviation", ""))
            if ab and st and st != "Finished" and not st.startswith("+"):
                dnf.add(ab)
    except Exception:
        pass
    npos = max(int(laps["Position"].dropna().max() or 0), len(session.drivers))
    seen = {}
    for drv in session.drivers:
        dl = laps[laps["DriverNumber"] == drv].dropna(subset=["Position"]).sort_values("LapNumber")
        if dl.empty:
            continue
        abbr = str(dl["Driver"].iloc[0])
        team = dl["Team"].iloc[0]
        c = team_color(team)
        xs, ys = smooth_xy(dl["LapNumber"].values, dl["Position"].values)
        ax.plot(xs, ys, color=c, lw=1.7, ls=style_for(team, seen), solid_capstyle="round",
                alpha=0.95, zorder=3)
        for L in _stint_starts(dl):
            row = dl[dl["LapNumber"] == L]
            if not row.empty:
                ax.scatter([L], [int(row["Position"].iloc[0])], marker="|", s=44, color=c,
                           linewidth=1.4, zorder=4)
        last = dl.iloc[-1]
        ll, lp = int(last["LapNumber"]), int(last["Position"])
        if abbr in dnf:   # retired (per the official classification)
            ax.scatter([ll], [lp], marker="x", s=34, color=INK, linewidth=1.6, zorder=6)
        if fl_drv == abbr and fl_lap is not None:
            frow = dl[dl["LapNumber"] == fl_lap]
            if not frow.empty:
                ax.scatter([fl_lap], [int(frow["Position"].iloc[0])], marker="*", s=110,
                           color=PURPLE, edgecolor=PAPER, linewidth=0.6, zorder=7)
        ax.scatter([ll], [lp], s=15, facecolor=PANEL, edgecolor=c, linewidth=1.3, zorder=6)
        ax.annotate(abbr, (ll, lp), xytext=(6, 0), textcoords="offset points", va="center",
                    ha="left", fontsize=7, fontproperties=FP_BODY_B, color=c, zorder=6)
    ax.set_xlim(0, total * 1.07)
    ax.set_ylim(npos + 0.6, 0.4)
    ax.set_yticks(pos_yticks(npos))
    ax.grid(axis="y", color=GRID, linewidth=0.9)
    _ra_axstyle(ax, "Lap", "Position")


def _ra_tyres(ax, session, laps):
    try:
        order = [a for a in session.results["Abbreviation"].values if a]
    except Exception:
        order = list(laps["Driver"].dropna().unique())
    order = order[:18]
    lmax = int(laps["LapNumber"].max())
    yt, yl = [], []
    for i, drv in enumerate(order):
        dl = laps[laps["Driver"] == drv].sort_values("LapNumber")
        if dl.empty:
            continue
        for si, (_, st) in enumerate(dl.groupby("Stint")):
            comp = str(st["Compound"].iloc[0]).upper()
            start = int(st["LapNumber"].min())
            length = int(st["LapNumber"].max() - start + 1)
            ax.barh(i, length, left=start - 1, height=0.64,
                    color=COMPOUND_COLORS.get(comp, "#9A9486"),
                    edgecolor=PAPER, linewidth=1.0, zorder=3)
            if si > 0:
                ax.scatter([start - 1], [i], marker="v", s=26, color=INK, edgecolor=PAPER,
                           linewidth=0.6, zorder=6)
        yt.append(i)
        yl.append(drv)
    if not yt:
        _ra_empty(ax, "No stint data")
        return
    ax.set_yticks(yt)
    ax.set_yticklabels(yl, fontproperties=FP_BODY_B, color=INK, fontsize=7.5)
    ax.set_ylim(-0.7, len(yt) - 0.3)
    ax.invert_yaxis()
    ax.set_xlim(0, lmax + 1)
    # safety-car / VSC laps shaded across every stint — shows the field pitting
    # under caution, on top of the compound bars.
    xtr = ax.get_xaxis_transform()
    for p in safety_periods(session):
        c = _SAFETY_COLOR[p["kind"]]
        ax.axvspan(p["start"] - 0.5, p["end"] + 0.5, facecolor=c, alpha=0.18, zorder=5,
                   hatch="///" if p["kind"] == "VSC" else None, lw=0)
        ax.text((p["start"] + p["end"]) / 2.0, 0.99, p["kind"], transform=xtr, ha="center",
                va="top", color=c, fontsize=6.5, fontproperties=FP_BODY_B, zorder=6)
    ax.grid(axis="x", color=GRID, linewidth=0.9)
    ax.grid(axis="y", linewidth=0)
    _ra_axstyle(ax, "Lap", None)


def _ra_places(ax, session):
    try:
        res = session.results.copy()
    except Exception:
        _ra_empty(ax, "No result data")
        return
    if "GridPosition" not in res or "Position" not in res:
        _ra_empty(ax, "No grid data")
        return
    res = res.dropna(subset=["GridPosition", "Position"])
    res = res[res["GridPosition"] > 0]
    if res.empty:
        _ra_empty(ax, "No grid data")
        return
    res["delta"] = res["GridPosition"] - res["Position"]
    res = res.sort_values("delta")
    codes = list(res["Abbreviation"].values)
    deltas = res["delta"].values
    cols = [_GAIN if d > 0 else (_LOSS if d < 0 else SUBINK) for d in deltas]
    ax.barh(range(len(codes)), deltas, color=cols, height=0.66, zorder=3,
            edgecolor=PAPER, linewidth=0.6)
    ax.axvline(0, color="#3A3D45", lw=1.1)
    ax.set_yticks(range(len(codes)))
    ax.set_yticklabels(codes, fontproperties=FP_BODY_B, color=INK, fontsize=6.8)
    ax.set_ylim(-0.7, len(codes) - 0.3)
    ax.invert_yaxis()
    ax.grid(axis="x", color=GRID, linewidth=0.9)
    ax.grid(axis="y", linewidth=0)
    _ra_axstyle(ax, "Gained (+) / lost (−)", None)


def _ra_passes(ax, laps):
    counts = _on_track_passes(laps)
    rows = sorted(((d, n) for d, n in counts.items() if n > 0), key=lambda x: x[1])[-12:]
    if not rows:
        _ra_empty(ax, "No on-track passes")
        return
    tmap = {}
    for d, _ in rows:
        sub = laps[laps["Driver"] == d]
        tmap[d] = sub["Team"].iloc[0] if not sub.empty else None
    for i, (d, n) in enumerate(rows):
        ax.barh(i, n, color=team_color(tmap.get(d)), height=0.66, zorder=3,
                edgecolor=PAPER, linewidth=0.6)
        ax.text(n + 0.12, i, str(n), va="center", ha="left", fontsize=7.5,
                fontproperties=FP_MONO_B, color=INK)
    ax.set_yticks(range(len(rows)))
    ax.set_yticklabels([d for d, _ in rows], fontproperties=FP_BODY_B, color=INK, fontsize=6.8)
    ax.set_ylim(-0.7, len(rows) - 0.3)
    ax.set_xlim(0, max(n for _, n in rows) * 1.20)
    ax.grid(axis="x", color=GRID, linewidth=0.9)
    ax.grid(axis="y", linewidth=0)
    _ra_axstyle(ax, "Passes", None)


def _ra_undercut(ax, laps):
    swings = [s for s in _pit_swings(laps) if s[2] != 0][:9]
    if not swings:
        _ra_empty(ax, "No decisive stops")
        return
    labels = [f"{d} · L{L}" for d, L, _ in swings]
    nets = [net for _, _, net in swings]
    cols = [_GAIN if n > 0 else _LOSS for n in nets]
    ax.barh(range(len(nets)), nets, color=cols, height=0.66, zorder=3,
            edgecolor=PAPER, linewidth=0.6)
    ax.axvline(0, color="#3A3D45", lw=1.1)
    for i, n in enumerate(nets):
        ha = "left" if n > 0 else "right"
        off = 0.08 if n > 0 else -0.08
        ax.text(n + off, i, f"+{n}" if n > 0 else str(n), va="center", ha=ha, fontsize=7,
                fontproperties=FP_MONO_B, color=INK)
    ax.set_yticks(range(len(labels)))
    ax.set_yticklabels(labels, fontproperties=FP_BODY_B, color=INK, fontsize=6.6)
    ax.set_ylim(-0.7, len(labels) - 0.3)
    ax.invert_yaxis()
    m = max(abs(n) for n in nets) or 1
    ax.set_xlim(-m * 1.35, m * 1.35)
    ax.grid(axis="x", color=GRID, linewidth=0.9)
    ax.grid(axis="y", linewidth=0)
    _ra_axstyle(ax, "Places through stop", None)


def _ra_gap(ax, session, laps):
    df = laps[["Driver", "LapNumber", "Time", "Team"]].dropna(subset=["Time", "LapNumber"]).copy()
    if df.empty:
        _ra_empty(ax, "No timing data")
        return
    df["t"] = df["Time"].dt.total_seconds()
    leader = df.groupby("LapNumber")["t"].min()
    df["gap"] = df["t"] - df["LapNumber"].map(leader)
    try:
        order = [a for a in session.results["Abbreviation"].values][:5]
    except Exception:
        order = list(df["Driver"].unique())[:5]
    seen = {}
    for drv in order:
        sub = df[df["Driver"] == drv].sort_values("LapNumber")
        if sub.empty:
            continue
        team = sub["Team"].iloc[0]
        c = team_color(team)
        ax.plot(sub["LapNumber"], sub["gap"], color=c, lw=1.6, ls=style_for(team, seen),
                solid_capstyle="round")
        last = sub.iloc[-1]
        ax.annotate(str(drv), (last["LapNumber"], last["gap"]), xytext=(4, 0),
                    textcoords="offset points", va="center", ha="left", fontsize=6.6,
                    fontproperties=FP_BODY_B, color=c)
    ax.invert_yaxis()
    ax.grid(axis="y", color=GRID, linewidth=0.9)
    _ra_axstyle(ax, "Lap", "Gap (s)")


def _poster_flag(fig, country, x, y, zoom=0.5):
    """Race-country flag at (x, y) figure-fraction, left-aligned. Returns the x-indent
    to offset the following text by (0 if no flag was resolved)."""
    arr = fetch_flag(country)
    if arr is None:
        return 0.0
    fig.add_artist(AnnotationBbox(OffsetImage(arr, zoom=zoom), (x, y), xycoords="figure fraction",
                   frameon=False, box_alignment=(0, 0.5), zorder=12))
    return 0.026


def _compare_team_badge(fig, season, team_a, team_b, x, y, zoom=0.16, gap=0.058):
    """Team logo(s) for a two-driver header: one logo when both share a team, else
    both side by side. Falls back to the team name if a logo can't be fetched."""
    teams = [team_a] if (not team_b or str(team_a) == str(team_b)) else [team_a, team_b]
    cx = x
    for t in teams:
        if not t:
            continue
        logo = fetch_team_logo(season, t)
        if logo is not None:
            fig.add_artist(AnnotationBbox(OffsetImage(logo, zoom=zoom), (cx, y),
                           xycoords="figure fraction", frameon=False, box_alignment=(0, 0.5), zorder=12))
        else:
            fig.text(cx, y, str(t), va="center", ha="left", color=INK, fontsize=9,
                     fontproperties=FP_BODY_SB)
        cx += gap


def _brand_mark(fig, tall=False):
    """F1 DataStop wordmark + logo, top-right of a poster header (matches the
    single-topic charts' title_block branding)."""
    x = 0.94 if tall else 0.965
    y = 0.980 if tall else 0.958
    fs = 12 if tall else 11
    if _LOGO is not None:
        fig.add_artist(AnnotationBbox(OffsetImage(_LOGO, zoom=0.15 if tall else 0.13), (x, y),
                       xycoords="figure fraction", frameon=False, box_alignment=(1, 0.5), zorder=12))
        fig.text(x - (0.052 if tall else 0.045), y, "F1 DATASTOP", ha="right", va="center",
                 color=INK, fontsize=fs, fontproperties=FP_BODY_SB)
    else:
        fig.text(x, y, "F1 DATASTOP", ha="right", va="center", color=INK, fontsize=fs,
                 fontproperties=FP_BODY_SB)


def _ra_result_cells(session, laps):
    """Result-cluster cells as (label, value, colour, sub, headshot_url|None).
    Podium + fastest-lap cells carry a driver headshot; LAPS/SC don't."""
    total = int(laps["LapNumber"].max())
    look = driver_lookup(session)

    def hs(abbr):
        return (look.get(str(abbr)) or {}).get("headshot")

    cells = []
    try:
        res = session.results
    except Exception:
        res = None
    if res is not None and len(res):
        try:
            win = res.iloc[0]
            wa = str(win.get("Abbreviation", ""))
            cells.append(("WINNER", wa, team_color(win.get("TeamName")), None, hs(wa)))
        except Exception:
            pass
        for pi in (1, 2):
            try:
                r = res.iloc[pi]
                ra = str(r.get("Abbreviation", ""))
                cells.append((f"P{pi + 1}", ra, team_color(r.get("TeamName")), _fmt_gap(r.get("Time")), hs(ra)))
            except Exception:
                pass
    try:
        fl = laps.pick_fastest()
        if fl is not None and not (hasattr(fl, "empty") and fl.empty):
            flt = fl["LapTime"].total_seconds() if pd.notna(fl["LapTime"]) else None
            fld = str(fl["Driver"])
            cells.append(("FASTEST LAP", fld, PURPLE, fmt_laptime(flt) if flt else None, hs(fld)))
    except Exception:
        pass
    cells.append(("LAPS", str(total), INK, None, None))
    n_sc = len([p for p in safety_periods(session) if p["kind"] in ("SC", "VSC")])
    cells.append(("SAFETY CARS", str(n_sc), GOLD if n_sc else SUBINK, None, None))
    return cells


def _ra_header(fig, session, laps, meta):
    fig.add_artist(plt.Rectangle((0, 0), 0.007, 1, transform=fig.transFigure, color=RED, zorder=10))
    ev, yr = meta.get("event", ""), meta.get("year", "")
    fig.text(0.035, 0.958, "   ".join("RACE ANALYSIS"), color=RED, fontsize=11,
             fontproperties=FP_MONO_B, va="center")
    fig.text(0.034, 0.928, f"{ev} {yr}", color=INK, fontsize=23, fontproperties=FP_TITLE, va="center")
    loc = meta.get("circuit") or meta.get("location") or ""
    fdx = _poster_flag(fig, meta.get("country"), 0.035, 0.898, 0.42)
    fig.text(0.035 + fdx, 0.898, f"{loc} · {meta.get('session_name', 'Race')}", color=SUBINK,
             fontsize=10, fontproperties=FP_BODY, va="center")
    _brand_mark(fig, False)
    cells = _ra_result_cells(session, laps)
    x0, x1 = 0.395, 0.955
    step = (x1 - x0) / max(len(cells), 1)
    for i, (lab, val, col, sub, hsu) in enumerate(cells):
        cx = x0 + step * i
        if hsu:
            disc = headshot_disc(hsu, col, size=120)
            if disc is not None:
                fig.add_artist(AnnotationBbox(OffsetImage(disc, zoom=0.09), (cx + 0.013, 0.972),
                               xycoords="figure fraction", frameon=False, box_alignment=(0.5, 0.5), zorder=12))
        fig.text(cx, 0.945, lab, color=SUBINK, fontsize=7.5, fontproperties=FP_MONO_B, va="center")
        fig.text(cx, 0.912, val, color=col, fontsize=13, fontproperties=FP_BODY_SB, va="center")
        if sub:
            fig.text(cx, 0.889, sub, color=SUBINK, fontsize=8.5, fontproperties=FP_MONO, va="center")
    fig.add_artist(plt.Line2D([0.033, 0.965], [0.872, 0.872], transform=fig.transFigure,
                              color=GRID, lw=1.0))


def _ra_header_tall(fig, session, laps, meta):
    """Portrait (9:16) header — bigger type, result cells centred in a row."""
    fig.add_artist(plt.Rectangle((0, 0), 0.011, 1, transform=fig.transFigure, color=RED, zorder=10))
    ev, yr = meta.get("event", ""), meta.get("year", "")
    fig.text(0.06, 0.980, "   ".join("RACE ANALYSIS"), color=RED, fontsize=13,
             fontproperties=FP_MONO_B, va="center")
    fig.text(0.058, 0.962, f"{ev} {yr}", color=INK, fontsize=28, fontproperties=FP_TITLE, va="center")
    loc = meta.get("circuit") or meta.get("location") or ""
    fdx = _poster_flag(fig, meta.get("country"), 0.06, 0.949, 0.5)
    fig.text(0.06 + fdx, 0.949, f"{loc} · {meta.get('session_name', 'Race')}", color=SUBINK,
             fontsize=12, fontproperties=FP_BODY, va="center")
    _brand_mark(fig, True)
    cells = _ra_result_cells(session, laps)
    x0, x1 = 0.06, 0.94
    step = (x1 - x0) / max(len(cells), 1)
    for i, (lab, val, col, sub, _hs) in enumerate(cells):
        cx = x0 + step * (i + 0.5)
        fig.text(cx, 0.933, lab, color=SUBINK, fontsize=8, fontproperties=FP_MONO_B, va="center", ha="center")
        fig.text(cx, 0.921, val, color=col, fontsize=13.5, fontproperties=FP_BODY_SB, va="center", ha="center")
        if sub:
            fig.text(cx, 0.910, sub, color=SUBINK, fontsize=8, fontproperties=FP_MONO, va="center", ha="center")
    fig.add_artist(plt.Line2D([0.055, 0.945], [0.900, 0.900], transform=fig.transFigure,
                              color=GRID, lw=1.0))


def chart_race_analysis(session, meta):
    """The whole race story on one board — 16:9 landscape/twitter, plus a stacked
    9:16 story variant for socials. 4:5 instagram returns None (use story)."""
    laps = session.laps
    if laps is None or len(laps) == 0:
        return None
    # Race board only — qualifying/practice have no race positions, stints, pits
    # or overtakes, so most panels are meaningless (and the position panel NaNs).
    sname = str(meta.get("session_name", "")).lower()
    if "qualif" in sname or "practice" in sname:
        return None
    panel_defs = [
        ("Position Evolution", lambda ax: _ra_position(ax, session, laps)),
        ("Tyre Strategy", lambda ax: _ra_tyres(ax, session, laps)),
        ("Places Gained / Lost", lambda ax: _ra_places(ax, session)),
        ("On-Track Passes", lambda ax: _ra_passes(ax, laps)),
        ("Undercut Scorecard", lambda ax: _ra_undercut(ax, laps)),
        ("Gap to Leader", lambda ax: _ra_gap(ax, session, laps)),
    ]
    if FMT in ("landscape", "twitter"):
        fig = plt.figure(figsize=(16, 9), dpi=200)
        fig.patch.set_facecolor(PAPER)
        _ra_header(fig, session, laps, meta)
        rects = [
            [0.035, 0.500, 0.470, 0.315], [0.575, 0.500, 0.390, 0.315],
            [0.035, 0.072, 0.170, 0.315], [0.265, 0.072, 0.170, 0.315],
            [0.500, 0.072, 0.185, 0.315], [0.745, 0.072, 0.220, 0.315],
        ]
    elif FMT == "story":
        fig = plt.figure(figsize=(10.8, 19.2), dpi=200)
        fig.patch.set_facecolor(PAPER)
        _ra_header_tall(fig, session, laps, meta)
        rects = [
            [0.10, 0.735, 0.84, 0.140], [0.10, 0.600, 0.84, 0.100],
            [0.10, 0.452, 0.84, 0.112], [0.10, 0.310, 0.84, 0.100],
            [0.10, 0.168, 0.84, 0.100], [0.10, 0.030, 0.84, 0.098],
        ]
    else:
        return None
    tall = FMT == "story"
    for rect, (ptitle, draw) in zip(rects, panel_defs):
        ax = fig.add_axes(rect)
        ax.set_facecolor(PAPER)
        _ra_ptitle(fig, rect[0], rect[1] + rect[3] + 0.010, ptitle)
        try:
            draw(ax)
            if tall:
                ax.set_xlabel("")   # drop redundant axis labels in the stack — titles name each panel
        except Exception as e:  # noqa: BLE001 — one bad panel shouldn't kill the poster
            _ra_empty(ax, "—")
            print(f"  ! race_analysis panel '{ptitle}' failed: {e}")
    # No footer(): the header carries event · circuit · session; watermark still tiles.
    return fig_png(fig)


# ── Driver vs Driver — pairwise fastest-lap telemetry board ──────────────────
def _lighten(hexc, t=0.5):
    r, g, b = _hex_to_rgb(hexc)
    return "#%02X%02X%02X" % (int(r + (255 - r) * t), int(g + (255 - g) * t), int(b + (255 - b) * t))


def _cmp_fastlap(laps, drv):
    dl = laps[laps["Driver"] == drv]
    if dl.empty:
        return None
    lap = dl.pick_fastest()
    if lap is None or (hasattr(lap, "empty") and lap.empty):
        return None
    return lap


def _cmp_map(ax, nx, ny, seg_cols, base=True):
    """Draw a normalised track ribbon coloured per-segment (shadow + glow + crisp)."""
    P = np.column_stack([nx, ny]).reshape(-1, 1, 2)
    segs = np.concatenate([P[:-1], P[1:]], axis=1)
    if base:
        ax.add_collection(LineCollection(segs, colors=GRID, linewidths=9.0,
                          capstyle="round", joinstyle="round", zorder=1))
    ax.add_collection(LineCollection(segs, colors=seg_cols, linewidths=11,
                      capstyle="round", joinstyle="round", alpha=0.16, zorder=2))
    ax.add_collection(LineCollection(segs, colors=seg_cols, linewidths=4.6,
                      capstyle="round", joinstyle="round", zorder=3))
    ax.scatter([nx[0]], [ny[0]], s=70, facecolor=PAPER, edgecolor=INK, lw=1.4, zorder=40)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.margins(0.04)
    for a in list(ax.collections):
        a.set_clip_on(False)


def chart_driver_compare(session, meta):
    """Head-to-head fastest-lap telemetry for two drivers: lap-time + sector deltas,
    a time gain/loss track map, speed dominance, speed trace, cumulative delta,
    throttle/braking and gears. 16:9 landscape/twitter + a stacked 9:16 story.
    Drivers = the two fastest of the picked set (--drivers), else the two fastest."""
    if FMT not in ("landscape", "twitter", "story"):
        return None
    laps = session.laps
    picks = top_drivers_by_pace(laps, 2)
    if len(picks) < 2:
        return None
    A, B = str(picks[0]), str(picks[1])
    lapA, lapB = _cmp_fastlap(laps, A), _cmp_fastlap(laps, B)
    if lapA is None or lapB is None:
        return None
    try:
        telA = lapA.get_telemetry().add_distance()
        telB = lapB.get_telemetry().add_distance()
    except Exception:
        return None
    if telA is None or telB is None or telA.empty or telB.empty or "X" not in telA:
        return None
    colA = team_color(lapA["Team"])
    colB = team_color(lapB["Team"])
    if colA == colB:
        colB = _hue_shift(colA, 0.11, 0.14)  # teammates: rotate hue (survives neon glow)

    sA = float(lapA["LapTime"].total_seconds())
    sB = float(lapB["LapTime"].total_seconds())

    # cumulative delta (B relative to A): + => B is behind A at that point
    refD = np.asarray(telA["Distance"], float)
    try:
        from fastf1.utils import delta_time
        dseries, ref_tel, _ = delta_time(lapA, lapB)
        refD = np.asarray(ref_tel["Distance"], float)
        dvals = np.asarray(dseries, float)
    except Exception:
        tA = (telA["Time"] - telA["Time"].iloc[0]).dt.total_seconds().to_numpy()
        tB = (telB["Time"] - telB["Time"].iloc[0]).dt.total_seconds().to_numpy()
        dvals = np.interp(refD, telB["Distance"], tB) - np.interp(refD, telA["Distance"], tA)

    # track geometry + fields on a common grid (from A, the reference lap)
    grid = np.linspace(0, float(telA["Distance"].max()), 700)
    gx = np.interp(grid, telA["Distance"], telA["X"].to_numpy())
    gy = np.interp(grid, telA["Distance"], telA["Y"].to_numpy())
    gdelta = np.interp(grid, refD, dvals)
    spA = np.interp(grid, telA["Distance"], telA["Speed"].to_numpy())
    spB = np.interp(grid, telB["Distance"], telB["Speed"].to_numpy())
    cx0, cy0 = (gx.max() + gx.min()) / 2, (gy.max() + gy.min()) / 2
    half = max(gx.max() - gx.min(), gy.max() - gy.min()) / 2 or 1.0
    nx, ny = (gx - cx0) / half, (gy - cy0) / half

    tall = FMT == "story"
    look = driver_lookup(session)
    subtitle = (f"{meta.get('event', '')} {meta.get('year', '')} · "
                f"{meta.get('session_name', 'Race')} · fastest laps")
    if tall:
        fig = plt.figure(figsize=(10.8, 19.2), dpi=200)
        fig.patch.set_facecolor(PAPER)
        R = {
            "lap": [0.09, 0.800, 0.40, 0.070], "sec": [0.57, 0.792, 0.38, 0.082],
            "delta": [0.055, 0.545, 0.41, 0.205], "dom": [0.535, 0.545, 0.41, 0.205],
            "speed": [0.10, 0.410, 0.85, 0.078], "cum": [0.10, 0.285, 0.85, 0.078],
            "thr": [0.10, 0.160, 0.85, 0.078], "gear": [0.10, 0.035, 0.85, 0.078],
        }
        key_xy = (0.55, 0.960)
        fig.add_artist(plt.Rectangle((0, 0), 0.011, 1, transform=fig.transFigure, color=RED, zorder=10))
        fig.text(0.06, 0.980, "   ".join("HEAD TO HEAD"), color=RED, fontsize=13,
                 fontproperties=FP_MONO_B, va="center")
        fig.text(0.058, 0.962, f"{A}  vs  {B}", color=INK, fontsize=30, fontproperties=FP_TITLE, va="center")
        fig.text(0.06 + _poster_flag(fig, meta.get("country"), 0.06, 0.948, 0.5), 0.948, subtitle,
                 color=SUBINK, fontsize=11, fontproperties=FP_BODY, va="center")
        _brand_mark(fig, True)
        for code, col, xx in ((A, colA, 0.79), (B, colB, 0.87)):
            disc = headshot_disc((look.get(str(code)) or {}).get("headshot"), col, size=120)
            if disc is not None:
                fig.add_artist(AnnotationBbox(OffsetImage(disc, zoom=0.16), (xx, 0.958),
                               xycoords="figure fraction", frameon=False, zorder=12))
        fig.add_artist(plt.Line2D([0.055, 0.945], [0.900, 0.900], transform=fig.transFigure,
                                  color=GRID, lw=1.0))
    else:
        fig = plt.figure(figsize=(16, 9), dpi=200)
        fig.patch.set_facecolor(PAPER)
        R = {
            "lap": [0.035, 0.615, 0.205, 0.205], "sec": [0.035, 0.335, 0.205, 0.195],
            "delta": [0.265, 0.335, 0.225, 0.485], "dom": [0.515, 0.335, 0.225, 0.485],
            "speed": [0.775, 0.615, 0.19, 0.205], "cum": [0.775, 0.335, 0.19, 0.195],
            "thr": [0.035, 0.072, 0.45, 0.175], "gear": [0.515, 0.072, 0.45, 0.175],
        }
        key_xy = (0.605, 0.930)
        fig.add_artist(plt.Rectangle((0, 0), 0.007, 1, transform=fig.transFigure, color=RED, zorder=10))
        fig.text(0.035, 0.958, "   ".join("HEAD TO HEAD"), color=RED, fontsize=11,
                 fontproperties=FP_MONO_B, va="center")
        fig.text(0.034, 0.926, f"{A}  vs  {B}", color=INK, fontsize=25, fontproperties=FP_TITLE, va="center")
        fig.text(0.035 + _poster_flag(fig, meta.get("country"), 0.035, 0.893, 0.42), 0.893, subtitle,
                 color=SUBINK, fontsize=10, fontproperties=FP_BODY, va="center")
        _brand_mark(fig, False)
        for code, col, xx in ((A, colA, 0.885), (B, colB, 0.945)):
            disc = headshot_disc((look.get(str(code)) or {}).get("headshot"), col, size=120)
            if disc is not None:
                fig.add_artist(AnnotationBbox(OffsetImage(disc, zoom=0.19), (xx, 0.918),
                               xycoords="figure fraction", frameon=False, zorder=12))
            else:
                fig.add_artist(plt.Rectangle((xx - 0.012, 0.905), 0.024, 0.026,
                               transform=fig.transFigure, color=col, zorder=12))
        fig.add_artist(plt.Line2D([0.033, 0.855], [0.872, 0.872], transform=fig.transFigure,
                                  color=GRID, lw=1.0))

    _compare_team_badge(fig, meta.get("year"), lapA["Team"], lapB["Team"],
                        0.06 if tall else 0.30, 0.925 if tall else 0.918, 0.17 if tall else 0.14)

    def add_panel(rect, title):
        ax = fig.add_axes(rect)
        ax.set_facecolor(PAPER)
        _ra_ptitle(fig, rect[0], rect[1] + rect[3] + 0.012, title)
        return ax

    # ── lap-time comparison ──
    ax = add_panel(R["lap"], "Lap Time")
    ax.barh([1, 0], [sA, sB], color=[colA, colB], height=0.62, edgecolor=PAPER, linewidth=1.0, zorder=3)
    lo, hi = min(sA, sB), max(sA, sB)
    ax.set_xlim(lo - 0.55, hi + 0.18)
    gap = abs(sA - sB)
    for y, code, s in ((1, A, sA), (0, B, sB)):
        tag = fmt_laptime(s) + ("" if s == lo else f"   +{gap:.3f}")
        ax.text(ax.get_xlim()[0] + 0.03, y, code, va="center", ha="left", fontsize=10,
                fontproperties=FP_BODY_B, color=INK, zorder=5)
        ax.text(s - 0.02, y, tag, va="center", ha="right", fontsize=9,
                fontproperties=FP_MONO_B, color="#FFFFFF", zorder=5)
    ax.set_yticks([])
    ax.grid(axis="x", color=GRID, linewidth=0.9)
    _ra_axstyle(ax, "Lap time (s)", None)

    # ── sector deltas ──
    ax = add_panel(R["sec"], "Sector Delta")
    secs, cols, labs = [], [], []
    for i, key in enumerate(("Sector1Time", "Sector2Time", "Sector3Time")):
        try:
            a = lapA[key].total_seconds()
            b = lapB[key].total_seconds()
        except Exception:
            continue
        if pd.isna(a) or pd.isna(b):
            continue
        d = b - a           # + => A faster in this sector
        secs.append(d)
        cols.append(colA if d > 0 else colB)
        labs.append(f"S{i + 1}")
    if secs:
        ax.bar(range(len(secs)), [abs(d) for d in secs], color=cols, width=0.6,
               edgecolor=PAPER, linewidth=1.0, zorder=3)
        for i, d in enumerate(secs):
            ax.text(i, abs(d), f"{A if d > 0 else B} +{abs(d):.3f}", ha="center", va="bottom",
                    fontsize=7.5, fontproperties=FP_MONO_B, color=INK)
        ax.set_xticks(range(len(labs)))
        ax.set_xticklabels(labs, fontproperties=FP_BODY_B, color=INK, fontsize=9)
        ax.set_ylim(0, max(abs(d) for d in secs) * 1.35 or 1)
        ax.grid(axis="y", color=GRID, linewidth=0.9)
        _ra_axstyle(ax, None, "Gap (s)")
    else:
        _ra_empty(ax, "No sector data")

    # ── time gain / loss track map ──
    ax = add_panel(R["delta"], "Time Gain / Loss")
    rate = np.gradient(gdelta)     # + => A pulling away (gaining) here
    P = np.column_stack([nx, ny]).reshape(-1, 1, 2)
    segs = np.concatenate([P[:-1], P[1:]], axis=1)
    m = float(np.percentile(np.abs(rate), 96)) or float(np.abs(rate).max()) or 1e-6
    ax.add_collection(LineCollection(segs, colors=GRID, linewidths=9.0,
                      capstyle="round", joinstyle="round", zorder=1))
    for lw, alpha, z in ((11, 0.16, 2), (4.6, 1.0, 3)):
        lc = LineCollection(segs, cmap="coolwarm", linewidths=lw, alpha=alpha,
                            capstyle="round", joinstyle="round", zorder=z)
        lc.set_array(rate[:-1])
        lc.set_clim(-m, m)
        ax.add_collection(lc)
    ax.scatter([nx[0]], [ny[0]], s=70, facecolor=PAPER, edgecolor=INK, lw=1.4, zorder=40)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.margins(0.04)
    for a in list(ax.collections):
        a.set_clip_on(False)
    lead = A if gdelta[-1] > 0 else B
    ax.text(0.5, -0.015, f"{lead} faster by {abs(gdelta[-1]):.3f}s", transform=ax.transAxes,
            ha="center", va="top", fontsize=9.5, fontproperties=FP_BODY_B, color=INK)
    ax.text(0.5, -0.072, f"red = {A} gaining · blue = {B} gaining", transform=ax.transAxes,
            ha="center", va="top", fontsize=7.5, fontproperties=FP_BODY, color=SUBINK)

    # ── speed dominance track map ──
    ax = add_panel(R["dom"], "Speed Dominance")
    dom = spA >= spB
    seg_cols = [colA if dom[i] else colB for i in range(len(nx) - 1)]
    _cmp_map(ax, nx, ny, seg_cols)
    pctA = round(100 * float(dom.mean()))
    ax.text(0.5, -0.02, f"{A} {pctA}%   ·   {B} {100 - pctA}%", transform=ax.transAxes,
            ha="center", va="top", fontsize=9.5, fontproperties=FP_BODY_B, color=SUBINK)

    # ── speed trace ──
    ax = add_panel(R["speed"], "Speed")
    ax.plot(grid, spA, color=colA, lw=1.4)
    ax.plot(grid, spB, color=colB, lw=1.4, ls=(0, (5, 2)))
    ax.grid(axis="y", color=GRID, linewidth=0.9)
    _ra_axstyle(ax, "Distance (m)", "km/h")

    # ── cumulative delta ──
    ax = add_panel(R["cum"], "Cumulative Gap")
    ax.axhline(0, color=GRID, lw=1.0)
    ax.plot(grid, gdelta, color=INK, lw=1.4, zorder=4)
    ax.fill_between(grid, 0, gdelta, where=gdelta >= 0, color=colA, alpha=0.30, zorder=2)
    ax.fill_between(grid, 0, gdelta, where=gdelta < 0, color=colB, alpha=0.30, zorder=2)
    ax.grid(axis="y", color=GRID, linewidth=0.9)
    _ra_axstyle(ax, "Distance (m)", f"+ = {A} ahead (s)")

    # ── throttle + braking zones ──
    ax = add_panel(R["thr"], "Throttle · braking zones shaded")
    ax.plot(telA["Distance"], telA["Throttle"], color=colA, lw=1.3)
    ax.plot(telB["Distance"], telB["Throttle"], color=colB, lw=1.3, ls=(0, (5, 2)))
    brA = telA["Brake"].astype(float)
    if brA.max() <= 1:
        brA = brA * 100
    ax.fill_between(telA["Distance"], 0, 100, where=brA > 0, color=RED, alpha=0.10, lw=0, zorder=0)
    ax.set_ylim(0, 105)
    ax.grid(axis="y", color=GRID, linewidth=0.9)
    _ra_axstyle(ax, "Distance (m)", "Throttle %")

    # ── gear ──
    ax = add_panel(R["gear"], "Gear")
    ax.step(telA["Distance"], telA["nGear"], where="post", color=colA, lw=1.3)
    ax.step(telB["Distance"], telB["nGear"], where="post", color=colB, lw=1.3, ls=(0, (5, 2)))
    ax.set_yticks(range(1, 9))
    ax.grid(axis="y", color=GRID, linewidth=0.9)
    _ra_axstyle(ax, "Distance (m)", "Gear")

    # driver colour key (solid = A, dashed = B)
    kx, ky0 = key_xy
    for i, (code, col, dash) in enumerate(((A, colA, "solid"), (B, colB, "dashed"))):
        yk = ky0 - i * 0.026
        fig.add_artist(plt.Line2D([kx, kx + 0.03], [yk, yk], transform=fig.transFigure, color=col,
                       lw=2.4, ls="-" if i == 0 else (0, (5, 2)), solid_capstyle="round", zorder=11))
        fig.text(kx + 0.04, yk, f"{code} · {dash}", va="center", color=INK, fontsize=9,
                 fontproperties=FP_BODY_B)

    return fig_png(fig)


# ── Season Scorecard — two drivers across the season so far (warehouse-backed) ─
def _sb_read_key():
    return (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")
            or os.environ.get("SUPABASE_PUBLISHABLE_KEY"))


@retry_supabase
def _wh_call(method, path, **kw):
    """Warehouse REST call. Returns parsed JSON, or None when Supabase isn't configured.
    Transient failures (network, 429/5xx) are retried then raised; any other non-OK status
    raises too — a chart must fail loudly rather than publish from silently-missing data."""
    url = os.environ.get("SUPABASE_URL")
    key = _sb_read_key()
    if not (url and key):
        return None
    headers = {"apikey": key, "Authorization": f"Bearer {key}", **kw.pop("headers", {})}
    r = requests.request(method, f"{url.rstrip('/')}/rest/v1/{path}", headers=headers, **kw)
    raise_if_transient(r)
    r.raise_for_status()
    return r.json()


def _wh_driver_by_code(code):
    rows = _wh_call("GET", "f1_driver",
                    params={"code": f"eq.{code.upper()}", "limit": "1",
                            "select": "ergast_id,given_name,family_name,code,nationality,headshot_url"},
                    timeout=20)
    return rows[0] if rows else None


def _wh_season_results(season, ergast_id):
    rows = _wh_call("POST", "rpc/get_driver_season_results",
                    json={"p_season": int(season), "p_driver_id": ergast_id}, timeout=25)
    return rows if isinstance(rows, list) else None


def _sc_pos(v):
    try:
        return int(str(v))
    except (TypeError, ValueError):
        return None


def _sc_num(x):
    f = float(x)
    return str(int(f)) if f == int(f) else f"{f:.1f}"


def _sc_summary(rows, upto):
    """Reduce a driver's season rows (<= upto round) into scorecard stats + series."""
    rows = sorted((r for r in rows if (r.get("round") or 0) <= upto), key=lambda r: r["round"])
    pts = wins = podiums = dnfs = 0
    finishes, grids, cum, by_round, series = [], [], 0.0, {}, []
    for r in rows:
        rnd = int(r["round"])
        pos = _sc_pos(r.get("position"))
        dnf = bool(r.get("is_dnf"))
        p = float(r.get("points") or 0)
        pts += p
        cum += p
        series.append((rnd, cum))
        if dnf:
            dnfs += 1
        if pos and not dnf:
            finishes.append(pos)
            if pos == 1:
                wins += 1
            if pos <= 3:
                podiums += 1
        g = r.get("grid")
        if g and int(g) > 0:
            grids.append(int(g))
        by_round[rnd] = {"pos": pos, "dnf": dnf, "quali": r.get("quali_position"), "grid": g}
    team = rows[-1].get("constructor") if rows else None
    return {
        "points": pts, "wins": wins, "podiums": podiums, "dnfs": dnfs,
        "avg_finish": (sum(finishes) / len(finishes)) if finishes else None,
        "avg_grid": (sum(grids) / len(grids)) if grids else None,
        "best": min(finishes) if finishes else None,
        "by_round": by_round, "series": series,
        "finishes": [(r, by_round[r]["pos"]) for r in sorted(by_round) if by_round[r]["pos"] and not by_round[r]["dnf"]],
        "team": team,
    }


def chart_season_scorecard(session, meta):
    """Two drivers head-to-head across the season so far (up to this round): season
    stats, race + qualifying H2H, finishing-position form and points progression.
    Warehouse-backed (ignores the loaded session). 16:9 + a 9:16 story; driver-picked."""
    if FMT not in ("landscape", "twitter", "story"):
        return None
    if not DRIVERS or len(DRIVERS) < 2:
        return None
    season = int(meta.get("year"))
    upto = int(meta.get("round") or 99)
    codes = sorted(DRIVERS)[:2]
    infos = [_wh_driver_by_code(c) for c in codes]
    if not all(infos):
        return None
    results = [_wh_season_results(season, d["ergast_id"]) for d in infos]
    if not all(results) or any(len(r) == 0 for r in results):
        return None
    SA, SB = _sc_summary(results[0], upto), _sc_summary(results[1], upto)
    # lead driver (more points) first, so the primary colour carries the story
    if (SB["points"] or 0) > (SA["points"] or 0):
        SA, SB, infos = SB, SA, [infos[1], infos[0]]
    A = infos[0].get("code") or codes[0]
    B = infos[1].get("code") or codes[1]
    colA, colB = team_color(SA["team"]), team_color(SB["team"])
    if colA == colB:
        colB = _hue_shift(colA, 0.11, 0.14)  # teammates: rotate hue (survives neon glow)

    # head-to-head tallies over the rounds both contested
    common = sorted(set(SA["by_round"]) & set(SB["by_round"]))
    ra, rb, qa, qb, race_win = 0, 0, 0, 0, []
    for rnd in common:
        a, b = SA["by_round"][rnd], SB["by_round"][rnd]
        ap = a["pos"] if (a["pos"] and not a["dnf"]) else 99
        bp = b["pos"] if (b["pos"] and not b["dnf"]) else 99
        if ap < bp:
            ra += 1; race_win.append(True)
        elif bp < ap:
            rb += 1; race_win.append(False)
        else:
            race_win.append(None)
        aq = a["quali"] or a["grid"] or 99
        bq = b["quali"] or b["grid"] or 99
        if aq < bq:
            qa += 1
        elif bq < aq:
            qb += 1

    tall = FMT == "story"
    thru = meta.get("event", "")
    subtitle = f"{season} · through round {upto}" + (f" · {thru}" if thru else "")
    if tall:
        fig = plt.figure(figsize=(10.8, 19.2), dpi=200)
        R = {"stats": [0.09, 0.645, 0.84, 0.225], "race": [0.09, 0.490, 0.84, 0.115],
             "quali": [0.09, 0.340, 0.84, 0.115], "finish": [0.09, 0.190, 0.84, 0.110],
             "points": [0.09, 0.040, 0.84, 0.110]}
        key_xy = (0.55, 0.960)
    else:
        fig = plt.figure(figsize=(16, 9), dpi=200)
        R = {"stats": [0.035, 0.09, 0.265, 0.72], "race": [0.34, 0.52, 0.30, 0.29],
             "quali": [0.34, 0.09, 0.30, 0.29], "finish": [0.68, 0.52, 0.285, 0.29],
             "points": [0.68, 0.09, 0.285, 0.29]}
        key_xy = (0.605, 0.930)
    fig.patch.set_facecolor(PAPER)
    if tall:
        fig.add_artist(plt.Rectangle((0, 0), 0.011, 1, transform=fig.transFigure, color=RED, zorder=10))
        fig.text(0.06, 0.980, "   ".join("SEASON SCORECARD"), color=RED, fontsize=13,
                 fontproperties=FP_MONO_B, va="center")
        fig.text(0.058, 0.962, f"{A}  vs  {B}", color=INK, fontsize=30, fontproperties=FP_TITLE, va="center")
        fig.text(0.06 + _poster_flag(fig, meta.get("country"), 0.06, 0.948, 0.5), 0.948, subtitle,
                 color=SUBINK, fontsize=11, fontproperties=FP_BODY, va="center")
        _brand_mark(fig, True)
        for d, col, xx in ((infos[0], colA, 0.79), (infos[1], colB, 0.87)):
            disc = headshot_disc(d.get("headshot_url"), col, size=120)
            if disc is not None:
                fig.add_artist(AnnotationBbox(OffsetImage(disc, zoom=0.16), (xx, 0.958),
                               xycoords="figure fraction", frameon=False, zorder=12))
        fig.add_artist(plt.Line2D([0.055, 0.945], [0.900, 0.900], transform=fig.transFigure,
                                  color=GRID, lw=1.0))
    else:
        fig.add_artist(plt.Rectangle((0, 0), 0.007, 1, transform=fig.transFigure, color=RED, zorder=10))
        fig.text(0.035, 0.958, "   ".join("SEASON SCORECARD"), color=RED, fontsize=11,
                 fontproperties=FP_MONO_B, va="center")
        fig.text(0.034, 0.926, f"{A}  vs  {B}", color=INK, fontsize=25, fontproperties=FP_TITLE, va="center")
        fig.text(0.035 + _poster_flag(fig, meta.get("country"), 0.035, 0.893, 0.42), 0.893, subtitle,
                 color=SUBINK, fontsize=10, fontproperties=FP_BODY, va="center")
        _brand_mark(fig, False)
        for d, col, xx in ((infos[0], colA, 0.885), (infos[1], colB, 0.945)):
            disc = headshot_disc(d.get("headshot_url"), col, size=120)
            if disc is not None:
                fig.add_artist(AnnotationBbox(OffsetImage(disc, zoom=0.19), (xx, 0.918),
                               xycoords="figure fraction", frameon=False, zorder=12))
            else:
                fig.add_artist(plt.Rectangle((xx - 0.012, 0.905), 0.024, 0.026,
                               transform=fig.transFigure, color=col, zorder=12))
        fig.add_artist(plt.Line2D([0.033, 0.855], [0.872, 0.872], transform=fig.transFigure,
                                  color=GRID, lw=1.0))

    _compare_team_badge(fig, season, SA["team"], SB["team"],
                        0.06 if tall else 0.30, 0.925 if tall else 0.918, 0.17 if tall else 0.14)

    # ── season stat cluster ──
    rc = R["stats"]
    ax = fig.add_axes(rc)
    ax.set_facecolor(PAPER)
    ax.axis("off")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    _ra_ptitle(fig, rc[0], rc[1] + rc[3] + 0.014, "Season So Far")
    metrics = [
        ("Points", SA["points"], SB["points"], "hi"),
        ("Wins", SA["wins"], SB["wins"], "hi"),
        ("Podiums", SA["podiums"], SB["podiums"], "hi"),
        ("Best finish", SA["best"], SB["best"], "lo"),
        ("Avg finish", SA["avg_finish"], SB["avg_finish"], "lo"),
        ("Avg grid", SA["avg_grid"], SB["avg_grid"], "lo"),
        ("DNFs", SA["dnfs"], SB["dnfs"], "lo"),
    ]
    n = len(metrics)
    for i, (lab, av, bv, better) in enumerate(metrics):
        y = 1 - (i + 0.5) / n
        awin = bwin = False
        if av is not None and bv is not None and av != bv:
            awin = (av > bv) if better == "hi" else (av < bv)
            bwin = not awin
        astr = "—" if av is None else (_sc_num(av) if lab in ("Points",) or isinstance(av, float) else str(av))
        bstr = "—" if bv is None else (_sc_num(bv) if lab in ("Points",) or isinstance(bv, float) else str(bv))
        ax.text(0.02, y, astr, ha="left", va="center", fontproperties=FP_MONO_B,
                fontsize=13.5 if awin else 12, color=colA if awin else SUBINK)
        ax.text(0.5, y, lab, ha="center", va="center", fontproperties=FP_BODY, fontsize=9.5, color=SUBINK)
        ax.text(0.98, y, bstr, ha="right", va="center", fontproperties=FP_MONO_B,
                fontsize=13.5 if bwin else 12, color=colB if bwin else SUBINK)
        if i < n - 1:
            ax.plot([0.03, 0.97], [1 - (i + 1) / n, 1 - (i + 1) / n], color=GRID, lw=0.8)

    # ── race / qualifying H2H strips (centre) ──
    def h2h_panel(rect, title, aAhead, bAhead, wins_seq):
        ax = fig.add_axes(rect)
        ax.set_facecolor(PAPER)
        ax.axis("off")
        ax.set_xlim(0, 1)
        ax.set_ylim(0, 1)
        _ra_ptitle(fig, rect[0], rect[1] + rect[3] + 0.014, title)
        ax.text(0.34, 0.78, str(aAhead), ha="center", va="center", color=colA, fontsize=34,
                fontproperties=FP_TITLE)
        ax.text(0.5, 0.78, "–", ha="center", va="center", color=SUBINK, fontsize=22, fontproperties=FP_TITLE_M)
        ax.text(0.66, 0.78, str(bAhead), ha="center", va="center", color=colB, fontsize=34,
                fontproperties=FP_TITLE)
        ax.text(0.5, 0.55, "rounds ahead", ha="center", va="center", color=SUBINK, fontsize=8.5,
                fontproperties=FP_MONO_B)
        if wins_seq:
            m = len(wins_seq)
            w = 0.86 / m
            for i, won in enumerate(wins_seq):
                x = 0.07 + 0.86 * i / m
                col = GRID if won is None else (colA if won else colB)
                ax.add_patch(plt.Rectangle((x, 0.18), w * 0.82, 0.20, color=col, zorder=3))
        return ax

    h2h_panel(R["race"], "Race · Head to Head", ra, rb, race_win)
    h2h_panel(R["quali"], "Qualifying · Head to Head", qa, qb, None)

    # ── finishing position by round ──
    rc = R["finish"]
    ax = fig.add_axes(rc)
    ax.set_facecolor(PAPER)
    _ra_ptitle(fig, rc[0], rc[1] + rc[3] + 0.014, "Finishing Position")
    maxpos = 1
    for S, col, ls in ((SA, colA, "-"), (SB, colB, (0, (5, 2)))):
        if S["finishes"]:
            xs = [r for r, _ in S["finishes"]]
            ys = [p for _, p in S["finishes"]]
            maxpos = max(maxpos, max(ys))
            ax.plot(xs, ys, color=col, lw=1.5, ls=ls, marker="o", ms=3.5, solid_capstyle="round")
    ax.set_ylim(maxpos + 0.6, 0.4)
    ax.grid(axis="y", color=GRID, linewidth=0.9)
    _ra_axstyle(ax, "Round", "Finish")
    if tall:
        ax.set_xlabel("")   # points panel below repeats the Round axis

    # ── points progression ──
    rc = R["points"]
    ax = fig.add_axes(rc)
    ax.set_facecolor(PAPER)
    _ra_ptitle(fig, rc[0], rc[1] + rc[3] + 0.014, "Points Progression")
    for S, col, ls in ((SA, colA, "-"), (SB, colB, (0, (5, 2)))):
        if S["series"]:
            xs = [r for r, _ in S["series"]]
            ys = [c for _, c in S["series"]]
            ax.plot(xs, ys, color=col, lw=1.6, ls=ls, solid_capstyle="round")
    ax.grid(axis="y", color=GRID, linewidth=0.9)
    _ra_axstyle(ax, "Round", "Points")

    kx, ky0 = key_xy
    for i, (code, col, dash) in enumerate(((A, colA, "solid"), (B, colB, "dashed"))):
        yk = ky0 - i * 0.026
        fig.add_artist(plt.Line2D([kx, kx + 0.03], [yk, yk], transform=fig.transFigure, color=col,
                       lw=2.4, ls="-" if i == 0 else (0, (5, 2)), solid_capstyle="round", zorder=11))
        fig.text(kx + 0.04, yk, f"{code} · {dash}", va="center", color=INK, fontsize=9,
                 fontproperties=FP_BODY_B)

    return fig_png(fig)


# ── Championship Story — the title fight so far (warehouse-backed) ────────────
def _wh_driver_standings(season, upto):
    rows = _wh_call("POST", "rpc/get_driver_standings",
                    json={"p_season": int(season), "p_round": int(upto)}, timeout=25)
    return rows if isinstance(rows, list) else None


def _wh_portraits(codes):
    """{CODE: F1-media portrait URL} for driver codes, from f1_driver.portrait_path
    (the 2026 full-body render, cropped to a head by fetch_headshot), else the
    legacy headshot_url. One batched request."""
    ucodes = sorted({str(c).upper() for c in codes if c})
    if not ucodes:
        return {}
    rows = _wh_call("GET", "f1_driver",
                    params={"code": f"in.({','.join(ucodes)})",
                            "select": "code,portrait_path,headshot_url"}, timeout=20)
    out = {}
    for row in rows or []:
        pp = row.get("portrait_path")
        out[row["code"]] = (f"{_MEDIA}/c_fill,w_720/q_auto/common/f1/{pp}"
                            if pp else row.get("headshot_url"))
    return out


def _wh_sprint_points(season, ergast_id, upto):
    """{round: sprint points} for one driver through `upto` (empty when none/unconfigured)."""
    rows = _wh_call("GET", "f1_sprint_result",
                    params={"season": f"eq.{int(season)}", "driver_id": f"eq.{ergast_id}",
                            "round": f"lte.{int(upto)}", "select": "round,points"}, timeout=20)
    out = {}
    for row in rows or []:
        try:
            out[int(row["round"])] = out.get(int(row["round"]), 0.0) + float(row.get("points") or 0)
        except (TypeError, ValueError, KeyError):
            continue
    return out


def _add_sprint_points(series, sprint_by_round):
    """Fold sprint points into a cumulative [(round, pts)] race-points series, so the
    championship line ends on the standings value (race + sprint)."""
    if not sprint_by_round:
        return series
    out, extra = [], 0.0
    for rnd, cum in series:
        extra += sum(p for r, p in sprint_by_round.items() if r == rnd)
        out.append((rnd, cum + extra))
    # sprint rounds with no race row (e.g. race not yet classified) still count at the end
    leftover = sum(p for r, p in sprint_by_round.items() if r not in {x for x, _ in series})
    if leftover and out:
        out[-1] = (out[-1][0], out[-1][1] + leftover)
    return out


def chart_championship(session, meta):
    """The championship after this round: driver standings table + points
    progression for the leaders. Warehouse-backed (ignores the session). Whole
    field, not driver-picked. 16:9 + a 9:16 story."""
    if FMT not in ("landscape", "twitter", "story"):
        return None
    season = int(meta.get("year"))
    upto = int(meta.get("round") or 99)
    standings = _wh_driver_standings(season, upto)
    if not standings:
        return None
    rows = []
    for s in standings:
        drv = s.get("Driver") or {}
        cons = (s.get("Constructors") or [{}])[0] or {}
        fam = drv.get("familyName") or ""
        giv = drv.get("givenName") or ""
        rows.append({
            "pts": float(s.get("points") or 0), "wins": int(float(s.get("wins") or 0)),
            "id": drv.get("driverId"), "code": drv.get("code") or fam[:3].upper(),
            "name": (f"{giv[:1]}. {fam}").strip(". ") or fam, "team": cons.get("name"),
        })
    if not rows:
        return None
    leader = rows[0]["pts"]

    # points progression (cumulative race points) for the top drivers
    prog = []
    for r in rows[:6]:
        if not r["id"]:
            continue
        res = _wh_season_results(season, r["id"])
        if res:
            ser = _sc_summary(res, upto)["series"]
            if ser:
                # get_driver_season_results is Grand Prix rows only; the table includes
                # sprint points, so add them or the line ends below the table value.
                ser = _add_sprint_points(ser, _wh_sprint_points(season, r["id"], upto))
                prog.append((r, ser))

    tall = FMT == "story"
    if tall:
        fig = plt.figure(figsize=(10.8, 19.2), dpi=200)
        R = {"table": [0.06, 0.470, 0.88, 0.385], "prog": [0.11, 0.050, 0.83, 0.330]}
        nrows = 12
    else:
        fig = plt.figure(figsize=(16, 9), dpi=200)
        R = {"table": [0.035, 0.075, 0.415, 0.745], "prog": [0.515, 0.095, 0.455, 0.720]}
        nrows = 14
    fig.patch.set_facecolor(PAPER)
    ex = meta.get("event", "")
    subtitle = f"through round {upto}" + (f" · {ex}" if ex else "")
    if tall:
        fig.add_artist(plt.Rectangle((0, 0), 0.011, 1, transform=fig.transFigure, color=RED, zorder=10))
        fig.text(0.06, 0.980, "   ".join("CHAMPIONSHIP"), color=RED, fontsize=13, fontproperties=FP_MONO_B, va="center")
        fig.text(0.058, 0.962, f"{season} Championship", color=INK, fontsize=30, fontproperties=FP_TITLE, va="center")
        fig.text(0.06 + _poster_flag(fig, meta.get("country"), 0.06, 0.948, 0.5), 0.948, subtitle,
                 color=SUBINK, fontsize=11, fontproperties=FP_BODY, va="center")
        _brand_mark(fig, True)
        fig.add_artist(plt.Line2D([0.055, 0.945], [0.900, 0.900], transform=fig.transFigure, color=GRID, lw=1.0))
    else:
        fig.add_artist(plt.Rectangle((0, 0), 0.007, 1, transform=fig.transFigure, color=RED, zorder=10))
        fig.text(0.035, 0.958, "   ".join("CHAMPIONSHIP"), color=RED, fontsize=11, fontproperties=FP_MONO_B, va="center")
        fig.text(0.034, 0.926, f"{season} Championship", color=INK, fontsize=25, fontproperties=FP_TITLE, va="center")
        fig.text(0.035 + _poster_flag(fig, meta.get("country"), 0.035, 0.893, 0.42), 0.893, subtitle,
                 color=SUBINK, fontsize=10, fontproperties=FP_BODY, va="center")
        _brand_mark(fig, False)
        fig.add_artist(plt.Line2D([0.033, 0.965], [0.872, 0.872], transform=fig.transFigure, color=GRID, lw=1.0))

    # ── standings table ──
    rc = R["table"]
    ax = fig.add_axes(rc)
    ax.set_facecolor(PAPER)
    ax.axis("off")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    _ra_ptitle(fig, rc[0], rc[1] + rc[3] + 0.012, "Drivers' Standings")
    N = min(nrows, len(rows))
    portraits = _wh_portraits([rows[i]["code"] for i in range(N)])
    h = 1.0 / N
    for i in range(N):
        r = rows[i]
        y = 1 - (i + 0.5) * h
        col = team_color(r["team"])
        ax.add_patch(plt.Rectangle((0.0, y - h / 2 + 0.004), 0.014, h - 0.008, color=col, zorder=3))
        lead = i == 0
        ax.text(0.05, y, str(i + 1), ha="right", va="center", fontproperties=FP_MONO_B,
                fontsize=11, color=GOLD if lead else SUBINK)
        disc = headshot_disc(portraits.get(r["code"]), col, size=150)
        if disc is not None:
            ax.add_artist(AnnotationBbox(OffsetImage(disc, zoom=0.18 if tall else 0.135),
                          (0.105, y), frameon=False, box_alignment=(0.5, 0.5), zorder=6))
        ax.text(0.175, y, r["code"], ha="left", va="center", fontproperties=FP_BODY_SB,
                fontsize=11.5, color=INK)
        ax.text(0.30, y, r["name"], ha="left", va="center", fontproperties=FP_BODY,
                fontsize=9.5, color=SUBINK)
        tlogo = fetch_team_logo(season, r["team"])
        if tlogo is not None:
            ax.add_artist(AnnotationBbox(OffsetImage(tlogo, zoom=0.2 if tall else 0.16),
                          (0.74, y), frameon=False, box_alignment=(1, 0.5), zorder=6))
        ax.text(0.86, y, _sc_num(r["pts"]), ha="right", va="center", fontproperties=FP_MONO_B,
                fontsize=12, color=INK)
        gap = "" if lead else f"−{_sc_num(leader - r['pts'])}"
        ax.text(0.995, y, gap or f"{r['wins']}W", ha="right", va="center", fontproperties=FP_MONO,
                fontsize=8.5, color=SUBINK)
        if i < N - 1:
            ax.plot([0.0, 1.0], [y - h / 2, y - h / 2], color=GRID, lw=0.6, zorder=1)

    # ── points progression ──
    rc = R["prog"]
    ax = fig.add_axes(rc)
    ax.set_facecolor(PAPER)
    _ra_ptitle(fig, rc[0], rc[1] + rc[3] + 0.012, "Points Progression · leaders")
    for r, ser in prog:
        xs = [rr for rr, _ in ser]
        ys = [cc for _, cc in ser]
        c = team_color(r["team"])
        ax.plot(xs, ys, color=c, lw=1.8, solid_capstyle="round")
        if xs:
            ax.annotate(r["code"], (xs[-1], ys[-1]), xytext=(5, 0), textcoords="offset points",
                        va="center", ha="left", fontsize=8, fontproperties=FP_BODY_B, color=c)
    ax.grid(axis="y", color=GRID, linewidth=0.9)
    _ra_axstyle(ax, "Round", "Points")

    return fig_png(fig)


# ── Constructor Season — the team battle + who is carrying each team ──────────
def _wh_constructor_standings(season, upto):
    rows = _wh_call("POST", "rpc/get_constructor_standings",
                    json={"p_season": int(season), "p_round": int(upto)}, timeout=25)
    return rows if isinstance(rows, list) else None


def chart_constructors(session, meta):
    """The constructors' championship after this round: standings table + each
    team's driver-contribution split (who is scoring the points). Warehouse-backed
    (ignores the session). Whole field, not driver-picked. 16:9 + a 9:16 story."""
    if FMT not in ("landscape", "twitter", "story"):
        return None
    season = int(meta.get("year"))
    upto = int(meta.get("round") or 99)
    cons = _wh_constructor_standings(season, upto)
    if not cons:
        return None
    crows = []
    for c in cons:
        cc = c.get("Constructor") or {}
        if cc.get("name"):
            crows.append({"name": cc["name"], "pts": float(c.get("points") or 0),
                          "wins": int(float(c.get("wins") or 0))})
    if not crows:
        return None
    leader = crows[0]["pts"]
    # group each team's drivers (code + points) for the contribution split
    by_team = {}
    for d in (_wh_driver_standings(season, upto) or []):
        cn = ((d.get("Constructors") or [{}])[0] or {}).get("name")
        drv = d.get("Driver") or {}
        code = drv.get("code") or (drv.get("familyName") or "")[:3].upper()
        if cn:
            by_team.setdefault(cn, []).append((code, float(d.get("points") or 0)))

    tall = FMT == "story"
    if tall:
        fig = plt.figure(figsize=(10.8, 19.2), dpi=200)
        R = {"table": [0.06, 0.500, 0.88, 0.355], "contrib": [0.15, 0.055, 0.80, 0.335]}
    else:
        fig = plt.figure(figsize=(16, 9), dpi=200)
        R = {"table": [0.035, 0.075, 0.415, 0.745], "contrib": [0.575, 0.09, 0.39, 0.72]}
    fig.patch.set_facecolor(PAPER)
    ex = meta.get("event", "")
    subtitle = f"through round {upto}" + (f" · {ex}" if ex else "")
    if tall:
        fig.add_artist(plt.Rectangle((0, 0), 0.011, 1, transform=fig.transFigure, color=RED, zorder=10))
        fig.text(0.06, 0.980, "   ".join("CONSTRUCTORS"), color=RED, fontsize=13, fontproperties=FP_MONO_B, va="center")
        fig.text(0.058, 0.962, f"{season} Constructors", color=INK, fontsize=30, fontproperties=FP_TITLE, va="center")
        fig.text(0.06 + _poster_flag(fig, meta.get("country"), 0.06, 0.948, 0.5), 0.948, subtitle,
                 color=SUBINK, fontsize=11, fontproperties=FP_BODY, va="center")
        _brand_mark(fig, True)
        fig.add_artist(plt.Line2D([0.055, 0.945], [0.900, 0.900], transform=fig.transFigure, color=GRID, lw=1.0))
    else:
        fig.add_artist(plt.Rectangle((0, 0), 0.007, 1, transform=fig.transFigure, color=RED, zorder=10))
        fig.text(0.035, 0.958, "   ".join("CONSTRUCTORS"), color=RED, fontsize=11, fontproperties=FP_MONO_B, va="center")
        fig.text(0.034, 0.926, f"{season} Constructors", color=INK, fontsize=25, fontproperties=FP_TITLE, va="center")
        fig.text(0.035 + _poster_flag(fig, meta.get("country"), 0.035, 0.893, 0.42), 0.893, subtitle,
                 color=SUBINK, fontsize=10, fontproperties=FP_BODY, va="center")
        _brand_mark(fig, False)
        fig.add_artist(plt.Line2D([0.033, 0.965], [0.872, 0.872], transform=fig.transFigure, color=GRID, lw=1.0))

    # ── constructor standings table ──
    rc = R["table"]
    ax = fig.add_axes(rc)
    ax.set_facecolor(PAPER)
    ax.axis("off")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    _ra_ptitle(fig, rc[0], rc[1] + rc[3] + 0.012, "Constructors' Standings")
    N = min(10, len(crows))
    h = 1.0 / N
    for i in range(N):
        c = crows[i]
        y = 1 - (i + 0.5) * h
        col = team_color(c["name"])
        ax.add_patch(plt.Rectangle((0.0, y - h / 2 + 0.004), 0.014, h - 0.008, color=col, zorder=3))
        lead = i == 0
        ax.text(0.055, y, str(i + 1), ha="right", va="center", fontproperties=FP_MONO_B,
                fontsize=11, color=GOLD if lead else SUBINK)
        logo = fetch_team_logo(season, c["name"])
        if logo is not None:
            ax.add_artist(AnnotationBbox(OffsetImage(logo, zoom=0.42 if tall else 0.34),
                          (0.085, y), frameon=False, box_alignment=(0, 0.5), zorder=6))
        else:
            ax.text(0.085, y, c["name"], ha="left", va="center", fontproperties=FP_BODY_SB,
                    fontsize=11, color=INK)
        ax.text(0.86, y, _sc_num(c["pts"]), ha="right", va="center", fontproperties=FP_MONO_B,
                fontsize=12, color=INK)
        gap = f"{c['wins']}W" if lead else f"−{_sc_num(leader - c['pts'])}"
        ax.text(0.995, y, gap, ha="right", va="center", fontproperties=FP_MONO, fontsize=8.5, color=SUBINK)
        if i < N - 1:
            ax.plot([0.0, 1.0], [y - h / 2, y - h / 2], color=GRID, lw=0.6, zorder=1)

    # ── driver contribution split ──
    rc = R["contrib"]
    ax = fig.add_axes(rc)
    ax.set_facecolor(PAPER)
    _ra_ptitle(fig, rc[0], rc[1] + rc[3] + 0.012, "Who's Scoring · driver split")
    teams = [c["name"] for c in crows[:N]]
    for i, name in enumerate(teams):
        ds = sorted(by_team.get(name, []), key=lambda x: -x[1])
        base = team_color(name)
        left = 0.0
        for j, (code, pts) in enumerate(ds[:2]):
            colr = base if j == 0 else _lighten(base, 0.5)
            ax.barh(i, pts, left=left, color=colr, height=0.64, edgecolor=PAPER, linewidth=1.0, zorder=3)
            if pts >= max(leader * 0.05, 6):
                ax.text(left + pts / 2, i, f"{code} {int(pts)}", ha="center", va="center",
                        fontsize=7.5, fontproperties=FP_MONO_B, color="#FFFFFF", zorder=5)
            left += pts
    team_y_labels(ax, teams, range(len(teams)), season, 8.5)
    ax.set_ylim(-0.7, len(teams) - 0.3)
    ax.invert_yaxis()
    ax.grid(axis="x", color=GRID, linewidth=0.9)
    ax.grid(axis="y", linewidth=0)
    _ra_axstyle(ax, "Points", None)

    return fig_png(fig)


# ── Circuit History — this track across the years (warehouse-backed) ──────────
def _wh_circuit_history(season, rnd):
    rows = _wh_call("POST", "rpc/get_circuit_history",
                    json={"p_season": int(season), "p_round": int(rnd)}, timeout=25)
    return rows if isinstance(rows, list) else None


def chart_circuit_history(session, meta):
    """This circuit across the years: per-edition winner + pole, and a 'most wins
    here' tally. Warehouse-backed (ignores the session). 16:9 + a 9:16 story."""
    if FMT not in ("landscape", "twitter", "story"):
        return None
    from collections import Counter
    season = int(meta.get("year"))
    rnd = int(meta.get("round") or 99)
    eds = _wh_circuit_history(season, rnd)
    eds = [e for e in (eds or []) if e.get("winner")]
    if len(eds) < 2:
        return None
    wins = Counter(e["winner"] for e in eds)
    wteam = {}
    for e in eds:
        if e["winner"] not in wteam and e.get("winner_team"):
            wteam[e["winner"]] = e["winner_team"]

    tall = FMT == "story"
    if tall:
        fig = plt.figure(figsize=(10.8, 19.2), dpi=200)
        R = {"eds": [0.06, 0.480, 0.88, 0.375], "tally": [0.13, 0.055, 0.82, 0.330]}
        nrows = 14
    else:
        fig = plt.figure(figsize=(16, 9), dpi=200)
        R = {"eds": [0.035, 0.075, 0.45, 0.745], "tally": [0.585, 0.09, 0.38, 0.72]}
        nrows = 15
    fig.patch.set_facecolor(PAPER)
    title = meta.get("event") or meta.get("circuit") or "Circuit"
    loc = meta.get("circuit") or meta.get("location") or ""
    subtitle = f"{len(eds)} editions · winners & poles" + (f" · {loc}" if loc and loc != title else "")
    if tall:
        fig.add_artist(plt.Rectangle((0, 0), 0.011, 1, transform=fig.transFigure, color=RED, zorder=10))
        fig.text(0.06, 0.980, "   ".join("CIRCUIT HISTORY"), color=RED, fontsize=13, fontproperties=FP_MONO_B, va="center")
        fig.text(0.058, 0.962, title, color=INK, fontsize=27, fontproperties=FP_TITLE, va="center")
        fig.text(0.06 + _poster_flag(fig, meta.get("country"), 0.06, 0.948, 0.5), 0.948, subtitle,
                 color=SUBINK, fontsize=11, fontproperties=FP_BODY, va="center")
        _brand_mark(fig, True)
        fig.add_artist(plt.Line2D([0.055, 0.945], [0.900, 0.900], transform=fig.transFigure, color=GRID, lw=1.0))
    else:
        fig.add_artist(plt.Rectangle((0, 0), 0.007, 1, transform=fig.transFigure, color=RED, zorder=10))
        fig.text(0.035, 0.958, "   ".join("CIRCUIT HISTORY"), color=RED, fontsize=11, fontproperties=FP_MONO_B, va="center")
        fig.text(0.034, 0.926, title, color=INK, fontsize=24, fontproperties=FP_TITLE, va="center")
        fig.text(0.035 + _poster_flag(fig, meta.get("country"), 0.035, 0.893, 0.42), 0.893, subtitle,
                 color=SUBINK, fontsize=10, fontproperties=FP_BODY, va="center")
        _brand_mark(fig, False)
        fig.add_artist(plt.Line2D([0.033, 0.965], [0.872, 0.872], transform=fig.transFigure, color=GRID, lw=1.0))

    # ── editions timeline ──
    rc = R["eds"]
    ax = fig.add_axes(rc)
    ax.set_facecolor(PAPER)
    ax.axis("off")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    _ra_ptitle(fig, rc[0], rc[1] + rc[3] + 0.012, "Every Edition · winner & pole")
    N = min(nrows, len(eds))
    portraits = _wh_portraits([eds[i]["winner"] for i in range(N)])
    h = 1.0 / N
    for i in range(N):
        e = eds[i]
        y = 1 - (i + 0.5) * h
        col = team_color(e.get("winner_team"))
        ax.add_patch(plt.Rectangle((0.0, y - h / 2 + 0.004), 0.012, h - 0.008, color=col, zorder=3))
        ax.text(0.04, y, str(e["season"]), ha="left", va="center", fontproperties=FP_MONO_B,
                fontsize=10.5, color=SUBINK)
        disc = headshot_disc(portraits.get(e["winner"]), col, size=150)
        if disc is not None:
            ax.add_artist(AnnotationBbox(OffsetImage(disc, zoom=0.19 if tall else 0.14),
                          (0.135, y), frameon=False, box_alignment=(0.5, 0.5), zorder=6))
        ax.text(0.20, y, e["winner"], ha="left", va="center", fontproperties=FP_BODY_SB,
                fontsize=11, color=INK)
        nm = e.get("winner_name") or ""
        ax.text(0.305, y, nm, ha="left", va="center", fontproperties=FP_BODY, fontsize=9, color=SUBINK)
        pole = e.get("pole")
        if pole:
            ax.text(0.995, y, f"pole {pole}", ha="right", va="center", fontproperties=FP_MONO,
                    fontsize=8.5, color=SUBINK)
        if i < N - 1:
            ax.plot([0.0, 1.0], [y - h / 2, y - h / 2], color=GRID, lw=0.6, zorder=1)

    # ── most wins here ──
    rc = R["tally"]
    ax = fig.add_axes(rc)
    ax.set_facecolor(PAPER)
    _ra_ptitle(fig, rc[0], rc[1] + rc[3] + 0.012, "Most Wins Here")
    top = wins.most_common(8)[::-1]
    for i, (code, n) in enumerate(top):
        ax.barh(i, n, color=team_color(wteam.get(code)), height=0.64, edgecolor=PAPER, linewidth=1.0, zorder=3)
        ax.text(n + 0.05, i, str(n), va="center", ha="left", fontsize=8.5, fontproperties=FP_MONO_B, color=INK)
    ax.set_yticks(range(len(top)))
    ax.set_yticklabels([c for c, _ in top], fontproperties=FP_BODY_B, color=INK, fontsize=9)
    ax.set_ylim(-0.7, len(top) - 0.3)
    ax.set_xlim(0, (max(n for _, n in top) if top else 1) * 1.16)
    ax.xaxis.set_major_locator(matplotlib.ticker.MaxNLocator(integer=True))
    ax.grid(axis="x", color=GRID, linewidth=0.9)
    ax.grid(axis="y", linewidth=0)
    _ra_axstyle(ax, "Wins", None)

    return fig_png(fig)


SECTOR_COLORS = ("#38BDF8", "#FBBF24", "#F472B6")  # S1 sky · S2 amber · S3 pink


def chart_sector_pace(session, meta):
    """Where the lap is won and lost — each driver's fastest lap split into sectors.

    The bar stacks *time lost* against the session's best in each sector, so its length
    is the gap to a theoretical perfect lap and each segment shows which sector cost it.
    Plotting raw sector times instead would make every bar near-identical (a ~90 s lap
    with ~0.3 s spreads), which is why deltas are used. Actual lap times are annotated so
    the absolute numbers are still there.
    """
    laps = session.laps
    rows = []
    for drv in session.drivers:
        dl = laps[laps["DriverNumber"] == drv]
        if dl.empty:
            continue
        code = dl["Driver"].iloc[0]
        if DRIVERS and code not in DRIVERS:
            continue
        lap = dl.pick_fastest()
        if lap is None or (hasattr(lap, "empty") and lap.empty):
            continue
        try:
            total = float(lap["LapTime"].total_seconds())
            secs = [float(lap[k].total_seconds()) for k in ("Sector1Time", "Sector2Time", "Sector3Time")]
        except Exception:
            continue
        if any(pd.isna(v) for v in [total, *secs]):
            continue
        rows.append({"code": code, "total": total, "secs": secs})

    if len(rows) < 2:
        return None

    best_sec = [min(r["secs"][i] for r in rows) for i in range(3)]
    best_total = min(r["total"] for r in rows)

    # Race/sprint: order by finishing position so the board reads like the result, not a
    # fastest-lap table (the winner rarely holds the quickest lap). Other sessions have no
    # finishing order, so they stay sorted by pace.
    finish = {}
    if str(getattr(session, "name", "")).lower() in ("race", "sprint"):
        try:
            for _, rr in session.results.iterrows():
                ab, p = rr.get("Abbreviation"), rr.get("Position")
                if ab is not None and pd.notna(p):
                    finish[str(ab)] = int(p)
        except Exception:
            finish = {}
    by_finish = bool(finish) and any(r["code"] in finish for r in rows)
    if by_finish:
        rows.sort(key=lambda r: (finish.get(r["code"], 9999), r["total"]))
    else:
        rows.sort(key=lambda r: r["total"])

    fig, ax = editorial_fig(left=0.10, right=0.88)
    title_block(
        fig, "Session pace", "Sector Pace",
        ("Fastest lap split by sector · ordered by finish — bar length is the gap to a perfect lap"
         if by_finish else
         "Time lost per sector vs the session's best — bar length is the gap to a perfect lap"),
    )

    for i, r in enumerate(rows):
        y = len(rows) - 1 - i  # fastest at the top
        left = 0.0
        for s in range(3):
            d = max(0.0, r["secs"][s] - best_sec[s])
            if d > 0:
                ax.barh(y, d, left=left, color=SECTOR_COLORS[s], height=0.62,
                        zorder=3, edgecolor=PAPER, linewidth=0.8)
            else:
                # Holds the session best here — mark it rather than drawing a zero bar.
                ax.plot(0.004, y, marker="o", markersize=4, color=PURPLE, zorder=4)
            left += d
        gap = r["total"] - best_total
        is_fastest = gap < 1e-9  # purple marks the fastest-lap holder, wherever it lands now
        label = fmt_laptime(r["total"]) + ("" if is_fastest else f"   +{gap:.3f}")
        ax.text(left + 0.012, y, label, va="center", ha="left", fontsize=9,
                fontproperties=FP_BODY_B, color=PURPLE if is_fastest else INK)

    ax.set_yticks(range(len(rows)))
    ax.set_yticklabels([r["code"] for r in reversed(rows)],
                       fontproperties=FP_BODY_B, color=INK, fontsize=10)
    ax.set_ylim(-0.8, len(rows) - 0.2)
    widest = max(sum(max(0.0, r["secs"][s] - best_sec[s]) for s in range(3)) for r in rows)
    ax.set_xlim(0, max(widest, 0.05) * 1.42)  # headroom for the lap-time labels
    ax.grid(axis="y", linewidth=0)
    ax.grid(axis="x", color=GRID, linewidth=1.0)
    clean_axes(ax, "Time lost vs best sector (s)", None)

    handles = [plt.Rectangle((0, 0), 1, 1, color=SECTOR_COLORS[s]) for s in range(3)]
    # Upper right: bars are sorted fastest-first so the top rows are shortest, leaving
    # that corner clear. "lower right" collides with the slowest drivers' labels.
    leg = ax.legend(handles, ["Sector 1", "Sector 2", "Sector 3"],
                    loc="upper right", frameon=False, fontsize=9, ncol=3)
    for t in leg.get_texts():
        t.set_color(INK)
        t.set_fontproperties(FP_BODY_B)

    footer(fig, meta)
    return fig_png(fig)


def _td_seconds(v):
    """A FastF1 Q1/Q2/Q3 timedelta (or NaT) → seconds, or None."""
    try:
        if v is None or pd.isna(v):
            return None
        return float(v.total_seconds())
    except Exception:  # noqa: BLE001
        return None


def chart_qualifying_breakdown(session, meta):
    """The qualifying classification, in full: every driver's Q1/Q2/Q3 time and the sector
    split of their best lap, grouped by how far they got.

    Reads the two things people actually want from a qualifying session and the pace charts
    don't give — the segment-by-segment progression (who improved, who was knocked out
    where) and where each lap's time sits across the three sectors. Purple marks the
    session best in each column. All drivers, split into the Q3 top ten, the Q2 knockouts
    and the Q1 knockouts by hairlines, mirroring the real timing screen.
    """
    res = getattr(session, "results", None)
    if res is None or res.empty:
        return None
    need = ("Abbreviation", "Position", "Q1", "Q2", "Q3")
    if any(c not in res.columns for c in need):
        return None

    # Best-lap sectors per driver code, from timing (Ergast has no sectors).
    sectors = {}
    try:
        laps = session.laps
        for drv in session.drivers:
            dl = laps[laps["DriverNumber"] == drv]
            if dl.empty:
                continue
            code = dl["Driver"].iloc[0]
            lap = dl.pick_fastest()
            if lap is None or (hasattr(lap, "empty") and lap.empty):
                continue
            try:
                secs = [float(lap[k].total_seconds())
                        for k in ("Sector1Time", "Sector2Time", "Sector3Time")]
                if not any(pd.isna(v) for v in secs):
                    sectors[code] = secs
            except Exception:  # noqa: BLE001
                pass
    except Exception:  # noqa: BLE001
        pass

    rows = []
    for _, r in res.iterrows():
        code = str(r.get("Abbreviation") or "").strip() or None
        try:
            pos = int(r.get("Position")) if not pd.isna(r.get("Position")) else None
        except (TypeError, ValueError):
            pos = None
        if not code or pos is None:
            continue
        if DRIVERS and code not in DRIVERS:
            continue
        rows.append({
            "code": code, "pos": pos,
            "q": [_td_seconds(r.get("Q1")), _td_seconds(r.get("Q2")), _td_seconds(r.get("Q3"))],
            "sec": sectors.get(code),
        })
    if len(rows) < 2:
        return None
    rows.sort(key=lambda x: x["pos"])

    # Fastest time in each Q column → purple; and the session-best in each sector.
    best_q = [min((r["q"][k] for r in rows if r["q"][k] is not None), default=None) for k in range(3)]
    sec_rows = [r["sec"] for r in rows if r["sec"]]
    best_sec = [min((s[k] for s in sec_rows), default=None) for k in range(3)] if sec_rows else [None] * 3

    # Knockout boundaries: Q3 is a fixed top ten; the Q1 cut is grid-size dependent so it
    # comes from who set a Q2 time (floored at the Q3 cut so the lines can't cross).
    n = len(rows)
    q3_cut = min(10, n)
    q2_cut = max(sum(1 for r in rows if r["q"][1] is not None), q3_cut)

    fig, ax = editorial_fig(left=0.075, right=0.965)
    title_block(fig, "Qualifying", "Qualifying Breakdown",
                "Q1 / Q2 / Q3 times and each driver's best-lap sector split — purple is session best")

    # x layout (axes fraction): rank · code · Q1 · Q2 · Q3 · sector bar.
    X_CODE, X_Q1, X_Q2, X_Q3 = 0.045, 0.20, 0.30, 0.40
    X_BAR0, X_BAR1 = 0.52, 0.99
    # Sector bars scale to the slowest best-lap so lengths are comparable across drivers.
    bar_max = max((sum(s) for s in sec_rows), default=1.0) or 1.0

    for i, r in enumerate(rows):
        y = n - 1 - i  # P1 at the top
        # rank + code, tinted for eliminated groups
        dim = r["pos"] > q3_cut
        ax.text(0.0, y, str(r["pos"]), va="center", ha="left", fontsize=9,
                fontproperties=FP_MONO_B, color=SUBINK if dim else INK)
        ax.text(X_CODE, y, r["code"], va="center", ha="left", fontsize=10,
                fontproperties=FP_BODY_B, color=INK)
        # Q1/Q2/Q3 times
        for k, x in enumerate((X_Q1, X_Q2, X_Q3)):
            v = r["q"][k]
            if v is None:
                ax.text(x, y, "—", va="center", ha="right", fontsize=8.5,
                        fontproperties=FP_MONO, color=SUBINK)
                continue
            is_best = best_q[k] is not None and abs(v - best_q[k]) < 1e-6
            ax.text(x, y, fmt_laptime(v), va="center", ha="right", fontsize=8.5,
                    fontproperties=FP_MONO_B if is_best else FP_MONO,
                    color=PURPLE if is_best else INK)
        # sector stacked bar of the best lap
        if r["sec"]:
            left = X_BAR0
            span = (X_BAR1 - X_BAR0)
            for k in range(3):
                w = span * (r["sec"][k] / bar_max)
                ax.add_patch(plt.Rectangle((left, y - 0.34), w, 0.68,
                             facecolor=SECTOR_COLORS[k], edgecolor=PAPER, linewidth=0.7,
                             zorder=3))
                # ring the segment if it holds the session best for that sector
                if best_sec[k] is not None and abs(r["sec"][k] - best_sec[k]) < 1e-6:
                    ax.add_patch(plt.Rectangle((left, y - 0.34), w, 0.68, facecolor="none",
                                 edgecolor=PURPLE, linewidth=1.6, zorder=4))
                left += w

    # Column headers (mounted just above the top row)
    hy = n - 0.35
    for x, lab, ha in ((X_CODE, "DRIVER", "left"), (X_Q1, "Q1", "right"),
                       (X_Q2, "Q2", "right"), (X_Q3, "Q3", "right"),
                       (X_BAR0, "BEST-LAP SECTORS", "left")):
        ax.text(x, hy, lab, va="bottom", ha=ha, fontsize=8,
                fontproperties=FP_MONO_B, color=SUBINK)

    # Knockout hairlines + group tags on the right margin
    for cut, tag in ((q3_cut, "Q3"), (q2_cut, "OUT Q2")):
        yl = n - cut - 0.5
        if 0 < cut < n:
            ax.plot([0.0, X_BAR1], [yl, yl], color=GRID, lw=1.2, zorder=2)

    ax.set_xlim(0, 1)
    ax.set_ylim(-0.7, n - 0.1 + 0.6)
    ax.set_xticks([])
    ax.set_yticks([])
    for side in ("top", "right", "bottom", "left"):
        ax.spines[side].set_visible(False)

    handles = [plt.Rectangle((0, 0), 1, 1, color=SECTOR_COLORS[k]) for k in range(3)]
    leg = ax.legend(handles, ["Sector 1", "Sector 2", "Sector 3"],
                    loc="lower right", frameon=False, fontsize=8, ncol=3,
                    bbox_to_anchor=(1.0, -0.06))
    for t in leg.get_texts():
        t.set_color(SUBINK)
        t.set_fontproperties(FP_BODY_B)

    footer(fig, meta)
    return fig_png(fig)


CHARTS = [
    ("qualifying_breakdown", "Qualifying Breakdown", "Q1/Q2/Q3 times and best-lap sectors for every driver", chart_qualifying_breakdown),
    ("sector_pace", "Sector Pace", "Each driver's fastest lap split by sector — where the time goes", chart_sector_pace),
    ("race_analysis", "Race Analysis", "The whole race story — strategy, pits, passes and pace on one board", chart_race_analysis),
    ("championship", "Championship", "The title fight so far — standings and points progression", chart_championship),
    ("constructors", "Constructor Season", "The team battle — standings and which driver is scoring", chart_constructors),
    ("circuit_history", "Circuit History", "This track across the years — winners, poles and most wins", chart_circuit_history),
    ("driver_compare", "Head to Head", "Two drivers' fastest laps — sector deltas, time gain/loss, speed, throttle and gears", chart_driver_compare),
    ("season_scorecard", "Season Scorecard", "Two drivers across the season so far — stats, race & quali H2H, form and points", chart_season_scorecard),
    ("position_changes", "Position Changes", "Track position through the race", chart_position_changes),
    ("parallax_stack", "Parallax Stack", "Top-three fastest laps stacked by pace", chart_parallax_stack),
    ("grid_flow", "Qualifying → Grid → Finish", "Driver flow from qualifying to the chequered flag", chart_grid_flow),
    ("gap_to_leader", "Gap to Leader", "Time behind the lead, lap by lap", chart_gap_to_leader),
    ("lap_down", "Lapped Drivers", "When each backmarker goes a lap down — laps-behind heatmap", chart_lap_down),
    ("lap_evolution", "Lap-Time Evolution", "Race pace through the stints", chart_lap_evolution),
    ("race_strategy", "Race Strategy Board", "Tyre stints, pit windows and track weather", chart_race_strategy),
    ("teammate_pace", "Teammate Distribution", "Teammate lap-time spread, side by side", chart_teammate_pace),
    ("teammate_laps", "Teammate Duel · Lap by Lap", "Each teammate's lap times through the race", chart_teammate_laps),
    ("top_speed", "Timing Line Speeds", "Best speed at each timing line, across every lap", chart_top_speed),
    ("driver_radar", "Driver Radar", "Performance profile of the top drivers", chart_driver_radar),
    ("track_dominance", "Track Dominance", "Where each driver is fastest, layered per driver", chart_dominance_stack),
    ("dominance_flat", "Track Dominance Map", "Fastest driver at each point of the lap", chart_dominance_flat),
    ("pace_tyre", "Race Pace by Tyre", "Lap-time distribution per team, coloured by compound", chart_pace_tyre),
    ("places_gained", "Places Gained & Lost", "Grid-to-finish position change per driver", chart_places_gained),
    ("speed_trace", "Speed Trace", "Fastest-lap speed vs distance for the top five", chart_speed_trace),
    ("speed_distribution", "Speed Distribution by Team", "Distribution of car speed per team", chart_speed_distribution),
    ("tyre_strategy", "Tyre Stints", "Compound usage per driver", chart_tyre_strategy),
    ("team_pace", "Gap to Fastest Team", "Median race-pace delta per team", chart_team_pace),
]


# ── which charts belong to which session ────────────────────────────────────
# Practice and qualifying have no race results, no grid flow and no pit strategy, so
# generating the full board there produced mostly empty or meaningless charts. Each
# session type gets the set that's actually worth looking at.
#
# Only applied to BULK generation. An explicit `--only` (how Deep Dive requests arrive)
# always wins, so a user can still ask for any chart on any session.
_PACE_CHARTS = {
    "sector_pace", "driver_compare", "speed_trace", "parallax_stack", "top_speed",
    "track_dominance", "dominance_flat", "speed_distribution", "driver_radar",
    "teammate_pace",
}
# Qualifying-format sessions (Q / sprint-quali / sprint-shootout) add the segment
# breakdown, which needs the Q1/Q2/Q3 classification — meaningless for practice or race.
_QUALI_CHARTS = _PACE_CHARTS | {"qualifying_breakdown"}
# Race/sprint add everything that needs results, stints, pit stops or grid positions,
# plus the season-level boards that are tied to a completed round.
_RACE_CHARTS = _PACE_CHARTS | {
    "race_analysis", "position_changes", "grid_flow", "gap_to_leader", "lap_evolution",
    "race_strategy", "teammate_laps", "pace_tyre", "places_gained", "tyre_strategy",
    "team_pace", "championship", "constructors", "circuit_history", "season_scorecard",
    "lap_down",
}
SESSION_CHARTS = {
    "FP1": _PACE_CHARTS, "FP2": _PACE_CHARTS, "FP3": _PACE_CHARTS,
    "Q": _QUALI_CHARTS, "SQ": _QUALI_CHARTS, "SS": _QUALI_CHARTS,
    "S": _RACE_CHARTS, "R": _RACE_CHARTS,
}


# Charts whose generator can LEGITIMATELY produce nothing for a healthy session (every
# `return None` path in the chart functions was read, not guessed). charts_todo treats a
# session as complete without these, otherwise a chart that never renders would keep the
# session "incomplete" and re-trigger a full FastF1 load every tick:
#   circuit_history    < 2 past editions at this track
#   season_scorecard   needs two --drivers picks; a bulk run has none
#   driver_compare     needs two drivers with fastest-lap telemetry
#   lap_down           nobody was lapped (e.g. red-flag-shortened race), or too few drivers
#   qualifying_breakdown  needs Q1/Q2/Q3 columns + >= 2 drivers with times
#   sector_pace        needs sector times for >= 2 drivers
#   top_speed          needs speed-trap data for >= 2 drivers
#   speed_distribution, track_dominance, dominance_flat
#                      each swallows per-lap car-data/telemetry errors (`except Exception:
#                      continue`) and returns None if < 2 teams/drivers (or no track
#                      geometry) survive — i.e. the session has no usable car data.
#                      speed_trace is NOT optional: it has no such swallow, so a None there
#                      (or a crash) means a real problem and must stay retried.
# Everything else renders for any loaded session of its type (or its absence is "not
# ingested yet", which SHOULD keep the session pending): championship and constructors
# return None only while the warehouse has no standings.
OPTIONAL_CHARTS = frozenset({
    "circuit_history", "season_scorecard", "driver_compare", "lap_down",
    "qualifying_breakdown", "sector_pace", "top_speed",
    "track_dominance", "dominance_flat", "speed_distribution",
})


def required_charts_for_session(session_code):
    """charts_for_session minus OPTIONAL_CHARTS — what a session must have to be complete."""
    return set(charts_for_session(session_code)) - OPTIONAL_CHARTS


def charts_for_session(session_code):
    """Chart keys worth generating for a session type (unknown codes get the full set)."""
    return SESSION_CHARTS.get((session_code or "R").upper(), _RACE_CHARTS)


# ── Supabase upload ─────────────────────────────────────────────────────────
def upload_png(path, png):
    """Upload a chart image to R2 under charts/{path}; returns its public URL.

    Standings-backed charts are re-rendered in place when standings change (BUG-003), so
    they must not carry the year-long immutable cache header the CDN would keep serving."""
    ctype = "image/webp" if path.endswith(".webp") else "image/png"
    name = path.rsplit("/", 1)[-1].split(".")[0]
    if name in standings_fp.STANDINGS_CHARTS:
        return bs.put("charts", path, png, ctype, cache_control="public, max-age=600")
    return bs.put("charts", path, png, ctype)


def standings_fingerprint(season, upto):
    """Fingerprint of the standings the standings charts are drawn from (None if unknown)."""
    d = _wh_driver_standings(season, upto)
    c = _wh_constructor_standings(season, upto)
    if not d or not c:
        return None
    return standings_fp.fingerprint(d, c)


def upsert_index(row):
    """Secondary copy of the chart row in Postgres — best effort (see db_index.py).
    The CDN index (index_export.py) is rebuilt from R2 at the end of every workflow."""
    db_index.upsert("analysis_charts", "season,round,session,chart_type,theme", row, timeout=30)


def existing_chart_keys(season, rnd, session):
    """(chart_type, theme) pairs already published for this session.

    One R2 listing up front lets --skip-existing avoid re-rendering charts that are
    already on the CDN — no database involved. A row only counts as done once it also
    has a thumbnail, so pre-thumbnail history gets re-rendered once (master + thumb).
    On any read failure it returns an empty set — fail open and render everything,
    never silently skip real work.
    """
    try:
        return index_export.chart_variants(season, rnd, session, require_thumb=True)
    except Exception as e:  # noqa: BLE001 — never let a read error skip real work
        print(f"  (skip-existing: R2 listing failed {e} — rendering all)")
        return set()


@retry_fastf1
def latest_completed_round(year):
    sched = fastf1.get_event_schedule(year, include_testing=False)
    now = pd.Timestamp.now(tz="UTC").tz_localize(None)
    col = "Session5DateUtc" if "Session5DateUtc" in sched.columns else "EventDate"
    past = sched[pd.to_datetime(sched[col]).dt.tz_localize(None) < now]
    return None if past.empty else int(past.iloc[-1]["RoundNumber"])


def run_strategy_history(args):
    from collections import Counter
    if not args.event:
        print("--strategy-history requires --event (e.g. --event Austria)")
        return 1
    years_data = []
    ename = None
    country = None
    location = None
    yy = args.season
    tries = 0
    print(f"Building strategy history for '{args.event}' ...")
    while len(years_data) < args.years and tries < args.years + 7:
        tries += 1
        try:
            s = fastf1.get_session(yy, args.event, "R")
            s.load(telemetry=False, weather=True, messages=False)
            laps, res = s.laps, s.results
            if laps is None or len(laps) == 0 or res is None or len(res) == 0:
                yy -= 1
                continue
            win = res.iloc[0]
            winner, wteam = win.get("Abbreviation"), win.get("TeamName")
            wl = laps[laps["Driver"] == winner].sort_values("LapNumber")
            stints = []
            for _, st in wl.groupby("Stint"):
                comp = str(st["Compound"].iloc[0]).upper()
                start = int(st["LapNumber"].min())
                stints.append((comp, start, int(st["LapNumber"].max() - start + 1)))
            if not stints:
                yy -= 1
                continue
            spd = laps.groupby("Driver")["Stint"].nunique() - 1
            mix = dict(Counter(int(x) for x in spd.dropna() if x >= 0))
            wx = getattr(s, "weather_data", None)
            has_wx = wx is not None and len(wx)
            years_data.append({
                "year": yy, "winner": winner, "winner_color": team_color(wteam),
                "stints": stints, "stops": len(stints) - 1, "mix": mix,
                "avg": float(spd.mean()),
                "track_temp": float(wx["TrackTemp"].mean()) if has_wx else None,
                "wet": bool(wx["Rainfall"].astype(bool).mean() > 0.1) if has_wx and "Rainfall" in wx else False,
                "total_laps": int(laps["LapNumber"].max()),
            })
            ev = s.event
            ename = ename or ev.get("EventName")
            country = country or ev.get("Country")
            location = location or ev.get("Location")
            print(f"  {yy}: {winner} won, {len(stints) - 1}-stop")
        except Exception as e:  # noqa: BLE001
            print(f"  {yy}: skipped ({e})")
        yy -= 1
    if len(years_data) < 2:
        print("Not enough editions with data.")
        return 1
    title = ename or args.event
    meta = {"event": title, "year": years_data[0]["year"], "round": 0,
            "session_name": "Race", "country": country, "location": location,
            "circuit": location}
    fmt_sets = {"landscape": ["landscape"], "twitter": ["twitter"],
                "instagram": ["instagram"], "story": ["story"],
                "both": ["landscape", "story"],
                "all": ["landscape", "twitter", "instagram", "story"]}
    slug = re.sub(r"[^A-Za-z0-9]+", "-", str(location or args.event)).strip("-")
    global FMT
    ok = 0
    for fmt in fmt_sets[args.format]:
        FMT = fmt
        try:
            png = chart_strategy_history(years_data, title, meta)
        except Exception as e:  # noqa: BLE001
            print(f"  ! {fmt} failed: {e}")
            traceback.print_exc()
            continue
        if not png:
            continue
        outdir = os.path.join("out", f"{years_data[0]['year']}", f"history-{slug}", fmt)
        os.makedirs(outdir, exist_ok=True)
        with open(os.path.join(outdir, "strategy_history.png"), "wb") as f:
            f.write(png)
        print(f"  - {fmt}/strategy_history: {len(png) // 1024} KB")
        ok += 1
    print(f"Done. {ok} charts in out/{years_data[0]['year']}/history-{slug}/")
    return 0


EXIT_OK, EXIT_FAIL, EXIT_ABSENT = 0, 1, 2


def only_laps_optional(args):
    """An explicit --only request may target session-independent (warehouse) charts, so
    the "no laps" short-circuit is applied to bulk runs only."""
    return bool(args.only)


def select_exit_code(failed, nodata, rendered):
    """Exit status for a chart run. Any failed chart -> 1. Otherwise, if every chart
    that was attempted hit a definitive "no data" and none rendered -> 2 (data not
    available yet). Otherwise 0 (including 'nothing to do')."""
    if failed:
        return EXIT_FAIL
    if nodata and not rendered:
        return EXIT_ABSENT
    return EXIT_OK


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", type=int, default=pd.Timestamp.now(tz="UTC").year)
    ap.add_argument("--round", type=int)
    ap.add_argument("--event", help="Race name, e.g. 'Monaco' or 'Bahrain' (instead of --round)")
    ap.add_argument("--session", default="R",
                      choices=["FP1", "FP2", "FP3", "Q", "SQ", "SS", "S", "R"])
    ap.add_argument("--only", help="comma-separated chart keys to render (default: all)")
    ap.add_argument("--latest", action="store_true")
    ap.add_argument("--no-upload", action="store_true")
    ap.add_argument("--format", default="landscape",
                    choices=["landscape", "twitter", "instagram", "story", "both", "all"],
                    help="output size: landscape 16:9, twitter 16:9, instagram 4:5, "
                         "story 9:16, both (landscape+story), or all four")
    ap.add_argument("--theme", default="dark",
                    choices=["dark", "light", "all"],
                    help="colour theme(s): dark (default), light, or both — the frontend "
                         "serves the one matching the viewer's theme (glass mode uses dark)")
    ap.add_argument("--team-labels", default="logo", choices=["text", "logo"],
                    help="team y-axis labels: team logos (default) or text names")
    ap.add_argument("--drivers", help="comma-separated driver codes to feature in "
                    "driver charts, e.g. HAM,LEC,RUS,ANT,NOR")
    ap.add_argument("--strategy-history", action="store_true",
                    help="multi-year strategy infographic for --event over the last ~5 editions")
    ap.add_argument("--years", type=int, default=5, help="how many past editions for --strategy-history")
    ap.add_argument("--skip-existing", action="store_true",
                    help="skip charts already in the index instead of re-rendering them "
                         "— the big Actions-minutes saver: repeated runs then only draw "
                         "NEW sessions/charts. A completed round's data is final, so its "
                         "charts never change. Omit it to force a full re-render.")
    args = ap.parse_args()

    cache = os.environ.get("FASTF1_CACHE", ".fastf1cache")
    os.makedirs(cache, exist_ok=True)
    fastf1.Cache.enable_cache(cache)

    if args.strategy_history:
        return run_strategy_history(args)

    rnd = args.round
    if args.event:
        try:
            ev_row = fastf1.get_event(args.season, args.event)
            rnd = int(ev_row["RoundNumber"])
            print(f"Matched '{args.event}' -> {ev_row['EventName']} (round {rnd})")
        except Exception as e:
            print(f"Could not match event '{args.event}': {e}")
            return 1
    if args.latest or rnd is None:
        rnd = latest_completed_round(args.season)
        if rnd is None:
            print("No completed race found.")
            return 0

    print(f"Loading {args.season} R{rnd} {args.session} ...")
    session = None
    try:
        @retry_fastf1
        def load_session():
            s = fastf1.get_session(args.season, rnd, args.session)
            s.load()
            return s
        session = load_session()
    except Exception as e:
        if is_absent(e):
            # e.g. Sprint on a non-sprint round, or a round that hasn't run yet.
            print(f"  session {args.session} not available for {args.season} R{rnd} ({e})")
            return EXIT_ABSENT
        print(f"  ! session {args.session} failed to load for {args.season} R{rnd}: {e}")
        traceback.print_exc()
        return EXIT_FAIL
    if not only_laps_optional(args):
        try:
            laps = session.laps
            has_laps = laps is not None and len(laps) > 0
        except Exception as e:  # noqa: BLE001
            if not is_absent(e):
                print(f"  ! could not read laps for {args.season} R{rnd}: {e}")
                return EXIT_FAIL
            has_laps = False
        if not has_laps:
            print(f"  session {args.session} loaded but has no lap data yet for {args.season} R{rnd}")
            return EXIT_ABSENT
    init_dynamic_styles(session)
    ev = session.event
    circuit = None
    try:
        from fastf1.ergast import Ergast

        @retry_fastf1
        def get_circuit_info():
            circuits = Ergast().get_circuits(season=args.season, round=rnd)
            if len(circuits):
                return circuits.iloc[0].get("circuitName")
            return None

        circuit = get_circuit_info()
    except Exception:
        circuit = None
    meta = {"event": ev["EventName"], "year": args.season, "round": rnd,
            "session_name": getattr(session, "name", args.session),
            "country": ev.get("Country"), "location": ev.get("Location"),
            "circuit": circuit}

    slug = re.sub(r"[^A-Za-z0-9]+", "-", str(ev["EventName"])).strip("-")
    fmt_sets = {
        "landscape": ["landscape"], "twitter": ["twitter"],
        "instagram": ["instagram"], "story": ["story"],
        "both": ["landscape", "story"],
        "all": ["landscape", "twitter", "instagram", "story"],
    }
    ratios = {"landscape": "16:9", "twitter": "16:9", "instagram": "4:5", "story": "9:16"}

    global FMT, TEAM_LABELS, DRIVERS
    TEAM_LABELS = args.team_labels
    DRIVERS = {d.strip().upper() for d in args.drivers.split(",")} if args.drivers else None
    only_set = {c.strip() for c in args.only.split(",")} if args.only else None
    if DRIVERS:
        print(f"Featuring drivers: {', '.join(sorted(DRIVERS))}")

    theme_set = ["dark", "light"] if args.theme == "all" else [args.theme]

    # --skip-existing: fetch what's already published once, so the per-chart loop
    # can skip the expensive render for charts that exist. Turns a repeated bulk
    # run (re-drawing every session for ~an hour) into "only draw what's new".
    existing = set()
    if args.skip_existing and not args.no_upload:
        existing = existing_chart_keys(args.season, rnd, args.session)
        print(f"skip-existing: {len(existing)} charts already indexed for this session")

    ok = 0
    failed, nodata, rendered = [], 0, 0
    # Theme is the outer loop, format the inner: the session is already loaded, so each
    # theme only re-renders (cheap) — no extra data fetch. dark keeps the original,
    # theme-less storage path so existing links stay valid; light gets a /light/
    # segment so its files sit alongside without clobbering.
    for theme in theme_set:
        apply_theme(theme)
        theme_seg = "" if theme == "dark" else f"{theme}/"
        for fmt in fmt_sets[args.format]:
            FMT = fmt
            # out/<year>/<round>-<Grand Prix>/<session>/[<theme>/]<format>/<chart>.png
            base = f"{args.season}/{rnd:02d}-{slug}/{args.session}/{theme_seg}{fmt}"
            # A custom driver selection gets a stable key suffix (sorted codes) so it
            # never clobbers the default charts and can be de-duplicated downstream
            # (same drivers -> same key -> same storage path + index row).
            dk = ("__" + "-".join(sorted(DRIVERS))) if DRIVERS else ""
            print(f"== {theme} · {fmt} ({ratios[fmt]}) ==")
            allowed = charts_for_session(args.session)
            for ctype, title, desc, fn in CHARTS:
                if only_set and ctype not in only_set:
                    continue
                # Bulk run: skip charts that don't apply to this session type. An explicit
                # --only bypasses this so on-demand requests still work anywhere.
                if not only_set and ctype not in allowed:
                    continue
                # Index key (encodes format + driver selection). Computed before the
                # render so --skip-existing avoids the expensive draw entirely.
                ct = (ctype if fmt == "landscape" else f"{ctype}_{fmt}") + dk
                # Standings charts are never skipped: they are cheap and must follow
                # standings corrections (BUG-003); charts_todo re-queues on a changed fingerprint.
                if args.skip_existing and ctype not in standings_fp.STANDINGS_CHARTS:
                    if not args.no_upload and (ct, theme) in existing:
                        print(f"  - {theme}/{fmt}/{ctype}: exists, skipped")
                        continue
                    if args.no_upload and os.path.exists(
                            os.path.join("out", base, f"{ctype}{dk}.png")):
                        print(f"  - {fmt}/{ctype}: exists (local), skipped")
                        continue
                try:
                    png = fn(session, meta)
                    if not png:
                        print(f"  - {fmt}/{ctype}: no data, skipped")
                        continue
                    rendered += 1
                    path = f"{base}/{ctype}{dk}.png"
                    if args.no_upload:
                        outdir = os.path.join("out", base)
                        os.makedirs(outdir, exist_ok=True)
                        # keep the driver-key suffix locally too, so different --drivers
                        # sets don't overwrite each other (matches the upload path).
                        with open(os.path.join(outdir, f"{ctype}{dk}.png"), "wb") as f:
                            f.write(png)
                        if getattr(png, "thumb", None):
                            with open(os.path.join(outdir, f"{ctype}{dk}.thumb.webp"), "wb") as f:
                                f.write(png.thumb)
                        print(f"  - {fmt}/{ctype}{dk}: {len(png) // 1024} KB")
                    else:
                        # Label a driver/teammate compare by its pair so multiple
                        # driver_compare cards are distinguishable in Deep Dive.
                        row_title = (f"{title} · {' vs '.join(sorted(DRIVERS))}"
                                     if DRIVERS and ctype == "driver_compare" else title)
                        public_url = upload_png(path, png)
                        thumb = getattr(png, "thumb", None)
                        thumb_path = f"{base}/{ctype}{dk}.thumb.webp" if thumb else None
                        if thumb_path:
                            upload_png(thumb_path, thumb)
                        upsert_index({"season": args.season, "round": rnd, "session": args.session,
                                      "chart_type": ct, "theme": theme,
                                      "title": row_title, "description": desc,
                                      "storage_path": path, "public_url": public_url,
                                      "thumb_path": thumb_path,
                                      "updated_at": pd.Timestamp.now(tz="UTC").isoformat()})
                        print(f"  - {theme}/{fmt}/{ctype}: uploaded")
                        ok += 1
                except Exception as e:  # noqa: BLE001
                    # A session that hasn't run yet (or has no published timing) still
                    # loads, it just has no laps — so every lap-dependent chart raises
                    # DataNotLoadedError. That's an expected "nothing to draw", not a
                    # defect. Report it in one line; a traceback per chart per format
                    # buries the real errors under a hundred identical stacks.
                    if is_absent(e):
                        print(f"  - {fmt}/{ctype}: no lap data, skipped")
                        nodata += 1
                    else:
                        print(f"  ! {theme}/{fmt}/{ctype} failed: {e}")
                        traceback.print_exc()
                        failed.append(f"{theme}/{fmt}/{ctype}")

    # BUG-003: record which standings the standings charts were drawn from, next to them,
    # so charts_todo can re-queue this session when the standings are later corrected.
    if args.session in ("R", "S") and (only_set is None or only_set & set(standings_fp.STANDINGS_CHARTS)):
        try:
            fp = standings_fingerprint(args.season, rnd)
        except Exception as e:  # noqa: BLE001 — a missing fingerprint only means "re-check"
            fp = None
            print(f"  (standings fingerprint unavailable: {e})")
        if fp:
            fp_path = f"{args.season}/{rnd:02d}-{slug}/{args.session}/{standings_fp.FP_NAME}"
            if args.no_upload:
                os.makedirs(os.path.dirname(os.path.join("out", fp_path)), exist_ok=True)
                with open(os.path.join("out", fp_path), "w") as f:
                    f.write(fp)
            else:
                bs.put("charts", fp_path, fp.encode(), "text/plain", cache_control="no-cache")
            print(f"  standings fingerprint {fp[:10]} -> {fp_path}")

    code = select_exit_code(failed, nodata, rendered)
    print(f"Done. {ok} charts uploaded, {rendered} rendered, {len(failed)} failed "
          f"({args.season}/{rnd:02d}-{slug}/{args.session}) -> exit {code}")
    if failed:
        print("Failed charts: " + ", ".join(failed))
    return code


if __name__ == "__main__":
    sys.exit(main())
