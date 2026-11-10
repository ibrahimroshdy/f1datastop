"""Grands Prix with flags, and the tyre icon, for the board's specimens.

Owner, 2026-11-10: "stress on prix not be R1..R2.. and be flags, also perfected tyres
and their icons". A race is named by its Grand Prix and its country's flag, never by a
round code. Flags here are simplified inline SVG (the board cannot load the flag-icons
CDN the app uses through react-country-flag). Tyre colours are the Pirelli set from the
social cards (analysis/social/session_results/session_results.py, TYRE).
"""

# Pirelli compound colours: one set for the app, the charts and the social cards.
TYRE = {"S": ("Soft", "#DA291C"), "M": ("Medium", "#FFD12E"), "H": ("Hard", "#F0F0EC"),
        "I": ("Intermediate", "#43B02A"), "W": ("Wet", "#2F8CFF")}
RUBBER = "#16161A"

FLAGS = {
    "IT": '<rect width="8" height="18" fill="#009246"/><rect x="8" width="8" height="18" fill="#fff"/><rect x="16" width="8" height="18" fill="#CE2B37"/>',
    "US": ('<rect width="24" height="18" fill="#B22234"/>'
           + "".join(f'<rect y="{18 / 13 * i:.2f}" width="24" height="{18 / 13:.2f}" fill="#fff"/>' for i in range(1, 13, 2))
           + '<rect width="10" height="9.7" fill="#3C3B6E"/>'
           + "".join(f'<circle cx="{1.6 + 1.7 * c + (0.85 if r % 2 else 0):.2f}" cy="{1.4 + 1.7 * r:.2f}" r=".38" fill="#fff"/>'
                     for r in range(5) for c in range(5 if r % 2 == 0 else 4))),
    "QA": ('<rect width="24" height="18" fill="#8A1538"/><path d="M0 0 H7 '
           + " ".join(f"L9.6 {1 + 2 * i} L7 {2 + 2 * i}" for i in range(9)) + ' V18 H0 Z" fill="#fff"/>'),
    "AE": ('<rect width="24" height="6" fill="#00732F"/><rect y="6" width="24" height="6" fill="#fff"/>'
           '<rect y="12" width="24" height="6" fill="#000"/><rect width="7" height="18" fill="#FF0000"/>'),
    "BR": ('<rect width="24" height="18" fill="#009C3B"/><path d="M12 2.2 L21.8 9 L12 15.8 L2.2 9 Z" fill="#FFDF00"/>'
           '<circle cx="12" cy="9" r="3.9" fill="#002776"/>'
           '<path d="M8.3 8.1 Q12 7.4 15.7 9.6" stroke="#fff" stroke-width=".7" fill="none"/>'),
}


def flag(code, h=18, label=None):
    w = round(h * 4 / 3)
    a = f'role="img" aria-label="{label}"' if label else 'aria-hidden="true"'
    return (f'<svg class="flag" width="{w}" height="{h}" viewBox="0 0 24 18" {a}><clipPath id="fl{code}{h}">'
            f'<rect width="24" height="18" rx="2.5"/></clipPath><g clip-path="url(#fl{code}{h})">{FLAGS[code]}</g>'
            '<rect x=".25" y=".25" width="23.5" height="17.5" rx="2.4" fill="none" stroke="rgba(127,127,127,.45)" stroke-width=".5"/></svg>')


def tyre(c, size=20, label=True):
    """Pirelli-style icon: the black tyre, the compound's coloured band near the rim, the
    letter in the band's colour. Same drawing at every size; the band and letter thicken
    slightly below 20 px so the letter stays readable."""
    name, col = TYRE[c]
    small = size < 20
    a = f'role="img" aria-label="{name} tyre"' if label else 'aria-hidden="true"'
    return (f'<svg class="tyre-i" width="{size}" height="{size}" viewBox="0 0 32 32" {a}>'
            f'<circle cx="16" cy="16" r="16" fill="{RUBBER}"/>'
            f'<circle cx="16" cy="16" r="{12.2 if small else 12.6}" fill="none" stroke="{col}" stroke-width="{5.2 if small else 4.4}"/>'
            f'<circle cx="16" cy="16" r="15.5" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="1"/>'
            f'<text x="16" y="16.6" text-anchor="middle" dominant-baseline="central" '
            f'style="font:800 {15 if small else 13.5}px Geist,system-ui,sans-serif;fill:{col}">{c}</text></svg>')


CALENDAR = [
    ("BR", "São Paulo Grand Prix", "Interlagos, São Paulo", "6 to 8 Nov", "done", "Antonelli won"),
    ("US", "Las Vegas Grand Prix", "Las Vegas Strip Circuit", "20 to 22 Nov", "next", "Next"),
    ("QA", "Qatar Grand Prix", "Lusail International Circuit", "27 to 29 Nov", "", ""),
    ("AE", "Abu Dhabi Grand Prix", "Yas Marina Circuit", "4 to 6 Dec", "", ""),
]


def calendar_html():
    rows = []
    for code, gp, where, when, state, note in CALENDAR:
        chip = f'<span class="chip-s {state}">{note}</span>' if note else ""
        rows.append(f'<li class="{state}">{flag(code, 21, gp.replace(" Grand Prix", ""))}<span class="gp"><b>{gp}</b>'
                    f'<small>{where}</small></span><span class="when"><span class="num">{when}</span>{chip}</span></li>')
    return '<h4>November and December</h4><ul class="cal">' + "".join(rows) + "</ul>"


STINTS = [("Antonelli", "antonelli", "#27F4D2", [("M", 1, 18), ("H", 19, 50)]),
          ("Verstappen", "max_verstappen", "#3671C6", [("M", 1, 21), ("H", 22, 50)]),
          ("Hamilton", "hamilton", "#F91536", [("S", 1, 12), ("H", 13, 37), ("S", 38, 50)])]


def tyres_html():
    rows = []
    from avatars import avatar
    for who, did, col, segs in STINTS:
        bar = "".join(f'<span style="flex:{b - a + 1};background:{TYRE[c][1]}" title="{TYRE[c][0]}, laps {a} to {b}"></span>' for c, a, b in segs)
        words = ", then ".join(f"{TYRE[c][0].lower()} {b - a + 1}" for c, a, b in segs)
        rows.append(f'<li><span class="st-h"><span class="st-w">{avatar(did, who, col, 28)}<b>{who}</b></span><span class="st-i">{"".join(tyre(c, 20) for c, _, _ in segs)}</span></span>'
                    f'<span class="strip" role="img" aria-label="{who}: {words} laps">{bar}</span><small>{words[0].upper() + words[1:]} laps</small></li>')
    key = "".join(f'<span class="tk">{tyre(c, 24)}{TYRE[c][0]}</span>' for c in TYRE)
    return (f'<h4>Tyres, Las Vegas</h4><div class="tkey">{key}</div><ul class="stints">{"".join(rows)}</ul>')


def flag_fill(code):
    """The flag stretched to fill a livery stripe (slice, so it always covers)."""
    return (f'<svg class="lv-flag" viewBox="0 0 24 18" preserveAspectRatio="xMidYMid slice" aria-hidden="true">'
            f'{FLAGS[code]}</svg>')
