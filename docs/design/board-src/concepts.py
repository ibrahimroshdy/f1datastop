"""The three directions on the concepts board, round 2: one identity, three treatments.

Round 2 (owner, 2026-11-10): F1 DataStop keeps its own red and carbon. The three
directions now differ in type and material only; they share PALETTE. build.py turns it
into CSS classes (.c-<key>.t-dark / .t-light), one contrast table and three specimens
per direction (race card, standings table, lap chart). Team colours come from
web/src/constants/f1Colors.ts and never change.
"""

# Real data colours, copied from web/src/constants/f1Colors.ts and index.css.
TEAM = {"mercedes": "#27F4D2", "red_bull": "#3671C6", "ferrari": "#F91536", "mclaren": "#FF8700"}
FASTEST = {"dark": "#B57BF7", "light": "#7C2BD9"}  # --fastest-lap, purple = fastest

ROLES = ["ground", "card", "raised", "line", "ink", "ink2", "ink3", "act", "on_act", "mark", "heading", "figure"]

# F1 DataStop's identity: the Deep Carbon ladder and F1 DataStop red (#E10600), with
# brighter secondary text than today (today's 64% grey on carbon is the "grey on black").
PALETTE = {
    "dark": dict(ground="#08080A", card="#0F0F12", raised="#17171B", line="#2A2A30", ink="#F3F4F7", ink2="#D2D3DA",
                 ink3="#ABACB5", act="#E10600", on_act="#FFFFFF", mark="#E10600", heading="#FFE9E7", figure="#FFFFFF"),
    "light": dict(ground="#F5F5F7", card="#FFFFFF", raised="#FFFFFF", line="#DEDEE3", ink="#0A0A0F", ink2="#44444E",
                  ink3="#5D5D69", act="#E10600", on_act="#FFFFFF", mark="#E10600", heading="#4A0603", figure="#0A0A0F"),
}

# Round 4 (owner, 2026-11-10): one direction, a mix of A Floodlight and C Livery, with
# Floodlight's type. Rounds 1 to 3 (Floodlight, Classification, Livery) are in git history.
CONCEPTS = [
    {
        "key": "flood", "letter": "", "name": "Floodlight Livery",
        "idea": "A night race in F1 DataStop red and carbon, lit from above, with a livery stripe on the lead card of each page that takes the team's colour on its own pages.",
        "display": "'Saira Condensed'", "sans": "'Saira'", "mono": "'JetBrains Mono'",
        "type_note": "Floodlight's type: Saira Condensed for titles, in capitals like trackside signage. Saira for the UI. JetBrains Mono for every time, gap and points figure.",
        "material": "Floodlight's solid raised surfaces with a soft light falling from the top of the page, and Livery's diagonal stripe across the lead card only: red on most pages, the team's colour on a team or driver page. Cards 20 px round, pills everywhere.",
        "risk": "The stripe is decoration. It stays on the one lead card of a page, never on list rows, and never carries data meaning.",
        "upper": True, "radius": 20,
    },
]
for _c in CONCEPTS:
    _c["dark"], _c["light"] = PALETTE["dark"], PALETTE["light"]


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
            vars_ += f"--fastest:{FASTEST[t]};--tile:{p['ground']};--on-mark:{on_mark};--ink-on-mark:#0A0A0F;color-scheme:{t};"
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
    (1, "Andrea Kimi Antonelli", "Mercedes", "mercedes", 9, 390, "antonelli"),
    (2, "Max Verstappen", "Red Bull Racing", "red_bull", 5, 279, "max_verstappen"),
    (3, "George Russell", "Mercedes", "mercedes", 3, 262, "russell"),
    (4, "Lewis Hamilton", "Ferrari", "ferrari", 1, 261, "hamilton"),
    (5, "Charles Leclerc", "Ferrari", "ferrari", 0, 249, "leclerc"),
]


def standings_html():
    lead = STANDINGS[0][5]
    rows = []
    from avatars import avatar, team_logo
    from race_bits import nat_flag
    for pos, name, team, tid, wins, pts, did in STANDINGS:
        gap = "Leader" if pos == 1 else f"{lead - pts} behind"
        rows.append(
            f'<tr><td class="pos num">{pos}</td>'
            f'<td>{avatar(did, name, TEAM[tid], 40)}<span class="who"><b>{name}</b><small><span class="dsub">{nat_flag(did, 11)}{team_logo(tid, team, 13)}</span></small></span></td>'
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
    from race_bits import flag, tyre
    return ('<article class="race"><div class="race-top">' + flag("US", 27, "United States")
            + '<span class="live">Next</span></div>'
            '<h4>Las Vegas Grand Prix</h4><p class="where">Las Vegas Strip Circuit</p>'
            '<dl class="sess"><div><dt>Practice 1</dt><dd class="num">Fri 20 Nov, 02:30</dd></div>'
            '<div><dt>Qualifying</dt><dd class="num">Sat 21 Nov, 06:00</dd></div>'
            '<div><dt>Race</dt><dd class="num">Sun 22 Nov, 06:00</dd></div></dl>'
            '<div class="count"><span>Starts in</span><b class="num fig">9d 03:57:11</b></div>'
            '<div class="race-foot">' + "".join(tyre(x, 24) for x in "SMH")
            + '<span class="note">Soft C5, medium C4, hard C3</span></div></article>')


def teamcard_html():
    """The lead card of a team page: the stripe in the team's colour, its logo, its drivers with avatars."""
    from avatars import avatar, team_logo
    rows = "".join(f'<div class="tdrv">{avatar(d, n, TEAM["mercedes"], 44)}<span class="who"><b>{n}</b>'
                   f'<small>{w} wins</small></span><b class="num fig">{p}</b></div>'
                   for n, w, p, d in (("Andrea Kimi Antonelli", 9, 390, "antonelli"), ("George Russell", 3, 262, "russell")))
    return ('<article class="team"><div class="race-top"><span class="live">P1 constructors</span></div>'
            + '<h4>' + team_logo("mercedes", "Mercedes", 26) + '</h4><p class="where">652 points, 12 wins, 142 ahead of Ferrari</p>' + rows + "</article>")


def drivercard_html():
    """The lead card of a driver page: the headshot, name and team, the stripe in the team's colour."""
    from avatars import avatar, team_logo
    from race_bits import nat_flag
    return ('<article class="team"><div class="dhead">' + avatar("antonelli", "Andrea Kimi Antonelli", TEAM["mercedes"], 72)
            + '<div><span class="live">P1 drivers</span><h4>Andrea Kimi Antonelli</h4><p class="where"><span class="dsub">' + nat_flag("antonelli", 12) + team_logo("mercedes", "Mercedes", 16) + '</span></p></div></div>'
            '<div class="tdrv"><span class="who"><b>390 points</b><small>111 ahead of Verstappen</small></span><b class="num fig">9 wins</b></div>'
            '<div class="tdrv"><span class="who"><b>Last race</b><small>São Paulo Grand Prix</small></span><b class="num fig">P1</b></div></article>')


def livery(colour=None):
    """The livery stripe across a lead card's corner: F1 DataStop red, or the team's colour
    on its team and driver pages. Colour only (owner, 2026-11-10)."""
    c = colour or "var(--mark)"
    return (f'<span class="livery" aria-hidden="true"><span class="lv-band" style="background:{c}"></span>'
            f'<span class="lv-trail" style="background:{c}"></span></span>')
