"""Sample data for the screens, shaped like the 2026 season (standings after round 20 as
on the live site; results, times and session clocks are invented). Team colours are the
real ones from web/src/constants/f1Colors.ts."""
import math

TEAM = {"mercedes": "#27F4D2", "red_bull": "#3671C6", "ferrari": "#F91536", "mclaren": "#FF8700"}
TEAM_NAME = {"mercedes": "Mercedes", "red_bull": "Red Bull Racing", "ferrari": "Ferrari", "mclaren": "McLaren"}

DRIVERS = {  # id: (name, short, team)
    "antonelli": ("Andrea Kimi Antonelli", "Antonelli", "mercedes"),
    "max_verstappen": ("Max Verstappen", "Verstappen", "red_bull"),
    "russell": ("George Russell", "Russell", "mercedes"),
    "hamilton": ("Lewis Hamilton", "Hamilton", "ferrari"),
    "norris": ("Lando Norris", "Norris", "mclaren"),
    "leclerc": ("Charles Leclerc", "Leclerc", "ferrari"),
    "piastri": ("Oscar Piastri", "Piastri", "mclaren"),
}

STANDINGS = [("antonelli", 390, 9), ("max_verstappen", 279, 5), ("russell", 262, 3), ("hamilton", 261, 1),
             ("norris", 246, 1), ("leclerc", 249, 0), ("piastri", 152, 1)]
STANDINGS.sort(key=lambda r: -r[1])
TEAMS = [("mercedes", 652, 12), ("ferrari", 510, 1), ("mclaren", 398, 2), ("red_bull", 301, 5)]

# São Paulo Grand Prix, the last race (invented classification).
RESULTS = [("antonelli", "1:32:11.402", "MH", 25), ("max_verstappen", "+2.871", "MH", 18), ("russell", "+6.204", "MH", 15),
           ("norris", "+11.930", "SH", 12), ("hamilton", "+14.305", "MH", 10), ("leclerc", "+20.118", "MH", 8),
           ("piastri", "+24.660", "MHS", 6)]
FASTEST = ("max_verstappen", "1:12.486", 64)

RACES = [  # month, flag, name, circuit, dates, state, winner
    ("October", "MX", "Mexico City Grand Prix", "Autódromo Hermanos Rodríguez", "23 to 25 Oct", "done", "norris"),
    ("November", "BR", "São Paulo Grand Prix", "Interlagos", "6 to 8 Nov", "done", "antonelli"),
    ("November", "US", "Las Vegas Grand Prix", "Las Vegas Strip Circuit", "20 to 22 Nov", "next", None),
    ("November", "QA", "Qatar Grand Prix", "Lusail International Circuit", "27 to 29 Nov", "", None),
    ("December", "AE", "Abu Dhabi Grand Prix", "Yas Marina Circuit", "4 to 6 Dec", "", None),
]

DRIVER_RESULTS = [("BR", "São Paulo Grand Prix", 2, 1, 25), ("MX", "Mexico City Grand Prix", 3, 2, 18),
                  ("US", "United States Grand Prix", 1, 1, 25), ("SG", "Singapore Grand Prix", 4, 3, 15)]

CORNERS = [(0.25, 95), (0.62, 175), (0.95, 150), (1.45, 170), (1.9, 110), (2.4, 85), (2.9, 120), (3.35, 190)]
LAP_KM = 4.309


def speed(d, bias=0.0, late=0.0):
    v = 325.0
    for dc, vc in CORNERS:
        vc = vc + bias
        if d >= dc:
            v = min(v, math.sqrt(vc * vc + 95000 * (d - dc)))
        else:
            v = min(v, math.sqrt(vc * vc + 380000 * max(0.0, dc - d - late)))
    return v


def points_progress(total, wins, seed):
    out, acc, x = [], 0, seed
    for r in range(1, 21):
        x = (x * 1103515245 + 12345) % 2 ** 31
        acc += total / 20 * (0.6 + (x % 1000) / 1000 * 0.8)
        out.append(acc)
    k = total / out[-1]
    return [p * k for p in out]
