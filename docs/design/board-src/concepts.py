"""The three directions on the concepts board: palettes, contrast and specimens.

Each concept is a dict of roles per theme. build.py turns them into CSS classes
(.c-<key>.t-dark / .t-light), a contrast table and three specimens (lap chart,
standings table, race card). Team colours come from web/src/constants/f1Colors.ts
and never change between concepts.
"""

# Real data colours, copied from web/src/constants/f1Colors.ts and index.css.
TEAM = {"mercedes": "#27F4D2", "red_bull": "#3671C6", "ferrari": "#F91536", "mclaren": "#FF8700"}
FASTEST = {"dark": "#B57BF7", "light": "#7C2BD9"}  # --fastest-lap, purple = fastest

ROLES = ["ground", "card", "raised", "line", "ink", "ink2", "ink3", "act", "on_act", "mark", "heading", "figure"]

CONCEPTS = [
    {
        "key": "flood", "letter": "A", "name": "Floodlight",
        "idea": "A night race: warm asphalt, white light from above, one sodium-orange signal.",
        "display": "'Saira Condensed'", "sans": "'Saira'", "mono": "'JetBrains Mono'",
        "type_note": "Saira Condensed for titles, set in capitals like trackside signage. Saira for the UI. JetBrains Mono for every time and gap.",
        "material": "Solid raised surfaces with a soft light falling from the top of the page. Cards 18 px round, pills everywhere.",
        "risk": "The orange sits close to McLaren (#FF8700). It is kept off chart lines and rows, but a McLaren line next to an orange button still competes.",
        "upper": True, "radius": 18,
        "dark": dict(ground="#12100E", card="#1D1A17", raised="#272320", line="#3A342E", ink="#F7F2EA", ink2="#D6CCBF",
                     ink3="#B3A797", act="#FF7A2F", on_act="#1F0B00", mark="#FF7A2F", heading="#FFE4C8", figure="#FFF1DA"),
        "light": dict(ground="#EEEAE3", card="#FAF8F4", raised="#FFFFFF", line="#D9D2C7", ink="#1A1714", ink2="#4D4640",
                      ink3="#655D55", act="#B8400D", on_act="#FFFFFF", mark="#E0611F", heading="#5A2709", figure="#2E1E12"),
    },
    {
        "key": "sheet", "letter": "B", "name": "Classification",
        "idea": "The official timing sheet, set like a race-weekend magazine: paper, navy ink, hairline rules.",
        "display": "'Newsreader'", "sans": "'Geist'", "mono": "'DM Mono'",
        "type_note": "Newsreader, a serif, for titles and driver names. Geist for the UI. DM Mono for the timing columns, like a printed classification.",
        "material": "Paper and ink. Ruled hairlines carry the structure, cards are 14 px round, and the act colour is the ink itself: navy by day, paper at night. Vermilion only on the mark.",
        "risk": "The quietest of the three. Without care it can feel like a document rather than an app; the serif must stay on titles only.",
        "upper": False, "radius": 14,
        "dark": dict(ground="#0F1220", card="#181C2E", raised="#21263A", line="#323850", ink="#F3EEE3", ink2="#CFC9D9",
                     ink3="#A9A4B8", act="#F3EEE3", on_act="#0F1220", mark="#FF6B4A", heading="#FFE2D6", figure="#F6EBD3"),
        "light": dict(ground="#F3EFE5", card="#FBF8F1", raised="#FFFFFF", line="#D8D1C2", ink="#14182B", ink2="#41465B",
                      ink3="#5A5F73", act="#14182B", on_act="#FBF8F1", mark="#C8371D", heading="#7A1F0E", figure="#14182B"),
    },
    {
        "key": "livery", "letter": "C", "name": "Livery",
        "idea": "Every page wears a livery: a bold magenta by default, and the team's own colour on its team and driver pages.",
        "display": "'Unbounded'", "sans": "'Geist'", "mono": "'Geist Mono'",
        "type_note": "Unbounded, wide and heavy like a car's number, for titles. Geist for the UI. Geist Mono for timing, as today.",
        "material": "Aubergine-black and blush paper. A diagonal livery stripe crosses the top of a card. Cards 22 px round, chunky pills.",
        "risk": "Magenta is near Alpine pink (#FF87BC). On a team page the act colour becomes the team's, which must pass contrast per team (Haas grey and Williams cyan need dark ink on them).",
        "upper": False, "radius": 22,
        "dark": dict(ground="#16111A", card="#221B27", raised="#2C2432", line="#3D3345", ink="#FBF5FF", ink2="#DDD0E6",
                     ink3="#B8A9C2", act="#FF3D8B", on_act="#1C0010", mark="#FF3D8B", heading="#FFD3E6", figure="#FFF0F7"),
        "light": dict(ground="#F5EFF3", card="#FFFFFF", raised="#FFFFFF", line="#E3D6DE", ink="#1D1420", ink2="#4A3F4F",
                      ink3="#625668", act="#C81E64", on_act="#FFFFFF", mark="#E62B78", heading="#6B0E36", figure="#1D1420"),
    },
]


def _lum(hexc):
    h = hexc.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def contrast(a, b):
    la, lb = sorted((_lum(a), _lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def css():
    out = []
    for c in CONCEPTS:
        fonts = f"--display:{c['display']},system-ui,sans-serif;--sans:{c['sans']},system-ui,sans-serif;--mono:{c['mono']},ui-monospace,monospace;--rc:{c['radius']}px;--tt:{'uppercase' if c['upper'] else 'none'};"
        out.append(f".c-{c['key']}{{{fonts}}}")
        for t in ("dark", "light"):
            p = c[t]
            vars_ = "".join(f"--{k.replace('_', '-')}:{v};" for k, v in p.items())
            on_mark = max(("#FFFFFF", p["ground"], p["on_act"]), key=lambda x: contrast(x, p["mark"]))
            vars_ += f"--fastest:{FASTEST[t]};--tile:{p['ground']};--on-mark:{on_mark};color-scheme:{t};"
            out.append(f".c-{c['key']}.t-{t}{{{vars_}}}")
    return "\n".join(out)


def contrast_table(c):
    rows = []
    for role, label in [("ink", "Text"), ("ink2", "Secondary text"), ("ink3", "Quiet text"), ("heading", "Title tint"),
                        ("figure", "Figure tint"), ("act", "Act colour (as a mark)")]:
        cells = []
        for t in ("dark", "light"):
            p = c[t]
            n = contrast(p[role], p["card"])
            cells.append(f'<td><span class="sw" style="background:{p[role]}"></span>{p[role]}</td><td class="num">{n:.1f}</td>')
        rows.append(f"<tr><th>{label}</th>{''.join(cells)}</tr>")
    on = [contrast(c[t]["on_act"], c[t]["act"]) for t in ("dark", "light")]
    rows.append(f'<tr><th>Words on the act colour</th><td>{c["dark"]["on_act"]} on {c["dark"]["act"]}</td><td class="num">{on[0]:.1f}</td>'
                f'<td>{c["light"]["on_act"]} on {c["light"]["act"]}</td><td class="num">{on[1]:.1f}</td></tr>')
    worst = min(contrast(c[t][r], c[t]["card"]) for t in ("dark", "light") for r in ("ink", "ink2", "ink3", "heading", "figure"))
    assert worst >= 4.5, f"{c['name']}: a text role is under 4.5:1 ({worst:.2f})"
    assert min(on) >= 4.5, f"{c['name']}: words on act under 4.5:1"
    return ('<table class="ctab"><thead><tr><th>Role, on a card</th><th>Night</th><th>Ratio</th><th>Day</th><th>Ratio</th></tr></thead>'
            f"<tbody>{''.join(rows)}</tbody></table>")


def swatches(c, t):
    p = c[t]
    names = [("ground", "Ground"), ("card", "Card"), ("raised", "Raised"), ("line", "Line"), ("ink", "Ink"),
             ("ink2", "Ink 2"), ("ink3", "Ink 3"), ("act", "Act"), ("heading", "Title"), ("figure", "Figure")]
    return "".join(f'<div class="chip"><span style="background:{p[k]}"></span><b>{n}</b><code>{p[k]}</code></div>' for k, n in names)


# Sample data shaped like the real thing (2026, round 20 standings from the live site).
STANDINGS = [
    (1, "Andrea Kimi Antonelli", "Mercedes", "mercedes", 9, 390),
    (2, "Max Verstappen", "Red Bull Racing", "red_bull", 5, 279),
    (3, "George Russell", "Mercedes", "mercedes", 3, 262),
    (4, "Lewis Hamilton", "Ferrari", "ferrari", 1, 261),
    (5, "Lando Norris", "McLaren", "mclaren", 1, 246),
]


def standings_html():
    lead = STANDINGS[0][5]
    rows = []
    for pos, name, team, tid, wins, pts in STANDINGS:
        gap = "Leader" if pos == 1 else f"{lead - pts} behind"
        rows.append(
            f'<tr><td class="pos num">{pos}</td>'
            f'<td><span class="tm" style="background:{TEAM[tid]}"></span><span class="who"><b>{name}</b><small>{team}</small></span></td>'
            f'<td class="num hide-s">{wins}</td><td class="num"><b class="fig">{pts}</b><small>{gap}</small></td></tr>')
    return ('<table class="stand"><caption>Drivers, after round 20</caption><thead><tr><th class="num">Pos</th><th>Driver</th>'
            '<th class="num hide-s">Wins</th><th class="num">Points</th></tr></thead><tbody>' + "".join(rows) + "</tbody></table>")


def _laps(base, seed, pit):
    out, x = [], seed
    for lap in range(1, 21):
        x = (x * 1103515245 + 12345) % 2 ** 31
        t = base - lap * 0.045 + (x % 1000) / 1000 * 0.35
        if lap == pit:
            t += 21.4
        out.append(t)
    return out


LAPS = [("ANT", "mercedes", _laps(94.9, 7, 12)), ("VER", "red_bull", _laps(95.05, 11, 13)),
        ("HAM", "ferrari", _laps(95.2, 3, 11)), ("NOR", "mclaren", _laps(95.15, 5, 14))]


def _lapchart(theme, W, H, cls):
    L, R, T, B = 46, 40, 12, 28
    lo, hi = 93.6, 95.9
    sx = lambda i: L + (i - 1) * (W - L - R) / 19
    sy = lambda v: T + (hi - min(v, hi)) / (hi - lo) * (H - T - B)
    g = []
    for v in (94.0, 94.5, 95.0, 95.5):
        y = sy(v)
        g.append(f'<line x1="{L}" x2="{W - R}" y1="{y:.1f}" y2="{y:.1f}" class="grid"/>'
                 f'<text x="{L - 6}" y="{y + 4:.1f}" class="ax" text-anchor="end">1:{v - 60:04.1f}</text>')
    for i in (1, 5, 10, 15, 20):
        g.append(f'<text x="{sx(i):.1f}" y="{H - 8}" class="ax" text-anchor="middle">{i}</text>')
    best = min((t, n, i) for n, _, ts in LAPS for i, t in enumerate(ts, 1))
    ends = sorted(((sy(ts[-1]), n, tid) for n, tid, ts in LAPS))
    placed = []
    for y, n, tid in ends:
        y = max(y, placed[-1] + 13) if placed else y
        placed.append(y)
        g.append(f'<text x="{W - R + 6}" y="{y + 4:.1f}" class="lbl" fill="{TEAM[tid]}">{n}</text>')
    for n, tid, ts in LAPS:
        pts = " ".join(f"{sx(i):.1f},{sy(t):.1f}" for i, t in enumerate(ts, 1))
        g.append(f'<polyline points="{pts}" fill="none" stroke="{TEAM[tid]}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>')
    bt, bn, bi = best
    g.append(f'<circle cx="{sx(bi):.1f}" cy="{sy(bt):.1f}" r="5" fill="{FASTEST[theme]}" stroke="var(--card)" stroke-width="2"/>')
    g.append(f'<text x="{sx(bi) - 9:.1f}" y="{sy(bt) + 16:.1f}" class="ax" text-anchor="end" fill="{FASTEST[theme]}" style="fill:{FASTEST[theme]}">Fastest lap, {bn}</text>')
    label = "Lap times, laps 1 to 20, for Antonelli, Verstappen, Hamilton and Norris. Fastest lap by " + bn
    return f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="{label}" class="lap {cls}">{"".join(g)}</svg>'


def lapchart_svg(theme):
    return _lapchart(theme, 290, 230, "lap-s") + _lapchart(theme, 860, 280, "lap-w")


def racecard_html():
    return ('<article class="race"><div class="race-top"><span class="rnd">Round 21</span><span class="live">Next</span></div>'
            '<h4>Las Vegas Grand Prix</h4><p class="where">Las Vegas Strip Circuit, United States</p>'
            '<dl class="sess"><div><dt>FP1</dt><dd class="num">Fri 20 Nov, 02:30</dd></div>'
            '<div><dt>Qualifying</dt><dd class="num">Sat 21 Nov, 06:00</dd></div>'
            '<div><dt>Race</dt><dd class="num">Sun 22 Nov, 06:00</dd></div></dl>'
            '<div class="count"><span>Starts in</span><b class="num fig">9d 03:57:11</b></div>'
            '<div class="race-foot"><span class="tyre s">S</span><span class="tyre m">M</span><span class="tyre h">H</span>'
            '<span class="note">Compounds C3, C4, C5</span></div></article>')
