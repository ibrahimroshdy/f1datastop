"""ingest.py / ff1_ingest.py guards: junk 'nan' driver ids and post-race result re-verification.
No network, no database: Jolpica and Supabase are mocked."""
import unittest
from unittest import mock

from _helpers import ANALYSIS  # noqa: F401 — sets sys.path

try:
    import ff1_ingest
    import ingest
except ImportError as e:  # pragma: no cover — heavy deps (requests/fastf1) not installed
    raise unittest.SkipTest(f"ingest deps not installed: {e}")


class FakeResults:
    def __init__(self, rows):
        self._rows = rows

    def iterrows(self):
        return iter(enumerate(self._rows))


class FakeSession:
    def __init__(self, rows):
        self.results = FakeResults(rows)


class CleanId(unittest.TestCase):
    def test_junk_values_become_none(self):
        for v in (None, float("nan"), "", "  ", "nan", "NaN", "None", "null"):
            self.assertIsNone(ff1_ingest._clean_id(v), repr(v))

    def test_real_ids_pass_through_stripped(self):
        self.assertEqual(ff1_ingest._clean_id(" bearman "), "bearman")
        self.assertEqual(ff1_ingest._clean_id("max_verstappen"), "max_verstappen")


class AbbrToId(unittest.TestCase):
    def test_nan_driver_id_is_never_mapped(self):
        sess = FakeSession([
            {"Abbreviation": "BEA", "DriverId": float("nan")},
            {"Abbreviation": "HAM", "DriverId": "hamilton"},
            {"Abbreviation": "STR", "DriverId": "nan"},
            {"Abbreviation": float("nan"), "DriverId": "ghost"},
        ])
        with mock.patch.object(ff1_ingest, "_db_abbr_to_id",
                               return_value={"BEA": "bearman", "STR": "stroll"}):
            out = ff1_ingest._abbr_to_id(sess, 2026)
        self.assertEqual(out, {"HAM": "hamilton", "BEA": "bearman", "STR": "stroll"})
        self.assertNotIn("nan", out.values())

    def test_unresolvable_abbreviation_is_skipped_not_nan(self):
        sess = FakeSession([{"Abbreviation": "XXX", "DriverId": float("nan")}])
        with mock.patch.object(ff1_ingest, "_db_abbr_to_id", return_value={}):
            self.assertEqual(ff1_ingest._abbr_to_id(sess, 2026), {})

    def test_db_table_junk_ids_are_ignored(self):
        with mock.patch.object(ff1_ingest.bf, "supa_select",
                               return_value=[{"code": "BEA", "ergast_id": "nan"},
                                             {"code": "HAM", "ergast_id": "hamilton"}]):
            ff1_ingest._DB_ABBR_CACHE.pop(2099, None)
            self.assertEqual(ff1_ingest._db_abbr_to_id(2099), {"HAM": "hamilton"})
            ff1_ingest._DB_ABBR_CACHE.pop(2099, None)

    def test_ingest_wrapper_and_s_guard(self):
        sess = FakeSession([{"Abbreviation": "BEA", "DriverId": "nan"}])
        with mock.patch.object(ff1_ingest, "_db_abbr_to_id", return_value={"BEA": "bearman"}):
            self.assertEqual(ingest._abbr_map(sess, 2026), {"BEA": "bearman"})
        self.assertIsNone(ingest._s("nan"))
        self.assertIsNone(ingest._s(float("nan")))
        self.assertEqual(ingest._s(" Finished "), "Finished")


def jolpica_doc(results):
    return {"MRData": {"RaceTable": {"Races": [{"Results": [
        {"Driver": {"driverId": d}, "Constructor": {"constructorId": c},
         "position": str(p), "points": str(pts)} for d, c, p, pts in results]}]}}}


DB_ROWS = [
    {"driver_id": "a", "constructor_id": "x", "position": 1, "points": "25.0"},
    {"driver_id": "b", "constructor_id": "y", "position": 2, "points": "18.0"},
]


class ResultsDiverge(unittest.TestCase):
    def check(self, fetch, rows=DB_ROWS):
        with mock.patch.object(ingest.bf, "jolpica_fetch", return_value=fetch), \
                mock.patch.object(ingest.bf, "supa_select", return_value=rows):
            return ingest._results_diverge(2026, 6)

    def test_same_results_do_not_diverge(self):
        self.assertIs(self.check((jolpica_doc([("a", "x", 1, 25), ("b", "y", 2, 18)]), "ok")), False)

    def test_penalty_reorder_diverges(self):
        self.assertIs(self.check((jolpica_doc([("b", "y", 1, 25), ("a", "x", 2, 18)]), "ok")), True)

    def test_missing_driver_diverges(self):
        self.assertIs(self.check((jolpica_doc([("a", "x", 1, 25)]), "ok")), True)

    def test_unavailable_absent_or_empty_is_unverifiable_not_a_mismatch(self):
        self.assertIsNone(self.check((None, "unavailable")))   # 5xx / timeout / 429
        self.assertIsNone(self.check((None, "absent")))        # 404
        self.assertIsNone(self.check(({"MRData": {"RaceTable": {"Races": []}}}, "ok")))
        self.assertIsNone(self.check(({"garbage": 1}, "ok")))


def raw_obj(driver, cons, pos, pts):
    return {"position": str(pos), "points": str(pts),
            "Driver": {"driverId": driver}, "Constructor": {"constructorId": cons}}


class ResultsDivergeServedRaw(unittest.TestCase):
    """The RPC serves COALESCE(raw, rebuilt): a stale raw is a divergence even when the
    structured columns already match Jolpica."""
    JOL = (jolpica_doc([("a", "x", 1, 25), ("b", "y", 2, 18)]), "ok")

    def check(self, raws):
        rows = [dict(r, raw=raws.get(r["driver_id"])) for r in DB_ROWS]
        with mock.patch.object(ingest.bf, "jolpica_fetch", return_value=self.JOL), \
                mock.patch.object(ingest.bf, "supa_select", return_value=rows):
            return ingest._results_diverge(2026, 6)

    def test_stale_raw_behind_correct_columns_diverges(self):
        self.assertIs(self.check({"a": raw_obj("a", "x", 3, 15)}), True)

    def test_stale_raw_points_only_diverges(self):
        self.assertIs(self.check({"b": raw_obj("b", "y", 2, 12)}), True)

    def test_consistent_raw_or_null_raw_does_not_diverge(self):
        self.assertIs(self.check({"a": raw_obj("a", "x", 1, 25)}), False)
        self.assertIs(self.check({}), False)


class IngestResultsClearsRaw(unittest.TestCase):
    def test_fastf1_rows_write_raw_null_so_a_stale_raw_cannot_survive_the_merge(self):
        sess = FakeSession([{"DriverId": "a", "Abbreviation": "AAA", "TeamId": "x",
                             "DriverNumber": "1", "Position": 1, "Points": 25, "Status": "Finished",
                             "ClassifiedPosition": "1", "Laps": 50, "Time": None, "GridPosition": 1}])
        for code, table in (("R", "f1_race_result"), ("S", "f1_sprint_result"),
                            ("Q", "f1_qualifying_result")):
            with mock.patch.object(ingest.bf, "race_id_for", return_value=7), \
                    mock.patch.object(ingest, "_fastest_laps", return_value={}), \
                    mock.patch.object(ingest, "_abbr_map", return_value={}), \
                    mock.patch.object(ingest, "_team_map", return_value={}), \
                    mock.patch.object(ingest, "_laps_completed", return_value={}), \
                    mock.patch.object(ingest, "_grid_positions", return_value={}), \
                    mock.patch.object(ingest, "_augment_grid_from_ergast", side_effect=lambda r, *a: r), \
                    mock.patch.object(ingest, "_augment_qualifying_from_ergast", side_effect=lambda r, *a: r), \
                    mock.patch.object(ingest.bf, "supa_upsert", return_value=1) as up:
                ingest.ingest_results(sess, 2026, 6, code)
            tbl, rows, _ = up.call_args[0]
            self.assertEqual(tbl, table)
            self.assertTrue(all("raw" in r and r["raw"] is None for r in rows), code)


class IngestRoundRecheck(unittest.TestCase):
    def run_round(self, diverge, recent=True, done=True):
        loads = []

        def fake_load(*a, **k):
            loads.append(a)
            raise RuntimeError("stop")   # ingest_round logs 'load failed' and moves on

        with mock.patch.object(ingest, "FORCE", False), \
                mock.patch.object(ingest, "_cache"), \
                mock.patch.object(ingest, "_round_done", return_value=done), \
                mock.patch.object(ingest, "_recently_completed", return_value=recent), \
                mock.patch.object(ingest, "_results_diverge", return_value=diverge), \
                mock.patch.object(ingest, "_round_has_happened", return_value=True), \
                mock.patch.object(ingest, "sessions_for_round", return_value=["R"]), \
                mock.patch.object(ingest, "_reverify_after_reingest"), \
                mock.patch.object(ingest, "_recheck_pitstops"), \
                mock.patch.object(ingest, "_load", side_effect=fake_load):
            ingest.ingest_round(2026, 6)
        return loads

    def test_divergence_forces_reingest_of_done_round(self):
        self.assertEqual(len(self.run_round(diverge=True)), 1)

    def test_no_divergence_skips(self):
        self.assertEqual(self.run_round(diverge=False), [])

    def test_unverifiable_skips(self):
        self.assertEqual(self.run_round(diverge=None), [])

    def test_old_round_is_not_rechecked(self):
        with mock.patch.object(ingest.bf, "jolpica_fetch") as fetch:
            self.assertEqual(self.run_round(diverge=True, recent=False), [])
            fetch.assert_not_called()

    def test_verification_error_never_breaks_the_run(self):
        with mock.patch.object(ingest, "_recently_completed", return_value=True), \
                mock.patch.object(ingest, "_results_diverge", side_effect=RuntimeError("boom")):
            self.assertFalse(ingest._needs_penalty_recheck(2026, 6))


class ReverifyAfterReingest(unittest.TestCase):
    def setUp(self):
        ingest.RESULT_DIVERGENCE.clear()
        self.addCleanup(ingest.RESULT_DIVERGENCE.clear)

    def run_reverify(self, diverge_seq):
        with mock.patch.object(ingest, "_results_diverge", side_effect=diverge_seq), \
                mock.patch.object(ingest, "_overwrite_results_from_jolpica") as overwrite:
            ingest._reverify_after_reingest(2026, 6)
        return overwrite

    def test_converged_after_reingest_does_not_overwrite(self):
        self.run_reverify([False]).assert_not_called()
        self.assertEqual(ingest.RESULT_DIVERGENCE, {})

    def test_unverifiable_does_not_overwrite(self):
        self.run_reverify([None]).assert_not_called()

    def test_diverges_before_overwrite_calls_jolpica_overwrite_and_clears(self):
        self.run_reverify([True, False]).assert_called_once_with(2026, 6)
        self.assertEqual(ingest.RESULT_DIVERGENCE, {})

    def test_still_diverges_after_overwrite_is_recorded(self):
        self.run_reverify([True, True]).assert_called_once_with(2026, 6)
        self.assertIn((2026, 6), ingest.RESULT_DIVERGENCE)

    def test_errors_are_recorded_not_raised(self):
        self.run_reverify(RuntimeError("boom"))
        self.assertIn((2026, 6), ingest.RESULT_DIVERGENCE)

    def test_main_exits_nonzero_for_recorded_divergence(self):
        ingest.RESULT_DIVERGENCE[(2026, 6)] = "x"
        with mock.patch("sys.argv", ["ingest.py", "--season", "2026", "--no-standings"]), \
                mock.patch.object(ingest.bf, "_env"), \
                mock.patch.object(ingest, "ingest_schedule", return_value={}):
            with self.assertRaises(SystemExit) as cm:
                ingest.main()
        self.assertIn("RESULT DIVERGENCE", str(cm.exception))


class OverwriteFromJolpica(unittest.TestCase):
    def test_upserts_jolpica_rows_and_deletes_unlisted_drivers(self):
        doc = jolpica_doc([("a", "x", 1, 25), ("b", "y", 2, 18)])
        deletes = []
        with mock.patch.object(ingest.bf, "jolpica_fetch", return_value=(doc, "ok")), \
                mock.patch.object(ingest.bf, "race_id_for", return_value=7), \
                mock.patch.object(ingest.bf, "_upsert_driver"), \
                mock.patch.object(ingest.bf, "_upsert_constructor"), \
                mock.patch.object(ingest.bf, "supa_upsert", return_value=2) as up, \
                mock.patch.object(ingest.bf, "supa_select",
                                  return_value=[{"driver_id": "a"}, {"driver_id": "b"},
                                                {"driver_id": "ghost"}]), \
                mock.patch.object(ingest, "_delete_rows",
                                  side_effect=lambda t, **kw: deletes.append((t, kw))):
            n = ingest._overwrite_results_from_jolpica(2026, 6)
        self.assertEqual(n, 2)
        table, rows, key = up.call_args[0]
        self.assertEqual((table, key), ("f1_race_result", "season,round,driver_id"))
        self.assertEqual([(r["driver_id"], r["position"], r["points"], r["provisional"])
                          for r in rows], [("a", 1, 25.0, False), ("b", 2, 18.0, False)])
        self.assertEqual([t for t, _ in deletes], ["f1_race_result", "f1_driver_standing"])
        self.assertEqual(deletes[0][1]["driver_id"], "in.(ghost)")

    def test_unreadable_jolpica_writes_nothing(self):
        with mock.patch.object(ingest.bf, "jolpica_fetch", return_value=(None, "unavailable")), \
                mock.patch.object(ingest.bf, "supa_upsert") as up:
            self.assertIsNone(ingest._overwrite_results_from_jolpica(2026, 6))
        up.assert_not_called()

    def test_empty_results_list_writes_and_deletes_nothing(self):
        doc = {"MRData": {"RaceTable": {"Races": [{"Results": []}]}}}
        with mock.patch.object(ingest.bf, "jolpica_fetch", return_value=(doc, "ok")), \
                mock.patch.object(ingest.bf, "supa_upsert") as up, \
                mock.patch.object(ingest, "_delete_rows") as dele:
            self.assertIsNone(ingest._overwrite_results_from_jolpica(2026, 6))
        up.assert_not_called()
        dele.assert_not_called()

    def test_overwritten_rows_carry_the_override_source(self):
        doc = jolpica_doc([("a", "x", 1, 25)])
        with mock.patch.object(ingest.bf, "jolpica_fetch", return_value=(doc, "ok")), \
                mock.patch.object(ingest.bf, "race_id_for", return_value=7), \
                mock.patch.object(ingest.bf, "_upsert_driver"), \
                mock.patch.object(ingest.bf, "_upsert_constructor"), \
                mock.patch.object(ingest.bf, "supa_upsert", return_value=1) as up, \
                mock.patch.object(ingest.bf, "supa_select", return_value=[{"driver_id": "a"}]):
            ingest._overwrite_results_from_jolpica(2026, 6)
        self.assertEqual({r["source"] for r in up.call_args[0][1]}, {"jolpica_override"})


class RoundDoneSources(unittest.TestCase):
    def done(self, source):
        rows = [{"driver_id": str(i), "provisional": False, "grid": i + 1, "source": source}
                for i in range(6)]
        def select(table, *a, **k):   # qualifying has real positions; only results vary
            return rows if table == "f1_race_result" else [{"position": 1}]

        with mock.patch.object(ingest.bf, "supa_select", side_effect=select):
            return ingest._round_done(2026, 6)

    def test_backfill_only_ergast_rows_are_not_done(self):
        self.assertFalse(self.done("ergast"))

    def test_fastf1_rows_are_done(self):
        self.assertTrue(self.done("fastf1"))

    def test_overwritten_rows_are_done(self):
        self.assertTrue(self.done("jolpica_override"))


class ReverifyDryRun(unittest.TestCase):
    def test_dry_run_reports_but_does_not_record_or_fail(self):
        ingest.RESULT_DIVERGENCE.clear()
        self.addCleanup(ingest.RESULT_DIVERGENCE.clear)
        with mock.patch.object(ingest.bf, "DRY_RUN", True), \
                mock.patch.object(ingest, "_results_diverge", return_value=True), \
                mock.patch.object(ingest, "_overwrite_results_from_jolpica") as ow:
            ingest._reverify_after_reingest(2026, 6)
        ow.assert_called_once_with(2026, 6)
        self.assertEqual(ingest.RESULT_DIVERGENCE, {})


class FreshCacheCleanup(unittest.TestCase):
    def run_round(self, load_side_effect=None):
        import os
        import tempfile
        tmp = tempfile.mkdtemp(prefix="fastf1-fresh-test-")
        self.addCleanup(lambda: os.path.isdir(tmp) and os.rmdir(tmp))
        with mock.patch.object(ingest, "FORCE", False), \
                mock.patch.object(ingest, "_cache", return_value=tmp), \
                mock.patch.object(ingest, "_round_done", return_value=True), \
                mock.patch.object(ingest, "_needs_penalty_recheck", return_value=True), \
                mock.patch.object(ingest, "_ingest_round_sessions",
                                  side_effect=load_side_effect, return_value=True), \
                mock.patch.object(ingest, "_reverify_after_reingest"):
            try:
                ingest.ingest_round(2026, 6)
            except RuntimeError:
                pass
        return tmp

    def test_temp_cache_removed_after_forced_reingest(self):
        import os
        self.assertFalse(os.path.exists(self.run_round()))

    def test_temp_cache_removed_even_when_ingest_raises(self):
        import os
        self.assertFalse(os.path.exists(self.run_round(RuntimeError("boom"))))


if __name__ == "__main__":
    unittest.main()


def _pit_doc(stops):
    return {"MRData": {"total": str(len(stops)), "RaceTable": {"Races": [{"PitStops": stops}]}}}


class PitStopsFromJolpica(unittest.TestCase):
    """BUG-001: FastF1-derived pit stops must be replaced by Jolpica's official list."""
    JOL = [{"driverId": "antonelli", "stop": "2", "lap": "39", "time": "t", "duration": "23.591"},
           {"driverId": "stroll", "stop": "1", "lap": "26", "time": "t", "duration": "23.601"},
           {"driverId": "russell", "stop": "1", "lap": "39", "time": "t", "duration": "23.648"}]
    WH = [{"driver_id": "russell", "stop": 1, "lap": 39, "duration_seconds": 23.613},
          {"driver_id": "antonelli", "stop": 2, "lap": 39, "duration_seconds": 23.646},
          {"driver_id": "stroll", "stop": 1, "lap": 26, "duration_seconds": 23.695},
          {"driver_id": "stroll", "stop": 2, "lap": 50, "duration_seconds": 30.0}]

    def patches(self, wh=None):
        return (mock.patch.object(ingest.bf, "jolpica_fetch", return_value=(_pit_doc(self.JOL), "ok")),
                mock.patch.object(ingest.bf, "race_id_for", return_value=1),
                mock.patch.object(ingest.bf, "supa_select", return_value=self.WH if wh is None else wh))

    def test_stale_fastf1_rows_diverge(self):
        a, b, c = self.patches()
        with a, b, c:
            self.assertTrue(ingest._pitstops_diverge(2026, 17))

    def test_matching_rows_do_not_diverge(self):
        same = [{"driver_id": r["driverId"], "stop": int(r["stop"]), "lap": int(r["lap"]),
                 "duration_seconds": float(r["duration"])} for r in self.JOL]
        a, b, c = self.patches(same)
        with a, b, c:
            self.assertFalse(ingest._pitstops_diverge(2026, 17))

    def test_unavailable_is_unverifiable(self):
        with mock.patch.object(ingest.bf, "jolpica_fetch", return_value=(None, "unavailable")), \
                mock.patch.object(ingest.bf, "race_id_for", return_value=1):
            self.assertIsNone(ingest._pitstops_diverge(2026, 17))
            self.assertIsNone(ingest._overwrite_pitstops_from_jolpica(2026, 17))

    def test_overwrite_upserts_jolpica_and_deletes_extra_stop(self):
        a, b, c = self.patches()
        with a, b, c, mock.patch.object(ingest.bf, "supa_upsert", return_value=3) as up, \
                mock.patch.object(ingest, "_delete_rows") as dele:
            self.assertEqual(ingest._overwrite_pitstops_from_jolpica(2026, 17), 3)
        rows = up.call_args[0][1]
        self.assertEqual({(r["driver_id"], r["duration_seconds"]) for r in rows},
                         {("antonelli", 23.591), ("stroll", 23.601), ("russell", 23.648)})
        self.assertTrue(all(r["source"] == "ergast" for r in rows))
        dele.assert_called_once()
        self.assertEqual(dele.call_args.kwargs["driver_id"], "eq.stroll")
        self.assertEqual(dele.call_args.kwargs["stop"], "eq.2")

    def test_recheck_never_raises(self):
        with mock.patch.object(ingest, "_recently_completed", return_value=True), \
                mock.patch.object(ingest, "_pitstops_diverge", side_effect=RuntimeError("x")):
            ingest._recheck_pitstops(2026, 17)
