#!/usr/bin/env python3
"""F1 DataStop news card: one headline, one number, optional driver or team. All 3 sizes per run.

  python3 news_card.py --headline "..." --number 102 [--label "POINTS CLEAR"]
                       [--driver ANT [--name "Kimi Antonelli"] | --team mercedes]
                       [--accent "#27F4D2"] [--out DIR] [--slug NAME]

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

BLK, BLD = design.CARD_BLACK, design.CARD_BOLD
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
    s = W / 1080.0; v = H / 1350.0
    accent = design.rgb(a.accent) if a.accent else (design.rgb(TEAMS[a.team][1]) if a.team else TEAL)
    img = design.background(W, H); d = ImageDraw.Draw(img, "RGBA")
    L = int(60 * s)
    # hero, right side, behind the text
    if a.driver:
        hero = hero_driver(a.driver, int(H * 0.56))
        img.alpha_composite(hero, (W - hero.width + int(30 * s), int(112 * v)))
    elif a.team:
        lg = Image.open(design.require_file(design.team_logo_path(a.team), "team logo")).convert("RGBA"); lg = lg.crop(lg.getbbox())
        sc = min(W * 0.42 / lg.width, H * 0.26 / lg.height)
        lg = lg.resize((int(lg.width * sc), int(lg.height * sc)), Image.LANCZOS)
        img.alpha_composite(lg, (W - lg.width - int(70 * s), int(H * 0.30 - lg.height / 2)))
    design.brand(img, W - int(60 * s), int(78 * s), int(56 * s))
    # identity line
    iy = int(178 * s)
    if a.driver:
        fl = design.flag(NATION[a.driver], int(34 * s)); img.alpha_composite(fl, (L, iy - fl.height // 2))
        x = L + fl.width + int(16 * s)
        if a.team:
            ml = design.small_logo(design.require_file(design.team_logo_path(a.team), "team logo"), int(38 * s)); img.alpha_composite(ml, (x, iy - ml.height // 2)); x += ml.width + int(16 * s)
        d.text((x, iy), (a.name or a.driver).upper(), font=design.F(BLD, 40 * s), fill=INK, anchor="lm")
    elif a.team:
        ml = design.small_logo(design.require_file(design.team_logo_path(a.team), "team logo"), int(38 * s)); img.alpha_composite(ml, (L, iy - ml.height // 2))
        d.text((L + ml.width + int(16 * s), iy), TEAMS[a.team][0].upper(), font=design.F(BLD, 40 * s), fill=INK, anchor="lm")
    # the number, sized to stay clear of the hero
    num = a.number; nmax = W * (0.60 if (a.driver or a.team) else 0.88); nsz = 330 * s
    while d.textlength(num, font=design.F(BLK, nsz)) > nmax and nsz > 80:
        nsz -= 6
    ny = int(H * 0.40)
    d.text((L - int(8 * s), ny), num, font=design.F(BLK, nsz), fill=INK, anchor="ls")
    if a.label:
        lsz = 72 * s
        while d.textlength(a.label.upper(), font=design.F(BLK, lsz)) > nmax and lsz > 30:
            lsz -= 3
        d.text((L, ny + int(lsz * 1.05)), a.label.upper(), font=design.F(BLK, lsz), fill=accent, anchor="ls")
    # headline: bottom block on a soft panel, auto-sized to max 4 lines
    hw = W - 2 * L; hsz = 92 * s
    while True:
        f = design.F(BLK, hsz); lines = wrap(d, a.headline.upper(), f, hw)
        if len(lines) <= 4 or hsz < 40 * s: break
        hsz -= 4
    lh = int(hsz * 1.02); block = lh * len(lines)
    top = int(H - 96 * s - block)
    sh = Image.new("RGBA", (W, H)); sd = ImageDraw.Draw(sh)
    for i in range(60):
        yy = top - int(70 * s) + i * (H - top + int(70 * s)) // 60
        sd.rectangle((0, yy, W, H), fill=GROUND + (7,))
    img.alpha_composite(sh)
    d = ImageDraw.Draw(img, "RGBA")
    d.rounded_rectangle((L, top - int(34 * s), L + int(90 * s), top - int(24 * s)), radius=int(5 * s), fill=RED)
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
    ap.add_argument("--out", default=".")
    ap.add_argument("--slug", default="news_card")
    design.add_settings_args(ap)
    a = ap.parse_args(); design.apply_settings(a)
    design.require_fonts(design.SITE_FONTS + design.CARD_FONTS)
    if a.team: a.team = team_key(a.team)
    if a.driver and a.driver not in NATION: sys.exit(f"unknown driver code {a.driver}")
    for t in (a.headline, a.number, a.label, a.name or ""):
        if BANNED.search(t): sys.exit(f"banned character or URL in: {t!r}")
    os.makedirs(a.out, exist_ok=True)
    for k, (W, H) in SIZES.items():
        p = design.free_path(os.path.join(a.out, f"{a.slug}_{k}.png")); render(a, W, H, p); print(p)


if __name__ == "__main__":
    main()
