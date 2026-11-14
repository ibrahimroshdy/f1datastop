"""Race rows read back from a saved results CSV keep their gap (the gap has its own column)."""
import os
import sys
import unittest

from _helpers import ANALYSIS  # noqa: F401

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "social", "session_results"))
import session_results as sr  # noqa: E402


def row(**kw):
    base = dict(pos="", number="", code="", driver="", team="", flag="", time="", gap="", segment="", status="", laps="", pts="")
    base.update(kw)
    return base


class RaceGapColumn(unittest.TestCase):
    def test_saved_csv_gap_is_kept(self):
        out = sr.classify([
            row(pos="1", code="VER", driver="Max Verstappen", time="2:20:28.772", laps="71"),
            row(pos="2", code="HAM", driver="Lewis Hamilton", gap="+0.799s", laps="71"),
            row(pos="NC", code="STR", driver="Lance Stroll", status="DNF", laps="5"),
        ], "race")
        self.assertEqual(out[0]["time"], "2:20:28.772")
        self.assertEqual(out[1]["gap"], "+0.799s")
        self.assertEqual(out[1]["status"], "")
        self.assertEqual(out[2]["status"], "DNF")

    def test_formula1_time_column_still_works(self):
        out = sr.classify([row(pos="2", code="HAM", driver="Lewis Hamilton", time="+0.799s")], "race")
        self.assertEqual(out[0]["gap"], "+0.799s")


if __name__ == "__main__":
    unittest.main()
