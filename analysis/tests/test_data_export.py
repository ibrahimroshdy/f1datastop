import datetime as dt
import unittest
from unittest import mock

from _helpers import ANALYSIS  # noqa: F401

import data_export as de


def race(rnd, date, **sessions):
    return {"round": str(rnd), "date": date, **sessions}


class SprintMarker(unittest.TestCase):
    def test_past_round_gets_absent_marker(self):
        self.assertEqual(de._should_skip("sprint", None, race_passed=True), ("absent", {"absent": True}))
        self.assertEqual(de._should_skip("sprint", {"SprintResults": []}, race_passed=True),
                         ("absent", {"absent": True}))

    def test_future_round_never_gets_marker(self):
        self.assertEqual(de._should_skip("sprint", None, race_passed=False), ("skip", None))
        self.assertEqual(de._should_skip("sprint", [], race_passed=False), ("skip", None))
        self.assertEqual(de._should_skip("sprint", {"SprintResults": []}, race_passed=False),
                         ("skip", None))

    def test_real_sprint_published_regardless(self):
        payload = {"SprintResults": [{"position": "1"}]}
        self.assertEqual(de._should_skip("sprint", payload, race_passed=False)[0], "put")

    def test_export_season_marks_only_past_rounds(self):
        sched = [race(1, "2026-03-01"), race(2, "2026-12-01")]
        puts = []

        def fake_rpc(fn, args):
            if fn == "get_schedule":
                return sched
            if fn == "get_sprint":
                return None
            return None

        with mock.patch.object(de, "rpc", side_effect=fake_rpc), \
                mock.patch.object(de, "_today", return_value=dt.date(2026, 6, 1)), \
                mock.patch.object(de, "_put", side_effect=lambda p, b: puts.append((p, b)) or 1):
            ok = de.export_season(2026, {"sprint"})
        self.assertTrue(ok)
        self.assertEqual(puts, [("2026/1/sprint.json", {"absent": True})])


class SanityCheck(unittest.TestCase):
    def test_weekend_sprint_ok(self):
        sched = [race(5, "2026-05-03", Sprint={"date": "2026-05-02"},
                      SprintQualifying={"date": "2026-05-01"})]
        self.assertEqual(de.check_schedule_weekends(sched), [])

    def test_miami_dates_on_round_6_flagged(self):
        sched = [race(6, "2026-05-24", Sprint={"date": "2026-05-02"},
                      SprintQualifying={"date": "2026-05-01"})]
        problems = de.check_schedule_weekends(sched)
        self.assertEqual(len(problems), 2)
        self.assertIn("round 6", problems[0])

    def test_violation_blocks_schedule_publish_and_returns_false(self):
        sched = [race(6, "2026-05-24", Sprint={"date": "2026-05-02"})]
        puts = []
        with mock.patch.object(de, "rpc", return_value=sched), \
                mock.patch.object(de, "_put", side_effect=lambda p, b: puts.append(p) or 1):
            ok = de.export_season(2026, {"schedule"})
        self.assertFalse(ok)
        self.assertEqual(puts, [])

    def test_clean_schedule_published(self):
        sched = [race(1, "2026-03-08")]
        puts = []
        with mock.patch.object(de, "rpc", return_value=sched), \
                mock.patch.object(de, "_put", side_effect=lambda p, b: puts.append(p) or 1):
            self.assertTrue(de.export_season(2026, {"schedule"}))
        self.assertEqual(puts, ["2026/schedule.json"])


if __name__ == "__main__":
    unittest.main()
