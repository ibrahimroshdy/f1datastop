import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import backfill as bf


class PitDuration(unittest.TestCase):
    def test_plain_seconds(self):
        self.assertEqual(bf.parse_pit_duration("23.591"), 23.591)
        self.assertEqual(bf.parse_pit_duration("24"), 24.0)

    def test_minutes_seconds(self):
        self.assertEqual(bf.parse_pit_duration("1:21.474"), 81.474)
        self.assertEqual(bf.parse_pit_duration("1:00.446"), 60.446)
        self.assertEqual(bf.parse_pit_duration("35:54.149"), 2154.149)

    def test_numbers_and_missing(self):
        self.assertEqual(bf.parse_pit_duration(23.5), 23.5)
        for v in (None, "", "abc", "1:2:3", float("nan")):
            self.assertIsNone(bf.parse_pit_duration(v))


if __name__ == "__main__":
    unittest.main()
