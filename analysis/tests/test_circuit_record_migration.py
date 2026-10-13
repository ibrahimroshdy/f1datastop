"""BUG-010: the circuit lap record must come from race laps, ordered numerically."""
import os
import re
import unittest

from _helpers import ANALYSIS

MIG = os.path.join(os.path.dirname(ANALYSIS), "supabase", "migrations",
                   "20261013120000_circuit_record_race_laps_only.sql")


class CircuitRecordMigration(unittest.TestCase):
    def setUp(self):
        with open(MIG) as f:
            self.sql = f.read()
        self.rec = re.search(r"with rec as \((.*?)\n  \),", self.sql, re.S).group(1)

    def test_only_race_laps(self):
        self.assertIn("l.session_type = 'R'", self.rec)

    def test_numeric_order(self):
        self.assertIn("order by l.time_millis asc", self.rec)
        self.assertNotIn("order by l.time_text", self.rec)

    def test_same_signature(self):
        self.assertIn("CREATE OR REPLACE FUNCTION public.get_circuit_detail(p_circuit_id text)", self.sql)
        self.assertIn("record_time text", self.sql)
