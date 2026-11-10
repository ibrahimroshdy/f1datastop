"""The six key screens and one sheet. Each function returns (phone_html, desktop_html)."""
from avatars import avatar
from charts import progression, sankey, speed_trace
from concepts import _lapchart, livery
from data import DRIVER_RESULTS, DRIVERS, FASTEST, RACES, RESULTS, STANDINGS, TEAM, TEAM_NAME, TEAMS
from race_bits import TYRE, flag, tyre
from shell import desktop, ic, phone


def av(did, size=40):
    n, _, t = DRIVERS[did]
    return avatar(did, n, TEAM[t], size)


def drow(did, end, pos=None, size=40, sub=None):
    n, _, t = DRIVERS[did]
    p = f'<span class="pos">{pos}</span>' if pos is not None else ""
    return (f'<li>{p}{av(did, size)}<span class="who"><b class="lnk">{n}</b><small>{sub or TEAM_NAME[t]}</small></span>'
            f'<span class="end">{end}</span></li>')


def crow(did, value, pos, sub=None):
    """The one compact row (D29): position, 32 px face, surname over team, one figure. One height everywhere."""
    _, short, t = DRIVERS[did]
    return (f'<li class="cr"><span class="pos">{pos}</span>{av(did, 32)}<span class="who"><b class="lnk">{short}</b>'
            f'<small>{sub or TEAM_NAME[t]}</small></span><span class="end"><b>{value}</b></span></li>')


def compact_standings(n=5):
    return "".join(crow(d, p, i + 1) for i, (d, p, _) in enumerate(STANDINGS[:n]))


def standings_rows(n=5, size=40):
    lead = STANDINGS[0][1]
    return "".join(drow(d, f'<b>{p}</b><small>{"Leader" if i == 0 else f"{lead - p} behind"}</small>', i + 1, size)
                   for i, (d, p, _) in enumerate(STANDINGS[:n]))


def team_rows(n=3):
    lead = TEAMS[0][1]
    return "".join(f'<li><span class="pos">{i + 1}</span><span class="tmk" style="width:6px;align-self:stretch;border-radius:3px;background:{TEAM[t]}"></span>'
                   f'<span class="who"><b class="lnk">{TEAM_NAME[t]}</b><small>{w} wins</small></span>'
                   f'<span class="end"><b>{p}</b><small>{"Leader" if i == 0 else f"{lead - p} behind"}</small></span></li>'
                   for i, (t, p, w) in enumerate(TEAMS[:n]))


def next_gp(full=True):
    sess = [("Practice 1", "Fri 20 Nov, 02:30"), ("Sprint qualifying", "Fri 20 Nov, 06:30"), ("Sprint", "Sat 21 Nov, 02:00"),
            ("Qualifying", "Sat 21 Nov, 06:00"), ("Race", "Sun 22 Nov, 06:00")]
    rows = "".join(f'<div><dt class="lnk">{a}</dt><dd class="num">{b}</dd></div>' for a, b in (sess if full else sess[-2:]))
    return (f'<article class="cd">{livery()}<div style="display:flex;gap:10px;align-items:center">{flag("US", 24, "United States")}'
            '<span class="chip red">Next</span></div>'
            '<h3 class="ttl lnk" style="font-size:26px;margin:10px 70px 2px 0">Las Vegas Grand Prix</h3>'
            '<p class="s2" style="font-size:14px">Las Vegas Strip Circuit, times in Cairo</p>'
            f'<dl class="sess" style="margin-top:10px">{rows}</dl>'
            '<div style="display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid var(--line);padding-top:10px">'
            '<span class="s2" style="font-size:14px">Practice 1 in</span><b class="num fig" style="font-size:24px">9d 03:57:11</b></div></article>')


def last_gp():
    pod = "".join(crow(d, t, i + 1) for i, (d, t, _, _) in enumerate(RESULTS[:3]))
    return (f'<article class="cd"><div style="display:flex;gap:10px;align-items:center">{flag("BR", 24, "Brazil")}'
            '<span class="chip">Last race</span></div>'
            '<h3 class="ttl lnk" style="font-size:22px;margin:10px 0 2px">São Paulo Grand Prix</h3>'
            f'<p class="s2" style="font-size:14px">Fastest lap <span class="purple num">{FASTEST[1]}</span>, Verstappen, lap {FASTEST[2]}</p>'
            f'<ul class="rows" style="margin-top:6px">{pod}</ul></article>')


def home():
    drivers = f'<article class="cd"><h3>Drivers <a>All</a></h3><ul class="rows" style="margin-top:6px">{compact_standings(5)}</ul></article>'
    teams = f'<article class="cd"><h3>Teams <a>All</a></h3><ul class="rows" style="margin-top:6px">{team_rows(3)}</ul></article>'
    ph = phone(next_gp(False) + last_gp() + sankey_card(300, 290) + drivers + teams, "Home", "home")
    dk = desktop(f'<div class="g3">{next_gp()}{last_gp()}{drivers}</div>'
                 f'<div class="g73">{sankey_card(620, 220)}{teams}</div>', "Home", "home")
    return ph, dk


def sankey_card(W, H, title="Qualifying to race, São Paulo"):
    return (f'<article class="cd"><h3>{title} <a>Open</a></h3>'
            f'<div style="margin-top:8px">{sankey(W, H)}</div></article>')


def lapcard(title, wide):
    svg = _lapchart("dark", 560 if wide else 300, 250 if wide else 230, "").replace("#B57BF7", "var(--fastest)")
    return f'<article class="cd"><h3>{title} <a>Open laps</a></h3><div style="margin-top:8px">{svg}</div></article>'


TABS = ["Schedule", "Results", "Laps", "Positions", "Strategy", "Telemetry", "Replay", "Weather", "Radio"]


def tabs(on, n=None):
    return '<div class="seg" style="flex-wrap:nowrap">' + "".join(
        f'<span class="{"on" if t == on else ""}">{t}</span>' for t in TABS[: n or len(TABS)]) + "</div>"


def section_pill(on):
    return (f'<div style="display:flex;gap:8px;align-items:center"><span class="pill act">{on} {ic("chev", 16)}</span>'
            '<span class="q" style="font-size:13px">9 sections</span></div>')


def gp_head(compact=False):
    w = DRIVERS["antonelli"][0]
    return (f'<article class="cd">{livery()}<div style="display:flex;gap:10px;align-items:center">{flag("BR", 24, "Brazil")}'
            '<span class="chip">Sprint weekend</span></div>'
            f'<h3 class="ttl" style="font-size:{26 if compact else 32}px;margin:10px 70px 2px 0">São Paulo Grand Prix</h3>'
            '<p class="s2" style="font-size:14px"><span class="lnk">Interlagos</span>, 6 to 8 Nov</p>'
            f'<div style="display:flex;gap:10px;align-items:center;margin-top:12px">{av("antonelli", 36)}'
            f'<span class="who"><b class="lnk">{w}</b><small>Won from P2, 71 laps</small></span></div></article>')


def result_rows(n):
    out = []
    for i, (d, t, tyres, pts) in enumerate(RESULTS[:n]):
        fl = d == FASTEST[0]
        sub = f'{TEAM_NAME[DRIVERS[d][2]]}' + (f', <span class="purple">fastest lap</span>' if fl else "")
        ty = "".join(tyre(c, 16) for c in tyres)
        out.append(drow(d, f'<b class="{"fig"}">{t}</b><small style="display:flex;gap:3px;justify-content:flex-end;margin-top:3px">{ty}</small>', i + 1, 40, sub))
    return "".join(out)


def grand_prix():
    sess = '<div class="chips"><span class="ck">Sprint</span><span class="ck">Qualifying</span><span class="ck on">Race</span></div>'
    ph = phone(gp_head(True) + section_pill("Results") + sess
               + f'<article class="cd"><ul class="rows">{result_rows(5)}</ul></article>' + sankey_card(300, 290, "Qualifying to race"),
               "São Paulo GP", "races", "Interlagos, 6 to 8 Nov", back=True)
    rows = "".join(
        f'<tr><td class="num">{i + 1}</td><td class="dv">{av(d, 32)}<b class="lnk">{DRIVERS[d][0]}</b></td>'
        f'<td><span class="lnk">{TEAM_NAME[DRIVERS[d][2]]}</span></td><td class="r num">71</td>'
        f'<td class="r num">{t}</td><td><span style="display:flex;gap:3px">{"".join(tyre(c, 18) for c in ty)}</span></td>'
        f'<td class="r num {"purple" if d == FASTEST[0] else ""}">{FASTEST[1] if d == FASTEST[0] else ""}</td><td class="r num fig">{p}</td></tr>'
        for i, (d, t, ty, p) in enumerate(RESULTS))
    table = ('<article class="cd"><table class="tbl"><thead><tr><th>Pos</th><th>Driver</th><th>Team</th><th class="r">Laps</th>'
             f'<th class="r">Time</th><th>Tyres</th><th class="r">Fastest</th><th class="r">Pts</th></tr></thead><tbody>{rows}</tbody></table></article>')
    side = gp_head()
    strat = "".join(
        f'<li style="flex-direction:column;align-items:stretch;gap:6px"><span style="display:flex;gap:8px;align-items:center">{av(d, 28)}<b class="lnk">{DRIVERS[d][1]}</b></span>'
        f'<span class="strip">{"".join(f"<span style=flex:{w};background:{TYRE[c][1]}></span>" for c, w in zip(ty, (30, 41, 10)))}</span></li>'
        for d, _, ty, _ in RESULTS[:3])
    dk = desktop(f'{tabs("Results")}<div style="display:flex;justify-content:space-between">{sess}<span class="pill">Open in Pit Wall {ic("go", 16)}</span></div>'
                 f'<div class="g73"><div style="display:grid;gap:12px">{table}<article class="cd"><h3>Strategy</h3><ul class="rows">{strat}</ul></article></div>'
                 f'<div style="display:grid;gap:12px">{side}{sankey_card(340, 300, "Qualifying to race")}</div></div>',
                 "São Paulo Grand Prix", "races", flag("BR", 22, "Brazil"))
    return ph, dk


def telemetry():
    pick = (f'<div style="display:flex;gap:8px;flex-wrap:wrap">{av("max_verstappen", 34)}{av("antonelli", 34)}'
            '<span class="pill">Lap 64, fastest ' + ic("chev", 16) + '</span><span class="pill">Speed ' + ic("chev", 16) + "</span></div>")
    sectors = "".join(f'<div><dt>Sector {i}</dt><dd class="num">{a} <span class="q">vs</span> {b}</dd></div>'
                      for i, a, b in ((1, '<span class="purple">18.204</span>', "18.311"), (2, "35.610", '<span class="purple">35.577</span>'),
                                      (3, '<span class="purple">18.672</span>', "18.732")))
    tel = (f'<article class="cd"><h3>Telemetry <a>km/h</a></h3>{pick}<div style="margin-top:10px">{speed_trace(320, 220, True)}</div>'
           f'<p class="s2" style="font-size:13px;margin-top:4px">Verstappen 1:12.486, Antonelli 1:12.620, 0.134 slower</p>'
           f'<dl class="sess" style="margin-top:8px">{sectors}</dl></article>')
    ph = phone(section_pill("Telemetry") + tel, "São Paulo GP", "races",
               "Telemetry, race", back=True)
    tel_w = tel.replace(speed_trace(320, 220, True), speed_trace(560, 300))
    dk = desktop(f'{tabs("Laps")}<div class="g2">{lapcard("Lap times", False).replace(_lapchart("dark", 300, 230, "").replace("#B57BF7", "var(--fastest)"), _lapchart("dark", 560, 330, "").replace("#B57BF7", "var(--fastest)"))}{tel_w}</div>',
                 "São Paulo Grand Prix", "races", flag("BR", 22, "Brazil") + '<span class="pill">Open in Pit Wall ' + ic("go", 16) + "</span>")
    return ph, dk


def standings():
    seg = '<div class="seg fill"><span class="on">Drivers</span><span>Teams</span></div>'
    ph = phone(seg + f'<article class="cd"><ul class="rows">{standings_rows(7)}</ul></article>', "Standings", "standings", "After São Paulo")
    rows = "".join(f'<tr><td class="num">{i + 1}</td><td class="dv">{av(d, 32)}<b class="lnk">{DRIVERS[d][0]}</b></td>'
                   f'<td><span class="lnk">{TEAM_NAME[DRIVERS[d][2]]}</span></td><td class="r num">{w}</td>'
                   f'<td class="r num fig">{p}</td><td class="r s2">{"Leader" if i == 0 else f"{STANDINGS[0][1] - p} behind"}</td></tr>'
                   for i, (d, p, w) in enumerate(STANDINGS))
    table = ('<article class="cd"><table class="tbl"><thead><tr><th>Pos</th><th>Driver</th><th>Team</th><th class="r">Wins</th>'
             f'<th class="r">Points</th><th class="r">Gap</th></tr></thead><tbody>{rows}</tbody></table></article>')
    chart = f'<article class="cd"><h3>Points after each round</h3><div style="margin-top:8px">{progression(400, 280)}</div></article>'
    dk = desktop(f'<div style="display:flex;gap:10px">{seg}</div><div class="g73">{table}{chart}</div>', "Standings", "standings",
                 '<span class="q" style="font-size:14px">After the São Paulo Grand Prix</span>')
    return ph, dk


def races(desk=False):
    out, month = [], None
    for m, fc, name, circ, dates, state, win in RACES:
        if m != month:
            out.append(f'<li class="grp-h" style="border:0">{m}</li>')
            month = m
        right = (f'{av(win, 28)}' if win else (f'<span class="chip red">Next</span>' if state == "next" else ""))
        out.append(f'<li>{flag(fc, 21, "")}<span class="who"><b class="lnk ttl" style="font-size:17px">{name}</b><small>{circ}</small></span>'
                   f'<span class="end" style="gap:4px"><small class="num" style="font-size:13px">{dates}</small>{right}</span></li>')
    return "".join(out)


def races_screen():
    tools = ('<div class="fld">' + ic("search", 18) + 'Search Grands Prix</div>'
             '<div class="chips"><span class="ck on">All 24</span><span class="ck">Coming 4</span><span class="ck">Done 20</span><span class="ck">Sprint 6</span></div>')
    ph = phone(tools + f'<article class="cd"><ul class="rows">{races()}</ul></article>'
               '<p class="q" style="font-size:13px;text-align:center">5 of 24, <span class="lnk">show earlier</span></p>', "Races", "races", "Season 2026")
    nxt = '<span class="chip red">Next</span>'

    def win_cell(w, st):
        if w:
            return f'<span style="display:flex;gap:8px;align-items:center">{av(w, 28)}<span class="lnk">{DRIVERS[w][1]}</span></span>'
        return nxt if st == "next" else ""
    rows = "".join(
        f'<tr><td class="dv">{flag(fc, 21, "")}<span class="who"><b class="lnk ttl" style="font-size:17px">{n}</b><small>{c}</small></span></td>'
        f'<td class="num">{dt}</td><td>{win_cell(w, st)}</td></tr>'
        for _, fc, n, c, dt, st, w in RACES)
    wide_tools = tools.replace('class="fld"', 'class="fld" style="width:320px"')
    dk = desktop(f'<div style="display:flex;gap:12px;align-items:center">{wide_tools}</div>'
                 f'<article class="cd"><table class="tbl"><thead><tr><th>Grand Prix</th><th>Dates</th><th>Winner</th></tr></thead><tbody>{rows}</tbody></table>'
                 '<p class="q" style="font-size:13px;margin-top:10px">Rows 20 to 24 of 24, grouped by month. <span class="lnk">Earlier</span></p></article>',
                 "Races", "races")
    return ph, dk


def driver():
    head = (f'<article class="cd">{livery(TEAM["mercedes"])}<div style="display:flex;gap:14px;align-items:center;padding-right:60px">'
            f'{av("antonelli", 72)}<div><span class="chip red">P1 drivers</span>'
            '<h3 class="ttl" style="font-size:26px;margin:6px 0 2px">Andrea Kimi Antonelli</h3>'
            '<p class="s2" style="font-size:14px"><span class="lnk">Mercedes</span>, Italy</p></div></div>'
            '<div class="stat" style="margin-top:14px"><div><b>390</b><small>Points</small></div><div><b>9</b><small>Wins</small></div>'
            '<div><b>14</b><small>Podiums</small></div><div><b>7</b><small>Poles</small></div></div></article>')
    res = "".join(f'<li>{flag(fc, 21, "")}<span class="who"><b class="lnk">{n}</b><small>From P{g}</small></span>'
                  f'<span class="end"><b>P{f}</b><small>{p} points</small></span></li>' for fc, n, g, f, p in DRIVER_RESULTS)
    results = f'<article class="cd"><h3>2026 results <a>All 20</a></h3><ul class="rows" style="margin-top:6px">{res}</ul></article>'
    h2h = (f'<article class="cd"><h3>Against <span class="lnk" style="text-transform:none;font:inherit">Russell</span></h3>'
           f'<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">{av("antonelli", 40)}'
           '<span class="num" style="font-size:20px"><b class="fig">14</b> <span class="q">to</span> <b class="fig">6</b></span>'
           f'{av("russell", 40)}</div><p class="s2" style="font-size:13px;margin-top:6px;text-align:center">Ahead at the finish in 14 of 20 races</p></article>')
    ph = phone(head + results + h2h, "Antonelli", "drivers", "Mercedes", back=True)
    dk = desktop(f'<div class="g73"><div style="display:grid;gap:12px">{head}{results}</div><div style="display:grid;gap:12px">{h2h}'
                 f'<article class="cd"><h3>Team</h3><ul class="rows">{drow("russell", "<b>262</b><small>P3</small>", None, 36)}</ul></article></div></div>',
                 "Andrea Kimi Antonelli", "drivers")
    return ph, dk


def sheet():
    opts = "".join(f'<div class="opt"><span class="{"ok" if y == 2026 else ""}">{y}</span>{ic("check", 20) if y == 2026 else ""}</div>'
                   for y in (2026, 2025, 2024, 2023, 2022))
    over = ('<div class="veil"></div><div class="sheet"><div class="grab"></div><div class="sh"><span class="ttl" style="font-size:22px">Season</span>'
            f'<span class="pill act">Done</span></div><div class="fld" style="margin:6px 0 8px">{ic("search", 18)}Search seasons</div>{opts}</div>')
    seg = '<div class="seg fill"><span class="on">Drivers</span><span>Teams</span></div>'
    return phone(seg + f'<article class="cd"><ul class="rows">{standings_rows(7)}</ul></article>', "Standings", "standings",
                 "After São Paulo", overlay=over)


def quick_look():
    """A race opens a quick look first (D30): a sheet on a phone, a dialog on a desktop, with its own
    URL (?race=sao-paulo), the summary, the Sankey and the way into the full page."""
    tiles = "".join(f'<div class="ql-t">{av(d, 36)}<span class="who"><small>{lbl}</small><b class="lnk">{DRIVERS[d][1]}</b>'
                    f'{f"<small class=num>{x}</small>" if x else ""}</span></div>'
                    for lbl, d, x in (("Winner", "antonelli", ""), ("Pole", "max_verstappen", ""),
                                      ("Fastest lap", "max_verstappen", '<span class="purple">1:12.486</span>')))
    body = (f'<div style="display:flex;gap:10px;align-items:center">{flag("BR", 24, "Brazil")}<span class="chip">Sprint weekend</span></div>'
            '<h3 class="ttl" style="font-size:26px;margin:8px 0 2px">São Paulo Grand Prix</h3>'
            '<p class="s2" style="font-size:14px"><span class="lnk">Interlagos</span>, 6 to 8 Nov</p>'
            f'<div class="ql-g">{tiles}</div>'
            '<p class="h3" style="margin:4px 0 6px;font-size:15px">Qualifying to race</p>{SANKEY}'
            '<div class="chips" style="margin-top:12px"><span class="ck">Results</span><span class="ck">Laps</span><span class="ck">Telemetry</span><span class="ck">Strategy</span></div>'
            f'<span class="pill act" style="width:100%;justify-content:center;height:46px;margin-top:12px;font-size:15px">Open Grand Prix {ic("go", 16)}</span>')
    under = f'<article class="cd"><ul class="rows">{races()}</ul></article>'
    ph_over = ('<div class="veil"></div><div class="sheet" style="padding-bottom:30px"><div class="grab"></div>'
               + body.replace("{SANKEY}", sankey(320, 230)) + "</div>")
    ph = phone(under, "Races", "races", "Season 2026", overlay=ph_over)
    dk_over = ('<div class="veil" style="border-radius:22px"></div><div class="dlg sur">'
               + body.replace("{SANKEY}", sankey(560, 200)) + "</div>")
    dk = desktop(f'<article class="cd"><ul class="rows">{races()}</ul></article>', "Races", "races") + dk_over
    return ph, dk
