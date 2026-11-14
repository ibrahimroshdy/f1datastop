"""News card tag chips: --tags draws more than one team, and the single-tag default is unchanged."""
import os
import sys
import unittest

from _helpers import ANALYSIS  # noqa: F401

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "social", "news_card"))
import news_card as nc  # noqa: E402


ACCENT = (0x27, 0xF4, 0xD2)
AUDI = nc.design.rgb(nc.TEAMS["audi"][1])
RACING_BULLS = nc.design.rgb(nc.TEAMS["racing_bulls"][1])
MERCEDES = nc.design.rgb(nc.TEAMS["mercedes"][1])


class TagColour(unittest.TestCase):
    def test_known_team_uses_team_colour(self):
        self.assertEqual(nc.tag_colour("Audi", ACCENT), AUDI)
        self.assertEqual(nc.tag_colour("Racing Bulls", ACCENT), RACING_BULLS)
        self.assertEqual(nc.tag_colour("mercedes", ACCENT), MERCEDES)

    def test_aliases_map_to_a_team(self):
        self.assertEqual(nc.tag_colour("rb", ACCENT), RACING_BULLS)
        self.assertEqual(nc.tag_colour("Red Bull", ACCENT), nc.design.rgb(nc.TEAMS["red_bull"][1]))

    def test_unknown_label_uses_fallback(self):
        self.assertEqual(nc.tag_colour("Court", ACCENT), ACCENT)


class TagChips(unittest.TestCase):
    def test_default_is_the_single_team_chip(self):
        self.assertEqual(
            nc.tag_chips(team="audi", accent=AUDI),
            [("AUDI", AUDI, "fill")],
        )

    def test_default_driver_chip_when_there_is_no_team(self):
        self.assertEqual(
            nc.tag_chips(driver="TSU", name="Yuki Tsunoda", accent=ACCENT),
            [("YUKI TSUNODA", ACCENT, "fill")],
        )

    def test_default_uses_the_driver_code_when_the_name_is_missing(self):
        self.assertEqual(
            nc.tag_chips(driver="TSU", accent=ACCENT),
            [("TSU", ACCENT, "fill")],
        )

    def test_tags_override_the_automatic_team_or_driver_chip(self):
        self.assertEqual(
            nc.tag_chips(
                tags="Audi,Racing Bulls",
                team="racing_bulls",
                driver="TSU",
                name="Yuki Tsunoda",
                accent=ACCENT,
            ),
            [("AUDI", AUDI, "fill"), ("RACING BULLS", RACING_BULLS, "fill")],
        )

    def test_tags_trim_spaces_and_skip_empty_items(self):
        self.assertEqual(
            nc.tag_chips(tags="Audi, , Racing Bulls,"),
            [("AUDI", AUDI, "fill"), ("RACING BULLS", RACING_BULLS, "fill")],
        )

    def test_unknown_tag_keeps_the_accent(self):
        self.assertEqual(
            nc.tag_chips(tags="Court", accent=ACCENT),
            [("COURT", ACCENT, "fill")],
        )

    def test_empty_tags_keep_the_single_team_default(self):
        self.assertEqual(
            nc.tag_chips(tags="", team="audi", accent=AUDI),
            [("AUDI", AUDI, "fill")],
        )

    def test_reported_is_appended_to_the_default_and_to_tags(self):
        self.assertEqual(
            nc.tag_chips(team="audi", accent=AUDI, reported=True),
            [("AUDI", AUDI, "fill"), ("REPORTED", nc.INK, "line")],
        )
        self.assertEqual(
            nc.tag_chips(tags="Audi,Racing Bulls", reported=True),
            [
                ("AUDI", AUDI, "fill"),
                ("RACING BULLS", RACING_BULLS, "fill"),
                ("REPORTED", nc.INK, "line"),
            ],
        )


if __name__ == "__main__":
    unittest.main()
