"""The clock-robustness migration must carry every documented schedule (parsed as text, no database)."""
import json
import re
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
MIGRATION = REPO / "supabase" / "migrations" / "20261012140000_clock_robustness.sql"
CLOCK_MIGRATION = REPO / "supabase" / "migrations" / "20261012130000_pg_cron_clock.sql"

EXPECTED = {
    "f1ds-queue": ("*/5 * * * *", "queue.yml", {}),
    "f1ds-reconcile": ("7 */6 * * *", "pipeline.yml", {"job": "reconcile"}),
    "f1ds-reconcile-race": (
        "*/30 12,13,14,15,16,17,18,19,20,21 * * 5,6,0",
        "pipeline.yml",
        {"job": "reconcile", "gate": "true"},
    ),
    "f1ds-charts": ("15 */2 * * 5,6,0", "pipeline.yml", {"job": "charts"}),
    "f1ds-assets": ("25 6,12,18 * * 5,6,0", "pipeline.yml", {"job": "assets"}),
    "f1ds-digest": ("17 7 * * *", "pipeline.yml", {"job": "digest"}),
}

ENTRY = re.compile(
    r"cron\.schedule\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*\$cron\$\s*SELECT\s+public\."
    r"(?:f1_dispatch_workflow\(\s*'([^']+)'\s*(?:,\s*'(\{[^']*\})'\s*)?\)"
    r"|(f1_dispatch_queue_if_needed)\(\s*\))\s*\$cron\$\s*\)",
    re.IGNORECASE,
)


class PgCronMigrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Drop SQL comment lines: the header mentions cron.schedule().
        cls.text = re.sub(r"(?m)^\s*--.*$", "", MIGRATION.read_text())
        cls.entries = {
            name: (cron, "queue.yml" if if_needed else workflow, json.loads(raw) if raw else {})
            for name, cron, workflow, raw, if_needed in ENTRY.findall(cls.text)
        }

    def test_every_cron_schedule_call_is_parsed(self):
        self.assertEqual(self.text.lower().count("cron.schedule("), len(self.entries))

    def test_expected_jobs_present_and_exact(self):
        self.assertEqual(set(self.entries), set(EXPECTED))
        for name, expected in EXPECTED.items():
            self.assertEqual(self.entries[name], expected, name)

    def test_queue_job_uses_the_guarded_wrapper(self):
        self.assertIn("$cron$SELECT public.f1_dispatch_queue_if_needed()$cron$", self.text)

    def test_no_two_pipeline_jobs_share_a_start_minute_and_hour(self):
        # reconcile 7 */6, charts 15 */2, assets 25 6,12,18, race */30: minutes 7/15/25/0,30 never meet.
        minutes = [EXPECTED[n][0].split()[0] for n in ("f1ds-reconcile", "f1ds-charts", "f1ds-assets")]
        self.assertEqual(len(set(minutes)), 3)
        self.assertNotIn("0", minutes)
        self.assertNotIn("30", minutes)

    def test_job_names_are_prefixed(self):
        self.assertTrue(all(n.startswith("f1ds-") for n in self.entries))

    def test_functions_are_locked_down(self):
        self.assertEqual(self.text.count("SECURITY DEFINER"), 3)
        self.assertNotRegex(self.text, r"SET search_path\s*=\s*[^;\n]*\b(public|extensions)\b")
        # 3 function definitions + the 2 ALTERs for the request-trigger path
        self.assertEqual(self.text.count("SET search_path = pg_catalog, pg_temp"), 5)
        for fn in ("f1_dispatch_queue()", "f1_dispatch_queue_trg()"):
            self.assertIn(f"ALTER FUNCTION public.{fn} SET search_path = pg_catalog, pg_temp;", self.text)
        for sig in ("f1_dispatch_workflow(text, jsonb)", "f1_dispatch_queue_if_needed()", "f1_dispatch_health(int)"):
            self.assertIn(f"REVOKE ALL ON FUNCTION public.{sig} FROM PUBLIC, anon, authenticated;", self.text)
            self.assertIn(f"GRANT EXECUTE ON FUNCTION public.{sig} TO service_role;", self.text)

    def test_dispatcher_objects_are_schema_qualified(self):
        self.assertIn("vault.decrypted_secrets", self.text)
        self.assertIn("net.http_post(", self.text)
        self.assertNotRegex(self.text, r"(?<![.\w])http_post\(")
        self.assertNotRegex(self.text, r"FROM\s+decrypted_secrets")

    def test_queue_needs_work_rule(self):
        self.assertIn("status = 'pending'", self.text)
        self.assertIn("status = 'processing' AND updated_at < now() - interval '30 minutes'", self.text)
        self.assertIn("f1_chart_requests", self.text)
        self.assertIn("f1_telemetry_requests", self.text)

    def test_queue_trigger_wrapper_kept_in_prior_migration(self):
        prior = CLOCK_MIGRATION.read_text()
        self.assertIn("CREATE OR REPLACE FUNCTION public.f1_dispatch_queue()", prior)
        self.assertIn("public.f1_dispatch_workflow('queue.yml', '{}'::jsonb)", prior)


if __name__ == "__main__":
    unittest.main()
