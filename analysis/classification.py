"""Race classification from Jolpica/Ergast positionText (FastF1: ClassifiedPosition).

BUG-005: status text is not a classification. "Lapped" can be not classified (2026 R1 STR,
+15 laps, NC) and "Retired" can be classified (2026 R17 ALB, P18). positionText is the
authority:
  numeric -> classified            "R" -> retired, not classified
  "N"     -> not classified        "W" / status "Did not start" -> DNS (neither a start nor a DNF)
  "D"     -> disqualified          "E" -> excluded          "F" -> failed to qualify
Stdlib only, shared by backfill.py, ingest.py and generate.py."""
import re

_LAP_STATUS = re.compile(r"^\+\d+\s+Laps?$")
_CODES = {"R": "retired", "N": "nc", "W": "dns", "D": "dsq", "E": "excluded", "F": "dnq"}
# Short labels for charts.
LABEL = {"retired": "DNF", "nc": "NC", "dns": "DNS", "dsq": "DSQ", "excluded": "EXC", "dnq": "DNQ"}


def _text(v):
    if v is None:
        return ""
    s = str(v).strip()
    return "" if s.lower() in ("nan", "none") else s


def classify(position_text, status=None):
    """'classified' | 'retired' | 'nc' | 'dns' | 'dsq' | 'excluded' | 'dnq', or None when
    positionText is missing (callers fall back to their old status rule)."""
    st = _text(status)
    if st.lower() == "did not start":
        return "dns"
    pt = _text(position_text).upper()
    if not pt:
        return None
    if pt.isdigit() or re.fullmatch(r"\d+(\.0+)?", pt):
        return "classified"
    return _CODES.get(pt, "nc")


def is_classified(position_text, status=None):
    return classify(position_text, status) == "classified"


def is_start(position_text, status=None):
    """A DNS/DNQ is not a race start."""
    return classify(position_text, status) not in ("dns", "dnq")


def is_dnf(position_text, status=None):
    """True for a start that wasn't classified (retired, NC, DSQ, excluded); False for a
    classified finisher and for a DNS/DNQ (not a start). With no positionText, falls back to
    the old status rule; None when there is nothing to go on."""
    c = classify(position_text, status)
    if c is not None:
        return c in ("retired", "nc", "dsq", "excluded")
    st = _text(status)
    if not st:
        return None
    return not (st == "Finished" or st == "Lapped" or bool(_LAP_STATUS.match(st)))
