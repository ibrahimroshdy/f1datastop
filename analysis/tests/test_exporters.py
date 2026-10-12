import unittest
from datetime import datetime, timedelta, timezone
from unittest import mock

import requests

from _helpers import ANALYSIS  # noqa: F401

import upstream_errors as ue

NOW = datetime(2026, 6, 1, 12, tzinfo=timezone.utc)


def http_error(status):
    resp = requests.Response()
    resp.status_code = status
    return requests.HTTPError(f"HTTP {status}", response=resp)


class DataNotLoadedError(Exception):
    pass


class SkipOrFail(unittest.TestCase):
    def test_absent_skips_even_when_due(self):
        for exc in (http_error(404), DataNotLoadedError("x"),
                    ValueError("Session type 'S' does not exist for this event")):
            ue.skip_or_fail(exc, "lbl", 2026, 5, "R", due=True)  # no raise

    def test_unexpected_on_due_session_fails(self):
        with self.assertRaises(ue.ExportFailure) as cm:
            ue.skip_or_fail(KeyError("Date"), "2026 R5 R", 2026, 5, "R", due=True)
        self.assertIn("unexpected error", str(cm.exception))

    def test_transient_on_due_session_fails_and_says_so(self):
        with self.assertRaises(ue.ExportFailure) as cm:
            ue.skip_or_fail(http_error(503), "lbl", 2026, 5, "R", due=True)
        self.assertIn("transient", str(cm.exception))

    def test_not_due_skips(self):
        ue.skip_or_fail(KeyError("Date"), "lbl", 2026, 9, "R", due=False)

    def test_not_on_schedule_skips(self):
        ue.skip_or_fail(KeyError("Date"), "lbl", 2026, 5, "S", due=None)


class SessionDue(unittest.TestCase):
    def _sched(self, start):
        return [(5, "R", start)]

    def test_due_after_start_plus_grace(self):
        with mock.patch("cdn_schedule.sessions", return_value=self._sched(NOW - timedelta(hours=4))):
            self.assertTrue(ue.session_is_due(2026, 5, "R", now=NOW))

    def test_not_due_before_grace(self):
        with mock.patch("cdn_schedule.sessions", return_value=self._sched(NOW - timedelta(hours=1))):
            self.assertFalse(ue.session_is_due(2026, 5, "R", now=NOW))

    def test_session_not_in_schedule_is_none(self):
        with mock.patch("cdn_schedule.sessions", return_value=self._sched(NOW)):
            self.assertIsNone(ue.session_is_due(2026, 5, "S", now=NOW))

    def test_unreadable_schedule(self):
        with mock.patch("cdn_schedule.sessions", side_effect=RuntimeError("x")):
            self.assertTrue(ue.session_is_due(2025, 5, "R", now=NOW))    # past season
            self.assertEqual(ue.session_is_due(2026, 5, "R", now=NOW), ue.UNKNOWN)

    def test_past_season_readable_schedule_session_absent_is_none_and_skips(self):
        with mock.patch("cdn_schedule.sessions", return_value=[(5, "R", NOW)]):
            self.assertIsNone(ue.session_is_due(2025, 5, "S", now=NOW))
            ue.skip_or_fail(KeyError("Date"), "lbl", 2025, 5, "S", now=NOW)  # no raise

    def test_past_season_readable_schedule_session_present_is_due(self):
        with mock.patch("cdn_schedule.sessions",
                        return_value=[(5, "R", datetime(2025, 5, 1, tzinfo=timezone.utc))]):
            self.assertTrue(ue.session_is_due(2025, 5, "R", now=NOW))

    def test_unknown_plus_unexpected_error_fails_mentioning_schedule(self):
        with mock.patch("cdn_schedule.sessions", side_effect=RuntimeError("cdn down")):
            with self.assertRaises(ue.ExportFailure) as cm:
                ue.skip_or_fail(KeyError("Date"), "lbl", 2026, 5, "R", now=NOW)
        self.assertIn("schedule unreadable", str(cm.exception))

    def test_unknown_plus_absent_skips(self):
        with mock.patch("cdn_schedule.sessions", side_effect=RuntimeError("cdn down")):
            ue.skip_or_fail(DataNotLoadedError("x"), "lbl", 2026, 5, "R", now=NOW)  # no raise


class ExitCodesWhenScheduleDown(unittest.TestCase):
    def test_weather_unknown_unexpected_exits_1_absent_exits_0(self):
        import weather_export as we
        argv = ["weather_export", "--season", "2026", "--round", "5"]
        with mock.patch("cdn_schedule.sessions", side_effect=RuntimeError("down")), \
                mock.patch.object(we.bs, "exists", return_value=False), \
                mock.patch.object(we.bs, "public_base", return_value="http://cdn"), \
                mock.patch("sys.argv", argv):
            with mock.patch.object(we, "build_rows", side_effect=KeyError("boom")):
                self.assertEqual(we.main(), 1)
            with mock.patch.object(we, "build_rows", side_effect=DataNotLoadedError("x")):
                self.assertEqual(we.main(), 0)


class PastSeasonAbsentSessionExit(unittest.TestCase):
    def test_weather_exits_0_on_nonabsent_error(self):
        import weather_export as we
        argv = ["weather_export", "--season", "2025", "--round", "5", "--session", "S"]
        with mock.patch("cdn_schedule.sessions", return_value=[(5, "R", NOW)]), \
                mock.patch.object(we.bs, "exists", return_value=False), \
                mock.patch.object(we.bs, "public_base", return_value="http://cdn"), \
                mock.patch.object(we, "build_rows", side_effect=KeyError("boom")), \
                mock.patch("sys.argv", argv):
            self.assertEqual(we.main(), 0)


class WeatherExporter(unittest.TestCase):
    def setUp(self):
        import weather_export as we
        self.we = we

    def test_absent_skips_exit_zero(self):
        with mock.patch.object(self.we.bs, "exists", return_value=False), \
                mock.patch.object(self.we, "build_rows", side_effect=DataNotLoadedError("x")), \
                mock.patch.object(self.we.bs, "put") as put:
            self.assertEqual(self.we.export_round(2026, 5, "R"), 0)
        put.assert_not_called()

    def test_unexpected_error_on_due_session_raises(self):
        with mock.patch.object(self.we.bs, "exists", return_value=False), \
                mock.patch.object(self.we, "build_rows", side_effect=KeyError("boom")), \
                mock.patch.object(ue, "session_is_due", return_value=True):
            with self.assertRaises(ue.ExportFailure):
                self.we.export_round(2026, 5, "R")

    def test_main_exits_nonzero_but_tries_every_round(self):
        calls = []

        def fake(season, rnd, code, force):
            calls.append(rnd)
            if rnd == 5:
                raise ue.ExportFailure("R5 broke")
            return 1

        with mock.patch.object(self.we, "export_round", side_effect=fake), \
                mock.patch.object(self.we, "finished_rounds", return_value=[6, 5, 4]), \
                mock.patch.object(self.we.bs, "public_base", return_value="http://cdn"), \
                mock.patch("sys.argv", ["weather_export", "--season", "2026"]):
            self.assertEqual(self.we.main(), 1)
        self.assertEqual(calls, [6, 5, 4])

    def test_main_zero_when_clean(self):
        with mock.patch.object(self.we, "export_round", return_value=0), \
                mock.patch.object(self.we, "finished_rounds", return_value=[1]), \
                mock.patch.object(self.we.bs, "public_base", return_value="http://cdn"), \
                mock.patch("sys.argv", ["weather_export", "--season", "2026"]):
            self.assertEqual(self.we.main(), 0)


def _import_or_skip(name):
    try:
        return __import__(name)
    except ImportError as e:  # pragma: no cover
        raise unittest.SkipTest(f"{name} deps not installed: {e}")


class TelemetryExporter(unittest.TestCase):
    def setUp(self):
        self.te = _import_or_skip("telemetry_export")

    def test_absent_session_skips(self):
        with mock.patch.object(self.te, "_round_has_happened", return_value=True), \
                mock.patch.object(self.te, "_load_session", side_effect=DataNotLoadedError("x")):
            self.assertEqual(self.te.export_session(2026, 5, "S", upload=False), [])

    def test_unexpected_on_due_session_raises_and_run_exits_1(self):
        with mock.patch.object(self.te, "_round_has_happened", return_value=True), \
                mock.patch.object(self.te, "_load_session", side_effect=KeyError("Date")), \
                mock.patch.object(ue, "session_is_due", return_value=True):
            with self.assertRaises(ue.ExportFailure):
                self.te.export_session(2026, 5, "R", upload=False)
            with mock.patch.object(self.te, "main", side_effect=ue.ExportFailure("x")):
                self.assertEqual(self.te.run(), 1)


class ReplayExporter(unittest.TestCase):
    def setUp(self):
        self.rr = _import_or_skip("race_replay_export")

    def test_absent_skips_unexpected_fails(self):
        with mock.patch.object(self.rr.fastf1, "get_session", side_effect=DataNotLoadedError("x")):
            self.assertIsNone(self.rr.export_replay(2026, 5, upload=False))
        with mock.patch.object(self.rr.fastf1, "get_session", side_effect=KeyError("Date")), \
                mock.patch.object(ue, "session_is_due", return_value=True):
            with self.assertRaises(ue.ExportFailure):
                self.rr.export_replay(2026, 5, upload=False)


class GeometryExporter(unittest.TestCase):
    def setUp(self):
        self.cg = _import_or_skip("circuit_geometry_export")

    def test_all_absent_skips(self):
        with mock.patch.object(self.cg.fastf1, "get_session", side_effect=DataNotLoadedError("x")):
            self.assertIsNone(self.cg.export_circuit(2026, 5, upload=False))

    def test_all_unexpected_on_due_round_fails(self):
        with mock.patch.object(self.cg.fastf1, "get_session", side_effect=KeyError("Date")), \
                mock.patch.object(self.cg, "session_is_due", return_value=True):
            with self.assertRaises(ue.ExportFailure):
                self.cg.export_circuit(2026, 5, upload=False)

    def test_unknown_dueness_with_unexpected_errors_fails(self):
        with mock.patch.object(self.cg.fastf1, "get_session", side_effect=KeyError("Date")), \
                mock.patch.object(self.cg, "session_is_due", return_value=ue.UNKNOWN):
            with self.assertRaises(ue.ExportFailure):
                self.cg.export_circuit(2026, 5, upload=False)

    def test_unexpected_but_not_due_skips(self):
        with mock.patch.object(self.cg.fastf1, "get_session", side_effect=KeyError("Date")), \
                mock.patch.object(self.cg, "session_is_due", return_value=False):
            self.assertIsNone(self.cg.export_circuit(2026, 5, upload=False))


class NoCircuitInfo(unittest.TestCase):
    def setUp(self):
        self.cg = _import_or_skip("circuit_geometry_export")

    def test_none_circuit_info_returns_none_with_warning(self):
        sess = mock.Mock()
        sess.get_circuit_info.side_effect = AttributeError(
            "'NoneType' object has no attribute 'add_marker_distance'")
        self.assertIsNone(self.cg.safe_circuit_info(sess, "2026 R14"))

    def test_other_attribute_errors_propagate(self):
        sess = mock.Mock()
        sess.get_circuit_info.side_effect = AttributeError("something else")
        with self.assertRaises(AttributeError):
            self.cg.safe_circuit_info(sess, "x")

    def test_other_errors_propagate(self):
        sess = mock.Mock()
        sess.get_circuit_info.side_effect = KeyError("x")
        with self.assertRaises(KeyError):
            self.cg.safe_circuit_info(sess, "x")

    def test_corner_and_marshal_helpers_accept_none(self):
        self.assertEqual(self.cg._corners(None, 0.0), [])
        self.assertEqual(self.cg._marshal_sectors(None, 0.0), [])

    def test_export_circuit_blob_without_corners(self):
        import numpy as np
        import pandas as pd
        n = 50
        t = np.linspace(0, 2 * np.pi, n)
        tel = pd.DataFrame({"X": 1000 * np.cos(t), "Y": 1000 * np.sin(t),
                            "Distance": np.linspace(0, 5000, n), "Throttle": np.full(n, 100.0)})
        lap = mock.MagicMock()
        lap.get_telemetry.return_value.add_distance.return_value = tel
        sess = mock.MagicMock()
        sess.laps.__len__.return_value = 10
        sess.laps.pick_fastest.return_value = lap
        lap.get.return_value = 5
        sess.event = {"Location": "Somewhere", "EventName": "X GP"}
        sess.get_circuit_info.side_effect = AttributeError(
            "'NoneType' object has no attribute 'add_marker_distance'")
        with mock.patch.object(self.cg.fastf1, "get_session", return_value=sess), \
                mock.patch.object(self.cg, "_lookup_circuit", return_value=("somewhere", "S")), \
                mock.patch.object(self.cg, "_emit"):
            blob = self.cg.export_circuit(2026, 14, upload=False)
        self.assertIsNotNone(blob)
        self.assertEqual(blob["corners"], [])
        self.assertEqual(blob["marshal_sectors"], [])
        self.assertEqual(blob["rotation"], 0.0)
        self.assertTrue(blob["outline"])


class ReplayNoCircuitInfo(unittest.TestCase):
    def test_replay_uses_safe_helper(self):
        rr = _import_or_skip("race_replay_export")
        cg = _import_or_skip("circuit_geometry_export")
        self.assertIs(rr.safe_circuit_info, cg.safe_circuit_info)


if __name__ == "__main__":
    unittest.main()
