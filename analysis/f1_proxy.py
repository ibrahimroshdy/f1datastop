"""Route FastF1's livetiming fetches through a proxy when F1_LIVETIMING_PROXY is set.

Why this exists
---------------
F1 fronts ``livetiming.formula1.com`` with CloudFront, which returns **403** to Azure IP
ranges — i.e. every GitHub-hosted runner. Verified: identical URL returns 200 from a
laptop and from AWS egress, 403 from two different Azure runners, across four
User-Agents and six retries over five minutes. It is an IP-range rule, not a
User-Agent or rate-limit issue, and FastF1's built-in mirror
(``livetiming-mirror.fastf1.dev``) 404s on every page, so it is not a usable fallback.

FastF1 fetches *all* session data (timing, car, position, track status, weather, race
control) through a single module-level ``base_url`` in ``fastf1/_api.py``, so repointing
that one value at an allow-listed proxy is enough to unblock every stream.

Behaviour
---------
No-op unless ``F1_LIVETIMING_PROXY`` is set, so local runs keep hitting the origin
directly (your own IP isn't blocked). Import this module before loading any session::

    import f1_proxy  # noqa: F401

The proxy URL embeds an auth token as its final path segment, because FastF1 appends its
own path to ``base_url`` and offers no hook for custom headers. Keep it in a secret.
"""

import os

_ENV = "F1_LIVETIMING_PROXY"


def install() -> bool:
    """Point FastF1's livetiming base_url at the proxy. Returns True if applied."""
    url = os.environ.get(_ENV, "").strip().rstrip("/")
    if not url:
        return False

    import fastf1._api as _api

    if getattr(_api, "_f1datastop_proxied", False):
        return True

    _api.base_url = url
    _api._f1datastop_proxied = True
    # Log the host only — the token lives in the path and must not reach CI logs.
    host = url.split("//", 1)[-1].split("/", 1)[0]
    print(f"[f1_proxy] livetiming routed via {host}")
    return True


install()
