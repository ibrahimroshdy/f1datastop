import { describe, expect, it } from "vitest";
import {
  getPrimaryConstructor,
  mergeDriver,
  normalizeErgastDriver,
  normalizeErgastDriverStanding,
  normalizeOpenF1Driver,
  openF1DriverToErgastShape,
} from "@/lib/f1/adapters";
import type {
  ErgastConstructorRef,
  ErgastDriverRef,
  ErgastDriverStandingRow,
  F1Driver,
  OpenF1DriverRow,
} from "@/lib/f1/types";

const ergastDriver: ErgastDriverRef = {
  driverId: "max_verstappen",
  code: "VER",
  givenName: "Max",
  familyName: "Verstappen",
  nationality: "Dutch",
  permanentNumber: "1",
};

const redBull: ErgastConstructorRef = {
  constructorId: "red_bull",
  name: "Red Bull Racing",
  nationality: "Austrian",
};

const standingRow: ErgastDriverStandingRow = {
  position: "1",
  points: "100.5",
  wins: "3",
  Driver: ergastDriver,
  Constructors: [
    { constructorId: "rbpt", name: "RB Powertrains", nationality: "Italian" },
    redBull,
  ],
};

describe("getPrimaryConstructor", () => {
  it("returns the last constructor in the Ergast list", () => {
    expect(getPrimaryConstructor(standingRow)?.constructorId).toBe("red_bull");
  });

  it("returns null when no constructors", () => {
    expect(getPrimaryConstructor({ ...standingRow, Constructors: [] })).toBeNull();
  });
});

describe("normalizeErgastDriver", () => {
  it("maps core driver fields and team colors", () => {
    const driver = normalizeErgastDriver(ergastDriver, redBull, {
      position: 1,
      points: 100,
      wins: 3,
    });

    expect(driver.ergastId).toBe("max_verstappen");
    expect(driver.fullName).toBe("Max Verstappen");
    expect(driver.teamId).toBe("red_bull");
    expect(driver.teamName).toBe("Red Bull Racing");
    expect(driver.position).toBe(1);
    expect(driver.teamColor).toMatch(/^#/);
    expect(driver.teamColorLight).toMatch(/^#/);
    expect(driver.teamColorDark).toMatch(/^#/);
  });
});

describe("normalizeErgastDriverStanding", () => {
  it("parses numeric standing fields", () => {
    const driver = normalizeErgastDriverStanding(standingRow);
    expect(driver.position).toBe(1);
    expect(driver.points).toBe(100.5);
    expect(driver.wins).toBe(3);
    expect(driver.teamId).toBe("red_bull");
  });
});

describe("normalizeOpenF1Driver", () => {
  it("maps OpenF1 enrichment fields", () => {
    const openF1: OpenF1DriverRow = {
      driver_number: 1,
      name_acronym: "VER",
      first_name: "Max",
      last_name: "Verstappen",
      team_name: "Red Bull Racing",
      country_code: "NED",
      headshot_url: "https://example.com/ver.png",
    };

    expect(normalizeOpenF1Driver(openF1)).toEqual({
      openF1Number: 1,
      code: "VER",
      givenName: "Max",
      familyName: "Verstappen",
      fullName: "Max Verstappen",
      permanentNumber: "1",
      nationality: "NED",
      teamName: "Red Bull Racing",
      headshotUrl: "https://example.com/ver.png",
    });
  });

  it("derives acronym from last name when missing", () => {
    const partial = normalizeOpenF1Driver({
      driver_number: 44,
      first_name: "Lewis",
      last_name: "Hamilton",
    });
    expect(partial.code).toBe("HAM");
  });
});

describe("mergeDriver", () => {
  const base: F1Driver = normalizeErgastDriver(ergastDriver, redBull);

  it("returns ergast driver unchanged when no OpenF1 data", () => {
    expect(mergeDriver(base)).toBe(base);
    expect(mergeDriver(base, null)).toBe(base);
  });

  it("prefers OpenF1 headshot and number when present", () => {
    const merged = mergeDriver(base, {
      openF1Number: 1,
      headshotUrl: "https://example.com/ver.png",
      permanentNumber: "1",
      code: "VER",
    });

    expect(merged.headshotUrl).toBe("https://example.com/ver.png");
    expect(merged.openF1Number).toBe(1);
    expect(merged.ergastId).toBe("max_verstappen");
  });
});

describe("openF1DriverToErgastShape", () => {
  it("produces Ergast-compatible driver object", () => {
    const shape = openF1DriverToErgastShape({
      driver_number: 16,
      name_acronym: "LEC",
      first_name: "Charles",
      last_name: "Leclerc",
      team_name: "Ferrari",
      country_code: "MON",
    });

    expect(shape.driverId).toBe("16");
    expect(shape.code).toBe("LEC");
    expect(shape.Constructor.name).toBe("Ferrari");
    expect(shape.Constructor.constructorId).toBe("ferrari");
  });
});
