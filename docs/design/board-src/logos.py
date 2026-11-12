"""Logo rounds for F1 DataStop. Round 1 offered six marks; Stop flag was
picked, so round 2 shows it in F1 DataStop red with three variations. One 64-unit geometry per mark, so every size on the
board is the same drawing. Colours are CSS variables, so a mark takes the colours of
whichever concept it sits in: --tile (ground), --ink (strokes) and --mark (the one accent).
"""

INK = "stroke:var(--ink)"
MARK = "fill:var(--mark)"


def apex():
    """A racing line through a corner, the apex hit."""
    return ('<path d="M17 52 C17 32 30 19 50 17" style="fill:none;stroke:var(--ink);stroke-width:7;stroke-linecap:round"/>'
            f'<circle cx="19.5" cy="21.5" r="6.5" style="{MARK}"/>')


def pitbox():
    """A D drawn as the pit lane, with the car's box in the middle."""
    return ('<path d="M18 12 H31 C44.5 12 53 20.5 53 32 C53 43.5 44.5 52 31 52 H18 Z" '
            'style="fill:none;stroke:var(--ink);stroke-width:7;stroke-linejoin:round"/>'
            f'<rect x="25" y="24.5" width="15" height="15" rx="3" style="{MARK}"/>')


def stopflag():
    """A stop octagon (the Stop in DataStop) carrying a chequered flag."""
    o = "32,9 48.3,15.7 55,32 48.3,48.3 32,55 15.7,48.3 9,32 15.7,15.7"
    sq = "".join(f'<rect x="{22 + 5 * c}" y="{22 + 5 * r}" width="5.05" height="5.05" style="fill:var(--on-mark)"/>'
                 for r in range(4) for c in range(4) if (r + c) % 2 == 0)
    return f'<polygon points="{o}" style="{MARK};stroke:var(--mark);stroke-width:2;stroke-linejoin:round"/>{sq}'


def pitboard():
    """The pit board held over the wall: P1."""
    return ('<rect x="10" y="9" width="44" height="34" rx="6" style="fill:var(--ink)"/>'
            '<rect x="29" y="43" width="6" height="13" rx="2" style="fill:var(--ink);opacity:.55"/>'
            '<text x="32" y="35" text-anchor="middle" style="font:700 24px var(--mono);fill:var(--ground);letter-spacing:-1px">P1</text>'
            f'<rect x="10" y="9" width="44" height="7" rx="3" style="{MARK}"/>')


def trace():
    """A speed trace: flat out, brake, turn in, back on the power."""
    return ('<path d="M11 20 H27 L33 45 Q35 50 38 45 L44 30 Q46 26 50 26 H53" '
            'style="fill:none;stroke:var(--ink);stroke-width:6.5;stroke-linejoin:round;stroke-linecap:round"/>'
            f'<circle cx="35.6" cy="48.6" r="6" style="{MARK}"/>')


def grid():
    """Two staggered starting-grid slots seen from above, pole taken."""
    br = "fill:none;stroke:var(--ink);stroke-width:5.5;stroke-linecap:round;stroke-linejoin:round"
    return (f'<path d="M13 12 V30 H30" style="{br}"/><path d="M34 34 V52 H51" style="{br}"/>'
            f'<rect x="18" y="11" width="10" height="14" rx="3.5" style="{MARK}"/>'
            '<rect x="39" y="33" width="10" height="14" rx="3.5" style="fill:var(--ink);opacity:.35"/>')


_n = [0]
OCT = "32,9 48.3,15.7 55,32 48.3,48.3 32,55 15.7,48.3 9,32 15.7,15.7"


def _uid(p):
    _n[0] += 1
    return f"{p}{_n[0]}"


def waving():
    """Round 2: the octagon carrying a waving chequered flag on a short pole."""
    cid = _uid("wv")
    flag = "M22 21 C27 17.5 31 24.5 37 21 C41 19 44 20 46 21 V37 C44 36 41 35 37 37 C31 40.5 27 33.5 22 37 Z"
    sq = "".join(f'<rect x="{22 + 4 * c}" y="{17 + 4 * r}" width="4.05" height="4.05"/>'
                 for r in range(6) for c in range(6) if (r + c) % 2 == 0)
    return (f'<defs><clipPath id="{cid}"><path d="{flag}"/></clipPath></defs>'
            f'<polygon points="{OCT}" style="{MARK};stroke:var(--mark);stroke-width:2;stroke-linejoin:round"/>'
            f'<path d="{flag}" style="fill:none;stroke:var(--on-mark);stroke-width:1.6"/>'
            f'<g clip-path="url(#{cid})" style="fill:var(--on-mark)">{sq}</g>'
            '<rect x="19" y="19" width="3" height="27" rx="1.5" style="fill:var(--on-mark)"/>')


def ring():
    """Round 2: a red octagon outline, the chequer in the ink colour inside it."""
    sq = "".join(f'<rect x="{23 + 4.5 * c}" y="{23 + 4.5 * r}" width="4.55" height="4.55" style="fill:var(--ink)"/>'
                 for r in range(4) for c in range(4) if (r + c) % 2 == 0)
    return f'<polygon points="{OCT}" style="fill:none;stroke:var(--mark);stroke-width:5.5;stroke-linejoin:round"/>{sq}'


def finish():
    """Round 2: the finish line crossing the stop octagon on a slant."""
    cid = _uid("fn")
    sq = "".join(f'<rect x="{-4 + 6 * c}" y="{26 + 6 * r}" width="6.05" height="6.05"/>'
                 for r in range(2) for c in range(13) if (r + c) % 2 == 0)
    return (f'<defs><clipPath id="{cid}"><polygon points="{OCT}"/></clipPath></defs>'
            f'<polygon points="{OCT}" style="{MARK};stroke:var(--mark);stroke-width:2;stroke-linejoin:round"/>'
            f'<g clip-path="url(#{cid})"><g transform="rotate(-24 32 32)">'
            '<rect x="-4" y="26" width="72" height="12" style="fill:var(--ink-on-mark)"/>'
            f'<g style="fill:var(--on-mark)">{sq}</g></g></g>')


MARKS = [
    ("stopflag", "Stop flag, as picked", "Round 1's mark in F1 DataStop red: a stop octagon carrying a 4 by 4 chequer. The red silhouette keeps the place of today's red roundel.", stopflag),
    ("waving", "Waving flag", "The chequered flag waving on its pole, inside the octagon. More movement; the wave blurs at 16 px.", waving),
    ("finish", "Finish line", "A slanted finish line crosses the octagon, like the line painted across the track. Reads as a red octagon and a stripe at 16 px.", finish),
    ("ring", "Ring", "The octagon as a red outline with the chequer inside in the ink colour. Lighter; on the app icon the carbon does more of the work.", ring),
]


def svg(inner, size, label=None, tile=True, radius=14):
    a = f'role="img" aria-label="{label}"' if label else 'aria-hidden="true"'
    bg = f'<rect width="64" height="64" rx="{radius}" style="fill:var(--tile)"/>' if tile else ""
    return f'<svg width="{size}" height="{size}" viewBox="0 0 64 64" {a}>{bg}{inner}</svg>'


def lockup(inner, name, label):
    return (f'<span class="lockup" role="img" aria-label="{label}">{svg(inner, 44)}'
            f'<span class="word"><span class="w1">F1</span> <span class="w2">DataStop</span></span></span>')


def logo_round():
    out = []
    for key, name, why, fn in MARKS:
        inner = fn()
        sizes = "".join(f'<figure>{svg(inner, s, None, True, 14)}<figcaption>{s} px</figcaption></figure>' for s in (16, 32))
        app = f'<figure>{svg(inner, 180, None, True, 40 * 64 / 180)}<figcaption>180 px app icon</figcaption></figure>'
        bare = f'<figure class="bare">{svg(inner, 64, None, False)}<figcaption>no tile</figcaption></figure>'
        out.append(
            f'<article class="logo" id="logo-{key}"><header><h3>{name}</h3><p>{why}</p></header>'
            f'<div class="logo-stages">'
            + "".join(f'<div class="stage t-{t}"><div class="sizes">{sizes}{bare}</div>{app}{lockup(inner, name, "F1 DataStop, " + name + " mark")}</div>'
                      for t in ("dark", "light"))
            + "</div></article>")
    return "".join(out)
