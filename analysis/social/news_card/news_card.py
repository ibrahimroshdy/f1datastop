#!/usr/bin/env python3
"""F1 DataStop news card: one headline, one number, optional driver or team. All 3 sizes per run.

  python3 news_card.py --headline "..." --number 102 [--label "POINTS CLEAR"]
                       [--driver ANT [--name "Kimi Antonelli"] | --team mercedes]
                       [--date "Nov 12"] [--race-flag us [--race "Las Vegas GP"]] [--reported]
                       [--tags "Audi,Racing Bulls"] [--accent "#27F4D2"] [--out DIR] [--slug NAME]

Writes DIR/<slug>_x.png 1080x1350, _ig 1080x1440, _threads 1440x1920 (never overwrites:
a clash gets _2, _3 ...). Background, colours, brand, fonts, flags, headshots and team
logos come from the shared design module (common/design.py); point it at the fonts and
assets with --font-dir / F1DS_FONT_DIR and --asset-dir / F1DS_ASSET_DIR.
"""
import argparse, os, re, sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))   # analysis/social
from common import design                                                         # noqa: E402

BLK, BLD = design.DISPLAY[800], design.DISPLAY[700]   # site type: Saira Condensed
FIG = design.FIG
INK, RED, GROUND = design.INK, design.RED, design.GROUND
TEAL = (0x27, 0xF4, 0xD2)   # default accent without a team
NATION, TEAMS, SIZES = design.NATION, design.TEAMS_2026, design.SIZES
BANNED = re.compile(r"[|\u2022\u00b7]|https?://|www\.|\.com\b", re.I)


def team_key(s):
    k = re.sub(r"[^a-z]+", "_", s.lower()).strip("_")
    k = {"redbull": "red_bull", "rb": "racing_bulls", "aston": "aston_martin", "astonmartin": "aston_martin"}.get(k, k)
    if k not in TEAMS:
        sys.exit(f"unknown team '{s}', use one of: {', '.join(TEAMS)}")
    return k


def tag_colour(label, fallback):
    k = re.sub(r"[^a-z]+", "_", label.lower()).strip("_")
    k = {"redbull": "red_bull", "red_bull_racing": "red_bull", "rb": "racing_bulls",
         "aston": "aston_martin", "astonmartin": "aston_martin"}.get(k, k)
    if k in TEAMS:
        return design.rgb(TEAMS[k][1])
    return fallback


def tag_chips(tags="", team=None, driver=None, name=None, accent=TEAL, reported=False):
    """Chips above the headline: --tags, or the automatic team or driver tag, plus REPORTED."""
    chips = []
    if tags:
        for raw in tags.split(","):
            lab = raw.strip()
            if lab:
                chips.append((lab.upper(), tag_colour(lab, accent), "fill"))
    elif team:
        chips.append((TEAMS[team][0].upper(), accent, "fill"))
    elif driver:
        chips.append(((name or driver).upper(), accent, "fill"))
    if reported:
        chips.append(("REPORTED", INK, "line"))
    return chips


def wrap(d, text, font, width):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if d.textlength(t, font=font) <= width or not cur:
            cur = t
        else:
            lines.append(cur); cur = w
    return lines + ([cur] if cur else [])


def hero_driver(code, hgt):
    hs = Image.open(design.require_file(design.headshot_path(code), "headshot")).convert("RGBA"); bb = hs.getbbox()
    bh = bb[3] - bb[1]   # head to chest: top ~42% of the figure
    crop = hs.crop((max(0, bb[0] - 30), max(0, bb[1] - 20), min(hs.width, bb[2] + 10), bb[1] + int(bh * 0.42)))
    sc = hgt / crop.height; crop = crop.resize((int(crop.width * sc), hgt), Image.LANCZOS)
    a = np.array(crop).astype(float); n = crop.height
    fade = np.clip((np.arange(n) - n * 0.60) / (n * 0.36), 0, 1); a[..., 3] *= (1 - fade ** 1.3)[:, None]
    return Image.fromarray(a.astype("uint8"))


def render(a, W, H, path):
    s = W / 1080.0
    accent = design.rgb(a.accent) if a.accent else (design.rgb(TEAMS[a.team][1]) if a.team else TEAL)
    img = design.background(W, H); d = ImageDraw.Draw(img, "RGBA")
    L = int(60 * s); hy = int(78 * s)
    # headline first: bottom block, auto-sized to max 4 lines; the rest balances around it
    hw = W - 2 * L; hsz = 92 * s
    while True:
        f = design.F(BLK, hsz); lines = wrap(d, a.headline.upper(), f, hw)
        if len(lines) <= 4 or hsz < 40 * s: break
        hsz -= 4
    lh = int(hsz * 1.04); block = lh * len(lines)
    top = int(H - 96 * s - block)
    chip_top = top - int(29 * s) - int(25 * s)          # top of the tag row above the headline
    iy = int(178 * s)                                   # identity line
    # hero, right side, behind the text: it runs down to the tag row so a short headline leaves no hole
    hero_left = W
    if a.driver:
        hero_y = int(112 * s)
        hh = max(int(H * 0.56), chip_top - hero_y + int(40 * s)); hero = hero_driver(a.driver, hh)
        if hero.width > W * 0.60:   # keep room for the number on the taller sizes
            hero = hero_driver(a.driver, int(hh * W * 0.60 / hero.width))
        hero_y = max(hero_y, chip_top + int(40 * s) - hero.height)   # sit the faded chest on the tag row
        hero_left = W - hero.width + int(30 * s)
        img.alpha_composite(hero, (hero_left, hero_y))
    elif a.team:
        lg = Image.open(design.require_file(design.team_logo_path(a.team), "team logo")).convert("RGBA"); lg = lg.crop(lg.getbbox())
        sc = min(W * 0.42 / lg.width, H * 0.26 / lg.height)
        lg = lg.resize((int(lg.width * sc), int(lg.height * sc)), Image.LANCZOS)
        cy = (iy + chip_top) // 2
        img.alpha_composite(lg, (W - lg.width - int(70 * s), int(cy - lg.height / 2)))
    # header: optional race flag, then team name and date (top left); logo + wordmark (top right)
    bx = design.brand(img, W - int(60 * s), hy, int(56 * s))
    x = L
    if a.race_flag:
        fl = design.flag(a.race_flag, int(40 * s)); img.alpha_composite(fl, (x, hy - fl.height // 2)); x += fl.width + int(16 * s)
    head = [(t, c) for t, c in (((a.race or (TEAMS[a.team][0] if a.team else "")).upper(), INK),
                                 ((a.date or "").upper(), design.INK2)) if t]
    hf = design.font(design.DISPLAY, 40 * s, 700)
    while sum(d.textlength(t, font=hf) for t, _ in head) + int(22 * s) * (len(head) - 1) > bx - x - int(24 * s) and hf.size > 20:
        hf = design.font(design.DISPLAY, hf.size - 2, 700)
    for t, c in head:
        d.text((x, hy), t, font=hf, fill=c, anchor="lm"); x += int(d.textlength(t, font=hf)) + int(22 * s)
    # identity line
    idf = design.font(design.DISPLAY, 40 * s, 700)
    if a.driver:
        fl = design.flag(NATION[a.driver], int(34 * s)); img.alpha_composite(fl, (L, iy - fl.height // 2))
        x = L + fl.width + int(16 * s)
        if a.team:
            ml = design.small_logo(design.require_file(design.team_logo_path(a.team), "team logo"), int(38 * s)); img.alpha_composite(ml, (x, iy - ml.height // 2)); x += ml.width + int(16 * s)
        d.text((x, iy), (a.name or a.driver).upper(), font=idf, fill=INK, anchor="lm")
    elif a.team:
        ml = design.small_logo(design.require_file(design.team_logo_path(a.team), "team logo"), int(38 * s)); img.alpha_composite(ml, (L, iy - ml.height // 2))
        d.text((L + ml.width + int(16 * s), iy), TEAMS[a.team][0].upper(), font=idf, fill=INK, anchor="lm")
    # the number (JetBrains Mono, site rule for figures), sized to stay clear of the hero
    num = a.number; nmax = W * (0.60 if (a.driver or a.team) else 0.88); nsz = 300 * s
    if a.driver: nmax = min(nmax, hero_left - L - int(40 * s))
    while d.textlength(num, font=design.font(design.MONO, nsz, 700)) > nmax and nsz > 80:
        nsz -= 6
    nf = design.font(design.MONO, nsz, 700)
    nb = d.textbbox((0, 0), num, font=nf, anchor="ls"); cap = -nb[1]
    lsz = 0
    if a.label:
        lsz = 64 * s
        while d.textlength(a.label.upper(), font=design.F(BLK, lsz)) > nmax and lsz > 30:
            lsz -= 3
    gap_nl = int(lsz * 1.25) if a.label else 0
    blockh = cap + gap_nl
    # centre the number block between the identity line and the tag row
    region_top = iy + int(40 * s); region_bot = chip_top - int(30 * s)
    ny = region_top + max(0, (region_bot - region_top - blockh) // 2) + cap
    d.text((L - int(6 * s), ny), num, font=nf, fill=FIG, anchor="ls")
    if a.label:
        d.text((L, ny + gap_nl), a.label.upper(), font=design.F(BLK, lsz), fill=accent, anchor="ls")
    # soft panel behind the headline
    sh = Image.new("RGBA", (W, H)); sd = ImageDraw.Draw(sh)
    for i in range(60):
        yy = top - int(70 * s) + i * (H - top + int(70 * s)) // 60
        sd.rectangle((0, yy, W, H), fill=GROUND + (7,))
    img.alpha_composite(sh)
    d = ImageDraw.Draw(img, "RGBA")
    d.rounded_rectangle((L, top - int(34 * s), L + int(90 * s), top - int(24 * s)), radius=int(5 * s), fill=RED)
    chips = tag_chips(a.tags, a.team, a.driver, a.name, accent, a.reported)
    cf = design.font(design.DISPLAY, 34 * s, 700); cx = L + int(90 * s) + int(22 * s); ch = int(50 * s); cy0 = top - int(29 * s) - ch // 2
    for txt, col, kind in chips:
        tw = int(d.textlength(txt, font=cf)) + int(36 * s)
        if kind == "fill":
            lum = 0.299 * col[0] + 0.587 * col[1] + 0.114 * col[2]
            d.rounded_rectangle((cx, cy0, cx + tw, cy0 + ch), radius=int(10 * s), fill=col)
            d.text((cx + tw // 2, cy0 + ch // 2), txt, font=cf, fill=GROUND if lum > 140 else INK, anchor="mm")
        else:
            d.rounded_rectangle((cx, cy0, cx + tw, cy0 + ch), radius=int(10 * s), outline=col, width=max(2, int(3 * s)))
            d.text((cx + tw // 2, cy0 + ch // 2), txt, font=cf, fill=col, anchor="mm")
        cx += tw + int(16 * s)
    for i, ln in enumerate(lines):
        d.text((L - int(2 * s), top + (i + 1) * lh), ln, font=f, fill=INK, anchor="ls")
    img.convert("RGB").save(path)


def main():
    ap = argparse.ArgumentParser(description="F1 DataStop news card (x, ig, threads in one run)")
    ap.add_argument("--headline", required=True)
    ap.add_argument("--number", required=True, help="the one big number, e.g. 102 or +0.262s")
    ap.add_argument("--label", default="", help="optional short label under the number")
    ap.add_argument("--driver", type=str.upper, help="three-letter code: headshot and flag")
    ap.add_argument("--name", help="driver name shown next to the flag (default: the code)")
    ap.add_argument("--team", help="team key, e.g. mercedes, red_bull, aston_martin")
    ap.add_argument("--accent", help="hex colour, default the team colour or teal")
    ap.add_argument("--race-flag", dest="race_flag", type=str.lower, help="iso2 flag of the race the post is for, drawn top left")
    ap.add_argument("--race", help="header text top left instead of the team name, e.g. 'Las Vegas GP' (optional)")
    ap.add_argument("--date", help="announcement date shown after the team name top left, e.g. 'Nov 12'")
    ap.add_argument("--reported", action="store_true", help="rumour variant: adds a REPORTED tag next to the team or driver tag")
    ap.add_argument("--tags", default="", help="comma-separated tag chips, e.g. 'Audi,Racing Bulls' (overrides the automatic team or driver tag)")
    ap.add_argument("--out", default=".")
    ap.add_argument("--slug", default="news_card")
    design.add_settings_args(ap)
    a = ap.parse_args(); design.apply_settings(a)
    design.require_fonts(design.SITE_FONTS)
    if a.team: a.team = team_key(a.team)
    if a.driver and a.driver not in NATION: sys.exit(f"unknown driver code {a.driver}")
    for t in (a.headline, a.number, a.label, a.name or "", a.race or "", a.date or "", a.tags or ""):
        if BANNED.search(t): sys.exit(f"banned character or URL in: {t!r}")
    os.makedirs(a.out, exist_ok=True)
    for k, (W, H) in SIZES.items():
        p = design.free_path(os.path.join(a.out, f"{a.slug}_{k}.png")); render(a, W, H, p); print(p)


if __name__ == "__main__":
    main()
