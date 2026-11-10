"""Charts drawn for the screens: a speed trace and the points progression. The lap chart
is the board's own (concepts._lapchart). Series take team colours; nothing takes the brand
red."""
from data import CAR_TEAM, CORNERS, DNF, DRIVERS, GRID, LAP_KM, QUALI, RACE, STANDINGS, TEAM, points_progress, speed


def speed_trace(W, H, compact=False):
    L, R, T, B = 40, 12, 14, 26
    sx = lambda d: L + d / LAP_KM * (W - L - R)
    sy = lambda v: T + (340 - v) / (340 - 60) * (H - T - B)
    g = []
    for v in (100, 200, 300):
        g.append(f'<line x1="{L}" x2="{W - R}" y1="{sy(v):.1f}" y2="{sy(v):.1f}" class="grid"/>'
                 f'<text x="{L - 6}" y="{sy(v) + 4:.1f}" class="ax" text-anchor="end">{v}</text>')
    for i, (dc, _) in enumerate(CORNERS):
        if compact and i % 2:
            continue
        g.append(f'<text x="{sx(dc):.1f}" y="{H - 8}" class="ax" text-anchor="middle">T{i + 1}</text>')
    for did, bias, late in (("antonelli", -7.0, 0.025), ("max_verstappen", 0.0, 0.0)):
        pts = " ".join(f"{sx(d / 100):.1f},{sy(speed(d / 100, bias, late)):.1f}" for d in range(0, int(LAP_KM * 100) + 1))
        g.append(f'<polyline points="{pts}" fill="none" stroke="{TEAM[DRIVERS[did][2]]}" stroke-width="2" stroke-linejoin="round"/>')
    return (f'<svg viewBox="0 0 {W} {H}" class="lap" role="img" aria-label="Speed in km/h over lap 64, '
            f'Verstappen and Antonelli">{"".join(g)}</svg>')


def progression(W, H):
    L, R, T, B = 40, 44, 12, 26
    sx = lambda r: L + (r - 1) / 19 * (W - L - R)
    sy = lambda p: T + (400 - p) / 400 * (H - T - B)
    g = []
    for p in (100, 200, 300, 400):
        g.append(f'<line x1="{L}" x2="{W - R}" y1="{sy(p):.1f}" y2="{sy(p):.1f}" class="grid"/>'
                 f'<text x="{L - 6}" y="{sy(p) + 4:.1f}" class="ax" text-anchor="end">{p}</text>')
    for r in (1, 5, 10, 15, 20):
        g.append(f'<text x="{sx(r):.1f}" y="{H - 8}" class="ax" text-anchor="middle">{r}</text>')
    last = []
    for i, (did, pts, _) in enumerate(STANDINGS[:4]):
        series = points_progress(pts, 0, 7 + i * 13)
        col = TEAM[DRIVERS[did][2]]
        dash = ' stroke-dasharray="6 4"' if i == 2 else ""  # teammates share a colour, so the second gets a dash
        g.append(f'<polyline points="{" ".join(f"{sx(r):.1f},{sy(p):.1f}" for r, p in enumerate(series, 1))}" '
                 f'fill="none" stroke="{col}" stroke-width="2.2"{dash}/>')
        last.append((sy(series[-1]), DRIVERS[did][1][:3].upper(), col))
    placed = []
    for y, n, col in sorted(last):
        y = max(y, placed[-1] + 13) if placed else y
        placed.append(y)
        g.append(f'<text x="{W - R + 6}" y="{y + 4:.1f}" class="lbl" fill="{col}">{n}</text>')
    return f'<svg viewBox="0 0 {W} {H}" class="lap" role="img" aria-label="Points after each round, top four">{"".join(g)}</svg>'


def sankey(W, H, compact=False):
    """Qualifying, grid, race, as the app draws it (MuiSankeyChart): three columns, every car, a team-coloured
    marker per place, and each band coloured by the change between columns: gain, loss or hold. A retirement's
    band is dimmed. The legend names the colours, so they are never the only cue."""
    L, R, T, B = (46, 46, 30, 4) if compact else (58, 58, 30, 4)
    n = len(QUALI)
    step = (H - T - B) / n
    m = 9 if compact else 11
    cols = [L, (L + W - R - m) / 2, W - R - m]
    y = lambda i: T + i * step + (step - m) / 2
    fs = 9 if compact else 11
    g = [f'<text x="{x + m / 2:.1f}" y="12" class="ax" text-anchor="middle" style="letter-spacing:.12em">{t}</text>'
         for x, t in zip(cols, ("QUALI", "GRID", "RACE"))]
    bw = max(2.0, m - 4)
    for (a, b), (xa, xb) in zip(((QUALI, GRID), (GRID, RACE)), ((cols[0], cols[1]), (cols[1], cols[2]))):
        for i, code in enumerate(a):
            j = b.index(code)
            col = "var(--gain)" if j < i else ("var(--loss)" if j > i else "var(--hold)")
            op = .18 if (code in DNF and b is RACE) else .55
            y0, y1 = y(i) + m / 2, y(j) + m / 2
            x0, x1 = xa + m, xb
            mx = (x0 + x1) / 2
            g.append(f'<path d="M{x0:.1f} {y0:.1f} C{mx:.1f} {y0:.1f} {mx:.1f} {y1:.1f} {x1:.1f} {y1:.1f}" fill="none" '
                     f'stroke="{col}" stroke-opacity="{op}" stroke-width="{bw:.1f}"/>')
    for x, order in zip(cols, (QUALI, GRID, RACE)):
        for i, code in enumerate(order):
            g.append(f'<rect x="{x:.1f}" y="{y(i):.1f}" width="{m}" height="{m}" rx="2.5" fill="{CAR_TEAM[code]}"/>')
    for i, code in enumerate(QUALI):
        g.append(f'<text x="{cols[0] - 5:.1f}" y="{y(i) + m - 1.5:.1f}" class="sk" text-anchor="end" style="font-size:{fs}px">{i + 1} {code}</text>')
    for i, code in enumerate(RACE):
        g.append(f'<text x="{cols[2] + m + 5:.1f}" y="{y(i) + m - 1.5:.1f}" class="sk" style="font-size:{fs}px">{code} {i + 1}</text>')
    return (f'<svg viewBox="0 0 {W} {H}" class="lap" role="img" aria-label="Qualifying, grid and race order for 22 cars. '
            f'Winner Antonelli from second; Alonso started 13th after a grid penalty and finished 10th; Perez retired.">{"".join(g)}</svg>')


def sankey_legend():
    return ('<span class="skl"><span><i style="background:var(--gain)"></i>&#8593; Gain</span>'
            '<span><i style="background:var(--loss)"></i>&#8595; Loss</span><span><i style="background:var(--hold)"></i>Hold</span></span>')
