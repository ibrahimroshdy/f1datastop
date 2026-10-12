"""check_schedules.py: the digest backup schedule is the one allowed exception."""
import importlib.util
import unittest
from pathlib import Path

import yaml  # in analysis/requirements.txt; a missing PyYAML must fail, never skip, these tests

SCRIPT = Path(__file__).resolve().parents[2] / ".github" / "scripts" / "check_schedules.py"


def load():
    spec = importlib.util.spec_from_file_location("check_schedules", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


PIPELINE_OK = """
on:
  schedule:
    - cron: '41 7 * * *'
  workflow_dispatch:
jobs:
  reconcile:
    if: inputs.job == 'all' || inputs.job == 'reconcile'
  digest:
    if: >-
      inputs.job == 'digest' || github.event.schedule == '41 7 * * *'
"""


class BackupScheduleException(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.m = load()

    def errors(self, name, text):
        return self.m.schedule_errors(name, text, yaml.safe_load(text))

    def test_exact_backup_is_accepted(self):
        self.assertEqual(self.errors("pipeline.yml", PIPELINE_OK), [])

    def test_wrong_cron_rejected(self):
        bad = PIPELINE_OK.replace("41 7 * * *", "42 7 * * *", 1)
        self.assertTrue(self.errors("pipeline.yml", bad))

    def test_second_schedule_rejected(self):
        bad = PIPELINE_OK.replace("  workflow_dispatch:", "    - cron: '0 * * * *'\n  workflow_dispatch:")
        self.assertTrue(any("exactly one cron" in e for e in self.errors("pipeline.yml", bad)))

    def test_missing_condition_rejected(self):
        bad = PIPELINE_OK.replace(" || github.event.schedule == '41 7 * * *'", "")
        self.assertTrue(any("must contain" in e for e in self.errors("pipeline.yml", bad)))

    def test_extra_schedule_literal_rejected(self):
        bad = PIPELINE_OK.replace("inputs.job == 'all'", "github.event.schedule == 'x'")
        self.assertTrue(any("exactly once" in e for e in self.errors("pipeline.yml", bad)))

    def test_any_other_workflow_schedule_rejected(self):
        text = "on:\n  schedule:\n    - cron: '41 7 * * *'\n  workflow_dispatch:\njobs: {}\n"
        self.assertTrue(any("schedule:" in e for e in self.errors("queue.yml", text)))

    def test_other_workflow_literal_rejected(self):
        text = "on:\n  workflow_dispatch:\njobs:\n  a:\n    if: github.event.schedule == '41 7 * * *'\n"
        self.assertTrue(any("github.event.schedule" in e for e in self.errors("queue.yml", text)))

    def test_pipeline_without_schedule_rejected(self):
        text = PIPELINE_OK.replace("  schedule:\n    - cron: '41 7 * * *'\n", "")
        self.assertTrue(self.errors("pipeline.yml", text))

    def test_queue_if_needed_entry_parses(self):
        sql = ("SELECT cron.schedule('f1ds-queue', '*/5 * * * *',\n"
               "  $cron$SELECT public.f1_dispatch_queue_if_needed()$cron$);")
        self.assertEqual(self.m.migration_entries(sql), {"f1ds-queue": ("*/5 * * * *", "queue.yml", {})})

    def test_queue_if_needed_on_another_job_is_not_documented(self):
        sql = ("SELECT cron.schedule('f1ds-digest', '17 7 * * *',\n"
               "  $cron$SELECT public.f1_dispatch_queue_if_needed()$cron$);")
        self.assertNotEqual(self.m.migration_entries(sql)["f1ds-digest"], self.m.EXPECTED["f1ds-digest"])


if __name__ == "__main__":
    unittest.main()
