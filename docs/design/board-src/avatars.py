"""Driver avatars for the board: the same F1 headshots the app shows.

URLs are built exactly as web/src/constants/f1DriverPortraitMedia.ts builds them
(buildF1DriverHeadshotUrl), read from that file at build time. The board is a single
file that cannot load outside images, so each headshot is fetched, shrunk to 96 px and
embedded. Nothing is stored in the repo; a failed fetch falls back to initials.
"""
import base64
import io
import pathlib
import re
import urllib.request

TS = pathlib.Path(__file__).parents[3] / "web/src/constants/f1DriverPortraitMedia.ts"
_cache = {}


def _consts():
    src = TS.read_text()
    get = lambda name: re.search(rf'export const {name} = "([^"]+)"', src).group(1)
    paths = dict(re.findall(r'^\s+(\w+): "([^"]+\.webp)"', src, re.M))
    return get("F1_MEDIA_UPLOAD_BASE"), get("F1_DRIVER_HEADSHOT_TRANSFORMS"), get("F1_DRIVER_PORTRAIT_VERSION"), paths


def data_uri(driver_id):
    if driver_id in _cache:
        return _cache[driver_id]
    uri = None
    try:
        from PIL import Image
        base, tr, ver, paths = _consts()
        url = f"{base}/{tr}/{ver}/common/f1/{paths[driver_id]}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        img = Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=20).read())).convert("RGBA")
        img = img.resize((96, 96), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, "WEBP", quality=80)
        uri = "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()
    except Exception as e:  # noqa: BLE001 - the board still builds, with initials
        print(f"avatar {driver_id}: {e}")
    _cache[driver_id] = uri
    return uri


def avatar(driver_id, name, colour, size=40):
    """A round headshot on the raised surface, ringed in the team colour."""
    uri = data_uri(driver_id)
    inner = (f'<img src="{uri}" alt="" width="{size}" height="{size}">' if uri else
             f'<span class="av-i">{"".join(w[0] for w in name.split()[-2:])}</span>')
    return f'<span class="av" style="--ring:{colour};width:{size}px;height:{size}px">{inner}</span>'


LOGO_TS = pathlib.Path(__file__).parents[3] / "web/src/constants/f1TeamLogoMedia.ts"
_lcache = {}


def logo_uri(team_id):
    """The official white team wordmark, built as buildF1TeamLogoUrl builds it, embedded at 48 px high."""
    key = team_id.lower().replace("_", "")
    if key in _lcache:
        return _lcache[key]
    uri = None
    try:
        from PIL import Image
        base, _, ver, _ = _consts()
        src = LOGO_TS.read_text()
        tr = re.search(r'export const F1_TEAM_LOGO_TRANSFORMS = "([^"]+)"', src).group(1)
        path = dict(re.findall(r'^\s+(\w+): "([^"]+\.webp)"', src, re.M))[key]
        url = f"{base}/{tr}/{ver}/common/f1/{path}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        img = Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=20).read())).convert("RGBA")
        img = img.crop(img.getbbox())
        img = img.resize((max(1, round(img.width * 48 / img.height)), 48), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, "WEBP", quality=85)
        uri = "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()
    except Exception as e:  # noqa: BLE001
        print(f"logo {team_id}: {e}")
    _lcache[key] = uri
    return uri


def team_logo(team_id, name, h=16, tail=""):
    """The team's emblem (white, inverted on light themes by CSS) beside its name: a team is never
    shown without its logo, and the emblem alone does not name it (D33)."""
    uri = logo_uri(team_id)
    img = f'<img class="tlogo" src="{uri}" alt="" style="height:{h}px">' if uri else ""
    return f'<span class="team-n">{img}<span>{name}{tail}</span></span>'
