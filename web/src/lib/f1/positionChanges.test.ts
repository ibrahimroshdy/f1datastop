import { describe, expect, it } from "vitest";
import {
  getPositionChangeSummary,
  isErgastDriverDNF,
  mapErgastResultsToDrivers,
} from "@/lib/f1/positionChanges";

describe("isErgastDriverDNF", () => {
  it("treats finished and +1 Lap as not DNF", () => {
    expect(isErgastDriverDNF("Finished", 1)).toBe(false);
    expect(isErgastDriverDNF("+1 Lap", 10)).toBe(false);
  });

  it("detects mechanical retirements", () => {
    expect(isErgastDriverDNF("Engine", 0)).toBe(true);
    expect(isErgastDriverDNF("Collision", 15)).toBe(true);
  });

  it("treats position 0 with empty status as not DNF", () => {
    expect(isErgastDriverDNF("", 0)).toBe(false);
  });
});

describe("mapErgastResultsToDrivers", () => {
  it("maps grid, finish, and DNF flag", () => {
    const drivers = mapErgastResultsToDrivers([
      {
        Driver: {
          driverId: "hamilton",
          code: "HAM",
          givenName: "Lewis",
          familyName: "Hamilton",
        },
        Constructor: { constructorId: "mercedes" },
        position: "3",
        grid: "1",
        status: "Finished",
      },
      {
        Driver: {
          driverId: "sainz",
          givenName: "Carlos",
          familyName: "Sainz",
        },
        Constructor: { constructorId: "ferrari" },
        position: "0",
        grid: "5",
        status: "Engine",
      },
    ]);

    expect(drivers[0].code).toBe("HAM");
    expect(drivers[0].grid).toBe(1);
    expect(drivers[0].finishPosition).toBe(3);
    expect(drivers[0].isDNF).toBe(false);

    expect(drivers[1].code).toBe("SAI");
    expect(drivers[1].isDNF).toBe(true);
  });
});

describe("getPositionChangeSummary", () => {
  const driver = {
    driverId: "ver",
    code: "VER",
    name: "Max Verstappen",
    team: "red_bull",
    finishPosition: 1,
    grid: 3,
    status: "Finished",
    isDNF: false,
  };

  it("computes positions gained from grid", () => {
    const summary = getPositionChangeSummary("VER", driver, []);
    expect(summary).toEqual({
      start: 3,
      end: 1,
      change: 2,
      improved: true,
      isDNF: false,
      status: "Finished",
    });
  });

  it("returns zero change for DNF drivers", () => {
    const summary = getPositionChangeSummary("VER", { ...driver, isDNF: true, finishPosition: 0 }, []);
    expect(summary?.change).toBe(0);
    expect(summary?.end).toBe(0);
    expect(summary?.improved).toBe(false);
  });

  it("falls back to first lap when grid is missing", () => {
    const summary = getPositionChangeSummary(
      "VER",
      { ...driver, grid: 0 },
      [{ lap: 1, VER: 5 }],
    );
    expect(summary?.start).toBe(5);
    expect(summary?.change).toBe(4);
  });
});
