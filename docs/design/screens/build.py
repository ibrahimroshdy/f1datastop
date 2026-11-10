"""Build docs/design/f1datastop-screens.html: the key screens (D27) on the Floodlight
Livery direction (D17) and the connected structure (D19 to D24), each at phone and
desktop, night and day. Run: python3 docs/design/screens/build.py
"""
import pathlib
import sys

here = pathlib.Path(__file__).parent
sys.path[:0] = [str(here), str(here.parent / "board-src")]
import content  # noqa: E402
from concepts import css  # noqa: E402

SCREENS = [
    ("home", "Home", content.home,
     "The next Grand Prix with every session in your time, the last one with its podium, and the top of both standings. Every card opens a page.",
     ["Session clock times are on the card, so the next session no longer needs a dialog.",
      "Names are links: the Grand Prix, each session, each driver and team."]),
    ("gp", "A Grand Prix", content.grand_prix,
     "One page per weekend replaces the race dialog and Race Analysis (D20). Tabs across the top; the session switch picks sprint, qualifying or race.",
     ["The lead card takes the red stripe; the winner opens their page.",
      "Results show each driver's face, team, gap, the tyres they used and the fastest lap in purple.",
      "Desktop: the full table, strategy strips, and Open in Pit Wall with this race loaded."]),
    ("tel", "Laps and telemetry", content.telemetry,
     "Any lap, any two drivers, on the Grand Prix page (D20); the Pit Wall is one tap away for the full engineer view.",
     ["Pick drivers by face, the lap and the channel; sector times underneath, the faster in purple."]),
    ("standings", "Standings", content.standings,
     "Drivers and teams for the season in the header pill (D21). One table, used again by Home.",
     ["The gap is in words, never a bar.", "Desktop adds points after each round; teammates share a colour, so the second line is dashed."]),
    ("races", "Races", content.races_screen,
     "Every Grand Prix, flag first, grouped by month, with search and filters in the URL (D8, D15).",
     ["A finished race shows its winner; the next one is marked.", "Phones list five at a time with Show earlier; desktop pages by twenty."]),
    ("quick", "A Grand Prix, quick look", content.quick_look,
     "Tapping a race anywhere opens a quick look first: a sheet on a phone, a dialog on a desktop. It has its own address, so Back closes it and a link opens it. Open Grand Prix goes to the full page.",
     ["Winner, pole and fastest lap with faces; the qualifying grid to race Sankey; shortcuts to each section of the full page.",
      "Desktop: the dialog sits over the Races list; Escape or a click outside closes it."]),
    ("driver", "A driver", content.driver,
     "The driver page leads with the face and the team-colour stripe (D25, D26), then every race of the season as a link.",
     ["The team and each Grand Prix are links (D19).", "Head to head against the teammate, in words and numbers."]),
]


def frame(kind, theme, html):
    return f'<div class="fit" data-w="{1280 if kind == "dk" else 390}" data-h="{800 if kind == "dk" else 844}"><div class="frame {kind} c-flood t-{theme}">{html}</div></div>'


def section(key, title, fn, lede, notes):
    ph, dk = fn()
    phones = "".join(f'<div><p class="cap">Phone, {lbl}</p>{frame("ph", t, ph)}</div>' for t, lbl in (("dark", "night"), ("light", "day")))
    desks = "".join(f'<div><p class="cap">Desktop, {lbl}</p>{frame("dk", t, dk)}</div>' for t, lbl in (("dark", "night"), ("light", "day")))
    li = "".join(f"<li>{n}</li>" for n in notes)
    return (f'<section class="scr" id="{key}"><h2>{title}</h2><p>{lede}</p><ul class="notes">{li}</ul>'
            f'<div class="phones">{phones}</div><div class="desks">{desks}</div></section>')


def sheet_section():
    ph = content.sheet()
    phones = "".join(f'<div><p class="cap">Phone, {lbl}</p>{frame("ph", t, ph)}</div>' for t, lbl in (("dark", "night"), ("light", "day")))
    return ('<section class="scr" id="sheet"><h2>A sheet</h2><p>Pickers open as an opaque sheet that rises from the bottom and drags down '
            'to close (D7). The season picker, with search, over Standings.</p>'
            f'<div class="phones">{phones}</div></section>')


body = "".join(section(*s) for s in SCREENS) + sheet_section()
toc = "".join(f'<a href="#{k}">{t}</a>' for k, t, *_ in SCREENS) + '<a href="#sheet">A sheet</a>'
page = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>F1 DataStop Screens</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@600;700;800&family=Saira:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600;700&family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap">
<style>{(here / "kit.css").read_text()}
{css()}</style></head><body><div class="wrap">
<p class="kicker">F1 DataStop design release, key screens, 10 Nov 2026</p>
<h1>The key screens, before any build</h1>
<p class="lede">Floodlight Livery in red and carbon, on the connected structure you accepted: every name a link, one page per Grand Prix, one season kept on every page, navigation by Home, Races, Standings, Drivers and More. The shell is Mondar's: a floating header pill, a floating dock, a floating sidebar and top bar on desktop, opaque sheets, nothing see-through. The logo is the Refined rear wing until you pick. Standings are the real ones after round 20; results, times and lap data are sample data.</p>
<nav class="toc" aria-label="Screens">{toc}</nav>
{body}
</div>
<script>
(function(){{
  function fit(){{
    document.querySelectorAll('.fit').forEach(function(el){{
      var w=+el.dataset.w,h=+el.dataset.h,k=Math.min(1,el.clientWidth/w);
      el.style.height=(h*k)+'px'; el.firstElementChild.style.transform='scale('+k+')';
    }});
  }}
  fit(); window.addEventListener('resize',fit);
}})();
</script></body></html>
"""
assert "·" not in page, "middle dot"
(here.parent / "f1datastop-screens.html").write_text(page)
print("built", len(page), "bytes")
