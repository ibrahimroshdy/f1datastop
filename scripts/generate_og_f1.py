#!/usr/bin/env python3
"""Single-source OG/social-preview renderer for F1 DataStop (1200x630).

Replaces generate_og.py / generate_og_v2.py (deleted). Those scripts passed
4-tuple RGBA fills (e.g. ``(255, 255, 255, 6)`` for the diagonal wash) to an
``ImageDraw`` on an ``RGB`` image, which raises / paints incorrectly.

Method: SVG-first render. This script composes the OG as an SVG (deep-carbon
field, the verbatim root ``logo.svg`` artwork inlined untouched, bold
wordmark + mono subline + flat-square pills + single red rule), rasterizes it
with ``rsvg-convert -w 1200 -h 630``, saves once to root ``og-image.png``,
then byte-copies to ``web/public/og-image.png`` (identical SHA256).

Palette (from frozen web/src/index.css):
  deep carbon field  hsl(240 8% 3.5%)  -> #0a0a0d..#111116 gradient
  single red accent  hsl(0 100% 44%)    -> #E00000
  text near-white #FAFAFA, muted #A1A1AF, chip hairline #5A5A68

Fonts degrade gracefully (rsvg uses system fonts only): Clash Display /
Geist Mono first, then Helvetica Neue / Menlo (present on macOS), then
Helvetica / Arial / generic sans / monospace.
"""
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

W, H = 1200, 630

ROOT = Path(__file__).resolve().parent.parent
LOGO = ROOT / "logo.svg"
OUT_ROOT = ROOT / "og-image.png"
OUT_PUBLIC = ROOT / "web" / "public" / "og-image.png"

SANS = "'Clash Display','Helvetica Neue',Helvetica,Arial,sans-serif"
MONO = "'Geist Mono',Menlo,'Andale Mono',monospace"


def logo_inner():
    """Inner markup of root logo.svg, pasted verbatim (ids untouched: this
    is the only instance in the OG document, so no suffixing needed)."""
    text = LOGO.read_text()
    inner = re.sub(r"^.*?<svg[^>]*>", "", text, count=1, flags=re.S)
    inner = re.sub(r"</svg>\s*$", "", inner, flags=re.S)
    for token in ("M40 60C40 60 65 50 80 50", "M50 63L55 97", "#FF2A12"):
        if token not in inner:
            raise ValueError(f"logo.svg artwork changed? missing {token!r}")
    return inner


def compose_svg():
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
  <defs>
    <linearGradient id="ogBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0a0a0d"/>
      <stop offset="1" stop-color="#111116"/>
    </linearGradient>
  </defs>
  <rect width="{W}" height="{H}" fill="url(#ogBg)"/>
  <svg x="90" y="187" width="256" height="256" viewBox="0 0 160 160">
{logo_inner()}  </svg>
  <text x="408" y="252" font-family="{SANS}" font-weight="800" font-size="102" letter-spacing="-2" fill="#FAFAFA">F1 DataStop</text>
  <text x="410" y="322" font-family="{MONO}" font-size="29" fill="#A1A1AF">Timing, telemetry, charts &amp; standings.</text>
  <g font-family="{MONO}" font-weight="700" font-size="26" fill="#ffffff" text-anchor="middle">
    <rect x="408" y="356" width="134" height="58" fill="#E00000"/>
    <text x="475" y="394">TIMING</text>
    <rect x="558" y="356" width="180" height="58" fill="none" stroke="#5A5A68" stroke-width="2"/>
    <text x="648" y="394">TELEMETRY</text>
    <rect x="754" y="356" width="134" height="58" fill="none" stroke="#5A5A68" stroke-width="2"/>
    <text x="821" y="394">CHARTS</text>
    <rect x="904" y="356" width="180" height="58" fill="none" stroke="#5A5A68" stroke-width="2"/>
    <text x="994" y="394">STANDINGS</text>
  </g>
  <rect x="408" y="478" width="676" height="8" fill="#E00000"/>
  <text x="410" y="540" font-family="{MONO}" font-size="26" fill="#A1A1AF">f1datastop.com</text>
</svg>
"""


def main():
    if shutil.which("rsvg-convert") is None:
        raise SystemExit("ERROR: rsvg-convert not found on PATH; cannot render OG.")
    with tempfile.NamedTemporaryFile(
        suffix=".svg", delete=False, prefix="og-f1-"
    ) as tmp:
        tmp.write(compose_svg().encode("utf-8"))
        tmp_svg = tmp.name
    try:
        subprocess.run(
            ["rsvg-convert", "-w", str(W), "-h", str(H),
             "-o", str(OUT_ROOT), tmp_svg],
            check=True,
        )
    finally:
        Path(tmp_svg).unlink(missing_ok=True)
    OUT_PUBLIC.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(OUT_ROOT, OUT_PUBLIC)
    print(f"wrote {OUT_ROOT} and {OUT_PUBLIC} ({W}x{H} via rsvg-convert)")


if __name__ == "__main__":
    main()
