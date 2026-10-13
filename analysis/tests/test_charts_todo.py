import unittest
from unittest import mock

from _helpers import ANALYSIS  # noqa: F401 — sets sys.path

import charts_todo as ct


def rows(types, thumb=True, theme="dark"):
    return [{"chart_type": t, "theme": theme, "thumb_path": "t.webp" if thumb else None}
            for t in types]


class Completeness(unittest.TestCase):
    def test_expected_comes_from_generate_registry(self):
        r = ct.expected_charts("R")
        self.assertIn("race_analysis", r)
        self.assertIn("parallax_stack", ct.expected_charts("Q"))
        self.assertNotIn("qualifying_breakdown", ct.expected_charts("Q"))  # optional
        self.assertNotIn("race_analysis", ct.expected_charts("FP1"))
        self.assertGreater(len(r), 11)

    def test_registry_source_fallback_matches_import(self):
        ns = ct._registry_from_source()
        for code in ("FP1", "Q", "SQ", "S", "R"):
            self.assertEqual(set(ns["charts_for_session"](code)) - set(ns["OPTIONAL_CHARTS"]),
                             set(ct.expected_charts(code)))

    def test_optional_charts_are_not_required(self):
        ns = ct._registry_from_source()
        opt = set(ns["OPTIONAL_CHARTS"])
        self.assertTrue(opt)
        for code in ("FP1", "Q", "R"):
            self.assertFalse(ct.expected_charts(code) & opt, code)
        self.assertTrue(opt & set(ns["charts_for_session"]("R")))

    def test_speed_trace_is_required_telemetry_swallowers_optional(self):
        ns = ct._registry_from_source()
        self.assertNotIn("speed_trace", ns["OPTIONAL_CHARTS"])
        self.assertIn("speed_trace", ct.expected_charts("FP1"))
        for k in ("speed_distribution", "track_dominance", "dominance_flat"):
            self.assertIn(k, ns["OPTIONAL_CHARTS"])

    def test_missing_only_optional_is_complete(self):
        ns = ct._registry_from_source()
        full = set(ns["charts_for_session"]("R"))
        have = full - set(ns["OPTIONAL_CHARTS"])
        self.assertTrue(ns["OPTIONAL_CHARTS"] & full)  # something really is missing
        self.assertTrue(ct._is_complete(ct._done_types(rows(sorted(have))), "R"))

    def test_missing_a_required_chart_is_not_complete(self):
        have = sorted(ct.expected_charts("R"))[1:]
        self.assertFalse(ct._is_complete(ct._done_types(rows(have)), "R"))

    def test_one_chart_is_not_complete(self):
        self.assertFalse(ct._is_complete(ct._done_types(rows(["race_analysis"])), "R"))

    def test_eleven_of_full_set_is_not_complete(self):
        full = sorted(ct.expected_charts("R"))
        self.assertFalse(ct._is_complete(ct._done_types(rows(full[:11])), "R"))

    def test_full_set_is_complete(self):
        self.assertTrue(ct._is_complete(ct._done_types(rows(sorted(ct.expected_charts("R")))), "R"))

    def test_thumbless_light_and_social_rows_do_not_count(self):
        full = sorted(ct.expected_charts("Q"))
        self.assertFalse(ct._is_complete(ct._done_types(rows(full, thumb=False)), "Q"))
        self.assertFalse(ct._is_complete(ct._done_types(rows(full, theme="light")), "Q"))
        social = [{"chart_type": f"{t}_story", "theme": "dark", "thumb_path": "x"} for t in full]
        self.assertFalse(ct._is_complete(ct._done_types(social), "Q"))

    def test_has_charts_uses_cdn_index(self):
        full = rows(sorted(ct.expected_charts("R")))
        with mock.patch.object(ct.cdn_schedule, "fetch_json", return_value=full):
            self.assertTrue(ct._has_charts(2026, 16, "R"))
        with mock.patch.object(ct.cdn_schedule, "fetch_json", return_value=full[:11]):
            self.assertFalse(ct._has_charts(2026, 17, "R"))


class Errors(unittest.TestCase):
    def test_error_exits_nonzero(self):
        with mock.patch.object(ct, "main", side_effect=RuntimeError("boom")):
            self.assertEqual(ct.run(), 1)

    def test_schedule_failure_with_no_supabase_env_is_error(self):
        with mock.patch.object(ct.cdn_schedule, "sessions",
                               side_effect=ct.cdn_schedule.ScheduleUnavailable("x")), \
                mock.patch.dict(ct.os.environ, {}, clear=True), \
                mock.patch("sys.argv", ["charts_todo"]):
            self.assertEqual(ct.run(), 1)


if __name__ == "__main__":
    unittest.main()


class StandingsFingerprint(unittest.TestCase):
    """BUG-003: a done race session whose standings charts are stale is re-queued."""
    D = [{"Driver": {"driverId": "antonelli"}, "points": "340.0"},
         {"Driver": {"driverId": "piastri"}, "points": "138.0"}]
    C = [{"Constructor": {"constructorId": "red_bull"}, "points": "332.0"}]
    ROWS = [{"chart_type": "championship", "theme": "dark",
             "storage_path": "2026/17-Singapore-Grand-Prix/R/landscape/championship.png"}]

    def run_stale(self, have):
        import standings_fp
        def fetch_json(path):
            return self.D if "driver" in path else self.C
        side = have if isinstance(have, Exception) else None
        with mock.patch.object(ct.cdn_schedule, "fetch_json", side_effect=fetch_json), \
                mock.patch.object(ct.cdn_schedule, "cdn_host", return_value="https://cdn"), \
                mock.patch.object(ct, "_fetch_text", side_effect=side,
                                  return_value=None if side else have) as ft:
            out = ct._standings_stale(2026, self.ROWS)
        return out, ft, standings_fp

    def test_fingerprint_is_order_independent_and_point_sensitive(self):
        import standings_fp as fp
        a = fp.fingerprint(self.D, self.C)
        self.assertEqual(a, fp.fingerprint(list(reversed(self.D)), self.C))
        changed = [dict(self.D[0]), {"Driver": {"driverId": "piastri"}, "points": "136.0"}]
        self.assertNotEqual(a, fp.fingerprint(changed, self.C))

    def test_matching_fingerprint_is_not_stale(self):
        import standings_fp as fp
        out, ft, _ = self.run_stale(fp.fingerprint(self.D, self.C))
        self.assertFalse(out)
        self.assertEqual(ft.call_args[0][0],
                         "https://cdn/charts/2026/17-Singapore-Grand-Prix/R/standings.fp")

    def test_changed_standings_are_stale(self):
        self.assertTrue(self.run_stale("deadbeef")[0])

    def test_missing_fingerprint_is_stale_once(self):
        import urllib.error
        err = urllib.error.HTTPError("u", 404, "nf", {}, None)
        self.assertTrue(self.run_stale(err)[0])

    def test_outage_is_not_stale(self):
        self.assertFalse(self.run_stale(RuntimeError("down"))[0])

    def test_only_latest_round_is_checked(self):
        rows = rows_ok = None
        with mock.patch.object(ct.cdn_schedule, "fetch_json", return_value=[]), \
                mock.patch.object(ct, "_is_complete", return_value=True), \
                mock.patch.object(ct, "_standings_stale", return_value=True) as st:
            self.assertTrue(ct._has_charts(2026, 16, "R", latest=False))
            self.assertFalse(ct._has_charts(2026, 17, "R", latest=True))
            self.assertTrue(ct._has_charts(2026, 17, "Q", latest=True))
        self.assertEqual(st.call_count, 1)
