"""Shared test setup: make analysis/ importable and import generate.py safely."""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ANALYSIS = os.path.dirname(HERE)
if ANALYSIS not in sys.path:
    sys.path.insert(0, ANALYSIS)


def import_generate():
    """generate.py needs the heavy stack (fastf1, matplotlib...). Returns the module, or
    raises unittest.SkipTest when those deps are not installed."""
    import unittest
    try:
        import generate
    except ImportError as e:  # pragma: no cover
        raise unittest.SkipTest(f"generate.py deps not installed: {e}")
    return generate
