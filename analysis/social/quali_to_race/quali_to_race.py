#!/usr/bin/env python3
"""F1 DataStop "Qualifying to Race" flow chart, ported from the website's card
(web/src/components/analytics/MuiSankeyChart.tsx + web/src/lib/f1/sankey.ts).

Same design as the site: three columns QUALI / GRID / RACE, one team coloured node per
driver ordered by position (P1 at top), ribbons between columns coloured by position
change (gain green, loss red, hold muted), held ribbons at 0.09 opacity, retirements dimmed
to 0.14, everything else 0.5; labels "1 NOR" on the left and "NOR 1" on the right, grid
column unlabelled, "POSITION CHANGE  Gain  Loss  Hold" legend, mono labels.
Laid out natively for each portrait size (no padding), F1 DataStop logo top right, race
flag next to the race and circuit name.

  python3 quali_to_race.py --season 2025 --round 20 [--stat "..."] [--out DIR] [--slug NAME]

Writes DIR/<slug>_x.png 1080x1350, _ig 1080x1440, _threads 1440x1920. Never overwrites:
a clash gets _2, _3 ... Data: Jolpica qualifying + race results (same fields the site uses).
"""
import argparse, json, math, os, re, sys, urllib.request
import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, "/workspace/final/templates/driver_cards")
import template as T

THEME_SRC = "/workspace/charts/mocks/stat_19_v3.py"
def _load_theme():
    src = open(THEME_SRC).read(); cut = src.index("# ---------------- data")
    ns = {"__name__": "stat_19_theme"}; exec(compile(src[:cut], THEME_SRC, "exec"), ns); return ns
make_background = _load_theme()["make_background"]

GF = "/usr/share/fonts/truetype/sand-box/google/"
MONO = GF + "Geist Mono/GeistMono-VariableFont_wght.ttf"
SANS = GF + "Geist/Geist-VariableFont_wght.ttf"
SIZES = T.SIZES
BANNED = re.compile(r"[|\u2022\u00b7]|https?://|www\.|\.com\b", re.I)
JOLPICA = "https://api.jolpi.ca/ergast/f1"

# site tokens (web/src/index.css): --status-completed, --destructive, --muted-foreground
GAIN = (34, 197, 94); LOSS = (239, 68, 68); HOLD = (157, 157, 168)
INK = (242, 243, 245); MUTE = (157, 157, 168); CARD = (14, 14, 17); BORDER = (38, 38, 44); RED = (225, 6, 0)
# web/src/constants/f1Colors.ts TEAM_COLORS (constructorId)
TEAM_COLORS = {"red_bull": "#3671C6", "ferrari": "#F91536", "mercedes": "#27F4D2", "mclaren": "#FF8700",
    "aston_martin": "#229971", "alpine": "#FF87BC", "williams": "#37BEDD", "rb": "#5E8FAA",
    "sauber": "#52E252", "haas": "#B6BABD", "cadillac": "#C4A747", "audi": "#FF0000",
    "alphatauri": "#5E8FAA", "alfa": "#900000", "racing_point": "#F596C8", "renault": "#FFF500",
    "toro_rosso": "#469BFF", "force_india": "#F596C8", "default": "#888888"}
COUNTRY_FLAG = {"Australia": "au", "China": "cn", "Japan": "jp", "Bahrain": "bh", "Saudi Arabia": "sa",
    "USA": "us", "United States": "us", "Italy": "it", "Monaco": "mc", "Spain": "es", "Canada": "ca",
    "Austria": "at", "UK": "gb", "United Kingdom": "gb", "Belgium": "be", "Hungary": "hu",
    "Netherlands": "nl", "Azerbaijan": "az", "Singapore": "sg", "Mexico": "mx", "Brazil": "br",
    "Qatar": "qa", "UAE": "ae", "United Arab Emirates": "ae", "Malaysia": "my", "Germany": "de",
    "France": "fr", "Portugal": "pt", "Argentina": "ar"}


def font(path, size, weight):
    f = ImageFont.truetype(path, max(1, int(size)))
    try: f.set_variation_by_axes([weight])
    except Exception: pass
    return f


def rgba(c, a): return tuple(c) + (int(round(255 * a)),)


# ---------------------------------------------------------------- data
def _get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "f1datastop"}), timeout=30) as r:
        return json.load(r)


def fetch(season, rnd):
    """Jolpica race + qualifying for one round (the payload the site's hook passes to sankey.ts)."""
    res = _get(f"{JOLPICA}/{season}/{rnd}/results.json?limit=100")["MRData"]["RaceTable"]["Races"]
    if not res: return None
    race = res[0]
    q = _get(f"{JOLPICA}/{season}/{rnd}/qualifying.json?limit=100")["MRData"]["RaceTable"]["Races"]
    race["QualifyingResults"] = q[0]["QualifyingResults"] if q else []
    return race


def build(race):
    """Port of buildSankeyFromRoundResults: one row per race classified entry with quali, grid,
    race slot. A missing or zero grid (pit lane start) falls back to the quali slot; when that
    slot is taken it goes behind the last grid slot, so no two drivers share a node."""
    quali = {r["Driver"]["driverId"]: int(r["position"]) for r in race.get("QualifyingResults", []) if r.get("position")}
    rows, used = [], set()
    for r in race["Results"]:
        g = int(r["grid"]) if str(r.get("grid", "")).lstrip("-").isdigit() else 0
        if g > 0: used.add(g)
    nxt = max(list(used) + list(quali.values()) + [19]) + 1
    for r in race["Results"]:
        did = r["Driver"]["driverId"]; qp = quali.get(did)
        g = int(r["grid"]) if str(r.get("grid", "")).lstrip("-").isdigit() else 0
        if g <= 0:
            if qp is not None and qp not in used: g = qp
            else: g = nxt; nxt += 1
            used.add(g)
        st = r.get("status", ""); pt = r.get("positionText", r["position"])
        finished = st == "Finished" or st == "Lapped" or st.startswith("+")
        rows.append(dict(code=r["Driver"].get("code") or r["Driver"]["familyName"][:3].upper(),
            family=r["Driver"]["familyName"], team=r["Constructor"]["constructorId"],
            quali=qp if qp is not None else g, has_quali=qp is not None, grid=g, race=int(r["position"]),
            race_label=pt if pt.isdigit() else "DNF", dnf=not finished, status=st))
    return rows


def ordinal(n): return f"{n}{'th' if 11 <= n % 100 <= 13 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"


def auto_stat(rows):
    w = min(rows, key=lambda r: r["race"])
    s = f"{w['family']} won from {'pole' if w['grid'] == 1 else ordinal(w['grid'])}"
    fin = [r for r in rows if not r["dnf"] and r["grid"] - r["race"] > 0]
    if fin:
        b = max(fin, key=lambda r: (r["grid"] - r["race"], -r["race"]))
        s += f". Biggest climb {b['family']}, {ordinal(b['grid'])} to {ordinal(b['race'])}"
    return s


# ---------------------------------------------------------------- drawing
def ribbon(layer, x0, y0, x1, y1, w, col, a):
    """d3 sankeyLinkHorizontal: cubic bezier with control points at the mid x, stroked at the
    node height. Drawn as a filled band with perpendicular offsets."""
    t = np.linspace(0, 1, 90); xm = (x0 + x1) / 2
    bx = (1 - t) ** 3 * x0 + 3 * (1 - t) ** 2 * t * xm + 3 * (1 - t) * t ** 2 * xm + t ** 3 * x1
    by = (1 - t) ** 3 * y0 + 3 * (1 - t) ** 2 * t * y0 + 3 * (1 - t) * t ** 2 * y1 + t ** 3 * y1
    dx = np.gradient(bx); dy = np.gradient(by); n = np.hypot(dx, dy); nx, ny = -dy / n, dx / n
    h = w / 2
    pts = list(zip(bx + nx * h, by + ny * h)) + list(zip(bx - nx * h, by - ny * h))[::-1]
    tmp = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    ImageDraw.Draw(tmp).polygon(pts, fill=rgba(col, a))
    layer.alpha_composite(tmp)


def text_w(d, s, f, track=0.0):
    return d.textlength(s, font=f) + track * max(0, len(s) - 1)


def tracked(d, xy, s, f, fill, track, anchor="l"):
    """Draw letter-spaced text (site uses tracking-widest on mono labels)."""
    x, y = xy; w = text_w(d, s, f, track)
    if anchor == "m": x -= w / 2
    elif anchor == "r": x -= w
    for ch in s:
        d.text((x, y), ch, font=f, fill=fill, anchor="lm"); x += d.textlength(ch, font=f) + track
    return w


def render(race, rows, W, H, path, stat):
    SS = 2; s = W / 1080 * SS                      # supersampled scale
    base = make_background(W * SS, H * SS, wm_y=0.6, wm_alpha=10).convert("RGBA")
    img = base; d = ImageDraw.Draw(img)
    portrait_tall = H / W > 1.3                     # ig / threads get more row height, same structure
    M = 52 * s

    # brand top right (site icon + wordmark)
    T.brand(img, int(W * SS - M), int(78 * s), int(56 * s))

    # header: race flag + race name, circuit, title, stat
    cc = COUNTRY_FLAG.get(race["Circuit"]["Location"]["country"])
    if not cc or not os.path.exists(T.FL + cc + ".png"):
        sys.exit(f"no flag for {race['Circuit']['Location']['country']} in {T.FL}")
    fh = int(40 * s); fl = T.flag(cc, fh); y = 78 * s
    img.alpha_composite(fl, (int(M), int(y - fh / 2)))
    fk = font(MONO, 25 * s, 600)
    tracked(d, (M + fl.width + 18 * s, y), f"{race['season']} {race['raceName'].upper()}", fk, INK, 2.2 * s)
    y = 150 * s
    ft = font(SANS, 84 * s, 800)
    d.text((M, y), "Qualifying to Race", font=ft, fill=INK, anchor="lm")
    y += 72 * s
    fc = font(SANS, 30 * s, 500)
    d.text((M, y), race["Circuit"]["circuitName"], font=fc, fill=MUTE, anchor="lm")
    y += 50 * s
    fs = font(SANS, 32 * s, 600)
    d.text((M, y), stat, font=fs, fill=INK, anchor="lm")
    y += 50 * s

    # card (site Card + scope frame corner ticks)
    cx0, cy0, cx1, cy1 = M - 20 * s, y, W * SS - M + 20 * s, H * SS - 44 * s
    card = Image.new("RGBA", img.size, (0, 0, 0, 0)); cd = ImageDraw.Draw(card)
    cd.rounded_rectangle((cx0, cy0, cx1, cy1), radius=int(20 * s), fill=rgba(CARD, 0.78), outline=rgba(BORDER, 1), width=max(1, int(1.5 * s)))
    L = 26 * s; lw = max(2, int(3 * s)); o = 10 * s
    cd.line([(cx0 + o, cy0 + o + L), (cx0 + o, cy0 + o), (cx0 + o + L, cy0 + o)], fill=rgba(RED, 1), width=lw)
    cd.line([(cx1 - o, cy1 - o - L), (cx1 - o, cy1 - o), (cx1 - o - L, cy1 - o)], fill=rgba(RED, 1), width=lw)
    img.alpha_composite(card); d = ImageDraw.Draw(img)

    # legend: POSITION CHANGE  ↑ Gain  ↓ Loss  – Hold (centred, like the site)
    y = cy0 + 54 * s
    fl1 = font(MONO, 22 * s, 600); fl2 = font(MONO, 22 * s, 500); tr = 1.6 * s
    parts = [("POSITION CHANGE", MUTE, fl1, tr), ("\u2191 Gain", GAIN, fl2, 0), ("\u2193 Loss", LOSS, fl2, 0), ("\u2013 Hold", MUTE, fl2, 0)]
    gap = 26 * s; tot = sum(text_w(d, p[0], p[2], p[3]) for p in parts) + gap * (len(parts) - 1)
    x = W * SS / 2 - tot / 2
    for txt, col, f, t in parts:
        x += tracked(d, (x, y), txt, f, col, t) + gap

    # chart extent (site margins: 100 px left/right for labels)
    fn = font(MONO, (26 if not portrait_tall else 27) * s, 600)
    lab_w = max(text_w(d, f"{r['quali']} {r['code']}", fn) for r in rows)
    lab_w = max(lab_w, max(text_w(d, f"{r['code']} {r['race_label']}", fn) for r in rows))
    lp = 14 * s
    x0 = cx0 + 30 * s + lab_w + lp; x1 = cx1 - 30 * s - lab_w - lp
    nw = 16 * s
    yh = y + 62 * s                                 # column header row
    fhd = font(MONO, 22 * s, 500)
    cols = [x0, (x0 + x1 - nw) / 2, x1 - nw]
    for name, cxn in zip(("QUALI", "GRID", "RACE"), cols):
        tracked(d, (cxn + nw / 2, yh), name, fhd, MUTE, 4.4 * s, anchor="m")
    ey0 = yh + 40 * s; ey1 = cy1 - 34 * s

    # nodes: each column sorted by position, equal heights (every node carries value 1)
    def column(key):
        return sorted(rows, key=lambda r: r[key])
    n = len(rows); pad = (5 if portrait_tall else 4) * s
    kh = (ey1 - ey0 - (n - 1) * pad) / n
    pos = {}
    for ci, key in enumerate(("quali", "grid", "race")):
        for i, r in enumerate(column(key)):
            pos[(key, r["code"])] = (cols[ci], ey0 + i * (kh + pad))

    links = Image.new("RGBA", img.size, (0, 0, 0, 0))
    for a, b in (("quali", "grid"), ("grid", "race")):
        for r in sorted(rows, key=lambda r: r[a]):
            ch = r[a] - r[b]                          # gain when the source slot number is larger
            col = GAIN if ch > 0 else LOSS if ch < 0 else HOLD
            dim = (a == "grid" and r["dnf"])
            op = 0.14 if dim else 0.09 if ch == 0 else 0.5
            (sx, sy), (tx, ty) = pos[(a, r["code"])], pos[(b, r["code"])]
            ribbon(links, sx + nw, sy + kh / 2, tx, ty + kh / 2, max((1 if ch == 0 else 2) * s, kh), col, op)
    img.alpha_composite(links); d = ImageDraw.Draw(img)

    for (key, code), (nx, ny) in pos.items():
        r = next(q for q in rows if q["code"] == code)
        c = T.rgb(TEAM_COLORS.get(r["team"], TEAM_COLORS["default"]))
        d.rounded_rectangle((nx, ny, nx + nw, ny + kh), radius=int(3 * s), fill=rgba(c, 0.95))
        cyl = ny + kh / 2
        if key == "quali":
            d.text((nx - lp, cyl), f"{r['quali']} {code}", font=fn, fill=MUTE, anchor="rm")
        elif key == "race":
            d.text((nx + nw + lp, cyl), f"{code} {r['race_label']}", font=fn, fill=MUTE, anchor="lm")

    img = img.convert("RGB").resize((W, H), Image.LANCZOS)
    img.save(path, optimize=True)
    return path


def free(path):
    if not os.path.exists(path): return path
    b, e = os.path.splitext(path); i = 2
    while os.path.exists(f"{b}_{i}{e}"): i += 1
    return f"{b}_{i}{e}"


def render_all(race, out, slug, stat=None, sizes=None):
    rows = build(race)
    if not rows: return []
    stat = stat or auto_stat(rows)
    for t in (stat, race["raceName"], race["Circuit"]["circuitName"]):
        if BANNED.search(t): sys.exit(f"banned character or URL in text: {t!r}")
    os.makedirs(out, exist_ok=True); done = []
    for k, (W, H) in SIZES.items():
        if sizes and k not in sizes: continue
        done.append(render(race, rows, W, H, free(os.path.join(out, f"{slug}_{k}.png")), stat))
    return done


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--season", type=int, required=True); ap.add_argument("--round", type=int, required=True)
    ap.add_argument("--stat"); ap.add_argument("--out", default="."); ap.add_argument("--slug")
    a = ap.parse_args()
    race = fetch(a.season, a.round)
    if not race: sys.exit(f"no race results for {a.season} round {a.round}")
    for p in render_all(race, a.out, a.slug or f"quali_to_race_{a.season}_{a.round:02d}", a.stat): print(p)


if __name__ == "__main__":
    main()
