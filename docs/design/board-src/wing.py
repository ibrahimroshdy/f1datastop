"""Logo round 3: today's mark, redrawn. The F1 DataStop logo is the rear wing of an F1
car seen from behind, on a red disc (logo.svg). The owner keeps the idea (2026-11-10:
"don't need a revamp of logo but need the existing one better"), so this round redraws
it in flat colours with parts thick enough to survive 16 px. One 64-unit geometry per
version; colours are fixed brand colours, not theme variables.
"""
import pathlib
import re

RED, CARBON, WHITE = "#E10600", "#0F0F12", "#FFFFFF"
_n = [0]


def _band(x0, x1, y, h, arch):
    """A wing element seen from behind: an arched band, ends at y, centre `arch` higher."""
    return (f"M{x0} {y} Q32 {y - 2 * arch} {x1} {y} L{x1} {y + h} Q32 {y + h - 2 * arch} {x0} {y + h} Z")


def _disc(inner):
    return f'<circle cx="32" cy="32" r="31" fill="{RED}"/>{inner}'


def _plates(top=15, bot=45, dx=0):
    j = f'stroke="{CARBON}" stroke-width="2" stroke-linejoin="round"'
    return (f'<path d="M{9 - dx} {top} H{15 - dx} L{17 - dx} {bot} H{12 - dx} Z" fill="{CARBON}" {j}/>'
            f'<path d="M{55 + dx} {top} H{49 + dx} L{47 + dx} {bot} H{52 + dx} Z" fill="{CARBON}" {j}/>')


def _pylon(y0=36, y1=55):
    return f'<rect x="29.75" y="{y0}" width="4.5" height="{y1 - y0}" rx="1.5" fill="{WHITE}"/>'


def refined():
    """Main plane and flap between two endplates, on the swan-neck pylon."""
    return _disc(_pylon() + f'<path d="{_band(14, 50, 20, 5.5, 1.5)}" fill="{CARBON}"/>'
                 f'<path d="{_band(14, 50, 28.5, 8.5, 1.5)}" fill="{CARBON}"/>' + _plates())


def bold():
    """One thick element, so the wing reads as a single dark bar at 16 px."""
    return _disc(_pylon(34) + f'<path d="{_band(13, 51, 20, 15, 1.5)}" fill="{CARBON}"/>'
                 f'<path d="M17 26.4 Q32 23.4 47 26.4" fill="none" stroke="{RED}" stroke-width="2.2"/>' + _plates(15, 44))


def open_flap():
    """The flap lifted off the main plane with the slot open: the wing in its low-drag mode."""
    return _disc(_pylon() + f'<path d="{_band(14, 50, 15.5, 5, 1.5)}" fill="{CARBON}"/>'
                 f'<path d="{_band(14, 50, 28.5, 8.5, 1.5)}" fill="{CARBON}"/>'
                 f'<path d="M23 21.5 V27.5 M41 21.5 V27.5" stroke="{WHITE}" stroke-width="2.4" stroke-linecap="round"/>'
                 + _plates(12, 45))


def square():
    """The refined wing on a red rounded square, for app icons that are square anyway."""
    return (f'<rect width="64" height="64" rx="15" fill="{RED}"/>' + _pylon(36, 64)
            + f'<path d="{_band(12, 52, 19, 6, 1.5)}" fill="{CARBON}"/>'
            f'<path d="{_band(12, 52, 28, 9, 1.5)}" fill="{CARBON}"/>' + _plates(13, 47, 2))


def today():
    """logo.svg as it ships today, scaled into the 64 box, ids made unique."""
    src = (pathlib.Path(__file__).parents[3] / "logo.svg").read_text()
    inner = re.search(r"<svg[^>]*>(.*)</svg>", src, re.S).group(1)
    _n[0] += 1
    k = _n[0]
    inner = re.sub(r'id="(\w+)"', lambda m: f'id="{m.group(1)}{k}"', inner)
    inner = re.sub(r"url\(#(\w+)\)", lambda m: f"url(#{m.group(1)}{k})", inner)
    return f'<g transform="scale(0.4)">{inner}</g>'


VERSIONS = [
    ("today", "Today", "logo.svg as it ships. The gradient, the thin white strokes and the faint rim disappear below 32 px; at 16 px it is a red dot.", today),
    ("refined", "Refined", "The same wing, flat: main plane, flap and endplates in carbon on the white pylon, all thick enough to hold at 16 px. Closest to today.", refined),
    ("bold", "Bold", "Main plane and flap merged into one bar, with a red line for the slot. The plainest at 16 px.", bold),
    ("open", "Open flap", "The flap lifted off the main plane on its two actuators, the slot open: the wing in its low-drag mode. More character, more parts.", open_flap),
    ("square", "Square", "The refined wing on a red rounded square instead of a disc. Fills a home-screen icon edge to edge.", square),
]


def svg(inner, size, label=None):
    a = f'role="img" aria-label="{label}"' if label else 'aria-hidden="true"'
    return f'<svg width="{size}" height="{size}" viewBox="0 0 64 64" {a}>{inner}</svg>'


def app_icon(key, fn):
    """A 180 px home-screen icon: the square version fills it; a disc sits on a carbon tile."""
    if key == "square":
        return svg(fn(), 180)
    return svg(f'<rect width="64" height="64" rx="14.2" fill="{CARBON}"/><g transform="translate(32 32) scale(.84) translate(-32 -32)">{fn()}</g>', 180)


def wing_round():
    out = []
    for key, name, why, fn in VERSIONS:
        sizes = "".join(f"<figure>{svg(fn(), s)}<figcaption>{s} px</figcaption></figure>" for s in (16, 32, 64))
        app = f"<figure>{app_icon(key, fn)}<figcaption>180 px app icon</figcaption></figure>"
        lock = (f'<span class="lockup" role="img" aria-label="F1 DataStop, {name} logo">{svg(fn(), 44)}'
                '<span class="word"><span class="w1">F1</span> <span class="w2">DataStop</span></span></span>')
        stages = "".join(f'<div class="stage c-flood t-{t}"><div class="sizes">{sizes}</div>{app}{lock}</div>' for t in ("dark", "light"))
        out.append(f'<article class="logo" id="logo-{key}"><header><h3>{name}</h3><p>{why}</p></header>'
                   f'<div class="logo-stages">{stages}</div></article>')
    return "".join(out)
