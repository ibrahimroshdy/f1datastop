"""The app shell for the screens board (D7, D22): phone header pill and dock, desktop
floating sidebar and top bar. Icons are simple 24-unit strokes drawn here."""
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).parents[1] / "board-src"))
from wing import today, svg as wsvg  # noqa: E402

_P = {
    "home": '<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>',
    "races": '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    "standings": '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/>',
    "drivers": '<path d="M4 15a8 8 0 0 1 16 0v2H4zM4 15h9l2-4M8 20h8"/>',
    "teams": '<path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 11a3 3 0 1 0-1-5.8M21 20a6 6 0 0 0-4-5.7"/>',
    "circuits": '<path d="M6 18c-3-2-2-7 2-7h6c3 0 3-4 0-4H9M14 7h4c3 0 3 5 0 6l-4 2c-2 1-1 4 2 4"/>',
    "pitwall": '<path d="M3 5h18v11H3zM8 20h8M12 16v4M6 13l3-4 3 2 4-5 2 3"/>',
    "more": '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    "search": '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
    "back": '<path d="M15 5l-7 7 7 7"/>',
    "moon": '<path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z"/>',
    "chev": '<path d="M6 9l6 6 6-6"/>',
    "go": '<path d="M9 5l7 7-7 7"/>',
    "check": '<path d="M5 12l5 5 9-10"/>',
}


def ic(name, size=22, sw=2):
    fill = "currentColor" if name == "more" else "none"
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="{fill}" stroke="currentColor" '
            f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{_P[name]}</svg>')


def logo(size):
    return wsvg(today(), size, "F1 DataStop")


DOCK = [("home", "Home"), ("races", "Races"), ("standings", "Standings"), ("drivers", "Drivers"), ("more", "More")]
SIDE = [("home", "Home"), ("races", "Races"), ("standings", "Standings"), ("drivers", "Drivers"),
        ("teams", "Teams"), ("circuits", "Circuits"), ("pitwall", "Pit Wall")]


def phone(content, title, active, sub=None, back=False, overlay=""):
    lead = f'<span class="circ">{ic("back")}</span>' if back else logo(36)
    sub_html = f"<small>{sub}</small>" if sub else ""
    dock = "".join(f'<a class="{"on" if k == active else ""}">{ic(k)}{label}</a>' for k, label in DOCK)
    return (f'<div class="sc">{content}</div><div class="scrim"></div>'
            '<div class="sb"><span>9:41</span><span>5G</span></div>'
            f'<header class="hp sur">{lead}<h1 class="t">{title}{sub_html}</h1>'
            f'<span class="pill">2026 {ic("chev", 16)}</span><span class="circ">{ic("search", 20)}</span></header>'
            f'<nav class="dock sur" aria-label="Main">{dock}</nav>{overlay}<div class="hi"></div>')


def desktop(content, title, active, title_extra=""):
    nav = "".join(f'<a class="{"on" if k == active else ""}">{ic(k, 20)}{label}</a>' for k, label in SIDE)
    return (f'<nav class="side sur" aria-label="Main"><div class="lock">{logo(36)}<b><i>F1</i> DataStop</b></div>{nav}'
            '<span class="grp">More</span><a>Docs</a><div class="foot">Data from Jolpica, OpenF1 and FastF1</div></nav>'
            f'<header class="top sur"><div class="t"><h1>{title}</h1>{title_extra}</div>'
            f'<span class="srch">{ic("search", 18)}Search drivers, teams, races<kbd>⌘K</kbd></span>'
            f'<span class="pill">Season 2026 {ic("chev", 16)}</span><span class="circ">{ic("moon", 18)}</span></header>'
            f'<main class="dsc">{content}</main>')
