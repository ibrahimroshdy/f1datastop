import subprocess
import unittest
from unittest import mock

from _helpers import ANALYSIS  # noqa: F401

import process_chart_requests as pcr


class Describe(unittest.TestCase):
    def test_exit_2_is_not_available_yet(self):
        e = subprocess.CalledProcessError(2, ["python", "generate.py"])
        self.assertEqual(pcr.describe_generate_failure(e),
                         "session data not available yet — retry later")

    def test_other_codes_concise(self):
        msg = pcr.describe_generate_failure(subprocess.CalledProcessError(1, ["python", "x"]))
        self.assertIn("exit 1", msg)
        self.assertNotIn("Command", msg)


class MainStoresMessage(unittest.TestCase):
    def _run_main(self, returncode):
        req = {"id": "r1", "season": 2026, "round": 5, "session": "R", "chart": "race_analysis",
               "format": "landscape", "theme": "dark", "drivers": []}
        resp = mock.Mock()
        resp.json.return_value = [req]
        patches = []
        with mock.patch.object(pcr, "_base", return_value="http://sb.test"), \
                mock.patch.object(pcr, "_headers", return_value={}), \
                mock.patch.object(pcr, "_limit", return_value=5), \
                mock.patch.object(pcr, "_reset_stale", return_value=0), \
                mock.patch.object(pcr, "_chart_keys", return_value={"race_analysis"}), \
                mock.patch.object(pcr.rq, "get", return_value=resp), \
                mock.patch.object(pcr, "_patch", side_effect=lambda rid, body: patches.append(body)), \
                mock.patch.object(pcr, "_run", side_effect=subprocess.CalledProcessError(
                    returncode, ["python", "generate.py"])):
            pcr.main()
        return patches

    def test_exit_2_stored(self):
        patches = self._run_main(2)
        self.assertEqual(patches[-1]["status"], "error")
        self.assertEqual(patches[-1]["error"], "session data not available yet — retry later")

    def test_exit_1_stored_without_raw_command_text(self):
        err = self._run_main(1)[-1]["error"]
        self.assertNotIn("Command", err)
        self.assertIn("exit 1", err)


if __name__ == "__main__":
    unittest.main()
