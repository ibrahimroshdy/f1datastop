import { describe, expect, it } from "vitest";
import { parseISO } from "date-fns";
import { DOUBLE_HEADER, SINGLE_RACE, TRIPLE_HEADER, areConsecutiveWeekends, determineRaceTypes } from "@/components/calendar/raceCalendarUtils";

const d = parseISO;

describe("areConsecutiveWeekends (BUG-009)", () => {
  it("Sunday to Saturday 13 days later is not consecutive (Madrid → Baku 2026)", () => {
    expect(areConsecutiveWeekends(d("2026-09-13"), d("2026-09-26"))).toBe(false);
  });
  it("back-to-back Sundays and Sunday → Saturday are consecutive", () => {
    expect(areConsecutiveWeekends(d("2026-10-25"), d("2026-11-01"))).toBe(true);
    expect(areConsecutiveWeekends(d("2026-11-22"), d("2026-11-28"))).toBe(true);
    expect(areConsecutiveWeekends(d("2026-12-27"), d("2027-01-03"))).toBe(true);
  });
});

describe("determineRaceTypes on the 2026 calendar", () => {
  const dates = ["2026-08-23", "2026-09-06", "2026-09-13", "2026-09-26", "2026-10-04", "2026-10-11",
                 "2026-10-25", "2026-11-01", "2026-11-08", "2026-11-22"];
  const { raceTypes } = determineRaceTypes(dates.map((date) => ({ date })));
  it("Monza–Madrid is a double, not a triple with Baku", () => {
    expect(raceTypes.slice(1, 3)).toEqual([DOUBLE_HEADER, DOUBLE_HEADER]);
  });
  it("Baku–Malaysia–Singapore is a triple (8 and 7 days apart)", () => {
    expect(raceTypes.slice(3, 6)).toEqual([TRIPLE_HEADER, TRIPLE_HEADER, TRIPLE_HEADER]);
  });
  it("Austin–Mexico–Brazil is a triple; Las Vegas stands alone", () => {
    expect(raceTypes.slice(6, 9)).toEqual([TRIPLE_HEADER, TRIPLE_HEADER, TRIPLE_HEADER]);
    expect(raceTypes[9]).toBe(SINGLE_RACE);
  });
});
