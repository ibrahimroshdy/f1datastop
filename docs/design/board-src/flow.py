"""The board's "How it connects" section: the flow review and the proposed structure.

Source: docs/design/audits/flows-2026-11-10.md. Proposed decisions D19 to D24.
"""

TASKS = [
    ("Last race's full results", "2, in a dialog with no URL", "1: the last Grand Prix card opens its page on Results"),
    ("A race's lap times", "3", "2: Grand Prix card, Laps"),
    ("Telemetry for any lap", "5 to 6, Pit Wall opens empty", "3: Grand Prix, Telemetry, tap a lap"),
    ("From a result row to that driver", "not possible", "1: every name is a link"),
    ("From a driver to a race they ran", "not possible", "1: their results list links each Grand Prix"),
    ("From a driver to their team", "not possible", "1"),
    ("Next session time in my time zone", "1, hidden in a dialog", "0: the home card shows the clock time"),
    ("A circuit's history", "2, from the Calendar only", "1 from any Grand Prix"),
    ("Last season's standings", "not possible on Standings", "1: the season in the header pill, kept on every page"),
]

PAGES = [
    ("Home", "Next Grand Prix with its sessions in your time, last Grand Prix with its podium, both standings tops. Every card opens a page."),
    ("Races", "Every Grand Prix of the season, flag first, grouped by month, searchable. The default lands on the next or latest one."),
    ("Grand Prix", "One page per weekend. Tabs: Schedule, Results (one session switch: practice, sprint, qualifying, race), Laps, Positions, Strategy (tyres and pit stops), Telemetry (any lap), Replay, Weather, Radio. Replaces the race dialog and Race Analysis; old links redirect."),
    ("Pit Wall", "The full-screen engineer view of the same weekend. Opened from a Grand Prix with that race loaded, and links back. Opens on the latest race, never empty."),
    ("Standings", "Drivers and teams for the season in the header; one renderer, used again by Home."),
    ("Drivers", "List with search, team filter and season; each driver page has the team, every race result as a link, and head to head."),
    ("Teams", "List and team pages; drivers link to their pages."),
    ("Circuits", "A list (new) and circuit pages; past editions and winners link to their Grand Prix and drivers."),
]

DECISIONS = [
    ("D19", "Every name is a link.", "Drivers, teams, Grands Prix, circuits and sessions, everywhere they appear: rows, cards, charts' legends, the Pit Wall."),
    ("D20", "A Grand Prix is a page.", "It replaces the race dialog and Race Analysis, with tabs for Schedule, Results, Laps, Positions, Strategy, Telemetry, Replay, Weather and Radio; the dialog goes."),
    ("D21", "One season, in the URL, kept on every page.", "Picked in the header pill; Standings, profiles and Home follow it."),
    ("D22", "Navigation by the nouns.", "Dock: Home, Races, Standings, Drivers, More (Teams, Circuits, Pit Wall, Docs). Sidebar: all seven. Search in the header pill finds any driver, team, Grand Prix or circuit."),
    ("D23", "No content behind a dialog without a URL.", "Sheets and dialogs are for pickers, filters and confirmations. One renderer per thing: results, standings and the Sankey each exist once."),
    ("D24", "Entries land on now.", "Races, a Grand Prix and the Pit Wall open on the next or latest race, never round 1 or an empty state."),
]


def flow_html():
    rows = "".join(f"<tr><th>{t}</th><td>{a}</td><td>{b}</td></tr>" for t, a, b in TASKS)
    pages = "".join(f'<div class="node"><b>{n}</b><p>{d}</p></div>' for n, d in PAGES)
    decs = "".join(f"<tr><th>{n}</th><td><b>{h}</b> {d}</td></tr>" for n, h, d in DECISIONS)
    return (
        '<div class="panel"><h3>What is wrong today</h3><ol class="why">'
        "<li>Driver names are links in 2 of about 24 places; teams in 3 of about 17; Grands Prix in 2; sessions in none.</li>"
        "<li>Every race click on Home and the Calendar opens a dialog with no URL, which always opens on Schedule. It is the only way into Race Analysis.</li>"
        "<li>Race Analysis and the Pit Wall link out to nothing and duplicate each other: two lap charts, two telemetry views, two replays.</li>"
        "<li>The Analysis tab opens round 1, not the latest race; the Pit Wall opens empty and is hidden on phones.</li>"
        "<li>Each page picks its season alone; five pages are locked to this year.</li>"
        "<li>Four copies of the standings, three of the race results.</li></ol></div>"
        f'<div class="panel scroll-x"><h3>Clicks, today and proposed</h3><table class="dec flowt"><thead><tr><th>Task</th><th>Today</th><th>Proposed</th></tr></thead><tbody>{rows}</tbody></table></div>'
        f'<div class="panel"><h3>The proposed structure</h3><p class="lede">Pages are the nouns of the sport. Each one links to every other noun it mentions.</p><div class="nodes">{pages}</div></div>'
        f'<div class="panel"><h3>Proposed, for your OK</h3><div class="scroll-x"><table class="dec">{decs}</table></div></div>')
