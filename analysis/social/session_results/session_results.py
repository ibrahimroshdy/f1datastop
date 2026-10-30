#!/usr/bin/env python3
"""F1 DataStop session results card (FP1, FP2, FP3, sprint qualifying, sprint, qualifying, race).

Every classified driver in order: position, headshot in a team colour ring, country flag, car
number, name, real team logo, best lap (or race time / status) and the gap to P1. Header: race
flag + circuit name, big plain title ("Mexico City GP Practice 2"), one stat line. 2026 carbon
background with red glow (no watermark), F1 DataStop logo + wordmark top right.
P1's lap time (race winner's time) in F1 purple. A round tyre badge (S/M/H/I/W) next to each time
shows the compound of that lap (race: fastest lap), from OpenF1; left out when unknown, never guessed.
Reflows into two columns above 12 rows so a full 22 car field stays legible on a phone.

  python3 session_results.py --season 2026 --race mexico --session fp2 [--out DIR] [--slug NAME]
  python3 session_results.py --season 2026 --race mexico --session fp2 --data results.csv

Data: the formula1.com results page for the session (no login). --data loads a CSV or JSON
instead (columns: pos, number, code, driver, team, time, gap, plus optional flag, status,
headshot_url, team_colour). The parsed classification is always saved as <slug>_data.csv
next to the images. Writes <slug>_x.png 1080x1350, _ig 1080x1440, _threads 1440x1920; never
overwrites (a clash gets _2, _3 ...). Never crops: the layout is drawn natively per size.
"""
import argparse, csv, html, json, os, re, sys, time, unicodedata, urllib.request
import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, "/workspace/final/templates/driver_cards")
import template as T                                    # brand, flag, fonts, headshot dir

THEME_SRC = "/workspace/charts/mocks/stat_19_v3.py"
def _load_theme():
    src = open(THEME_SRC).read(); cut = src.index("# ---------------- data")
    ns = {"__name__": "stat_19_theme"}; exec(compile(src[:cut], THEME_SRC, "exec"), ns); return ns
make_background = _load_theme()["make_background"]

GF = "/usr/share/fonts/truetype/sand-box/google/"
BLK = GF + "Barlow Condensed/BarlowCondensed-Black.ttf"
XB = GF + "Barlow Condensed/BarlowCondensed-ExtraBold.ttf"
BLD = GF + "Barlow Condensed/BarlowCondensed-Bold.ttf"
SEMI = GF + "Barlow Condensed/BarlowCondensed-SemiBold.ttf"
MED = GF + "Barlow Condensed/BarlowCondensed-Medium.ttf"
for _p in ("SEMI", "MED"):
    if not os.path.exists(globals()[_p]): globals()[_p] = BLD
SIZES = T.SIZES
LOGOS = "/workspace/assets/team-logos/"
HS_CACHE = "/workspace/assets/headshots/session/"       # headshots fetched for drivers not in T.HS
F1 = "https://www.formula1.com"
JOLPICA = "https://api.jolpi.ca/ergast/f1"
OPENF1 = "https://api.openf1.org/v1"
OF1_SESSION = {"fp1": ["Practice 1"], "fp2": ["Practice 2"], "fp3": ["Practice 3"], "quali": ["Qualifying"],
    "sprint_quali": ["Sprint Qualifying", "Sprint Shootout"], "sprint": ["Sprint"], "race": ["Race"]}
TYRE = {"SOFT": ("S", (218, 41, 28)), "MEDIUM": ("M", (255, 209, 46)), "HARD": ("H", (240, 240, 236)),
        "INTERMEDIATE": ("I", (67, 176, 42)), "WET": ("W", (47, 140, 255))}
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) f1datastop"}
BANNED = re.compile(r"[|\u2022\u00b7]|https?://|www\.|\.com\b", re.I)
INK = (242, 243, 245); SEC = (214, 216, 224); MUTE = (170, 172, 184); GOLD = (231, 176, 8); RED = (225, 6, 0)
PURPLE = (168, 85, 247)   # F1 fastest-time purple: P1's lap time (race winner's time)

SESSIONS = {   # key: (formula1.com results path, title label, kind)
    "fp1": ("practice/1", "Practice 1", "practice"), "fp2": ("practice/2", "Practice 2", "practice"),
    "fp3": ("practice/3", "Practice 3", "practice"), "quali": ("qualifying", "Qualifying", "quali"),
    "sprint_quali": ("sprint-qualifying", "Sprint Qualifying", "quali"),
    "sprint": ("sprint-results", "Sprint", "race"), "race": ("race-result", "Race", "race")}
SESSION_ALIASES = {"q": "quali", "qualifying": "quali", "sq": "sprint_quali", "sprint-qualifying": "sprint_quali",
    "sprint_qualifying": "sprint_quali", "gp": "race", "practice1": "fp1", "practice2": "fp2", "practice3": "fp3"}

TEAM_LOGO = {"ferrari": "ferrari", "mercedes": "mercedes", "red bull racing": "red_bull", "red bull": "red_bull",
    "mclaren": "mclaren", "aston martin": "aston_martin", "alpine": "alpine", "williams": "williams",
    "racing bulls": "racing_bulls", "audi": "audi", "haas f1 team": "haas", "haas": "haas", "cadillac": "cadillac"}
TEAM_COLOUR = {"ferrari": "#E8002D", "mercedes": "#27F4D2", "red_bull": "#3671C6", "mclaren": "#FF8000",
    "aston_martin": "#229971", "alpine": "#FF87BC", "williams": "#1868DB", "racing_bulls": "#6692FF",
    "audi": "#F50537", "haas": "#B6BABD", "cadillac": "#C4A747"}
TEAM_SHORT = {"red_bull": "RED BULL", "aston_martin": "ASTON MARTIN", "racing_bulls": "RACING BULLS", "haas": "HAAS"}
# driver code -> ISO 3166 flag (2026 grid and 2026 FP1 drivers; checked against Wikipedia)
NATION = {"VER": "nl", "HAD": "fr", "LEC": "mc", "HAM": "gb", "RUS": "gb", "ANT": "it", "NOR": "gb", "PIA": "au",
    "ALO": "es", "STR": "ca", "GAS": "fr", "COL": "ar", "ALB": "th", "SAI": "es", "LAW": "nz", "LIN": "gb",
    "HUL": "de", "BOR": "br", "OCO": "fr", "BEA": "gb", "PER": "mx", "BOT": "fi", "TSU": "jp", "DOO": "au",
    "VES": "dk", "IWA": "jp", "TSO": "bg", "MIN": "it", "HIR": "jp", "FOR": "it", "CRA": "us", "BRO": "gb",
    "SLA": "gb", "HER": "us", "DRU": "br", "ARO": "ee", "BEG": "it", "MAR": "es", "DUN": "ie", "SHW": "cn",
    "ZHO": "cn", "VAN": "nl", "OSU": "jp", "FIT": "br", "LIN_": "gb"}
COUNTRY_FLAG = {"Australia": "au", "China": "cn", "Japan": "jp", "Bahrain": "bh", "Saudi Arabia": "sa",
    "USA": "us", "United States": "us", "Italy": "it", "Monaco": "mc", "Spain": "es", "Canada": "ca",
    "Austria": "at", "UK": "gb", "United Kingdom": "gb", "Belgium": "be", "Hungary": "hu",
    "Netherlands": "nl", "Azerbaijan": "az", "Singapore": "sg", "Mexico": "mx", "Brazil": "br",
    "Qatar": "qa", "UAE": "ae", "United Arab Emirates": "ae", "Malaysia": "my", "Germany": "de",
    "France": "fr", "Portugal": "pt", "Argentina": "ar"}
SLUG_ALIAS = {"united-states": "americas", "great-britain": "silverstone", "barcelona-catalunya": "catalunya",
    "abu-dhabi": "yas_marina", "las-vegas": "vegas", "saudi-arabia": "jeddah", "emilia-romagna": "imola"}


def F(p, s): return ImageFont.truetype(p, max(1, int(s)))
def rgb(c): return T.rgb(c)


def _get(url, as_json=False, tries=3):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                b = r.read()
            return json.loads(b) if as_json else b
        except Exception:
            if i == tries - 1: raise
            time.sleep(2)


def norm(s): return re.sub(r"[^a-z0-9]+", "", unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower())


# ---------------------------------------------------------------- event + data
def event_info(season, race, rnd=None):
    """GP name, circuit, flag from the Jolpica schedule (matched on round, or the formula1.com slug)."""
    races = _get(f"{JOLPICA}/{season}.json?limit=40", True)["MRData"]["RaceTable"]["Races"]
    if rnd: hit = [r for r in races if int(r["round"]) == int(rnd)]
    else:
        k = norm(SLUG_ALIAS.get(race, race))
        hit = [r for r in races if k in (norm(r["Circuit"]["circuitId"]), norm(r["Circuit"]["Location"]["country"]),
               norm(r["Circuit"]["Location"]["locality"]))] or \
              [r for r in races if k and k in norm(r["raceName"])]
    if len(hit) != 1: sys.exit(f"could not match {race!r} in the {season} schedule; pass --round or --title/--circuit/--flag")
    r = hit[0]
    return dict(round=int(r["round"]), date=r.get("date", ""), gp=r["raceName"].replace("Grand Prix", "GP").strip(),
                circuit=r["Circuit"]["circuitName"], flag=COUNTRY_FLAG.get(r["Circuit"]["Location"]["country"]))


def f1_race_id(season, race):
    page = _get(f"{F1}/en/results/{season}/races").decode("utf-8", "ignore")
    ids = set(re.findall(rf"/en/results/{season}/races/(\d+)/{re.escape(race)}/", page))
    if len(ids) != 1: sys.exit(f"formula1.com has no single {season} results id for {race!r} (found {sorted(ids)})")
    return ids.pop()


def _cells(row):
    return re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)


def _txt(s): return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s))).strip()


def fetch_f1(season, race, session):
    """Parse the formula1.com results table for one session. Returns (rows, url)."""
    path = SESSIONS[session][0]
    url = f"{F1}/en/results/{season}/races/{f1_race_id(season, race)}/{race}/{path}"
    page = _get(f"{url}?t={int(time.time())}").decode("utf-8", "ignore")   # bust stale CDN copies
    m = re.search(r"<table[^>]*>(.*?)</table>", page, re.S)
    if not m or "No results available" in m.group(1): return [], url
    heads = [_txt(h) for h in re.findall(r"<th[^>]*>(.*?)</th>", m.group(1), re.S)]
    rows = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", m.group(1), re.S)[1:]:
        c = _cells(tr)
        if len(c) != len(heads): continue
        cell = dict(zip(heads, c)); drv = cell["Driver"]
        spans = re.findall(r"<span class=\"(max-lg:hidden|max-md:hidden|md:hidden)\">(.*?)</span>", drv)
        sp = {k: html.unescape(v).strip() for k, v in spans}
        img = re.search(r'<img src="([^"]+)"[^>]*style="background-color:(#[0-9a-fA-F]{6})', drv)
        r = dict(pos=_txt(cell["Pos."]), number=_txt(cell["No."]), code=sp.get("md:hidden", ""),
                 driver=f"{sp.get('max-lg:hidden', '')} {sp.get('max-md:hidden', '')}".strip(),
                 team=_txt(cell["Team"]), headshot_url=img.group(1) if img else "",
                 team_colour=img.group(2).upper() if img else "")
        for h in heads[4:]: r[h] = _txt(cell[h])
        rows.append(r)
    return rows, url


def load_file(path):
    if path.lower().endswith(".json"):
        d = json.load(open(path)); return d["rows"] if isinstance(d, dict) else d
    return list(csv.DictReader(open(path, newline="", encoding="utf-8")))


def ms(t):
    """'1:18.128' / '78.128' / '1:02:03.456' -> milliseconds."""
    t = t.strip().rstrip("s")
    if not re.fullmatch(r"[\d:.]+", t or "x"): return None
    p = [float(x) for x in t.split(":")]; v = 0.0
    for x in p: v = v * 60 + x
    return int(round(v * 1000))


def fmt_lap(v):
    m, s = divmod(v, 60000)
    return f"{m}:{s / 1000:06.3f}" if m else f"{s / 1000:.3f}"


def classify(raw, kind):
    """Normalise rows to pos, number, code, driver, team, time, gap, status (+ flag, logo, colour, hs)."""
    out = []
    for r in raw:
        g = lambda *ks: next((str(r[k]).strip() for k in ks if r.get(k) not in (None, "")), "")
        team = g("team", "Team"); tk = TEAM_LOGO.get(team.lower(), g("team_key"))
        e = dict(pos=g("pos", "Pos.", "position"), number=g("number", "No."), code=g("code").upper(),
                 driver=g("driver", "Driver"), team=team, team_key=tk, flag=g("flag").lower(),
                 team_colour=g("team_colour") or TEAM_COLOUR.get(tk, "#888888"), headshot_url=g("headshot_url"),
                 time="", gap="", status="", laps=g("laps", "Laps"))
        if kind == "practice":
            tg = g("time", "Time / Gap", "Time")
            e["time"], e["gap"] = (tg, "") if not tg.startswith("+") else ("", tg)
            if g("gap") and not e["gap"]: e["gap"] = g("gap")
        elif kind == "quali":
            qs = [(k, g(k)) for k in ("Q3", "Q2", "Q1", "SQ3", "SQ2", "SQ1") if g(k)]
            e["time"] = g("time") or (qs[0][1] if qs else ""); e["segment"] = g("segment") or (qs[0][0] if qs else "")
            e["gap"] = g("gap")
        else:
            tr = g("time", "Time / Retired", "Time"); st = g("status")
            if tr and (ms(tr) is not None) and not tr.startswith("+") and not e["pos"] in ("", "1"):
                e["gap"] = "+" + tr if not tr.startswith("+") else tr
            elif tr.startswith("+"): e["gap"] = tr
            elif ms(tr) is not None: e["time"] = tr
            else: e["status"] = tr or st
            e["pts"] = g("pts", "Pts.", "Pts")
        if not e["status"] and not e["time"] and not e["gap"]: e["status"] = g("status") or "No time"
        if not e["code"]:
            e["code"] = norm(e["driver"].split()[-1])[:3].upper()
        out.append(e)
    # practice: lap = P1 time + gap (formula1.com lists gaps after P1); gap re-derived for P1
    lead = next((ms(e["time"]) for e in out if e["time"] and ms(e["time"])), None)
    for e in out:
        if kind == "practice" and lead is not None:
            if e["gap"] and not e["time"]:
                gv = ms(e["gap"].lstrip("+"))
                if gv is not None: e["time"] = fmt_lap(lead + gv)
            elif e["time"] and not e["gap"] and ms(e["time"]) != lead:
                e["gap"] = f"+{(ms(e['time']) - lead) / 1000:.3f}s"
        if kind == "quali" and lead is not None and e["time"] and not e["gap"] and ms(e["time"]) and ms(e["time"]) != lead:
            e["gap"] = f"+{(ms(e['time']) - lead) / 1000:.3f}s"
        if e["gap"] and re.fullmatch(r"\+[\d.]+", e["gap"]): e["gap"] += "s"
    return out


def fetch_tyres(season, ev, s, rows, kind):
    """Compound of each driver's shown lap from OpenF1 (no login): {car number: 'SOFT'|...}.
    Practice/quali: the lap whose time equals the card's time; race/sprint: the driver's fastest lap.
    That lap is mapped to its stint's compound. Anything not found is left out, never guessed."""
    if not ev.get("date"): raise RuntimeError("no race date to find the OpenF1 session")
    names = OF1_SESSION[s]; rd = time.strptime(ev["date"], "%Y-%m-%d"); rd = time.mktime(rd)
    ss = [x for x in _get(f"{OPENF1}/sessions?year={season}", True)
          if x.get("session_name") in names and not x.get("is_cancelled")
          and -5 * 86400 <= time.mktime(time.strptime(x["date_start"][:10], "%Y-%m-%d")) - rd <= 86400]
    if len(ss) != 1: raise RuntimeError(f"OpenF1 has {len(ss)} '{names[0]}' sessions near {ev['date']}")
    sk = ss[0]["session_key"]
    laps = _get(f"{OPENF1}/laps?session_key={sk}", True); stints = _get(f"{OPENF1}/stints?session_key={sk}", True)
    if not laps or not stints: raise RuntimeError(f"OpenF1 has no laps/stints yet for session {sk}")
    out = {}
    for e in rows:
        dl = [l for l in laps if str(l.get("driver_number")) == e["number"] and l.get("lap_duration")]
        if not dl: continue
        if kind == "race": lap = min(dl, key=lambda l: l["lap_duration"])
        else:
            want = ms(e["time"]) if e["time"] else None
            hit = [l for l in dl if want is not None and abs(round(l["lap_duration"] * 1000) - want) <= 1]
            if not hit: continue
            lap = hit[0]
        n = lap["lap_number"]
        c = {x.get("compound") for x in stints if str(x.get("driver_number")) == e["number"]
             and (x.get("lap_start") or 0) <= n <= (x.get("lap_end") or 10 ** 6)}
        if len(c) == 1 and (cc := c.pop()) in TYRE: out[e["number"]] = cc
    return out


def tyre_badge(comp, D, ss=4):
    """Round tyre badge: coloured ring on dark fill, coloured letter, D px wide."""
    letter, col = TYRE[comp]; R = D * ss
    im = Image.new("RGBA", (R, R)); dr = ImageDraw.Draw(im)
    dr.ellipse((0, 0, R - 1, R - 1), fill=col + (255,))
    t = int(R * 0.12); dr.ellipse((t, t, R - 1 - t, R - 1 - t), fill=(22, 22, 26, 255))
    dr.text((R / 2, R / 2 + R * 0.02), letter, font=F(BLK, R * 0.64), fill=col + (255,), anchor="mm")
    return im.resize((D, D), Image.LANCZOS)


# ---------------------------------------------------------------- assets
def ensure_flag(cc):
    p = T.FL + cc + ".png"
    if not os.path.exists(p):
        b = _get(f"https://flagcdn.com/w320/{cc}.png"); open(p, "wb").write(b)
        with open(T.FL + "SOURCES_ADDED.txt", "a") as f: f.write(f"{cc}.png flagcdn.com/w320/{cc}.png (added {time.strftime('%Y-%m-%d')})\n")
    return cc


def headshot(e):
    """The formula1.com 2026 portrait for that driver in that team (from the results row), cached
    under HS_CACHE; else the local portrait T.HS/<code>.webp. Returns a path or None."""
    p = T.HS + e["code"] + ".webp"
    u = e.get("headshot_url") or ""
    if not u: return p if os.path.exists(p) else None
    u = re.sub(r"/d_common:[^/]+/", "/", u)              # drop the silhouette fallback
    os.makedirs(HS_CACHE, exist_ok=True)
    c = HS_CACHE + e["code"] + "_" + norm(e["team"]) + ".webp"
    if not os.path.exists(c):
        best = None
        for w in ("w_720", "w_440", "w_256"):
            try:
                b = _get(re.sub(r"c_lfill,w_\d+", "c_lfill," + w, u)); im = Image.open(__import__("io").BytesIO(b))
                if best is None or im.width > best[0]: best = (im.width, b)
            except Exception: pass
        if not best: return p if os.path.exists(p) else None
        open(c, "wb").write(best[1])
    return c


def ring_avatar(path, d, ring, ss=4):
    """Circle headshot in a team colour ring, drawn at ss x then downsampled (smooth edges)."""
    D = d * ss; rw = max(2, int(D * 0.06))
    h = Image.open(path).convert("RGBA"); w = h.width
    if h.height / w > 1.3:                                 # full length 2026 portrait: crop head + shoulders
        a = np.array(h)[..., 3]; top = int(np.argmax(a.max(1) > 20)); t = max(0, top - int(w * .04))
        box = (int(w * .12), t, int(w * .88), t + int(w * .76))
    else:                                                  # square formula1.com thumb: already framed
        box = (int(w * .08), 0, int(w * .92), int(w * .84))
    inner = D - 2 * rw
    face = h.crop(box).resize((inner, inner), Image.LANCZOS)
    out = Image.new("RGBA", (D, D)); dr = ImageDraw.Draw(out); dr.ellipse((0, 0, D - 1, D - 1), fill=ring + (255,))
    m = Image.new("L", (inner, inner)); ImageDraw.Draw(m).ellipse((0, 0, inner - 1, inner - 1), fill=255)
    c = Image.new("RGBA", (inner, inner), (34, 36, 46, 255)); c.alpha_composite(face); out.paste(c, (rw, rw), m)
    return out.resize((d, d), Image.LANCZOS)


def team_logo(tk, h):
    p = LOGOS + (tk or "") + ".png"
    return T.small_logo(p, h) if tk and os.path.exists(p) else None


# ---------------------------------------------------------------- text
def ordinal(n): return f"{n}{'th' if 11 <= n % 100 <= 13 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"


def surname(e): return e["driver"].split()[-1] if e["driver"] else e["code"]


def auto_stat(rows, kind):
    p1 = rows[0]; p2 = rows[1] if len(rows) > 1 else None
    gap = p2["gap"].lstrip("+") if p2 and p2.get("gap") else ""
    if kind == "practice": return f"{surname(p1)} tops it by {gap}" if gap else f"{surname(p1)} tops it"
    if kind == "quali": return f"{surname(p1)} on pole by {gap}" if gap else f"{surname(p1)} on pole"
    return f"{surname(p1)} wins by {gap}" if gap and re.match(r"[\d.]+s$", gap) else f"{surname(p1)} wins"


def right_text(e, kind):
    """(big value, small line) for the right side of a row."""
    if kind == "practice" or kind == "quali":
        if not e["time"]: return (e["status"] or "No time", "")
        small = e["gap"] if e["gap"] else ("FASTEST" if kind == "practice" else "POLE")
        if kind == "quali" and e.get("segment") and e["segment"] not in ("Q3", "SQ3"):
            small = f"{e['segment']} TIME"          # knocked out (or no final segment time): no cross segment gap
        return (e["time"], small)
    if e["time"]: return (e["time"], "WINNER" if e["pos"] == "1" else "")
    if e["gap"]: return (e["gap"], "")
    return (e["status"] or "DNF", "")


# ---------------------------------------------------------------- drawing
def fit(d, s, path, size, maxw, minsize=8):
    while size > minsize and d.textlength(s, font=F(path, size)) > maxw: size -= 1
    return F(path, size)


def draw_row(img, d, e, kind, x, y, w, h, S, first):
    tc = rgb(e["team_colour"])
    card = Image.new("RGBA", (int(w), int(h))); cd = ImageDraw.Draw(card)
    cd.rounded_rectangle((0, 0, card.width - 1, card.height - 1), radius=S(14),
                         fill=(231, 176, 8, 30) if first else (255, 255, 255, 15),
                         outline=GOLD + (255,) if first else (255, 255, 255, 38), width=max(1, S(2)))
    cd.rounded_rectangle((0, S(8), S(6), card.height - S(8)), radius=S(3), fill=tc + (255,))
    img.alpha_composite(card, (int(x), int(y)))
    cy = y + h / 2
    # position
    pf = F(BLK, min(h * 0.50, S(46))); pw = d.textlength("22", font=pf)
    d.text((x + S(16) + pw / 2, cy), e["pos"] or "NC", font=pf, fill=GOLD if first else INK, anchor="mm")
    cx = x + S(16) + pw + S(10)
    # headshot
    ad = int(min(h - S(12), w * 0.17)); hp = headshot(e)
    if not hp: sys.exit(f"no headshot for {e['code']} {e['driver']}")
    img.alpha_composite(ring_avatar(hp, ad, tc), (int(cx), int(cy - ad / 2))); cx += ad + S(12)
    # right: time + gap
    big, small = right_text(e, kind)
    bf = F(XB, min(h * (0.40 if small else 0.44), w * 0.066)); sf = F(SEMI, min(h * 0.27, w * 0.045))
    rx = x + w - S(14)
    if small:
        d.text((rx, cy - h * 0.06), big, font=bf, fill=PURPLE if first else INK, anchor="rs")
        d.text((rx, cy + h * 0.06), small, font=sf, fill=SEC, anchor="rt")
    else:
        d.text((rx, cy), big, font=bf, fill=PURPLE if first else INK, anchor="rm")
    tw_ = max(d.textlength(big, font=bf), d.textlength(small, font=sf) if small else 0)
    if e.get("tyre") in TYRE:                         # tyre badge left of the time block
        bd = int(min(h * 0.42, w * 0.07)); bx = rx - tw_ - S(10) - bd
        img.alpha_composite(tyre_badge(e["tyre"], bd), (int(bx), int(cy - bd / 2))); tw_ += bd + S(10)
    room = rx - tw_ - S(14) - cx
    # line 1: flag + name; line 2: number + team logo + team
    ns = min(h * 0.36, w * 0.060); fl = T.flag(ensure_flag(e["flag"]), int(ns * 0.62))
    img.alpha_composite(fl, (int(cx), int(cy - h * 0.20 - fl.height / 2)))
    nx = cx + fl.width + S(8)
    nf = fit(d, e["driver"], BLD, ns, room - fl.width - S(8))
    d.text((nx, cy - h * 0.20), e["driver"], font=nf, fill=INK, anchor="lm")
    ly = cy + h * 0.21; lf = F(BLD, min(h * 0.26, w * 0.043))
    num = e["number"]; d.text((cx, ly), num, font=lf, fill=tc if sum(tc) > 160 else SEC, anchor="lm")
    lx = cx + d.textlength(num, font=lf) + S(10)
    lg = team_logo(e["team_key"], int(min(h * 0.24, w * 0.040)))
    if lg is None: sys.exit(f"no team logo for {e['team']!r} in {LOGOS}")
    img.alpha_composite(lg, (int(lx), int(ly - lg.height / 2))); lx += lg.width + S(8)
    tn = TEAM_SHORT.get(e["team_key"], e["team"].upper())
    tf = fit(d, tn, MED, min(h * 0.24, w * 0.040), max(S(10), cx + room - lx))
    if cx + room - lx > S(40): d.text((lx, ly), tn, font=tf, fill=SEC, anchor="lm")


def render(ev, rows, kind, label, stat, W, H, path):
    SS = 2; k = W / 1080 * SS; S = lambda v: int(v * k)
    img = make_background(W * SS, H * SS, watermark=None).convert("RGBA"); d = ImageDraw.Draw(img, "RGBA")
    M = S(48); top = S(70)
    T.brand(img, W * SS - M, top, S(54))
    fl = T.flag(ensure_flag(ev["flag"]), S(34)); img.alpha_composite(fl, (M, int(top - fl.height / 2)))
    cf = fit(d, ev["circuit"].upper(), BLD, S(34), W * SS * 0.55 - fl.width)
    d.text((M + fl.width + S(14), top), ev["circuit"].upper(), font=cf, fill=RED, anchor="lm")
    title = f"{ev['gp']} {label}"
    ts = S(112) if H / W > 1.3 else S(104)
    tf = fit(d, title, XB, ts, W * SS - 2 * M)
    ty = top + S(44); d.text((M - S(2), ty), title, font=tf, fill=INK, anchor="lt")
    tb = d.textbbox((M, ty), title, font=tf, anchor="lt")
    sy = tb[3] + S(14); sf = fit(d, stat, BLD, S(50), W * SS - 2 * M)
    d.text((M, sy), stat, font=sf, fill=GOLD, anchor="lt")
    y0 = d.textbbox((M, sy), stat, font=sf, anchor="lt")[3] + S(30)
    n = len(rows); cols = 1 if n <= 12 else 2; per = -(-n // cols)
    gx = S(14); gy = S(9 if cols == 2 else 12)
    cw = (W * SS - 2 * M + S(16) - gx * (cols - 1)) / cols; x0 = M - S(8)
    rh = (H * SS - S(40) - y0 - gy * (per - 1)) / per
    rh = min(rh, S(120))
    for i, e in enumerate(rows):
        c, r = divmod(i, per)
        draw_row(img, d, e, kind, x0 + c * (cw + gx), y0 + r * (rh + gy), cw, rh, S, i == 0)
    img.convert("RGB").resize((W, H), Image.LANCZOS).save(path, optimize=True)
    return path


def free(path):
    if not os.path.exists(path): return path
    b, e = os.path.splitext(path); i = 2
    while os.path.exists(f"{b}_{i}{e}"): i += 1
    return f"{b}_{i}{e}"


FIELDS = ["pos", "number", "code", "driver", "team", "flag", "time", "gap", "segment", "status", "laps", "pts",
          "team_colour", "headshot_url", "tyre"]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--season", type=int, required=True)
    ap.add_argument("--race", required=True, help="formula1.com results slug, e.g. mexico, united-states")
    ap.add_argument("--session", required=True, help="fp1 fp2 fp3 sprint_quali sprint quali race")
    ap.add_argument("--round", type=int, help="schedule round (when the slug does not match)")
    ap.add_argument("--data", help="CSV or JSON results instead of formula1.com")
    ap.add_argument("--stat", help="override the stat line"); ap.add_argument("--title", help="override GP name, e.g. 'Mexico City GP'")
    ap.add_argument("--circuit"); ap.add_argument("--flag", help="race country flag code, e.g. mx")
    ap.add_argument("--flags", default="", help="extra driver flags, e.g. VES=dk,TSO=bg")
    ap.add_argument("--no-tyres", action="store_true", help="skip the OpenF1 tyre compound badges")
    ap.add_argument("--sizes", default="x,ig,threads"); ap.add_argument("--out", default="."); ap.add_argument("--slug")
    a = ap.parse_args()
    t0 = time.time()
    s = SESSION_ALIASES.get(a.session.lower(), a.session.lower())
    if s not in SESSIONS: sys.exit(f"unknown session {a.session!r}")
    path_, label, kind = SESSIONS[s]
    if a.title and a.circuit and a.flag: ev = dict(gp=a.title, circuit=a.circuit, flag=a.flag)
    else:
        ev = event_info(a.season, a.race, a.round)
        ev.update({k: v for k, v in (("gp", a.title), ("circuit", a.circuit), ("flag", a.flag)) if v})
    if a.data: raw, src = load_file(a.data), a.data
    else: raw, src = fetch_f1(a.season, a.race, s)
    if not raw: sys.exit(f"HOLD: no published classification yet at {src}")
    rows = classify(raw, kind)
    extra = dict(p.split("=") for p in a.flags.split(",") if "=" in p)
    for e in rows:
        e["flag"] = (extra.get(e["code"]) or e["flag"] or NATION.get(e["code"], "")).lower()
        if not e["flag"]: sys.exit(f"no nationality for {e['code']} {e['driver']}: pass --flags {e['code']}=cc")
        if not e["team_key"]: sys.exit(f"unknown team {e['team']!r} for {e['code']}")
    if not a.no_tyres:
        try:
            ty = fetch_tyres(a.season, ev, s, rows, kind)
            for e in rows: e["tyre"] = ty.get(e["number"], "")
            miss = [e["code"] for e in rows if not e["tyre"]]
            print(f"tyres {len(ty)}/{len(rows)} from OpenF1" + (f"; no badge for {', '.join(miss)}" if miss else ""), file=sys.stderr)
        except Exception as x:
            print(f"WARNING: tyre compounds unavailable ({x}); rendering without tyre badges", file=sys.stderr)
    stat = a.stat or auto_stat(rows, kind)
    for t in [stat, ev["gp"], ev["circuit"], label] + [e["driver"] for e in rows]:
        if BANNED.search(t): sys.exit(f"banned character or URL in text: {t!r}")
    slug = a.slug or f"{a.race}_{a.season}_{s}_results"
    os.makedirs(a.out, exist_ok=True)
    dp = free(os.path.join(a.out, f"{slug}_data.csv"))
    with open(dp, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, extrasaction="ignore"); w.writeheader(); w.writerows(rows)
    print(dp)
    for k_, (W, H) in SIZES.items():
        if k_ in a.sizes.split(","): print(render(ev, rows, kind, label, stat, W, H, free(os.path.join(a.out, f"{slug}_{k_}.png"))))
    print(f"source {src}\nstat {stat}\n{len(rows)} rows in {time.time() - t0:.1f}s", file=sys.stderr)


if __name__ == "__main__":
    main()
