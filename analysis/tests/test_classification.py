"""BUG-005: classification comes from positionText, not status. Cases from the 2026
formula1.com cross-check (season_review/for_case.md)."""
import unittest

from _helpers import ANALYSIS  # noqa: F401

import classification as c


class Classify(unittest.TestCase):
    def test_lapped_but_not_classified_is_dnf(self):      # 2026 R1 STR, +15 laps, NC
        self.assertEqual(c.classify("N", "Lapped"), "nc")
        self.assertTrue(c.is_dnf("N", "Lapped"))
        self.assertFalse(c.is_classified("N", "Lapped"))

    def test_retired_but_classified_is_a_finish(self):    # 2026 R17 ALB, Retired, P18
        self.assertEqual(c.classify("18", "Retired"), "classified")
        self.assertFalse(c.is_dnf("18", "Retired"))

    def test_retired_not_classified(self):                # 2026 R17 STR/COL/BOR
        self.assertEqual(c.classify("R", "Retired"), "retired")
        self.assertTrue(c.is_dnf("R", "Retired"))

    def test_dns_is_neither_start_nor_dnf(self):          # 2026 R1 PIA / HUL
        for pt, st in (("W", "Did not start"), ("W", None), ("", "Did not start")):
            self.assertEqual(c.classify(pt, st), "dns")
            self.assertFalse(c.is_dnf(pt, st))
            self.assertFalse(c.is_start(pt, st))

    def test_lapped_classified_and_finished(self):
        self.assertFalse(c.is_dnf("11", "Lapped"))
        self.assertFalse(c.is_dnf("1", "Finished"))
        self.assertFalse(c.is_dnf("12.0", "+1 Lap"))     # FastF1 float-ish text

    def test_dsq_counts_as_dnf(self):
        self.assertEqual(c.classify("D", "Disqualified"), "dsq")
        self.assertTrue(c.is_dnf("D", "Disqualified"))

    def test_missing_position_text_falls_back_to_status(self):
        self.assertIsNone(c.classify(None, "Finished"))
        self.assertIsNone(c.classify("nan", "Finished"))
        self.assertFalse(c.is_dnf(None, "+2 Laps"))
        self.assertTrue(c.is_dnf(None, "Accident"))
        self.assertIsNone(c.is_dnf(None, None))


class BackfillUsesPositionText(unittest.TestCase):
    def test_derive_dnf(self):
        try:
            import backfill
        except ImportError as e:  # pragma: no cover
            raise unittest.SkipTest(str(e))
        self.assertTrue(backfill.derive_dnf("Lapped", "N"))
        self.assertFalse(backfill.derive_dnf("Retired", "18"))
        self.assertFalse(backfill.derive_dnf("Did not start", "W"))
        self.assertFalse(backfill.derive_dnf("Finished"))   # old one-arg call still works


class PlacesGainedRows(unittest.TestCase):
    def test_singapore_2026(self):
        try:
            import pandas as pd
            from _helpers import import_generate
            g = import_generate()
        except unittest.SkipTest:
            raise
        res = pd.DataFrame([
            ("HAD", 22.0, 10.0, "10", "Finished"),
            ("ALB", 16.0, 18.0, "18", "Retired"),
            ("STR", 21.0, 20.0, "R", "Retired"),
            ("COL", 15.0, 21.0, "R", "Retired"),
            ("BOR", 14.0, 22.0, "R", "Retired"),
            ("PIA", 0.0, None, "W", "Did not start"),
        ], columns=["Abbreviation", "GridPosition", "Position", "ClassifiedPosition", "Status"])
        rows = g.places_gained_rows(res)
        self.assertEqual(rows[0], ("HAD", 12, None))
        self.assertIn(("ALB", -2, None), rows)              # retired but classified: real delta
        self.assertEqual({r for r in rows if r[1] is None},
                         {("STR", None, "DNF"), ("COL", None, "DNF"), ("BOR", None, "DNF")})
        self.assertNotIn("PIA", [r[0] for r in rows])        # DNS is not a starter
