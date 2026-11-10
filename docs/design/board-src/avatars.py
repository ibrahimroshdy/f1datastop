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
