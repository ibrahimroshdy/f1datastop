"""index_export key patterns: pure regex checks, no network."""
import unittest
from unittest import mock

import _helpers  # noqa: F401  (puts analysis/ on sys.path)

try:
    import index_export
except ImportError as e:  # pragma: no cover
    raise unittest.SkipTest(f"index_export deps not installed: {e}")


class ReplayKeyTests(unittest.TestCase):
    def parse(self, key):
        m = index_export._REPLAY_KEY.match(key)
        return m.groupdict() if m else None

    def test_underscore_circuit_no_suffix(self):
        m = self.parse("2026/marina_bay.json")
        self.assertEqual(m["season"], "2026")
        self.assertEqual(m["circuit"], "marina_bay")
        self.assertIsNone(m["session"])

    def test_underscore_circuit_with_session(self):
        m = self.parse("2026/marina_bay_FP1.json")
        self.assertEqual((m["circuit"], m["session"]), ("marina_bay", "FP1"))

    def test_multi_underscore_circuit_sprint_quali(self):
        m = self.parse("2026/red_bull_ring_SQ.json")
        self.assertEqual((m["circuit"], m["session"]), ("red_bull_ring", "SQ"))

    def test_multi_underscore_circuit_no_suffix(self):
        m = self.parse("2026/red_bull_ring.json")
        self.assertEqual((m["circuit"], m["session"]), ("red_bull_ring", None))

    def test_old_slug_still_parses(self):
        m = self.parse("2026/melbourne_FP1.json")
        self.assertEqual((m["circuit"], m["session"]), ("melbourne", "FP1"))
        m = self.parse("2025/melbourne.json")
        self.assertEqual((m["circuit"], m["session"]), ("melbourne", None))

    def test_rejects_nested_or_non_json(self):
        self.assertIsNone(self.parse("2026/a/b.json"))
        self.assertIsNone(self.parse("2026/marina_bay.png"))


class OtherKeyTests(unittest.TestCase):
    def test_circuit_key_allows_underscores(self):
        m = index_export._CIRCUIT_KEY.match("2026/yas_marina.json")
        self.assertEqual(m["circuit"], "yas_marina")

    def test_chart_key_slug_allows_underscores(self):
        m = index_export._CHART_KEY.match(
            "2026/17-marina_bay/R/landscape/race_analysis.png")
        self.assertEqual((m["round"], m["slug"], m["session"]), ("17", "marina_bay", "R"))

    def test_telemetry_key(self):
        m = index_export._TELEMETRY_KEY.match("2026/17/R/VER_12.json")
        self.assertEqual((m["session"], m["code"], m["lap"]), ("R", "VER", "12"))


def _row(path, cid, rnd, session="R", season=2026, chart_type=None, theme="dark"):
    return {"season": season, "round": rnd, "session": session, "circuit_id": cid,
            "chart_type": chart_type, "theme": theme, "storage_path": path}


SCHEDULE = [{"round": "5", "Circuit": {"circuitId": "villeneuve"}},
            {"round": "6", "Circuit": {"circuitId": "monaco"}}]


class DedupeTests(unittest.TestCase):
    def dedupe(self, rows, kind="replays", schedule=SCHEDULE):
        def fake(path):
            if schedule is None:
                raise OSError("down")
            return schedule
        with mock.patch.object(index_export.cdn_schedule, "fetch_json", side_effect=fake), \
                mock.patch("builtins.print") as pr:
            out = index_export._dedupe_rows(rows, index_export._DEDUPE_KEYS[kind], 2026)
        return out, [" ".join(map(str, c.args)) for c in pr.call_args_list]

    def test_schedule_match_kept_per_session(self):
        rows = [_row("2026/montreal.json", "montreal", 5), _row("2026/villeneuve.json", "villeneuve", 5),
                _row("2026/montreal_Q.json", "montreal", 5, "Q"),
                _row("2026/villeneuve_Q.json", "villeneuve", 5, "Q")]
        out, logs = self.dedupe(rows)
        self.assertEqual([r["storage_path"] for r in out], ["2026/villeneuve.json", "2026/villeneuve_Q.json"])
        self.assertEqual(logs, [])

    def test_schedule_unavailable_keeps_first_and_warns(self):
        rows = [_row("2026/montreal.json", "montreal", 5), _row("2026/villeneuve.json", "villeneuve", 5)]
        out, logs = self.dedupe(rows, schedule=None)
        self.assertEqual([r["storage_path"] for r in out], ["2026/montreal.json"])
        warn = [m for m in logs if "round 5" in m]
        self.assertEqual(len(warn), 1)
        self.assertIn("2026/montreal.json", warn[0])
        self.assertIn("2026/villeneuve.json", warn[0])

    def test_no_match_in_schedule_warns(self):
        rows = [_row("2026/a.json", "a", 6), _row("2026/b.json", "b", 6)]
        out, logs = self.dedupe(rows)
        self.assertEqual(len(out), 1)
        self.assertTrue(any("round 6" in m for m in logs))

    def test_non_duplicates_untouched(self):
        rows = [_row("2026/montreal.json", "montreal", 5), _row("2026/montreal_Q.json", "montreal", 5, "Q"),
                _row("2026/monaco.json", "monaco", 6)]
        out, _ = self.dedupe(rows)
        self.assertEqual(out, rows)

    def test_rows_without_round_kept(self):
        rows = [_row("2026/x.json", "x", None), _row("2026/y.json", "y", None)]
        out, _ = self.dedupe(rows)
        self.assertEqual(out, rows)

    def test_circuits_dedupe_per_round(self):
        rows = [_row("2026/montreal.json", "montreal", 5, None), _row("2026/villeneuve.json", "villeneuve", 5, None),
                _row("2026/monaco.json", "monaco", 6, None)]
        out, _ = self.dedupe(rows, kind="circuits")
        self.assertEqual([r["circuit_id"] for r in out], ["villeneuve", "monaco"])

    def test_charts_dedupe_keeps_schedule_circuit(self):
        # Two slugs, same round (5): an event-name slug and the schedule's circuit id.
        # Only the schedule-matching circuit id (villeneuve) is kept.
        rows = [
            _row("2026/05-singapore-grand-prix/R/landscape/circuit_history.png",
                 "singapore-grand-prix", 5),
            _row("2026/05-villeneuve/R/landscape/circuit_history.png",
                 "villeneuve", 5),
        ]
        out, logs = self.dedupe(rows, kind="charts")
        self.assertEqual([r["circuit_id"] for r in out], ["villeneuve"])
        self.assertEqual([r["storage_path"] for r in out],
                         ["2026/05-villeneuve/R/landscape/circuit_history.png"])
        self.assertEqual(logs, [])

    def test_charts_dedupe_schedule_unavailable_keeps_first_and_warns(self):
        rows = [
            _row("2026/05-singapore-grand-prix/R/landscape/circuit_history.png",
                 "singapore-grand-prix", 5),
            _row("2026/05-villeneuve/R/landscape/circuit_history.png",
                 "villeneuve", 5),
        ]
        out, logs = self.dedupe(rows, kind="charts", schedule=None)
        self.assertEqual([r["storage_path"] for r in out],
                         ["2026/05-singapore-grand-prix/R/landscape/circuit_history.png"])
        warn = [m for m in logs if "round 5" in m]
        self.assertEqual(len(warn), 1)
        self.assertIn("2026/05-villeneuve/R/landscape/circuit_history.png", warn[0])

    def test_charts_dedupe_keeps_all_chart_types_same_session(self):
        # Same round/session: circuit_history under two slugs (stale event-name +
        # canonical circuit id) plus a different chart type. circuit_history
        # collapses to the schedule match; championship survives as its own
        # group — dedupe must not keep a single chart per session.
        rows = [
            _row("2026/05-singapore-grand-prix/R/landscape/circuit_history.png",
                 "singapore-grand-prix", 5, chart_type="circuit_history"),
            _row("2026/05-villeneuve/R/landscape/circuit_history.png",
                 "villeneuve", 5, chart_type="circuit_history"),
            _row("2026/05-villeneuve/R/landscape/championship.png",
                 "villeneuve", 5, chart_type="championship"),
        ]
        out, logs = self.dedupe(rows, kind="charts")
        self.assertEqual([r["storage_path"] for r in out],
                         ["2026/05-villeneuve/R/landscape/circuit_history.png",
                          "2026/05-villeneuve/R/landscape/championship.png"])
        self.assertEqual([r["chart_type"] for r in out], ["circuit_history", "championship"])
        self.assertEqual(logs, [])


if __name__ == "__main__":
    unittest.main()
