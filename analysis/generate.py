#!/usr/bin/env python3
"""
FastF1 analysis generator for f1datastop — publication-quality, shareable
infographics (editorial 'paper' aesthetic, not dark/analytical).

Uploads PNGs to the Supabase `charts` bucket and upserts `analysis_charts`.
Env for upload: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

Usage:
  python generate.py --season 2024 --round 1 --session R --no-upload   # local
  python generate.py --latest                                          # CI
"""
import argparse
import io
import os
import re
import sys
import traceback

import fastf1
import matplotlib
import numpy as np
import pandas as pd
import requests

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

HERE = os.path.dirname(os.path.abspath(__file__))

# ── Palette (F1 DataStop — dark Pit Wall, red signature) ────────────────────
PAPER = "#0A0B0F"     # ≈ app --background (240 8% 3.5%)
PANEL = "#14161C"     # ≈ app --card / raised surface
INK = "#F2F3F5"       # ≈ app --foreground (220 15% 96%)
SUBINK = "#9A9CA6"    # ≈ app --muted-foreground (240 6% 64%)
GRID = "#23262E"      # ≈ app --border
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
    fig.patch.set_facecolor(PAPER)
    b, h = L["ax"]
    ax = fig.add_axes([left, b, right - left, h])
    ax.set_facecolor(PAPER)
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


def fetch_headshot(url):
    if not url or not isinstance(url, str):
        return None
    if url in _HEADSHOT_CACHE:
        return _HEADSHOT_CACHE[url]
    try:
        r = requests.get(url, timeout=12)
        r.raise_for_status()
        img = Image.open(BytesIO(r.content)).convert("RGBA")
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
        _HEADSHOT_CACHE[url] = img
        return img
    except Exception:
        _HEADSHOT_CACHE[url] = None
        return None


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
    if url in _IMG_CACHE:
        return _IMG_CACHE[url]
    arr = None
    try:
        r = requests.get(url, timeout=12)
        if r.ok:
            arr = np.asarray(Image.open(io.BytesIO(r.content)).convert("RGBA"))
    except Exception:
        arr = None
    _IMG_CACHE[url] = arr
    return arr


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
    if iso in _FLAG_CACHE:
        return _FLAG_CACHE[iso]
    arr = None
    try:
        r = requests.get(f"https://flagcdn.com/w40/{iso}.png", timeout=8)
        if r.ok:
            arr = np.asarray(Image.open(io.BytesIO(r.content)).convert("RGBA"))
    except Exception:
        arr = None
    _FLAG_CACHE[iso] = arr
    return arr


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
            fig.text(xx, yy, "f1datastop.com", color="#FFFFFF", alpha=0.015, fontsize=8.5,
                     fontproperties=FP_BODY, rotation=16, ha="left", va="center", zorder=20)


def fig_png(fig):
    add_watermark(fig)
    buf = io.BytesIO()
    fig.savefig(buf, format="png", facecolor=PAPER, dpi=200, bbox_inches=None, pad_inches=0)
    plt.close(fig)
    return buf.getvalue()


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
    for drv in top_drivers_by_pace(laps, 5):
        dl = laps[laps["Driver"] == drv]
        if dl.empty:
            continue
        lap = dl.pick_fastest()
        if lap is None or (hasattr(lap, "empty") and lap.empty):
            continue
        tel = lap.get_car_data().add_distance()
        c = team_color(lap["Team"])
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
                   edgecolor="white", linewidth=1.4)
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
        ax.scatter([m_slow], [i - 0.15], s=46, color="#FFFFFF", edgecolor=col, lw=1.7, zorder=6)
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
                       edgecolor="#FFFFFF", lw=0.9, zorder=6)
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


def neon_lines(ax, segs, array=None, colors=None, cmap=None, lw=8):
    """Line segments with a neon glow halo (trendy 'pulse' look)."""
    for glw, ga in ((lw * 3.6, 0.06), (lw * 2.5, 0.09), (lw * 1.6, 0.13)):
        g = LineCollection(segs, linewidths=glw, capstyle="round", joinstyle="round", alpha=ga)
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


def chart_top_speed(session, meta):
    laps = session.laps
    rows = []
    for drv in session.drivers:
        dl = laps[laps["DriverNumber"] == drv]
        if dl.empty:
            continue
        if DRIVERS and dl["Driver"].iloc[0] not in DRIVERS:
            continue
        lap = dl.pick_fastest()
        if lap is None or (hasattr(lap, "empty") and lap.empty):
            continue
        try:
            spd = float(lap.get_car_data()["Speed"].max())
        except Exception:
            continue
        rows.append((dl["Driver"].iloc[0], team_color(dl["Team"].iloc[0]), spd))
    if not rows:
        return None
    rows.sort(key=lambda r: r[2])
    fig, ax = editorial_fig(left=0.10)
    title_block(fig, "Telemetry", "Top Speed", "Highest speed reached · fastest lap")
    for i, (code, c, spd) in enumerate(rows):
        ax.barh(i, spd, color=c, height=0.62, zorder=3, edgecolor=PAPER, linewidth=1.0)
        ax.text(spd - 2, i, f"{spd:.0f}", va="center", ha="right", fontsize=10,
                fontproperties=FP_BODY_B, color="#FFFFFF")
    ax.set_yticks(range(len(rows)))
    ax.set_yticklabels([r[0] for r in rows], fontproperties=FP_BODY_B, color=INK, fontsize=10)
    ax.set_xlim(left=min(r[2] for r in rows) - 18)
    ax.grid(axis="y", linewidth=0)
    ax.grid(axis="x", color=GRID, linewidth=1.0)
    clean_axes(ax, "Speed (km/h)", None)
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
        drivers.append((drv, team_color(dl["Team"].iloc[0])))
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
        ax.add_collection(LineCollection(segs, colors="#34383F", linewidths=4.0 + 1.5 * frac,
                          capstyle="round", zorder=10 * k + 2))
        wmask = winner[:-1] == di
        if wmask.any():
            neon_lines(ax, segs[wmask], colors=[col] * int(wmask.sum()), lw=6.0 + 2.0 * frac)
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
        drivers.append((drv, team_color(dl["Team"].iloc[0])))
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
    ax.add_collection(LineCollection(segs, colors=GRID, linewidths=15,
                      capstyle="round", joinstyle="round", zorder=1))
    neon_lines(ax, segs, colors=seg_cols, lw=9.0)
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

    # weather strip, aligned to the lap axis
    wx = getattr(session, "weather_data", None)
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
        lc = neon_lines(ax, segs, array=speeds[di][:-1], cmap="inferno", lw=6.0 + 2.5 * frac)
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


CHARTS = [
    ("position_changes", "Position Changes", "Track position through the race", chart_position_changes),
    ("parallax_stack", "Parallax Stack", "Top-three fastest laps stacked by pace", chart_parallax_stack),
    ("grid_flow", "Qualifying → Grid → Finish", "Driver flow from qualifying to the chequered flag", chart_grid_flow),
    ("gap_to_leader", "Gap to Leader", "Time behind the lead, lap by lap", chart_gap_to_leader),
    ("lap_evolution", "Lap-Time Evolution", "Race pace through the stints", chart_lap_evolution),
    ("race_strategy", "Race Strategy Board", "Tyre stints, pit windows and track weather", chart_race_strategy),
    ("teammate_pace", "Teammate Distribution", "Teammate lap-time spread, side by side", chart_teammate_pace),
    ("teammate_laps", "Teammate Duel · Lap by Lap", "Each teammate's lap times through the race", chart_teammate_laps),
    ("top_speed", "Top Speed", "Highest speed per driver on the fastest lap", chart_top_speed),
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


# ── Supabase upload ─────────────────────────────────────────────────────────
def upload_png(path, png):
    url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    r = requests.post(
        f"{url}/storage/v1/object/charts/{path}",
        headers={"Authorization": f"Bearer {key}", "apikey": key,
                 "Content-Type": "image/png", "x-upsert": "true"},
        data=png, timeout=60,
    )
    if not r.ok:
        raise RuntimeError(f"upload {path} failed {r.status_code}: {r.text}")
    return f"{url}/storage/v1/object/public/charts/{path}"


def upsert_index(row):
    url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    r = requests.post(
        f"{url}/rest/v1/analysis_charts?on_conflict=season,round,session,chart_type",
        headers={"Authorization": f"Bearer {key}", "apikey": key,
                 "Content-Type": "application/json",
                 "Prefer": "resolution=merge-duplicates,return=minimal"},
        json=row, timeout=30,
    )
    if not r.ok:
        raise RuntimeError(f"index upsert failed {r.status_code}: {r.text}")


def latest_completed_round(year):
    sched = fastf1.get_event_schedule(year, include_testing=False)
    now = pd.Timestamp.utcnow().tz_localize(None)
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", type=int, default=pd.Timestamp.utcnow().year)
    ap.add_argument("--round", type=int)
    ap.add_argument("--event", help="Race name, e.g. 'Monaco' or 'Bahrain' (instead of --round)")
    ap.add_argument("--session", default="R")
    ap.add_argument("--only", help="comma-separated chart keys to render (default: all)")
    ap.add_argument("--latest", action="store_true")
    ap.add_argument("--no-upload", action="store_true")
    ap.add_argument("--format", default="landscape",
                    choices=["landscape", "twitter", "instagram", "story", "both", "all"],
                    help="output size: landscape 16:9, twitter 16:9, instagram 4:5, "
                         "story 9:16, both (landscape+story), or all four")
    ap.add_argument("--team-labels", default="logo", choices=["text", "logo"],
                    help="team y-axis labels: team logos (default) or text names")
    ap.add_argument("--drivers", help="comma-separated driver codes to feature in "
                    "driver charts, e.g. HAM,LEC,RUS,ANT,NOR")
    ap.add_argument("--strategy-history", action="store_true",
                    help="multi-year strategy infographic for --event over the last ~5 editions")
    ap.add_argument("--years", type=int, default=5, help="how many past editions for --strategy-history")
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
    session = fastf1.get_session(args.season, rnd, args.session)
    session.load()
    init_dynamic_styles(session)
    ev = session.event
    circuit = None
    try:
        from fastf1.ergast import Ergast
        circuits = Ergast().get_circuits(season=args.season, round=rnd)
        if len(circuits):
            circuit = circuits.iloc[0].get("circuitName")
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

    ok = 0
    for fmt in fmt_sets[args.format]:
        FMT = fmt
        # out/<year>/<round>-<Grand Prix>/<session>/<format>/<chart>.png
        base = f"{args.season}/{rnd:02d}-{slug}/{args.session}/{fmt}"
        # A custom driver selection gets a stable key suffix (sorted codes) so it
        # never clobbers the default charts and can be de-duplicated downstream
        # (same drivers -> same key -> same storage path + index row).
        dk = ("__" + "-".join(sorted(DRIVERS))) if DRIVERS else ""
        print(f"== {fmt} ({ratios[fmt]}) ==")
        for ctype, title, desc, fn in CHARTS:
            if only_set and ctype not in only_set:
                continue
            try:
                png = fn(session, meta)
                if not png:
                    print(f"  - {fmt}/{ctype}: no data, skipped")
                    continue
                path = f"{base}/{ctype}{dk}.png"
                if args.no_upload:
                    outdir = os.path.join("out", base)
                    os.makedirs(outdir, exist_ok=True)
                    with open(os.path.join(outdir, f"{ctype}.png"), "wb") as f:
                        f.write(png)
                    print(f"  - {fmt}/{ctype}: {len(png) // 1024} KB")
                else:
                    ct = (ctype if fmt == "landscape" else f"{ctype}_{fmt}") + dk
                    public_url = upload_png(path, png)
                    upsert_index({"season": args.season, "round": rnd, "session": args.session,
                                  "chart_type": ct, "title": title, "description": desc,
                                  "storage_path": path, "public_url": public_url,
                                  "updated_at": pd.Timestamp.utcnow().isoformat()})
                    print(f"  - {fmt}/{ctype}: uploaded")
                ok += 1
            except Exception as e:  # noqa: BLE001
                print(f"  ! {fmt}/{ctype} failed: {e}")
                traceback.print_exc()

    print(f"Done. {ok} charts generated into out/{args.season}/{rnd:02d}-{slug}/{args.session}/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
