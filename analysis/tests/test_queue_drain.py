"""Both queue scripts drain every pending row in one run (batches of REQUEST_LIMIT), bounded by
QUEUE_TIME_BUDGET_S. HTTP and subprocess are mocked; no network."""
import contextlib
import io
import subprocess
import unittest
from unittest import mock

from _helpers import ANALYSIS  # noqa: F401

import process_chart_requests as pcr
import process_telemetry_requests as ptr


def _chart(i):
    return {"id": f"c{i}", "season": 2026, "round": 5, "session": "R", "chart": "race_analysis",
            "format": "landscape", "theme": "dark", "drivers": []}


def _tele(i):
    return {"id": f"t{i}", "season": 2026, "round": 5, "session": "R", "driver": "VER",
            "lap_number": i + 1}


class _Drain:
    """Shared scenarios; subclasses bind the module, the row factory and the row-timeout env."""
    mod = None
    row = None
    timeout_env = None

    def _run(self, batches, clock=None, budget="900", row_timeout="10", pending_after=None):
        """batches: lists returned by successive pending-fetches (then [])."""
        queue = [list(b) for b in batches]
        handled = []
        calls = {"fetch": 0}

        def fetch(base, headers, limit):
            calls["fetch"] += 1
            return queue.pop(0) if queue else []

        def process(base, headers, rows, can_start):
            done = []
            for r in rows:
                if not can_start():
                    break
                handled.append(r["id"])
                done.append(r["id"])
                self.mod._STATS["terminal"] += 1  # the row reached a terminal status
            return done

        patches = [
            mock.patch.object(self.mod, "_base", return_value="http://sb.test"),
            mock.patch.object(self.mod, "_headers", return_value={}),
            mock.patch.object(self.mod, "_limit", return_value=2),
            mock.patch.object(self.mod, "_reset_stale", return_value=0),
            mock.patch.object(self.mod, "_fetch_pending", side_effect=fetch),
            mock.patch.object(self.mod, "_process_batch", side_effect=process),
            mock.patch.object(self.mod, "_signal_leftover"),
            mock.patch.dict("os.environ", {"QUEUE_TIME_BUDGET_S": budget, self.timeout_env: row_timeout}),
        ]
        if clock is not None:
            patches.append(mock.patch.object(self.mod, "time", mock.Mock(monotonic=clock)))
        if pending_after is not None:
            # what the post-budget leftover check sees
            patches[4] = mock.patch.object(
                self.mod, "_fetch_pending",
                side_effect=lambda *a: (fetch(*a) if queue else list(pending_after)))
        started = [p.start() for p in patches]
        signal = started[6]
        try:
            self.mod.main()
        finally:
            mock.patch.stopall()
        return handled, queue, signal

    def test_multi_batch_drain(self):
        r = self.row
        handled, left, signal = self._run([[r(0), r(1)], [r(2), r(3)], [r(4)]])
        self.assertEqual(len(handled), 5)
        self.assertEqual(left, [])
        signal.assert_not_called()  # drained completely: no continuation

    def test_stops_at_empty(self):
        handled, _, signal = self._run([])
        self.assertEqual(handled, [])
        signal.assert_not_called()

    def test_budget_stops_before_a_row_that_would_not_fit(self):
        r = self.row
        # budget 100, row timeout 40 -> deadline 100. Row 0 starts at t=0 (0+40<=100), row 1 at
        # t=50 (90<=100), row 2 at t=70 (110>100): stop before it, even though it is pending.
        ticks = iter([0, 0, 50, 70, 70, 70])
        pend = [r(2), r(3)]
        handled, _, signal = self._run([[r(0), r(1), r(2)]], clock=lambda: next(ticks),
                                       budget="100", row_timeout="40", pending_after=pend)
        self.assertEqual(handled, [r(0)["id"], r(1)["id"]])
        signal.assert_called_once()  # unattempted pending rows remain

    def test_budget_stop_without_leftovers_sets_no_flag(self):
        r = self.row
        ticks = iter([0, 0, 50, 70, 70, 70])
        handled, _, signal = self._run([[r(0), r(1), r(2)]], clock=lambda: next(ticks),
                                       budget="100", row_timeout="40", pending_after=[])
        self.assertEqual(len(handled), 2)
        signal.assert_not_called()

    def test_no_progress_sets_no_flag(self):
        r = self.row
        # the budget check fails before any row starts: nothing finished, so no continuation
        ticks = iter([0, 95, 95, 95])
        handled, _, signal = self._run([[r(0), r(1)]], clock=lambda: next(ticks), budget="100",
                                       row_timeout="40", pending_after=[r(0), r(1)])
        self.assertEqual(handled, [])
        signal.assert_not_called()

    def test_stuck_rows_do_not_spin(self):
        r = self.row
        same = [r(0), r(1)]  # status writes failing: the same rows stay pending forever
        handled, left, signal = self._run([list(same), list(same), list(same)])
        self.assertEqual(handled, [r(0)["id"], r(1)["id"]])
        self.assertEqual(len(left), 1)
        signal.assert_not_called()

    def test_row_timeout_over_budget_fails_fast(self):
        with self.assertRaises(SystemExit) as cm:
            self._run([[self.row(0)]], budget="30", row_timeout="60")
        self.assertIn("exceeds QUEUE_TIME_BUDGET_S", str(cm.exception))

    def test_bad_budget_is_a_clear_error(self):
        with mock.patch.dict("os.environ", {"QUEUE_TIME_BUDGET_S": "soon"}):
            with self.assertRaises(SystemExit):
                self.mod._budget()

    def test_bad_row_timeout_is_a_clear_error(self):
        with mock.patch.dict("os.environ", {self.timeout_env: "x"}):
            with self.assertRaises(SystemExit):
                self.mod._row_timeout()

    def test_leftover_flag_is_written_to_github_output(self):
        import os
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "out")
            with mock.patch.dict("os.environ", {"GITHUB_OUTPUT": path}):
                self.mod._signal_leftover()
            with open(path) as f:
                self.assertEqual(f.read(), "leftover=true\n")

    def test_no_github_output_is_harmless(self):
        env = {k: v for k, v in __import__("os").environ.items() if k != "GITHUB_OUTPUT"}
        with mock.patch.dict("os.environ", env, clear=True):
            self.mod._signal_leftover()  # must not raise


class ChartDrain(_Drain, unittest.TestCase):
    mod = pcr
    row = staticmethod(_chart)
    timeout_env = "CHART_ROW_TIMEOUT_S"


class TelemetryDrain(_Drain, unittest.TestCase):
    mod = ptr
    row = staticmethod(_tele)
    timeout_env = "TELEMETRY_ROW_TIMEOUT_S"


class FetchPendingHttp(unittest.TestCase):
    """The HTTP layer is mocked: one GET per batch, filtered to pending, oldest first."""

    def test_chart_fetch_query(self):
        resp = mock.Mock()
        resp.json.return_value = [_chart(0)]
        with mock.patch.object(pcr.rq, "get", return_value=resp) as g:
            rows = pcr._fetch_pending("http://sb.test", {}, 8)
        self.assertEqual(rows, [_chart(0)])
        params = g.call_args.kwargs["params"]
        self.assertEqual(params["status"], "eq.pending")
        self.assertEqual(params["limit"], "8")

    def test_telemetry_fetch_query(self):
        resp = mock.Mock()
        resp.json.return_value = []
        with mock.patch.object(ptr.rq, "get", return_value=resp) as g:
            self.assertEqual(ptr._fetch_pending("http://sb.test", {}, 3), [])
        self.assertEqual(g.call_args.kwargs["params"]["status"], "eq.pending")


class StaleReset(unittest.TestCase):
    """Rows stuck in `processing` go back to `pending` before the drain; fresh ones are untouched."""

    def _case(self, mod, table):
        resp = mock.Mock()
        resp.json.return_value = [{"id": "old1"}, {"id": "old2"}]
        with mock.patch.object(mod.rq, "patch", return_value=resp) as p:
            n = mod._reset_stale("http://sb.test", {"apikey": "k"}, 1800)
        self.assertEqual(n, 2)
        self.assertEqual(p.call_args.args[0], f"http://sb.test/rest/v1/{table}")
        params = p.call_args.kwargs["params"]
        self.assertEqual(params["status"], "eq.processing")
        self.assertTrue(params["updated_at"].startswith("lt."))  # only rows older than the cutoff
        self.assertEqual(p.call_args.kwargs["json"]["status"], "pending")
        self.assertNotIn("id", params)  # no row is addressed by id: fresh rows fail the cutoff filter

    def test_chart_reset_filters_by_age(self):
        self._case(pcr, "f1_chart_requests")

    def test_telemetry_reset_filters_by_age(self):
        self._case(ptr, "f1_telemetry_requests")

    def test_cutoff_is_stale_seconds_ago(self):
        from datetime import datetime, timedelta, timezone
        resp = mock.Mock()
        resp.json.return_value = []
        with mock.patch.object(pcr.rq, "patch", return_value=resp) as p:
            before = datetime.now(timezone.utc)
            pcr._reset_stale("http://sb.test", {}, 600)
        cutoff = datetime.fromisoformat(p.call_args.kwargs["params"]["updated_at"][3:])
        self.assertAlmostEqual((before - cutoff).total_seconds(), 600, delta=5)

    def test_http_failure_does_not_stop_the_drain(self):
        for mod in (pcr, ptr):
            with mock.patch.object(mod.rq, "patch", side_effect=OSError("down")):
                self.assertEqual(mod._reset_stale("http://sb.test", {}, 1800), 0)

    def test_reset_runs_before_the_first_fetch(self):
        for mod in (pcr, ptr):
            order = []
            with mock.patch.dict("os.environ", {"QUEUE_TIME_BUDGET_S": "900"}), \
                    mock.patch.object(mod, "_base", return_value="http://sb.test"), \
                    mock.patch.object(mod, "_headers", return_value={}), \
                    mock.patch.object(mod, "_limit", return_value=2), \
                    mock.patch.object(mod, "_reset_stale", side_effect=lambda *a: order.append("reset") or 1), \
                    mock.patch.object(mod, "_fetch_pending",
                                      side_effect=lambda *a: order.append("fetch") or []):
                mod.main()
            self.assertEqual(order, ["reset", "fetch"])  # reset rows are claimed in the same run

    def test_bad_stale_value_is_a_clear_error(self):
        with mock.patch.dict("os.environ", {"QUEUE_STALE_PROCESSING_S": "x"}):
            for mod in (pcr, ptr):
                with self.assertRaises(SystemExit):
                    mod._stale_s()


class RowTimeout(unittest.TestCase):
    """A hung child is killed by the per-row timeout; the row ends `error`, never `processing`,
    and the drain moves on. Error rows leave the pending set, so continuation cannot loop."""

    def _drain(self, mod, rows, run_exc):
        patches = []
        queue = [list(rows)]
        env = {"QUEUE_TIME_BUDGET_S": "900", "CHART_ROW_TIMEOUT_S": "7", "TELEMETRY_ROW_TIMEOUT_S": "7"}
        resp = mock.Mock(ok=True)
        resp.json.return_value = [{"public_url": "http://x/y.png"}]
        with mock.patch.dict("os.environ", env), \
                mock.patch.object(mod, "_base", return_value="http://sb.test"), \
                mock.patch.object(mod, "_headers", return_value={}), \
                mock.patch.object(mod, "_limit", return_value=5), \
                mock.patch.object(mod, "_reset_stale", return_value=0), \
                mock.patch.object(mod, "_fetch_pending", side_effect=lambda *a: queue.pop(0) if queue else []), \
                mock.patch.object(mod, "_chart_keys", create=True, return_value={"race_analysis"}), \
                mock.patch.object(mod.rq, "get", return_value=resp), \
                mock.patch.object(mod, "_patch", side_effect=lambda rid, body: patches.append((rid, body))), \
                mock.patch.object(mod, "_run", side_effect=run_exc) as run:
            mod.main()
        return patches, run

    def _check(self, mod, rows, script):
        calls = []

        def run(*a, **kw):
            calls.append((a, kw))
            if len(calls) == 1:
                raise subprocess.TimeoutExpired(a, kw.get("timeout"))

        patches, _ = self._drain(mod, rows, run)
        self.assertEqual(len(calls), 2)  # the drain continued with the next row
        self.assertTrue(all(kw.get("timeout") == 7 for _, kw in calls))  # the timeout is passed down
        first = [b for rid, b in patches if rid == rows[0]["id"]]
        self.assertEqual(first[0], {"status": "processing"})
        self.assertEqual(first[-1]["status"], "error")
        self.assertIn("timed out after 7 s", first[-1]["error"])
        self.assertIn("retry later", first[-1]["error"])
        second = [b for rid, b in patches if rid == rows[1]["id"]]
        self.assertEqual(second[-1]["status"], "done")
        # no row is left in `processing`
        for rid in (r["id"] for r in rows):
            last = [b for r2, b in patches if r2 == rid][-1]
            self.assertNotEqual(last["status"], "processing")

    def test_chart_timeout_marks_error_and_continues(self):
        self._check(pcr, [_chart(0), _chart(1)], "generate.py")

    def test_telemetry_timeout_marks_error_and_continues(self):
        resp_rows = [_tele(0), _tele(1)]
        self._check(ptr, resp_rows, "telemetry_export.py")


class _Scenario:
    """Drive the real main()/_process_batch()/_write() with a fake Supabase store."""

    def _drive(self, mod, rows, timeout_env, ticks=None, patch_fails=False, run_exc=None, store=None):
        store = {} if store is None else store
        flags = []
        resp = mock.Mock(ok=True)
        resp.json.return_value = [{"public_url": "http://x/y"}]
        clock = {"t": 0.0}

        def fetch(base, headers, limit):
            return [dict(r) for r in rows if store.get(r["id"], "pending") == "pending"][:limit]

        def patch(rid, body):
            if patch_fails:
                raise OSError("403 Forbidden")
            store[rid] = body["status"]

        def run(*a, timeout=None, **kw):
            clock["t"] += timeout
            if run_exc:
                raise subprocess.TimeoutExpired(a, timeout)

        tick = (lambda: next(ticks)) if ticks is not None else (lambda: clock["t"])
        out = io.StringIO()
        with mock.patch.dict("os.environ", {"QUEUE_TIME_BUDGET_S": "100", timeout_env: "30"}), \
                mock.patch.object(mod, "_base", return_value="http://sb.test"), \
                mock.patch.object(mod, "_headers", return_value={}), \
                mock.patch.object(mod, "_limit", return_value=8), \
                mock.patch.object(mod, "_reset_stale", return_value=0), \
                mock.patch.object(mod, "_chart_keys", create=True, return_value={"race_analysis"}), \
                mock.patch.object(mod, "_fetch_pending", side_effect=fetch), \
                mock.patch.object(mod, "_patch", side_effect=patch), \
                mock.patch.object(mod, "_run", side_effect=run), \
                mock.patch.object(mod.rq, "get", return_value=resp), \
                mock.patch.object(mod, "time", mock.Mock(monotonic=tick)), \
                mock.patch.object(mod, "_signal_leftover", side_effect=lambda: flags.append(1)), \
                contextlib.redirect_stdout(out):
            clock["t"] = 0.0
            mod.main()
        return store, flags, out.getvalue()


class WriteFailureAndProgress(_Scenario, unittest.TestCase):
    CASES = ((pcr, _chart, "CHART_ROW_TIMEOUT_S"), (ptr, _tele, "TELEMETRY_ROW_TIMEOUT_S"))

    def test_patch_raises_on_http_error(self):
        for mod, _, _ in self.CASES:
            bad = mock.Mock()
            bad.raise_for_status.side_effect = RuntimeError("403")
            with mock.patch.dict("os.environ", {"SUPABASE_URL": "http://sb.test",
                                                "SUPABASE_SERVICE_ROLE_KEY": "k"}), \
                    mock.patch.object(mod.rq, "patch", return_value=bad):
                with self.assertRaises(RuntimeError):
                    mod._patch("id1", {"status": "done"})

    def test_persistent_write_failure_sets_no_flag_and_is_reported(self):
        for mod, row, env in self.CASES:
            rows = [row(i) for i in range(5)]
            # GETs work, every PATCH fails; the clock runs out after the first row
            store, flags, out = self._drive(mod, rows, env, ticks=iter([0, 0, 95, 95, 95, 95, 95]),
                                            patch_fails=True)
            self.assertEqual(flags, [], mod.__name__)
            self.assertIn("status write failed", out)
            self.assertIn("ERROR", out)  # the one summary line
            self.assertIn("not requesting a continuation run", out)

    def test_progress_with_leftovers_sets_flag(self):
        for mod, row, env in self.CASES:
            rows = [row(i) for i in range(5)]
            # budget 100, timeout 30: starts at t=0 and t=60, then 60+... stop at t=80 (110 > 100)
            store, flags, out = self._drive(mod, rows, env, ticks=iter([0, 0, 60, 80, 80, 80, 80]))
            self.assertEqual(flags, [1], mod.__name__)
            self.assertEqual(sum(1 for v in store.values() if v == "done"), 2)

    def test_everything_drained_sets_no_flag(self):
        for mod, row, env in self.CASES:
            store, flags, _ = self._drive(mod, [row(0), row(1)], env)
            self.assertEqual(flags, [])
            self.assertEqual(set(store.values()), {"done"})


class WriteFailuresOutput(_Scenario, unittest.TestCase):
    """`write_failures=<N>` is always written to $GITHUB_OUTPUT (0 included)."""

    def _output(self, mod, row, env, patch_fails):
        import os
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "out")
            with mock.patch.dict("os.environ", {"GITHUB_OUTPUT": path}):
                self._drive(mod, [row(0), row(1)], env, patch_fails=patch_fails)
            with open(path) as f:
                return f.read().splitlines()

    def test_zero_is_written_when_all_writes_succeed(self):
        for mod, row, env in WriteFailureAndProgress.CASES:
            self.assertIn("write_failures=0", self._output(mod, row, env, False), mod.__name__)

    def test_count_is_written_when_writes_fail(self):
        for mod, row, env in WriteFailureAndProgress.CASES:
            lines = self._output(mod, row, env, True)
            self.assertIn("write_failures=2", lines, mod.__name__)  # one failed claim per row
            self.assertNotIn("leftover=true", lines)

    def test_zero_is_written_when_queue_is_empty(self):
        for mod, row, env in WriteFailureAndProgress.CASES:
            import os
            import tempfile
            with tempfile.TemporaryDirectory() as d:
                path = os.path.join(d, "out")
                with mock.patch.dict("os.environ", {"GITHUB_OUTPUT": path}):
                    self._drive(mod, [], env)
                with open(path) as f:
                    self.assertIn("write_failures=0", f.read().splitlines())


class ContinuationTerminates(_Scenario, unittest.TestCase):
    """Rows that always time out end `error`, so chained continuation runs reach an empty queue."""

    def _chain(self, mod, row, env):
        store = {}
        rows = [row(i) for i in range(7)]
        runs = 0
        while True:
            runs += 1
            self.assertLess(runs, 10, "continuation chain did not terminate")
            _, flags, _ = self._drive(mod, rows, env, run_exc=True, store=store)
            if not flags:
                break
        self.assertEqual(set(store.values()), {"error"})
        self.assertEqual(len(store), 7)
        self.assertGreater(runs, 1)  # the budget really did split the work across runs

    def test_chart_chain_terminates(self):
        self._chain(pcr, _chart, "CHART_ROW_TIMEOUT_S")

    def test_telemetry_chain_terminates(self):
        self._chain(ptr, _tele, "TELEMETRY_ROW_TIMEOUT_S")


if __name__ == "__main__":
    unittest.main()
