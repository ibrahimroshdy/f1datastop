"""Charts drawn for the screens: a speed trace and the points progression. The lap chart
is the board's own (concepts._lapchart). Series take team colours; nothing takes the brand
red."""
from data import CORNERS, DRIVERS, LAP_KM, STANDINGS, TEAM, points_progress, speed


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
