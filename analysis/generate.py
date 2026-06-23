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
from matplotlib.offsetbox import AnnotationBbox, OffsetImage  # noqa: E402
from PIL import Image, ImageDraw, ImageFilter  # noqa: E402

from io import BytesIO  # noqa: E402

try:
    from scipy.interpolate import make_interp_spline
    _HAVE_SCIPY = True
except Exception:
    _HAVE_SCIPY = False

HERE = os.path.dirname(os.path.abspath(__file__))

# ── Palette (F1 DataStop — dark Pit Wall, red signature) ────────────────────
PAPER = "#0E1014"
PANEL = "#181B22"
INK = "#F2F3F5"
SUBINK = "#8C929B"
GRID = "#23262E"
RED = "#E10600"
GOLD = "#A6912F"

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


# ── Fonts ───────────────────────────────────────────────────────────────────
def _load_font(name):
    p = os.path.join(HERE, "fonts", name)
    if os.path.exists(p):
        fm.fontManager.addfont(p)
        return fm.FontProperties(fname=p)
    return fm.FontProperties()


FP_BODY = _load_font("Exo2-var.ttf")
_exo2 = FP_BODY.get_file()
FP_TITLE = fm.FontProperties(fname=_exo2, weight=800) if _exo2 else fm.FontProperties(weight="bold")
FP_BODY_B = fm.FontProperties(fname=_exo2, weight=700) if _exo2 else fm.FontProperties(weight="bold")
plt.rcParams["font.family"] = FP_BODY.get_name() if _exo2 else "sans-serif"
plt.rcParams["svg.fonttype"] = "none"

_LOGO = None
_logo_path = os.path.join(HERE, "assets", "logo.png")
if os.path.exists(_logo_path):
    try:
        _LOGO = np.asarray(Image.open(_logo_path).convert("RGBA"))
    except Exception:
        _LOGO = None


# ── Figure / layout helpers ─────────────────────────────────────────────────
def editorial_fig(left=0.065, right=0.93):
    fig = plt.figure(figsize=(12.8, 7.2), dpi=200)
    fig.patch.set_facecolor(PAPER)
    ax = fig.add_axes([left, 0.12, right - left, 0.58])  # headroom above for the title
    ax.set_facecolor(PAPER)
    return fig, ax


def title_block(fig, eyebrow, title, subtitle=None):
    # pit-wall red edge bar (F1 DataStop signature)
    fig.add_artist(plt.Rectangle((0, 0), 0.009, 1, transform=fig.transFigure, color=RED, zorder=10))
    # red eyebrow
    fig.text(0.066, 0.905, "   ".join(eyebrow.upper()), color=RED, fontsize=12.5,
             fontproperties=FP_BODY_B)
    fig.text(0.062, 0.795, title, color=INK, fontsize=40, fontproperties=FP_TITLE)
    # red underline accent under the title
    fig.add_artist(plt.Line2D([0.066, 0.138], [0.762, 0.762], transform=fig.transFigure,
                              color=RED, lw=4.5, solid_capstyle="round"))
    if subtitle:
        fig.text(0.066, 0.728, subtitle, color=SUBINK, fontsize=15.5, fontproperties=FP_BODY)
    # brand mark, top-right — logo + wordmark
    fig.text(0.928, 0.905, "F1 DATASTOP", ha="right", va="center", color=INK, fontsize=12.5,
             fontproperties=FP_BODY_B)
    if _LOGO is not None:
        ab = AnnotationBbox(OffsetImage(_LOGO, zoom=0.16), (0.952, 0.905),
                            xycoords="figure fraction", frameon=False, zorder=11)
        fig.add_artist(ab)
    else:
        fig.add_artist(plt.Rectangle((0.941, 0.898), 0.011, 0.015, transform=fig.transFigure,
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
        lbl.set_fontproperties(FP_BODY)


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
        s = min(w, h)
        img = img.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s)).resize((140, 140))
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
                color=INK, zorder=8)


def headshot_legend_row(fig, items, y=0.852, x0=0.5, step=0.105):
    """items: (code, color, url) placed as a glowing headshot row in figure coords."""
    x = x0
    for code, color, url in items:
        arr = headshot_disc(url, color)
        if arr is not None:
            fig.add_artist(AnnotationBbox(OffsetImage(arr, zoom=0.16), (x, y),
                                          xycoords="figure fraction", frameon=False, zorder=12))
        fig.text(x + 0.026, y, code, va="center", ha="left", color=INK, fontsize=12,
                 fontproperties=FP_BODY_B)
        x += step


def compound_legend(fig, y=0.852):
    items = [("Soft", "SOFT"), ("Medium", "MEDIUM"), ("Hard", "HARD"),
             ("Inter", "INTERMEDIATE"), ("Wet", "WET")]
    x = 0.50
    for label, comp in items:
        fig.add_artist(plt.Rectangle((x, y - 0.009), 0.013, 0.02, transform=fig.transFigure,
                                     color=COMPOUND_COLORS[comp], zorder=11))
        fig.text(x + 0.021, y, label, va="center", ha="left", color=INK, fontsize=11.5,
                 fontproperties=FP_BODY)
        x += 0.088


def driver_lookup(session):
    out = {}
    try:
        for num, row in session.results.iterrows():
            info = {"abbr": row.get("Abbreviation"), "team": row.get("TeamName"),
                    "headshot": row.get("HeadshotUrl")}
            out[str(num)] = info
            if info["abbr"]:
                out[str(info["abbr"])] = info
    except Exception:
        pass
    return out


def footer(fig, meta):
    fig.text(0.066, 0.045,
             f"{meta['event']} {meta['year']} · {meta['session_name']}   —   f1datastop.com",
             color=SUBINK, fontsize=11, fontproperties=FP_BODY)


def add_watermark(fig):
    """Faint, full-coverage tiled wordmark — anti-theft 'security-paper' texture.
    Light weight + low opacity so it reads as subtle grain, not repeated words."""
    for j, yy in enumerate(np.arange(0.03, 1.02, 0.092)):
        x0 = -0.06 + (0.07 if j % 2 else 0.0)
        for xx in np.arange(x0, 1.04, 0.143):
            fig.text(xx, yy, "f1datastop.com", color="#FFFFFF", alpha=0.026, fontsize=8.5,
                     fontproperties=FP_BODY, rotation=16, ha="left", va="center", zorder=20)


def fig_png(fig):
    add_watermark(fig)
    buf = io.BytesIO()
    fig.savefig(buf, format="png", facecolor=PAPER, dpi=200, bbox_inches=None, pad_inches=0)
    plt.close(fig)
    return buf.getvalue()


def top_drivers_by_pace(laps, n=5):
    q = laps.pick_quicklaps() if hasattr(laps, "pick_quicklaps") else laps
    return list(q.groupby("Driver")["LapTime"].min().sort_values().index[:n])


# ── Charts ──────────────────────────────────────────────────────────────────
def chart_speed_trace(session, meta):
    laps = session.laps
    fig, ax = editorial_fig(right=0.84)
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
    plotted = 0
    seen = {}
    for drv in session.drivers:
        dl = laps[laps["DriverNumber"] == drv].dropna(subset=["Position"])
        if dl.empty:
            continue
        abbr = dl["Driver"].iloc[0]
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
    ax.set_ylim(20.6, 0.4)
    ax.set_yticks([1, 5, 10, 15, 20])
    clean_axes(ax, "Lap", "Position")
    footer(fig, meta)
    return fig_png(fig)


def chart_tyre_strategy(session, meta):
    laps = session.laps
    fig, ax = editorial_fig()
    title_block(fig, "Strategy", "Tyre Stints", "Compound usage per driver")
    yt, yl = [], []
    for i, drv in enumerate(session.drivers):
        dl = laps[laps["DriverNumber"] == drv]
        if dl.empty:
            continue
        abbr = dl["Driver"].iloc[0]
        for _, st in dl.groupby("Stint"):
            comp = str(st["Compound"].iloc[0]).upper()
            start = st["LapNumber"].min()
            length = st["LapNumber"].max() - start + 1
            ax.barh(i, length, left=start - 1, height=0.62,
                    color=COMPOUND_COLORS.get(comp, "#9A9486"),
                    edgecolor=PAPER, linewidth=1.4, zorder=3)
        yt.append(i)
        yl.append(abbr)
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
    for i, t in enumerate(teams):
        delta = med[t] - best
        ax.barh(i, delta, height=0.6, color=team_color(t), zorder=3,
                edgecolor=PAPER, linewidth=1.2)
        ax.text(delta + (med.max() - best) * 0.015, i,
                "BASE" if delta == 0 else f"+{delta:.2f}s",
                va="center", ha="left", fontsize=11, fontproperties=FP_BODY_B, color=INK)
    ax.set_yticks(range(len(teams)))
    ax.set_yticklabels(teams, fontproperties=FP_BODY_B, color=INK, fontsize=11)
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
    parts = ax.violinplot(data, vert=False, showextrema=False, widths=0.85)
    for body, t in zip(parts["bodies"], teams):
        body.set_facecolor(team_color(t))
        body.set_edgecolor(team_color(t))
        body.set_alpha(0.55)
        body.set_linewidth(1.5)
    for i, t in enumerate(teams):
        med = np.median(pooled[t])
        ax.scatter([med], [i + 1], s=46, color=team_color(t), zorder=5,
                   edgecolor="white", linewidth=1.4)
    ax.set_yticks(range(1, len(teams) + 1))
    ax.set_yticklabels(teams, fontproperties=FP_BODY_B, color=INK, fontsize=11)
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
                fontsize=10.5, fontproperties=FP_BODY_B, color=INK)
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
    fig, ax = editorial_fig(left=0.17)
    title_block(fig, "Pace", "Race Pace by Tyre", "Lap-time spread per team · point colour = compound")
    data = [laps[laps["Team"] == t]["s"].values for t in order]
    parts = ax.violinplot(data, vert=False, showextrema=False, widths=0.9)
    for body, t in zip(parts["bodies"], order):
        body.set_facecolor(team_color(t))
        body.set_alpha(0.22)
        body.set_edgecolor(team_color(t))
        body.set_linewidth(1.3)
    for i, t in enumerate(order):
        sub = laps[laps["Team"] == t]
        rng = np.random.RandomState(i)
        ys = (i + 1) + (rng.rand(len(sub)) - 0.5) * 0.55
        cols = [COMPOUND_COLORS.get(str(c).upper(), "#999999") for c in sub["Compound"]]
        ax.scatter(sub["s"].values, ys, c=cols, s=22, alpha=0.9,
                   edgecolor=PAPER, linewidth=0.5, zorder=5)
    ax.set_yticks(range(1, len(order) + 1))
    ax.set_yticklabels(order, fontproperties=FP_BODY_B, color=INK, fontsize=11)
    ax.invert_yaxis()
    ax.grid(axis="y", linewidth=0)
    ax.grid(axis="x", color=GRID, linewidth=1.0)
    clean_axes(ax, "Lap time (s)", None)
    compound_legend(fig)
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
    fig, ax = editorial_fig(left=0.10, right=0.90)
    title_block(fig, "Race", "Qualifying · Grid · Finish", "Where every driver started and ended")
    cols = [0, 1, 2]
    for _, row in res.iterrows():
        abbr = row.get("Abbreviation")
        grid = int(row["GridPosition"])
        fin = int(row["Position"])
        q = qpos.get(abbr, grid)
        c = team_color(row.get("TeamName"))
        ys = [q, grid, fin]
        ax.plot(cols, ys, color=c, lw=3.0, alpha=0.85, solid_capstyle="round", zorder=3)
        ax.scatter(cols, ys, s=38, color=c, edgecolor=PAPER, linewidth=1.2, zorder=4)
        ax.annotate(abbr, (0, q), xytext=(-9, 0), textcoords="offset points",
                    va="center", ha="right", fontsize=8.5, color=c, fontproperties=FP_BODY_B)
        ax.annotate(abbr, (2, fin), xytext=(9, 0), textcoords="offset points",
                    va="center", ha="left", fontsize=8.5, color=c, fontproperties=FP_BODY_B)
    ax.set_xlim(-0.28, 2.28)
    ax.set_ylim(20.6, 0.4)
    ax.set_xticks(cols)
    ax.set_xticklabels(["QUALIFYING", "GRID", "FINISH"], fontproperties=FP_BODY_B, fontsize=12)
    ax.set_yticks([1, 5, 10, 15, 20])
    for s in ("top", "right", "left", "bottom"):
        ax.spines[s].set_visible(False)
    ax.tick_params(colors=SUBINK, length=0, labelsize=11)
    ax.grid(axis="y", color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    for lbl in ax.get_xticklabels():
        lbl.set_color(INK)
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
            parts = ax.violinplot([data], positions=[i], vert=False, widths=0.92,
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
    ax.set_yticks(range(len(teams)))
    ax.set_yticklabels(teams, fontproperties=FP_BODY_B, color=INK, fontsize=9.5)
    ax.set_ylim(-0.7, len(teams) - 0.3)
    ax.invert_yaxis()
    ax.set_xlim(lo - 0.3, hi + 0.08)
    ax.grid(axis="x", color=GRID, linewidth=1.0)
    ax.grid(axis="y", linewidth=0)
    clean_axes(ax, "Lap time (s)", None)
    fig.add_artist(plt.Rectangle((0.60, 0.847), 0.014, 0.015, transform=fig.transFigure,
                                 color=INK, alpha=0.75, zorder=11))
    fig.text(0.62, 0.853, "faster", color=SUBINK, fontsize=9.5, fontproperties=FP_BODY)
    fig.add_artist(plt.Rectangle((0.69, 0.847), 0.014, 0.015, transform=fig.transFigure,
                                 fill=False, edgecolor=INK, hatch="////", linewidth=0.5, zorder=11))
    fig.text(0.71, 0.853, "teammate", color=SUBINK, fontsize=9.5, fontproperties=FP_BODY)
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
    for glw, ga in ((lw * 2.7, 0.045), (lw * 1.95, 0.07), (lw * 1.4, 0.10)):
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
        order = [a for a in session.results["Abbreviation"].values][:6]
    except Exception:
        order = list(df["Driver"].unique())[:6]
    look = driver_lookup(session)
    fig, ax = editorial_fig(right=0.86)
    title_block(fig, "Race", "Gap to Leader", "Time behind the lead, lap by lap")
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
    fig, ax = editorial_fig(right=0.86)
    title_block(fig, "Pace", "Lap-Time Evolution", "Race pace through the stints · top five")
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
    clean_axes(ax, "Lap", "Lap time (s)")
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
    cax = fig.add_axes([0.63, 0.15, 0.22, 0.02])
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
    x0 = 0.55
    for gg in range(2, 9):
        fig.add_artist(plt.Rectangle((x0, 0.843), 0.013, 0.02, transform=fig.transFigure,
                                     color=gear_colors[gg], zorder=11))
        fig.text(x0 + 0.017, 0.852, str(gg), va="center", color=INK, fontsize=10.5,
                 fontproperties=FP_BODY)
        x0 += 0.052
    footer(fig, meta)
    return fig_png(fig)


def chart_driver_radar(session, meta):
    laps = session.laps
    metrics = ["Top speed", "Avg speed", "Throttle", "Braking", "Consistency"]
    vals = {}
    for drv in top_drivers_by_pace(laps, 3):
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
        vals[drv] = (m, team_color(dl["Team"].iloc[0]))
    if len(vals) < 2:
        return None
    n = len(metrics)
    ang = np.linspace(0, 2 * np.pi, n, endpoint=False).tolist()
    ang += ang[:1]
    fig = plt.figure(figsize=(12.8, 7.2), dpi=200)
    fig.patch.set_facecolor(PAPER)
    ax = fig.add_axes([0.34, 0.06, 0.34, 0.60], polar=True)
    ax.set_facecolor(PAPER)
    title_block(fig, "Telemetry", "Driver Radar", "Performance profile · fastest lap · top three")
    ax.set_theta_offset(np.pi / 2)
    ax.set_theta_direction(-1)
    ax.set_xticks(ang[:-1])
    ax.set_xticklabels(metrics, color=INK, fontproperties=FP_BODY, fontsize=11)
    ax.set_yticks([25, 50, 75, 100])
    ax.set_yticklabels([])
    ax.set_ylim(0, 100)
    ax.grid(color=GRID)
    ax.spines["polar"].set_color(GRID)
    for drv, (m, c) in vals.items():
        d = m + m[:1]
        ax.plot(ang, d, color=c, lw=2.4)
        ax.fill(ang, d, color=c, alpha=0.12)
    look = driver_lookup(session)
    items = [(drv, vals[drv][1], (look.get(str(drv)) or {}).get("headshot")) for drv in vals]
    headshot_legend_row(fig, items, x0=0.62, step=0.13)
    footer(fig, meta)
    return fig_png(fig)


CHARTS = [
    ("position_changes", "Position Changes", "Track position through the race", chart_position_changes),
    ("grid_flow", "Qualifying → Grid → Finish", "Driver flow from qualifying to the chequered flag", chart_grid_flow),
    ("gap_to_leader", "Gap to Leader", "Time behind the lead, lap by lap", chart_gap_to_leader),
    ("lap_evolution", "Lap-Time Evolution", "Race pace through the stints", chart_lap_evolution),
    ("teammate_pace", "Teammate Distribution", "Teammate lap-time spread, side by side", chart_teammate_pace),
    ("top_speed", "Top Speed", "Highest speed per driver on the fastest lap", chart_top_speed),
    ("speed_map", "Speed Map", "Fastest-lap speed mapped on the circuit", chart_speed_map),
    ("gear_map", "Gears", "Gear selection mapped on the circuit", chart_gear_map),
    ("driver_radar", "Driver Radar", "Performance profile of the top drivers", chart_driver_radar),
    ("track_dominance", "Track Dominance", "Fastest driver in each mini-sector", chart_track_dominance),
    ("throttle_brake", "Throttle & Brake", "Throttle and brake inputs on the fastest lap", chart_throttle_brake),
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--season", type=int, default=pd.Timestamp.utcnow().year)
    ap.add_argument("--round", type=int)
    ap.add_argument("--session", default="R")
    ap.add_argument("--latest", action="store_true")
    ap.add_argument("--no-upload", action="store_true")
    args = ap.parse_args()

    cache = os.environ.get("FASTF1_CACHE", ".fastf1cache")
    os.makedirs(cache, exist_ok=True)
    fastf1.Cache.enable_cache(cache)

    rnd = args.round
    if args.latest or rnd is None:
        rnd = latest_completed_round(args.season)
        if rnd is None:
            print("No completed race found.")
            return 0

    print(f"Loading {args.season} R{rnd} {args.session} ...")
    session = fastf1.get_session(args.season, rnd, args.session)
    session.load()
    ev = session.event
    meta = {"event": ev["EventName"], "year": args.season, "round": rnd,
            "session_name": getattr(session, "name", args.session)}

    ok = 0
    for ctype, title, desc, fn in CHARTS:
        try:
            png = fn(session, meta)
            if not png:
                print(f"  - {ctype}: no data, skipped")
                continue
            path = f"{args.season}/{rnd}/{args.session}/{ctype}.png"
            if args.no_upload:
                os.makedirs("out", exist_ok=True)
                with open(f"out/{args.season}-{rnd}-{args.session}-{ctype}.png", "wb") as f:
                    f.write(png)
                print(f"  - {ctype}: wrote local PNG ({len(png)//1024} KB)")
            else:
                public_url = upload_png(path, png)
                upsert_index({"season": args.season, "round": rnd, "session": args.session,
                              "chart_type": ctype, "title": title, "description": desc,
                              "storage_path": path, "public_url": public_url,
                              "updated_at": pd.Timestamp.utcnow().isoformat()})
                print(f"  - {ctype}: uploaded {public_url}")
            ok += 1
        except Exception as e:  # noqa: BLE001
            print(f"  ! {ctype} failed: {e}")
            traceback.print_exc()

    print(f"Done. {ok}/{len(CHARTS)} charts generated.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
