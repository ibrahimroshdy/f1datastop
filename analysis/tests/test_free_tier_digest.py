import unittest
from unittest import mock

from _helpers import ANALYSIS  # noqa: F401

import free_tier_digest as d


class Conclusions(unittest.TestCase):
    def test_only_real_failures_count(self):
        for c in ("failure", "timed_out", "startup_failure"):
            self.assertTrue(d.is_failure(c), c)
        for c in ("success", "cancelled", "skipped", "neutral", None):
            self.assertFalse(d.is_failure(c), c)

    def test_count(self):
        self.assertEqual(d.count_failures(["success", "cancelled", None, "failure", "timed_out", "skipped"]), 2)


class PipelineSummary(unittest.TestCase):
    def test_per_job_latest_and_failures(self):
        runs = [{"id": 3, "conclusion": None}, {"id": 2, "conclusion": "failure"},
                {"id": 1, "conclusion": "success"}]
        jobs = {
            3: [{"name": "charts", "conclusion": None}, {"name": "reconcile", "conclusion": "success"}],
            2: [{"name": "charts", "conclusion": "failure"}, {"name": "reconcile", "conclusion": "cancelled"}],
            1: [{"name": "charts", "conclusion": "success"}, {"name": "reconcile", "conclusion": "success"}],
        }
        line = d.summarize_pipeline(runs, jobs)
        self.assertIn("charts:failure(1", line)       # latest *concluded*; in-progress skipped
        self.assertIn("reconcile:success", line)
        self.assertIn("3 runs, 1 failed", line)       # cancelled/None not counted

    def test_cancelled_is_not_a_failure_in_summary(self):
        runs = [{"id": 1, "conclusion": "cancelled"}]
        jobs = {1: [{"name": "assets", "conclusion": "cancelled"}]}
        line = d.summarize_pipeline(runs, jobs)
        self.assertIn("0 failed", line)
        self.assertNotIn("✗", line)


class DispatchLine(unittest.TestCase):
    def test_healthy(self):
        line = d.dispatch_line({"window_hours": 6, "responses": 10, "non_2xx": 0,
                                "last_2xx_at": "2026-10-12T18:51:19+00:00", "failed_cron_runs": 0})
        self.assertIn(":white_check_mark:", line)
        self.assertIn("10 dispatches in 6 h, 0 non-2xx", line)
        self.assertIn("last OK 2026-10-12", line)

    def test_non_2xx_is_bad(self):
        h = {"window_hours": 6, "responses": 3, "non_2xx": 3, "last_non_2xx_status": 401, "failed_cron_runs": 0}
        self.assertTrue(d.dispatch_is_bad(h))
        line = d.dispatch_line(h)
        self.assertIn(":rotating_light:", line)
        self.assertIn("last HTTP 401", line)

    def test_failed_cron_runs_is_bad(self):
        h = {"window_hours": 6, "responses": 0, "non_2xx": 0, "failed_cron_runs": 2}
        self.assertTrue(d.dispatch_is_bad(h))
        self.assertIn("2 failed cron runs", d.dispatch_line(h))

    def test_zero_dispatches_green_only_while_reconcile_fresh(self):
        h = {"window_hours": 6, "responses": 0, "non_2xx": 0, "failed_cron_runs": 0}
        self.assertIn(":white_check_mark:", d.dispatch_line(h))
        self.assertIn(":white_check_mark:", d.dispatch_line(h, reconcile_stale=False))
        stale = d.dispatch_line(h, reconcile_stale=True)
        self.assertIn(":warning:", stale)
        self.assertNotIn(":white_check_mark:", stale)

    def test_stale_reconcile_with_dispatches_stays_green(self):
        h = {"window_hours": 6, "responses": 4, "non_2xx": 0, "failed_cron_runs": 0}
        self.assertIn(":white_check_mark:", d.dispatch_line(h, reconcile_stale=True))

    def test_status_warns_when_no_responses_and_reconcile_stale(self):
        h = {"window_hours": 6, "responses": 0, "non_2xx": 0, "failed_cron_runs": 0}
        with mock.patch.object(d, "dispatch_health", return_value=(h, None)), \
                mock.patch.object(d, "_reconcile_age", return_value=(30.0, None)):
            line, note = d.dispatch_status()
        self.assertIn(":warning:", line)
        with mock.patch.object(d, "dispatch_health", return_value=(h, None)), \
                mock.patch.object(d, "_reconcile_age", return_value=(2.0, None)):
            self.assertIn(":white_check_mark:", d.dispatch_status()[0])

    def test_status_reports_note_when_rpc_unavailable(self):
        with mock.patch.object(d, "dispatch_health", return_value=(None, "f1_dispatch_health HTTP 404")):
            self.assertEqual(d.dispatch_status(), (None, "f1_dispatch_health HTTP 404"))


class Freshness(unittest.TestCase):
    def test_age_hours(self):
        now = d.dt.datetime(2026, 10, 12, 12, 0, tzinfo=d.dt.timezone.utc)
        self.assertAlmostEqual(d.age_hours("2026-10-12T09:30:00Z", now), 2.5)
        self.assertIsNone(d.age_hours(None, now))
        self.assertIsNone(d.age_hours("garbage", now))

    def test_fresh_and_stale(self):
        self.assertIn(":white_check_mark:", d.freshness_line(5.9))
        self.assertIn(":white_check_mark:", d.freshness_line(12.0))
        self.assertIn(":rotating_light:", d.freshness_line(12.1))
        self.assertIn("no successful reconcile", d.freshness_line(None))

    def test_last_success_age_picks_newest_successful_job(self):
        now = d.dt.datetime(2026, 10, 12, 12, 0, tzinfo=d.dt.timezone.utc)
        runs = [{"id": 2, "conclusion": "failure"}, {"id": 1, "conclusion": "success"}]
        jobs = {"jobs": [{"name": "digest", "conclusion": "skipped"},
                         {"name": "reconcile", "conclusion": "success", "completed_at": "2026-10-12T06:00:00Z"}]}
        with mock.patch.object(d, "_recent_runs", return_value=(runs, None)), \
                mock.patch.object(d, "_gh_get", return_value=(jobs, None)) as get:
            age, note = d.last_success_age("reconcile", "tok", now=now)
        self.assertAlmostEqual(age, 6.0)
        self.assertIsNone(note)
        self.assertIn("/runs/1/jobs", get.call_args.args[0])  # the failed run is never fetched

    def test_last_success_age_none_when_no_run(self):
        with mock.patch.object(d, "_recent_runs", return_value=([], None)):
            self.assertEqual(d.last_success_age("digest", "tok"), (None, None))


class BackupDecision(unittest.TestCase):
    def test_quiet_when_recent_digest_and_healthy(self):
        self.assertFalse(d.backup_should_post(0.4, False))
        self.assertFalse(d.backup_should_post(20.0, False))

    def test_posts_when_digest_old_missing_or_dispatch_bad(self):
        self.assertTrue(d.backup_should_post(20.1, False))
        self.assertTrue(d.backup_should_post(None, False))
        self.assertTrue(d.backup_should_post(0.4, True))

    def test_main_backup_quiet_exits_zero_without_posting(self):
        with mock.patch.dict(d.os.environ, {"DIGEST_MODE": "backup", "SLACK_ALERTS_WEBHOOK": "http://slack.test/x"}), \
                mock.patch.object(d, "_backup_decision", return_value=(False, "ok")), \
                mock.patch.object(d, "build_digest") as build, \
                mock.patch.object(d.requests, "post") as post:
            self.assertEqual(d.main(), 0)
        build.assert_not_called()
        post.assert_not_called()

    def test_main_backup_alert_posts_with_banner(self):
        with mock.patch.dict(d.os.environ, {"DIGEST_MODE": "backup", "SLACK_ALERTS_WEBHOOK": "http://slack.test/x"}), \
                mock.patch.object(d, "_backup_decision", return_value=(True, "stale")), \
                mock.patch.object(d, "build_digest", return_value="body"), \
                mock.patch.object(d.requests, "post") as post:
            self.assertEqual(d.main(), 0)
        self.assertIn("Backup clock fired", post.call_args.kwargs["json"]["text"])
        self.assertIn("body", post.call_args.kwargs["json"]["text"])

    def test_decision_unreadable_dispatch_health_is_bad(self):
        with mock.patch.object(d, "dispatch_health", return_value=(None, "down")), \
                mock.patch.object(d, "_gh_token", return_value="tok"), \
                mock.patch.object(d, "last_success_age", return_value=(1.0, None)):
            self.assertTrue(d._backup_decision()[0])


class Isolation(unittest.TestCase):
    def test_every_section_failing_still_builds_message(self):
        boom = mock.Mock(side_effect=RuntimeError("down"))
        with mock.patch.object(d, "r2_usage", boom), \
                mock.patch.object(d, "db_mb", boom), \
                mock.patch.object(d, "github_actions_status", boom), \
                mock.patch.object(d, "pipeline_status", boom), \
                mock.patch.object(d, "queue_runs_status", boom), \
                mock.patch.object(d, "dispatch_status", boom), \
                mock.patch.object(d, "freshness_status", boom), \
                mock.patch.object(d, "queue_depth", boom):
            text = d.build_digest()
        self.assertIn("free-tier digest", text)
        self.assertIn("R2 storage: unavailable", text)
        self.assertIn("Supabase: unavailable", text)

    def test_r2_systemexit_is_contained(self):
        with mock.patch.object(d, "r2_usage", side_effect=SystemExit("missing R2 env")):
            self.assertIn("unavailable", d._section("R2 storage", d._r2_line))

    def test_keyboard_interrupt_propagates(self):
        with self.assertRaises(KeyboardInterrupt):
            d._section("x", mock.Mock(side_effect=KeyboardInterrupt))

    def test_slack_always_posted(self):
        with mock.patch.object(d, "build_digest", return_value="hello"), \
                mock.patch.dict(d.os.environ, {"SLACK_ALERTS_WEBHOOK": "http://slack.test/x"}), \
                mock.patch.object(d.requests, "post") as post:
            self.assertEqual(d.main(), 0)
        post.assert_called_once()


if __name__ == "__main__":
    unittest.main()
