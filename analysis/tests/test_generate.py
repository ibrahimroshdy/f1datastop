import unittest
from unittest import mock

from _helpers import import_generate

g = import_generate()
import requests  # noqa: E402


def http_error(status):
    resp = requests.Response()
    resp.status_code = status
    return requests.HTTPError(f"HTTP {status}", response=resp)


def fake_response(status, content=b""):
    r = requests.Response()
    r.status_code = status
    r._content = content
    return r


class Classification(unittest.TestCase):
    def test_transient(self):
        self.assertTrue(g.is_transient(http_error(503)))
        self.assertTrue(g.is_transient(http_error(429)))
        self.assertTrue(g.is_transient(requests.ConnectionError("x")))
        self.assertTrue(g.is_transient(requests.Timeout("x")))

    def test_not_transient(self):
        self.assertFalse(g.is_transient(http_error(404)))
        self.assertFalse(g.is_transient(http_error(403)))
        self.assertFalse(g.is_transient(ValueError("nope")))

    def test_wrapped_cause_is_seen(self):
        try:
            try:
                raise requests.ConnectionError("down")
            except Exception as inner:
                raise RuntimeError("wrapped") from inner
        except RuntimeError as e:
            self.assertTrue(g.is_transient(e))

    def test_absent(self):
        class DataNotLoadedError(Exception):
            pass
        self.assertTrue(g.is_absent(http_error(404)))
        self.assertTrue(g.is_absent(DataNotLoadedError("x")))
        self.assertTrue(g.is_absent(ValueError("Session type 'S' does not exist for this event")))
        self.assertFalse(g.is_absent(http_error(503)))
        self.assertFalse(g.is_absent(ValueError("boom")))


class RetryDecorator(unittest.TestCase):
    def _run(self, exc, **kw):
        calls = []
        kw.setdefault("base_delay", 0.01)

        @g.retry_with_backoff(**kw)
        def fn():
            calls.append(1)
            raise exc

        with mock.patch.object(g.time, "sleep") as sl:
            with self.assertRaises(type(exc)):
                fn()
        return len(calls), sl.call_count

    def test_404_not_retried(self):
        self.assertEqual(self._run(http_error(404)), (1, 0))

    def test_503_retried(self):
        self.assertEqual(self._run(http_error(503), max_retries=3), (4, 3))

    def test_non_transient_not_retried(self):
        self.assertEqual(self._run(ValueError("x")), (1, 0))

    def test_total_budget_bounds_retries(self):
        calls, sleeps = self._run(http_error(503), max_retries=10, base_delay=5.0,
                                  max_total=6.0, jitter=0.0)
        self.assertLess(calls, 11)
        self.assertLessEqual(sleeps, 1)

    def test_succeeds_after_transient(self):
        seq = [http_error(503), "ok"]

        @g.retry_with_backoff(base_delay=0.01)
        def fn():
            v = seq.pop(0)
            if isinstance(v, Exception):
                raise v
            return v

        with mock.patch.object(g.time, "sleep"):
            self.assertEqual(fn(), "ok")


class FetcherCaching(unittest.TestCase):
    def setUp(self):
        g._HEADSHOT_CACHE.clear()
        g._FLAG_CACHE.clear()
        patcher = mock.patch.object(g.time, "sleep")
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_transient_failure_is_retried_and_not_cached(self):
        with mock.patch.object(g.requests, "get", return_value=fake_response(503)) as get:
            self.assertIsNone(g.fetch_headshot("http://x/h.png"))
            self.assertGreater(get.call_count, 1)  # the retry actually fired
        self.assertNotIn("http://x/h.png", g._HEADSHOT_CACHE)

    def test_404_cached_and_not_retried(self):
        with mock.patch.object(g.requests, "get", return_value=fake_response(404)) as get:
            self.assertIsNone(g.fetch_headshot("http://x/h.png"))
            self.assertIsNone(g.fetch_headshot("http://x/h.png"))
            self.assertEqual(get.call_count, 1)
        self.assertIn("http://x/h.png", g._HEADSHOT_CACHE)

    def test_success_cached(self):
        from io import BytesIO
        from PIL import Image
        buf = BytesIO()
        Image.new("RGBA", (40, 40), (255, 0, 0, 255)).save(buf, "PNG")
        with mock.patch.object(g.requests, "get",
                               return_value=fake_response(200, buf.getvalue())) as get:
            a = g.fetch_headshot("http://x/ok.png")
            b = g.fetch_headshot("http://x/ok.png")
        self.assertIsNotNone(a)
        self.assertIs(a, b)
        self.assertEqual(get.call_count, 1)


class WarehouseCalls(unittest.TestCase):
    def setUp(self):
        patcher = mock.patch.object(g.time, "sleep")
        patcher.start()
        self.addCleanup(patcher.stop)
        env = mock.patch.dict(g.os.environ, {"SUPABASE_URL": "http://sb.test",
                                             "SUPABASE_SERVICE_ROLE_KEY": "k"})
        env.start()
        self.addCleanup(env.stop)

    def test_transient_is_retried_then_raised(self):
        with mock.patch.object(g.requests, "request", return_value=fake_response(503)) as rq:
            with self.assertRaises(requests.HTTPError):
                g._wh_driver_standings(2026, 3)
            self.assertGreater(rq.call_count, 1)

    def test_recovers_after_transient(self):
        ok = fake_response(200, b"[1,2]")
        with mock.patch.object(g.requests, "request", side_effect=[fake_response(502), ok]):
            self.assertEqual(g._wh_driver_standings(2026, 3), [1, 2])

    def test_unconfigured_returns_none(self):
        with mock.patch.dict(g.os.environ, {}, clear=True):
            self.assertIsNone(g._wh_driver_standings(2026, 3))


class ExitCodes(unittest.TestCase):
    def test_selection(self):
        self.assertEqual(g.select_exit_code([], 0, 5), 0)
        self.assertEqual(g.select_exit_code([], 0, 0), 0)          # nothing to do
        self.assertEqual(g.select_exit_code(["x"], 0, 5), 1)       # any failure wins
        self.assertEqual(g.select_exit_code(["x"], 3, 0), 1)
        self.assertEqual(g.select_exit_code([], 4, 0), 2)          # only absence
        self.assertEqual(g.select_exit_code([], 2, 3), 0)          # some rendered


if __name__ == "__main__":
    unittest.main()


class ChampionshipSprintPoints(unittest.TestCase):
    """BUG-002: the progression line must include sprint points (table does)."""
    def test_sprint_points_are_folded_in(self):
        ser = [(1, 25.0), (2, 43.0), (3, 43.0)]
        self.assertEqual(g._add_sprint_points(ser, {2: 8.0, 3: 5.0}),
                         [(1, 25.0), (2, 51.0), (3, 56.0)])

    def test_no_sprints_is_identity(self):
        ser = [(1, 25.0)]
        self.assertEqual(g._add_sprint_points(ser, {}), ser)

    def test_line_ends_on_table_value_singapore(self):
        # Antonelli 2026: 309 race points + 31 sprint points = 340 (the standings value)
        ser = [(16, 300.0), (17, 309.0)]
        sprint = {2: 4.0, 4: 3.0, 5: 6.0, 9: 8.0, 12: 5.0, 17: 5.0}
        self.assertEqual(g._add_sprint_points(ser, sprint)[-1], (17, 340.0))

class StandingsChartsCache(unittest.TestCase):
    """BUG-003: re-rendered standings charts must not be cached as immutable."""
    def test_standings_charts_get_short_cache(self):
        with mock.patch.object(g.bs, "put", return_value="u") as put:
            g.upload_png("2026/17-X/R/landscape/championship.png", b"x")
            g.upload_png("2026/17-X/R/landscape/constructors.thumb.webp", b"x")
            g.upload_png("2026/17-X/R/landscape/places_gained.png", b"x")
        kws = [c.kwargs.get("cache_control") for c in put.call_args_list]
        self.assertEqual(kws[:2], ["public, max-age=600"] * 2)
        self.assertIsNone(kws[2])
