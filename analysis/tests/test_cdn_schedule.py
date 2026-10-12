import unittest
from unittest import mock

from _helpers import ANALYSIS  # noqa: F401

import cdn_schedule as cs

RACE = {"round": "6", "date": "2026-05-24", "time": "13:00:00Z",
        "Qualifying": {"date": "2026-05-23", "time": "14:00:00Z"}}


def env(data=None, **extra):
    return {"data": {"MRData": {"RaceTable": {"Races": data}}} if data is not None else None, **extra}


class ProxyParsing(unittest.TestCase):
    def test_ok(self):
        self.assertEqual(cs.parse_proxy_response(env([RACE], status=200)), [RACE])

    def test_error_field_is_failure(self):
        with self.assertRaises(ValueError):
            cs.parse_proxy_response(env([RACE], error="upstream down"))

    def test_non_ok_status_is_failure(self):
        with self.assertRaises(ValueError):
            cs.parse_proxy_response(env([RACE], status=502))

    def test_zero_races_is_failure(self):
        with self.assertRaises(ValueError):
            cs.parse_proxy_response(env([]))
        with self.assertRaises(ValueError):
            cs.parse_proxy_response({"data": None})


class Fallback(unittest.TestCase):
    def test_proxy_error_falls_back_to_cdn(self):
        with mock.patch.object(cs, "_post_json", return_value=env([], error="boom")), \
                mock.patch.object(cs, "fetch_json", return_value=[RACE]):
            out = cs.sessions(2026)
        self.assertIn((6, "R"), [(r, c) for r, c, _ in out])

    def test_proxy_empty_falls_back_to_cdn(self):
        with mock.patch.object(cs, "_post_json", return_value=env([])), \
                mock.patch.object(cs, "fetch_json", return_value=[RACE]):
            self.assertTrue(cs.sessions(2026))

    def test_both_empty_raises(self):
        with mock.patch.object(cs, "_post_json", return_value=env([])), \
                mock.patch.object(cs, "fetch_json", return_value=[]):
            with self.assertRaises(cs.ScheduleUnavailable):
                cs.sessions(2026)

    def test_proxy_exception_and_cdn_failure_raises(self):
        with mock.patch.object(cs, "_post_json", side_effect=OSError("net")), \
                mock.patch.object(cs, "fetch_json", side_effect=OSError("cdn")):
            with self.assertRaises(cs.ScheduleUnavailable):
                cs.sessions(2026)


if __name__ == "__main__":
    unittest.main()
