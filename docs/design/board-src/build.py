"""Build docs/design/f1datastop-design-board.html from board.tmpl.html.

Palettes, contrast and specimens come from concepts.py; the logo round from logos.py;
the decisions table from ../decisions.md. Run: python3 docs/design/board-src/build.py
The build fails if a text role drops under 4.5:1 or a middle dot appears.
"""
import html
import pathlib
import re
import sys

here = pathlib.Path(__file__).parent
sys.path.insert(0, str(here))
from concepts import CONCEPTS, drivercard_html, livery, teamcard_html, contrast_table, css, lapchart_svg, racecard_html, standings_html, swatches  # noqa: E402
from race_bits import TYRE, calendar_html, tyre, tyres_html  # noqa: E402
from wing import wing_round  # noqa: E402
from flow import DECISIONS as FLOW_D, flow_html  # noqa: E402


def concept_section(c):
    k = c["key"]
    specs = []
    for t, label in (("dark", "Night"), ("light", "Day")):
        specs.append(
            f'<div class="spec c-{k} t-{t}"><p class="spec-cap">{label}</p>'
            '<div class="bar"><span class="seg"><span class="on">Drivers</span><span>Constructors</span></span>'
            '<span><button class="btn q" type="button">Season 2026</button> <button class="btn" type="button">Open weekend</button></span></div>'
            f'<div class="spec-grid"><div class="card lead">{livery()}{racecard_html()}</div><div class="card">{standings_html()}</div>'
            f'<div class="card">{calendar_html()}</div><div class="card">{tyres_html()}</div>'
            f'<div class="card lead">{livery("#27F4D2")}{teamcard_html()}</div><div class="card lead">{livery("#27F4D2")}{drivercard_html()}</div>'
            f'<div class="card full"><div class="chart-h"><h4>Lap times, Las Vegas</h4><small>Laps 1 to 20, sample data. Pit stops, laps 11 to 14, run off the top.</small></div>{lapchart_svg(t)}</div></div></div>')
    return (f'<h2 id="c-{k}">The direction: {c["name"]}</h2><p class="lede">{c["idea"]}</p>'
            f'<div class="meta"><div><b>Materials</b>{c["material"]}</div><div><b>Type</b>{c["type_note"]}</div></div>'
            f'<div class="type c-{k} t-dark"><div class="d">Las Vegas Grand Prix</div>'
            '<div class="s">Antonelli leads by 111 points with three rounds left. Verstappen needs 112 to stay in it.</div>'
            '<div class="m"><span>1:33.712</span><span class="p">1:33.209</span><span>+0.503</span><span>P1</span><span>390 pts</span></div></div>'
            + "".join(specs) + f'<p class="risk"><b>Watch for:</b> {c["risk"]}</p>')


def identity():
    c = CONCEPTS[0]
    pal = "".join(f'<div class="c-flood t-{t}"><h4>{label}</h4><div class="chips">{swatches(c, t)}</div></div>'
                  for t, label in (("dark", "Night"), ("light", "Day")))
    return f'<div class="pal">{pal}</div><div class="panel scroll-x">{contrast_table(c)}</div>'


def tyre_ladder():
    out = []
    for t in ("dark", "light"):
        rows = "".join(f'<div class="tl-row"><span class="tl-n">{TYRE[c][0]}</span>'
                       + "".join(f"<figure>{tyre(c, s)}<figcaption>{s}</figcaption></figure>" for s in (16, 20, 24, 32, 48))
                       + "</div>" for c in TYRE)
        out.append(f'<div class="stage c-flood t-{t}">{rows}</div>')
    return f'<div class="logo-stages">{"".join(out)}</div>'


def decisions():
    rows = []
    for line in (here.parent / "decisions.md").read_text().splitlines():
        m = re.match(r"\| (D\d+) \| (.+) \| (.*) \|$", line)
        if not m:
            continue
        txt = html.escape(m.group(2))
        txt = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", txt)
        txt = re.sub(r"`(.+?)`", r"<code>\1</code>", txt)
        rows.append(f"<tr><th>{m.group(1)}</th><td>{txt}</td></tr>")
    return "".join(rows)


src = (here / "board.tmpl.html").read_text()
parts = {
    "TOC": '<a href="#c-flood">The direction</a>',
    "IDENTITY": identity(),
    "CONCEPTS": "".join(concept_section(c) for c in CONCEPTS),
    "FLOW": flow_html(),
    "LOGOS": wing_round(),
    "TYRES": tyre_ladder(),
    "DECISIONS": decisions(),
}
out = re.sub(r"@@([A-Z]+)@@", lambda m: parts[m.group(1)], src)
assert "@@" not in out, "unreplaced marker"
out = out.replace("</style>", css() + "\n</style>", 1)
assert "·" not in out and "&middot;" not in out, "middle dot in the board"
head, body = out.split('<div class="wrap">', 1)
page = ('<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        + head + '</head><body>\n<div class="wrap">' + body + "</body></html>\n")
(here.parent / "f1datastop-design-board.html").write_text(page)
print("built", len(page), "bytes")
