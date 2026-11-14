#!/usr/bin/env python3
"""F1 DataStop statement card (pixel style): one checked fact as one plain sentence, plus one
big pixel number. No lead-in, no label, no "did you know". All 3 sizes per run.

  python3 statement_card.py --number 20 \
      --statement "Kimi Antonelli won the 2026 title aged 20 years and 68 days, the youngest champion in F1 history." \
      --driver ANT --name "Kimi Antonelli" --team mercedes --race-flag mx --race "Mexico City GP" \
      [--theme dark|light] [--out DIR] [--slug NAME]

Our own pixel look: the number is set in a chunky 5x7 pixel face with a team-colour drop shadow,
and a pixel-art 2026-style car in the team colour runs along a pixel track at the foot of the
card. Brand red only appears in the logo lockup. Background, tokens, fonts,
flags, headshots and logos come from ../common/design.py. Writes DIR/<slug>_x.png 1080x1350,
_ig 1080x1440, _threads 1440x1920 and never overwrites (a clash gets _2, _3 ...).
"""
import argparse, os, re, sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))   # analysis/social
from common import design                                                         # noqa: E402

NATION, TEAMS, SIZES = design.NATION, design.TEAMS_2026, design.SIZES
BANNED = re.compile(r"[|\u2022\u00b7]|https?://|www\.|\.com\b|fun fact|did you know", re.I)

# Site palettes (DESIGN_SYSTEM.md v1.8.1): dark is the social default, light the alternative.
THEMES = {
    "dark": dict(ground=design.GROUND, ink=design.INK, ink2=design.INK2, quiet=design.MUTE, head=design.HEAD,
                 fig=design.FIG, line=design.BORDER, raised=design.RAISED, tyre=(0x26, 0x26, 0x2C), rim=(0x5D, 0x5D, 0x69)),
    "light": dict(ground=(0xF5, 0xF5, 0xF7), ink=(0x0A, 0x0A, 0x0F), ink2=(0x44, 0x44, 0x4E), quiet=(0x5D, 0x5D, 0x69),
                  head=(0x4A, 0x07, 0x03), fig=(0x0A, 0x0A, 0x0F), line=design.BORDER_LIGHT, raised=(0xFF, 0xFF, 0xFF),
                  tyre=(0x1C, 0x1C, 0x21), rim=(0xAB, 0xAB, 0xB5)),
}

# Chunky 5x7 pixel figures (our own face).
GLYPHS = {
    "0": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
    "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
    "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
    "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
    "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
    ".": ["0", "0", "0", "0", "0", "1", "1"],
    ":": ["0", "1", "1", "0", "1", "1", "0"],
    "x": ["00000", "00000", "10001", "01010", "00100", "01010", "10001"],
}


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


def shade(c, f):
    return tuple(int(max(0, min(255, v * f))) for v in c)


def pixel_cell(d, x, y, c, col, bevel=True):
    """One chunky pixel: a square with a light top-left and dark bottom-right edge."""
    d.rectangle((x, y, x + c - 1, y + c - 1), fill=col)
    if bevel and c >= 8:
        e = max(2, c // 7)
        d.rectangle((x, y, x + c - 1, y + e - 1), fill=shade(col, 1.18) if sum(col) < 600 else col)
        d.rectangle((x, y + c - e, x + c - 1, y + c - 1), fill=shade(col, 0.86))
        d.rectangle((x + c - e, y, x + c - 1, y + c - 1), fill=shade(col, 0.9))


def number_size(text, cell):
    gap = 1   # one empty column between glyphs
    cols = sum(len(GLYPHS[ch][0]) for ch in text) + gap * (len(text) - 1)
    return cols * cell, 7 * cell


def draw_number(img, text, x, y, cell, face, shadow):
    d = ImageDraw.Draw(img)
    for pass_, (dx, dy, col) in enumerate(((cell // 3, cell // 3, shadow), (0, 0, face))):
        cx = x
        for ch in text:
            g = GLYPHS[ch]
            for r, row in enumerate(g):
                for k, bit in enumerate(row):
                    if bit == "1":
                        pixel_cell(d, cx + k * cell + dx, y + r * cell + dy, cell - max(1, cell // 14), col, bevel=pass_ == 1)
            cx += (len(g[0]) + 1) * cell


def car_sprite(team, t):
    """2026-style F1 car, side view, nose right, on a 72x20 grid. Returns an RGBA grid image."""
    g = Image.new("RGBA", (72, 20), (0, 0, 0, 0)); d = ImageDraw.Draw(g)
    dark = shade(team, 0.55); hi = shade(team, 1.25) if sum(team) < 600 else team
    # rear wing: endplate, two elements, pillar
    d.rectangle((2, 2, 4, 9), fill=t["tyre"]); d.rectangle((3, 2, 11, 3), fill=team); d.rectangle((3, 5, 10, 5), fill=dark)
    d.rectangle((8, 6, 9, 10), fill=t["tyre"])
    # body: sidepod, engine cover with airbox, nose taper
    d.polygon([(6, 13), (8, 10), (16, 9), (26, 8), (29, 4), (33, 4), (35, 7), (44, 8), (54, 10), (64, 12), (68, 13), (68, 14), (6, 14)], fill=team)
    d.rectangle((16, 9, 44, 9), fill=hi)                     # top highlight
    d.rectangle((18, 11, 40, 12), fill=dark)                 # sidepod shadow
    d.rectangle((30, 5, 32, 6), fill=t["tyre"])              # airbox intake
    # cockpit: helmet and halo
    d.rectangle((36, 5, 39, 7), fill=t["ink"]); d.rectangle((37, 6, 39, 6), fill=t["tyre"])
    d.line((35, 4, 41, 4), fill=t["tyre"]); d.line((41, 4, 43, 7), fill=t["tyre"])
    # floor and front wing
    d.rectangle((10, 15, 64, 15), fill=t["tyre"])
    d.rectangle((60, 16, 71, 16), fill=team); d.rectangle((69, 12, 71, 16), fill=t["tyre"])
    # wheels: tyre, sidewall ring, team hub
    for cx in (15, 54):
        d.ellipse((cx - 5, 10, cx + 5, 19), fill=t["tyre"])
        d.rectangle((cx - 2, 13, cx + 2, 16), fill=t["rim"]); d.rectangle((cx - 1, 14, cx + 1, 15), fill=team)
    return g


def draw_sprite(img, grid, x, y, cell):
    d = ImageDraw.Draw(img); a = np.array(grid); gap = max(1, cell // 9)
    for r in range(a.shape[0]):
        for k in range(a.shape[1]):
            if a[r, k, 3]:
                d.rectangle((x + k * cell, y + r * cell, x + (k + 1) * cell - gap - 1, y + (r + 1) * cell - gap - 1), fill=tuple(a[r, k, :3]))


def round_headshot(code, size, ring):
    hs = Image.open(design.require_file(design.headshot_path(code), "headshot")).convert("RGBA"); bb = hs.getbbox()
    w = bb[2] - bb[0]; side = int(w * 0.62); cx = (bb[0] + bb[2]) // 2
    crop = hs.crop((cx - side // 2, bb[1] + int(side * 0.02), cx + side // 2, bb[1] + int(side * 1.02))).resize((size, size), Image.LANCZOS)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0)); od = ImageDraw.Draw(out)
    od.ellipse((0, 0, size - 1, size - 1), fill=shade(ring, 0.35) + (255,))
    m = Image.new("L", (size, size), 0); ImageDraw.Draw(m).ellipse((0, 0, size - 1, size - 1), fill=255)
    out.paste(crop, (0, 0), Image.composite(crop.split()[3], Image.new("L", (size, size), 0), m))
    rw = max(3, size // 22); od.ellipse((rw // 2, rw // 2, size - 1 - rw // 2, size - 1 - rw // 2), outline=ring + (255,), width=rw)
    return out


def light_background(W, H, t):
    """Light ground with a faint pixel grid (social only; no stripes, no watermark)."""
    y, x = np.mgrid[0:H, 0:W]; p = max(18, W // 45)
    chk = (((x // p) + (y // p)) % 2 == 0) * 3.5                      # faint pixel checker
    glow = np.exp(-(((x - W) / (W * .55)) ** 2 + (y / (H * .40)) ** 2)) * 0.05   # soft brand glow, top right
    base = np.array(t["ground"], float)
    im = base - chk[..., None] + glow[..., None] * (np.array(design.RED) - base)
    return Image.fromarray(np.clip(im, 0, 255).astype("uint8")).convert("RGBA")


def render(a, W, H, path):
    t = THEMES[a.theme]; s = W / 1080.0; L = int(64 * s); R = W - L
    team = design.rgb(a.accent) if a.accent else (design.rgb(TEAMS[a.team][1]) if a.team else design.rgb("#27F4D2"))
    img = design.background(W, H) if a.theme == "dark" else light_background(W, H, t)
    d = ImageDraw.Draw(img, "RGBA")
    # header: race flag + race name top left, logo + wordmark top right
    hy = int(78 * s)
    if a.theme == "dark":
        bx = design.brand(img, R, hy, int(56 * s))
    else:   # same lockup, dark wordmark
        lg = Image.open(design.require_file(design.LOGO, "site icon")).convert("RGBA").resize((int(56 * s),) * 2, Image.LANCZOS)
        f = design.F(design.DISPLAY[700], 56 * s * .62); x = int(R - d.textlength("F1 DATASTOP", font=f))
        d.text((x, hy), "F1 DATASTOP", font=f, fill=t["ink"], anchor="lm"); bx = int(x - 56 * s * 1.25)
        img.alpha_composite(lg, (bx, hy - lg.height // 2))
    if a.race_flag:
        fl = design.flag(a.race_flag, int(40 * s), line=t["line"]); img.alpha_composite(fl, (L, hy - fl.height // 2))
        if a.race:
            d.text((L + fl.width + int(16 * s), hy), a.race.upper(), font=design.font(design.DISPLAY, 40 * s, 700), fill=t["ink"], anchor="lm")
    # identity: round headshot ringed in team colour, flag, team logo, name
    iy = int(196 * s); hs_size = int(124 * s); x = L
    if a.driver:
        hs = round_headshot(a.driver, hs_size, team); img.alpha_composite(hs, (x, iy)); x += hs_size + int(24 * s)
    name = (a.name or (TEAMS[a.team][0] if a.team else "")).upper()
    d.text((x, iy + int(hs_size * 0.36)), name, font=design.font(design.DISPLAY, 56 * s, 700), fill=t["ink"], anchor="lm")
    sub_y = iy + int(hs_size * 0.78); sx = x
    if a.driver:
        fl = design.flag(NATION[a.driver], int(30 * s), line=t["line"]); img.alpha_composite(fl, (sx, sub_y - fl.height // 2)); sx += fl.width + int(14 * s)
    if a.team:
        lp = design.require_file(design.team_logo_path(a.team), "team logo")
        ml = design.small_logo(lp, int(32 * s))
        if a.theme == "light":   # white logo files: tint them to ink on the light ground
            al = ml.split()[3]; ml = Image.new("RGBA", ml.size, t["ink"] + (255,)); ml.putalpha(al)
        img.alpha_composite(ml, (sx, sub_y - ml.height // 2)); sx += ml.width + int(14 * s)
        d.text((sx, sub_y), TEAMS[a.team][0], font=design.font(design.SANS, 30 * s, 600), fill=t["ink2"], anchor="lm")
    # bottom: pixel track and car
    car = car_sprite(team, t); ccell = int(W * 0.56 / 72); cw, chh = 72 * ccell, 20 * ccell
    track_y = H - int(118 * s); car_x = R - cw; car_y = track_y - chh
    tc = ccell; n = (R - L) // tc
    for i in range(n):   # track: kerb pixels in hairline and quiet tones
        pixel_cell(d, L + i * tc, track_y + tc // 2, tc - max(1, tc // 9), t["line"] if i % 2 else t["rim"], bevel=False)
    trail = Image.new("RGBA", (W, H), (0, 0, 0, 0)); td = ImageDraw.Draw(trail)
    for i, al in enumerate((0.85, 0.6, 0.4, 0.22)):   # speed trail in team colour
        for row in (9, 12):
            ln = int((5 - i) * 2.2)
            xx = car_x - (i * 9 + 3) * ccell
            if xx - ln * ccell < L: continue
            for k in range(ln):
                td.rectangle((xx - k * ccell, car_y + row * ccell, xx - k * ccell + ccell - 2, car_y + (row + 1) * ccell - 2), fill=team + (int(255 * al),))
    img.alpha_composite(trail)
    draw_sprite(img, car, car_x, car_y, ccell); d = ImageDraw.Draw(img, "RGBA")
    # statement: one plain sentence, sized to fit 4 lines max above the car
    top_free = iy + hs_size + int(24 * s); bot_free = car_y - int(30 * s)
    ssz = 76 * s
    while True:
        sf = design.font(design.DISPLAY, ssz, 700); lines = wrap(d, a.statement, sf, R - L)
        if len(lines) <= 4 or ssz < 40 * s: break
        ssz -= 2
    lh = int(ssz * 1.08); sblock = lh * len(lines)
    # big pixel number: as large as fits the space left
    avail_h = bot_free - top_free - sblock - int(60 * s)
    cell = int(min(avail_h / 7.4, (R - L) / max(1, number_size(a.number, 1)[0] + 0.5), 96 * s))
    nw, nh = number_size(a.number, cell)
    gap = (bot_free - top_free - nh - cell // 2 - sblock) // 3
    ny = top_free + gap
    draw_number(img, a.number, L, ny, cell, t["fig"], team); d = ImageDraw.Draw(img, "RGBA")
    sy = ny + nh + cell // 2 + gap
    for i, ln in enumerate(lines):
        d.text((L, sy + i * lh), ln, font=sf, fill=t["head"] if a.theme == "dark" else t["ink"], anchor="la")
    img.convert("RGB").save(path)


def main():
    ap = argparse.ArgumentParser(description="F1 DataStop pixel statement card (x, ig, threads in one run)")
    ap.add_argument("--number", required=True, help="the one big number, drawn in pixels: digits and + - % . : x")
    ap.add_argument("--statement", required=True, help="the fact as one plain sentence, no lead-in")
    ap.add_argument("--driver", type=str.upper, help="three-letter code: round headshot and flag")
    ap.add_argument("--name", help="name shown in the identity line (default: the team name)")
    ap.add_argument("--team", help="team key: logo, colour of the car, ring and number shadow")
    ap.add_argument("--accent", help="hex colour override for the team colour")
    ap.add_argument("--race-flag", dest="race_flag", type=str.lower, help="iso2 flag of the race, top left")
    ap.add_argument("--race", help="race name next to the flag")
    ap.add_argument("--theme", choices=THEMES, default="dark")
    ap.add_argument("--out", default=".")
    ap.add_argument("--slug", default="statement_card")
    design.add_settings_args(ap)
    a = ap.parse_args(); design.apply_settings(a)
    design.require_fonts(design.SITE_FONTS)
    if a.team: a.team = team_key(a.team)
    if a.driver and a.driver not in NATION: sys.exit(f"unknown driver code {a.driver}")
    bad = [ch for ch in a.number if ch not in GLYPHS]
    if bad: sys.exit(f"number has characters without a pixel glyph: {bad}")
    for txt in (a.statement, a.number, a.name or "", a.race or ""):
        if BANNED.search(txt): sys.exit(f"banned character, lead-in or URL in: {txt!r}")
    os.makedirs(a.out, exist_ok=True)
    for k, (W, H) in SIZES.items():
        p = design.free_path(os.path.join(a.out, f"{a.slug}_{k}.png")); render(a, W, H, p); print(p)


if __name__ == "__main__":
    main()
