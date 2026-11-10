import { describe, expect, it } from "vitest";
import { buildRaceRows, groupByMonth, matchesFilter, matchesSearch, parseRaceFilter, weekendDates } from "./raceRows";
import type { ScheduleRace } from "./raceRows";

const race = (round: string, date: string, extra: Partial<ScheduleRace> = {}): ScheduleRace => ({
  season: "2026",
  round,
  raceName: "Test Grand Prix",
  date,
  time: "14:00:00Z",
  Circuit: { circuitId: "c", circuitName: "Circuit", Location: { locality: "Town", country: "Brazil" } },
  ...extra,
});

describe("weekendDates", () => {
  it("spans the weekend within a month", () => {
    expect(weekendDates({ date: "2026-11-08", FirstPractice: { date: "2026-11-06" } })).toBe("6 to 8 Nov");
  });
  it("spans two months", () => {
    expect(weekendDates({ date: "2026-11-01", FirstPractice: { date: "2026-10-30" } })).toBe("30 Oct to 1 Nov");
  });
  it("falls back to the race day", () => {
    expect(weekendDates({ date: "2026-11-08" })).toBe("8 Nov");
  });
});

describe("buildRaceRows", () => {
  const races = [race("1", "2026-03-01"), race("2", "2026-03-15", { Sprint: { date: "2026-03-14" } }), race("3", "2026-04-05")];
  const winners = new Map([["1", { driverId: "x", familyName: "X" }]]);
  const rows = buildRaceRows(races, winners, new Date("2026-03-10T00:00:00Z"));

  it("marks done, next and coming, with the winner on finished races", () => {
    expect(rows.map((r) => r.status)).toEqual(["done", "next", "coming"]);
    expect(rows[0].winner?.driverId).toBe("x");
    expect(rows[1].winner).toBeUndefined();
  });
  it("filters and groups", () => {
    expect(rows.filter((r) => matchesFilter(r, "sprint")).map((r) => r.race.round)).toEqual(["2"]);
    expect(rows.filter((r) => matchesFilter(r, "coming"))).toHaveLength(2);
    expect(groupByMonth(rows).map((g) => g.month)).toEqual(["March", "April"]);
  });
  it("searches without accents or case", () => {
    const sp = { ...rows[0], name: "São Paulo Grand Prix" };
    expect(matchesSearch(sp, "sao")).toBe(true);
    expect(matchesSearch(sp, "brazil")).toBe(true);
    expect(matchesSearch(sp, "monaco")).toBe(false);
  });
  it("reads unknown filters as all", () => {
    expect(parseRaceFilter("nope")).toBe("all");
    expect(parseRaceFilter("done")).toBe("done");
  });
});
