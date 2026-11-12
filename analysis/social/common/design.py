"""Shared design system for the F1 DataStop social images.

One place for the colour tokens, fonts, background, sizes, brand lockup, flags, headshots
and team colours, so every script in analysis/social draws the same thing. Tokens follow
docs/design/DESIGN_SYSTEM.md (dark theme); the social-only exceptions are listed in its
"Social images" section.

Nothing here depends on one machine. Fonts and image assets are looked up through settings:

  F1DS_FONT_DIR         folder(s) with the font files (os.pathsep separated, searched recursively)
  F1DS_ASSET_DIR        asset root, default analysis/social/assets (not committed)
  F1DS_HEADSHOT_DIR     driver portraits <CODE>.webp (default <asset root>/headshots)
  F1DS_FLAG_DIR         flags <iso2>.png (default <asset root>/flags), missing ones are fetched
  F1DS_TEAM_LOGO_DIR    team logos <team>.png (default <asset root>/team-logos)

Every script also takes --font-dir and --asset-dir, which override the environment
(see add_settings_args). Fonts are checked when rendering starts (require_fonts), not at import.
"""
import functools
import os
import time
import urllib.request

import numpy as np
from PIL import Image, ImageDraw, ImageFont

SOCIAL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # analysis/social
REPO_ROOT = os.path.dirname(os.path.dirname(SOCIAL_DIR))
LOGO = os.path.join(REPO_ROOT, "web", "public", "icon-512.png")             # the site icon

SIZES = {"x": (1080, 1350), "ig": (1080, 1440), "threads": (1440, 1920)}


# ---------------------------------------------------------------- colour tokens (dark theme)
def rgb(c):
    """'#RRGGBB' or an (r, g, b) tuple -> (r, g, b)."""
    return tuple(int(c.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)) if isinstance(c, str) else tuple(c)


def rgba(c, a):
    """Colour plus an alpha from 0 to 1."""
    return tuple(rgb(c)) + (int(round(255 * a)),)


GROUND = (0x08, 0x08, 0x0A)   # background
CARD = (0x0F, 0x0F, 0x12)     # card
RAISED = (0x17, 0x17, 0x1B)   # raised surface
MUTED = (0x1C, 0x1C, 0x21)    # muted fill (tracks, unlit chips)
BORDER = (0x2A, 0x2A, 0x30)   # hairline
BORDER_LIGHT = (0xDE, 0xDE, 0xE3)   # hairline on light charts
INK = (0xF3, 0xF4, 0xF7)      # foreground
INK2 = (0xD2, 0xD3, 0xDA)     # secondary text
MUTE = (0xAB, 0xAC, 0xB5)     # muted-foreground, quiet labels
HEAD = (0xFF, 0xE9, 0xE7)     # heading tint
FIG = (0xFF, 0xFF, 0xFF)      # figures
GAIN = (0x21, 0xC4, 0x5D)
LOSS = (0xEF, 0x4D, 0x4D)
HOLD = (0x5D, 0x5D, 0x69)
GOLD = (0xE7, 0xB0, 0x08)     # P1
PURPLE = (0xA8, 0x55, 0xF7)   # fastest time
RED = (0xE1, 0x06, 0x00)      # brand red: logo and brand marks only, never data
HOLD_OPACITY = 0.35           # held flow bands on social (the site uses 0.09)

# Team colours by Jolpica constructorId. Mirrors TEAM_COLORS in web/src/constants/f1Colors.ts;
# change both together.
TEAM_COLORS = {"red_bull": "#3671C6", "ferrari": "#F91536", "mercedes": "#27F4D2", "mclaren": "#FF8700",
    "aston_martin": "#229971", "alpine": "#FF87BC", "williams": "#37BEDD", "rb": "#5E8FAA",
    "sauber": "#52E252", "haas": "#B6BABD", "cadillac": "#C4A747", "audi": "#FF0000",
    "alphatauri": "#5E8FAA", "alfa": "#900000", "alfa_romeo": "#900000", "racing_point": "#F596C8",
    "renault": "#FFF500", "toro_rosso": "#469BFF", "force_india": "#F596C8", "default": "#888888"}

# 2026 entries as formula1.com names them: display name and the colour formula1.com uses on
# its results pages (the session cards take the team colour from the results row first).
TEAMS_2026 = {"mercedes": ("Mercedes", "#27F4D2"), "ferrari": ("Ferrari", "#E8002D"),
    "mclaren": ("McLaren", "#FF8000"), "red_bull": ("Red Bull Racing", "#3671C6"),
    "alpine": ("Alpine", "#FF87BC"), "racing_bulls": ("Racing Bulls", "#6692FF"),
    "haas": ("Haas", "#B6BABD"), "aston_martin": ("Aston Martin", "#229971"),
    "williams": ("Williams", "#1868DB"), "audi": ("Audi", "#F50537"), "cadillac": ("Cadillac", "#C4A747")}

# Country (Jolpica circuit location) -> ISO 3166 flag code.
COUNTRY_FLAG = {"Australia": "au", "China": "cn", "Japan": "jp", "Bahrain": "bh", "Saudi Arabia": "sa",
    "USA": "us", "United States": "us", "Italy": "it", "Monaco": "mc", "Spain": "es", "Canada": "ca",
    "Austria": "at", "UK": "gb", "United Kingdom": "gb", "Belgium": "be", "Hungary": "hu",
    "Netherlands": "nl", "Azerbaijan": "az", "Singapore": "sg", "Mexico": "mx", "Brazil": "br",
    "Qatar": "qa", "UAE": "ae", "United Arab Emirates": "ae", "Malaysia": "my", "Germany": "de",
    "France": "fr", "Portugal": "pt", "Argentina": "ar"}

# Driver code -> nationality flag (2026 grid and 2026 FP1 drivers; checked against Wikipedia).
NATION = {"VER": "nl", "HAD": "fr", "LEC": "mc", "HAM": "gb", "RUS": "gb", "ANT": "it", "NOR": "gb", "PIA": "au",
    "ALO": "es", "STR": "ca", "GAS": "fr", "COL": "ar", "ALB": "th", "SAI": "es", "LAW": "nz", "LIN": "gb",
    "HUL": "de", "BOR": "br", "OCO": "fr", "BEA": "gb", "PER": "mx", "BOT": "fi", "TSU": "jp", "DOO": "au",
    "VES": "dk", "IWA": "jp", "TSO": "bg", "MIN": "it", "HIR": "jp", "FOR": "it", "CRA": "us", "BRO": "gb",
    "SLA": "gb", "HER": "us", "DRU": "br", "ARO": "ee", "BEG": "it", "MAR": "es", "DUN": "ie", "SHW": "cn",
    "ZHO": "cn", "VAN": "nl", "OSU": "jp", "FIT": "br", "LIN_": "gb"}


# ---------------------------------------------------------------- settings
SETTINGS = {"font_dirs": None, "asset_dir": None}


def add_settings_args(ap):
    """Add --font-dir and --asset-dir to an argparse parser."""
    ap.add_argument("--font-dir", action="append", metavar="DIR",
                    help="folder with the font files (repeatable; default $F1DS_FONT_DIR, then the system font folders)")
    ap.add_argument("--asset-dir", metavar="DIR",
                    help="asset root with headshots/, flags/ and team-logos/ (default $F1DS_ASSET_DIR or analysis/social/assets)")
    return ap


def apply_settings(args):
    """Use the parsed --font-dir and --asset-dir values."""
    if getattr(args, "font_dir", None):
        SETTINGS["font_dirs"] = list(args.font_dir); _font_index.cache_clear()
    if getattr(args, "asset_dir", None):
        SETTINGS["asset_dir"] = args.asset_dir


def asset_dir():
    return SETTINGS["asset_dir"] or os.environ.get("F1DS_ASSET_DIR") or os.path.join(SOCIAL_DIR, "assets")


def _asset_sub(env, sub):
    d = os.environ.get(env) if not SETTINGS["asset_dir"] else None
    return d or os.path.join(asset_dir(), sub)


def headshot_dir(): return _asset_sub("F1DS_HEADSHOT_DIR", "headshots")
def flag_dir(): return _asset_sub("F1DS_FLAG_DIR", "flags")
def team_logo_dir(): return _asset_sub("F1DS_TEAM_LOGO_DIR", "team-logos")
def headshot_cache_dir(): return os.path.join(headshot_dir(), "session")   # portraits fetched from results rows


def headshot_path(code):
    """<headshot dir>/<CODE>.webp (may not exist)."""
    return os.path.join(headshot_dir(), code + ".webp")


def team_logo_path(team):
    """<team logo dir>/<team>.png (may not exist)."""
    return os.path.join(team_logo_dir(), (team or "") + ".png")


def require_file(path, what):
    """Raise FileNotFoundError naming the setting to change when an asset is missing."""
    if not os.path.exists(path):
        raise FileNotFoundError(f"{what} not found: {path} (set --asset-dir or F1DS_ASSET_DIR, "
                                "or the F1DS_*_DIR variable for that folder)")
    return path


# ---------------------------------------------------------------- fonts
class FontNotFoundError(RuntimeError):
    pass


# Site type (web/index.html): static instances of Saira Condensed, Saira and JetBrains Mono.
DISPLAY = {600: "SairaCondensed-SemiBold.ttf", 700: "SairaCondensed-Bold.ttf", 800: "SairaCondensed-ExtraBold.ttf"}
SANS = {500: "Saira-Medium.ttf", 600: "Saira-SemiBold.ttf", 700: "Saira-Bold.ttf"}
MONO = {500: "JetBrainsMono-Medium.ttf", 600: "JetBrainsMono-SemiBold.ttf", 700: "JetBrainsMono-Bold.ttf"}
SITE_FONTS = sorted(set(DISPLAY.values()) | set(SANS.values()) | set(MONO.values()))

# Condensed card type used by the session results and news cards.
CARD_BLACK = "BarlowCondensed-Black.ttf"
CARD_XBOLD = "BarlowCondensed-ExtraBold.ttf"
CARD_BOLD = "BarlowCondensed-Bold.ttf"
CARD_SEMI = "BarlowCondensed-SemiBold.ttf"
CARD_MEDIUM = "BarlowCondensed-Medium.ttf"
CARD_TEXT = "TitilliumWeb-SemiBold.ttf"
CARD_BADGE = "Barlow-Bold.ttf"          # tyre letters: a clean S (the condensed S reads like a $ when small)
CARD_FONTS = [CARD_BLACK, CARD_XBOLD, CARD_BOLD]
FALLBACK = {CARD_SEMI: CARD_BOLD, CARD_MEDIUM: CARD_BOLD, CARD_BADGE: "DejaVuSans-Bold.ttf"}   # optional faces


def font_dirs():
    d = SETTINGS["font_dirs"] or [p for p in os.environ.get("F1DS_FONT_DIR", "").split(os.pathsep) if p]
    return d + [os.path.join(REPO_ROOT, "analysis", "fonts"), os.path.expanduser("~/.local/share/fonts"),
                os.path.expanduser("~/.fonts"), "/usr/local/share/fonts", "/usr/share/fonts",
                "/Library/Fonts", os.path.expanduser("~/Library/Fonts")]


@functools.lru_cache(maxsize=1)
def _font_index():
    idx = {}
    for root in font_dirs():
        for dp, _, files in os.walk(os.path.expanduser(root)):
            for f in files:
                idx.setdefault(f, os.path.join(dp, f))   # first folder wins
    return idx


def font_path(name):
    """Full path of a font file name, searched in font_dirs(); optional weights fall back."""
    if os.path.isabs(name) and os.path.exists(name): return name
    p = _font_index().get(name) or (FALLBACK.get(name) and _font_index().get(FALLBACK[name]))
    if not p:
        raise FontNotFoundError(f"font {name} not found in: {', '.join(font_dirs())}. "
                                "Pass --font-dir DIR or set F1DS_FONT_DIR.")
    return p


def require_fonts(names):
    """Call when rendering starts: raise one clear error listing every missing font."""
    missing = [n for n in names if n not in _font_index() and not (FALLBACK.get(n) in _font_index())]
    if missing:
        raise FontNotFoundError(f"missing fonts (no fallback allowed): {', '.join(missing)}. Searched: "
                                f"{', '.join(font_dirs())}. Pass --font-dir DIR or set F1DS_FONT_DIR.")


def F(name, size):
    """Font file name (or path) at a pixel size."""
    return ImageFont.truetype(font_path(name), max(1, int(size)))


def font(fam, size, weight):
    """fam is DISPLAY, SANS or MONO; the nearest available static weight is used."""
    w = min(fam, key=lambda k: abs(k - weight))
    return F(fam[w], size)


# ---------------------------------------------------------------- background and brand
def background(W, H):
    """Social background: carbon weave and a red glow on the site ground. No livery stripe and
    no watermark on social images."""
    y, x = np.mgrid[0:H, 0:W]; base = np.array(GROUND, float); s = max(1, W // 180)
    cf = ((((x // (6 * s)) + (y // (6 * s))) % 2) * 2 - 1) * ((x + y) % (6 * s) < 3 * s) * 3.0
    g = np.exp(-(((x - W) / (W * .55)) ** 2 + (y / (H * .40)) ** 2)) * 0.14 \
        + np.exp(-((x / (W * .5)) ** 2 + ((y - H) / (H * .3)) ** 2)) * 0.07
    im = np.clip(base + cf[..., None] + g[..., None] * (np.array(RED) - base), 0, 255)
    return Image.fromarray(im.astype("uint8")).convert("RGBA")


def brand(img, right, cy, h, text="F1 DataStop"):
    """Site icon + wordmark, right-aligned at x=right, centred on cy. Returns the left x."""
    d = ImageDraw.Draw(img); lg = Image.open(require_file(LOGO, "site icon")).convert("RGBA").resize((h, h), Image.LANCZOS)
    text = text.upper(); f = F(DISPLAY[700], h * .62); x = int(right - d.textlength(text, font=f))
    d.text((x, cy), text, font=f, fill=INK, anchor="lm")   # site lockup: name in Saira Condensed caps
    lx = int(x - h * 1.25); img.alpha_composite(lg, (lx, int(cy - h / 2))); return lx


def small_logo(path, h):
    """A transparent logo trimmed and scaled to height h (at most 2.2 h wide)."""
    lg = Image.open(path).convert("RGBA"); lg = lg.crop(lg.getbbox()); s = h / lg.height
    if lg.width * s > h * 2.2: s = h * 2.2 / lg.width
    return lg.resize((max(1, int(lg.width * s)), max(1, int(lg.height * s))), Image.LANCZOS)


# ---------------------------------------------------------------- flags
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) f1datastop"}


def ensure_flag(cc):
    """Make sure <flag dir>/<cc>.png exists, fetching it from flagcdn.com once if needed. Returns cc."""
    d = flag_dir(); p = os.path.join(d, cc + ".png")
    if not os.path.exists(p):
        os.makedirs(d, exist_ok=True)
        with urllib.request.urlopen(urllib.request.Request(f"https://flagcdn.com/w320/{cc}.png", headers=UA), timeout=30) as r:
            b = r.read()
        with open(p, "wb") as f: f.write(b)
        with open(os.path.join(d, "SOURCES_ADDED.txt"), "a") as f:
            f.write(f"{cc}.png flagcdn.com/w320/{cc}.png (added {time.strftime('%Y-%m-%d')})\n")
    return cc


def flag(cc, h, line=BORDER):
    """Site CountryFlag: 4:3 cover crop, corners at 20% of the height, and a hairline in the
    border colour outside the flag (pass line=BORDER_LIGHT on light charts)."""
    f = Image.open(os.path.join(flag_dir(), ensure_flag(cc) + ".png")).convert("RGBA"); w = int(round(h * 4 / 3))
    sc = max(w / f.width, h / f.height)
    f = f.resize((max(w, int(round(f.width * sc))), max(h, int(round(f.height * sc)))), Image.LANCZOS)
    l_, t_ = (f.width - w) // 2, (f.height - h) // 2; f = f.crop((l_, t_, l_ + w, t_ + h))   # object-fit: cover
    rad = max(1, round(h * 0.2)); lw = max(1, round(h / 24))
    o = Image.new("RGBA", (w + 2 * lw, h + 2 * lw))
    ImageDraw.Draw(o).rounded_rectangle((0, 0, w + 2 * lw - 1, h + 2 * lw - 1), radius=rad + lw, fill=tuple(line) + (255,))
    m = Image.new("L", (w, h)); ImageDraw.Draw(m).rounded_rectangle((0, 0, w - 1, h - 1), radius=rad, fill=255)
    o.paste(f, (lw, lw), m); return o


def free_path(path):
    """path, or path with _2, _3 ... before the extension when it already exists (never overwrite)."""
    if not os.path.exists(path): return path
    b, e = os.path.splitext(path); i = 2
    while os.path.exists(f"{b}_{i}{e}"): i += 1
    return f"{b}_{i}{e}"
