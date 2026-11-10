"""Charts drawn for the screens: a speed trace and the points progression. The lap chart
is the board's own (concepts._lapchart). Series take team colours; nothing takes the brand
red."""
from data import CORNERS, DRIVERS, FINISH, LAP_KM, QUALI, STANDINGS, TEAM, points_progress, speed


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


def sankey(W, H):
    """Qualifying grid to race: each driver's band runs from grid slot to finishing place, in the team colour.
    Places gained or lost are written beside the finish, never shown by colour alone."""
    L, R, T, B, gap = 62, 78, 22, 6, 4
    n = len(QUALI)
    h = (H - T - B - gap * (n - 1)) / n
    y = lambda i: T + i * (h + gap)
    team = dict(QUALI)
    g = [f'<text x="{L}" y="12" class="ax">Qualifying grid</text>',
         f'<text x="{W - R}" y="12" class="ax" text-anchor="end">Race</text>']
    for qi, (code, tid) in enumerate(QUALI):
        fi = FINISH.index(code)
        x0, x1 = L + 6, W - R - 6
        y0, y1 = y(qi), y(fi)
        mx = (x0 + x1) / 2
        g.append(f'<path d="M{x0} {y0:.1f} C{mx} {y0:.1f} {mx} {y1:.1f} {x1} {y1:.1f} L{x1} {y1 + h:.1f} '
                 f'C{mx} {y1 + h:.1f} {mx} {y0 + h:.1f} {x0} {y0 + h:.1f} Z" fill="{TEAM[tid]}" fill-opacity=".42"/>')
        g.append(f'<rect x="{L}" y="{y0:.1f}" width="6" height="{h:.1f}" rx="2" fill="{TEAM[tid]}"/>'
                 f'<text x="{L - 8}" y="{y0 + h / 2 + 4:.1f}" class="lbl" text-anchor="end" fill="var(--ink)">{qi + 1} {code}</text>')
    for fi, code in enumerate(FINISH):
        qi = [c for c, _ in QUALI].index(code)
        d = qi - fi
        mv = f"+{d}" if d > 0 else (f"{d}".replace("-", "\u2212") if d < 0 else "=")
        y1 = y(fi)
        g.append(f'<rect x="{W - R - 6}" y="{y1:.1f}" width="6" height="{h:.1f}" rx="2" fill="{TEAM[team[code]]}"/>'
                 f'<text x="{W - R + 8}" y="{y1 + h / 2 + 4:.1f}" class="lbl" fill="var(--ink)">{fi + 1} {code}</text>'
                 f'<text x="{W - 4}" y="{y1 + h / 2 + 4:.1f}" class="ax" text-anchor="end">{mv}</text>')
    return (f'<svg viewBox="0 0 {W} {H}" class="lap" role="img" aria-label="Qualifying to race, top ten: '
            f'{", ".join(f"{c} from {[q for q, _ in QUALI].index(c) + 1} to {i + 1}" for i, c in enumerate(FINISH))}">{"".join(g)}</svg>')
