import { describe, it, expect } from "vitest";
import {
  computeRaceSummary,
  computeQualiRaceDelta,
  computeTeammateH2H,
  type ErgastResultRow,
  type ErgastQualifyingRow,
} from "./raceInsights";

const results: ErgastResultRow[] = [
  {
    position: "1",
    points: "25",
    grid: "1",
    status: "Finished",
    Driver: { driverId: "verstappen", code: "VER", givenName: "Max", familyName: "Verstappen" },
    Constructor: { constructorId: "red_bull" },
    Time: { time: "1:30:00.000" },
    FastestLap: { rank: "2", Time: { time: "1:32.1" } },
  },
  {
    position: "2",
    points: "18",
    grid: "5",
    status: "Finished",
    Driver: { driverId: "norris", code: "NOR", givenName: "Lando", familyName: "Norris" },
    Constructor: { constructorId: "mclaren" },
    Time: { time: "+5.231" },
    FastestLap: { rank: "1", Time: { time: "1:31.5" } },
  },
  {
    position: "3",
    points: "15",
    grid: "2",
    status: "Finished",
    Driver: { driverId: "piastri", code: "PIA", givenName: "Oscar", familyName: "Piastri" },
    Constructor: { constructorId: "mclaren" },
    Time: { time: "+9.100" },
  },
  {
    position: "0",
    points: "0",
    grid: "3",
    status: "Engine",
    Driver: { driverId: "perez", code: "PER", givenName: "Sergio", familyName: "Perez" },
    Constructor: { constructorId: "red_bull" },
  },
];

const qualifying: ErgastQualifyingRow[] = [
  { position: "1", Driver: { driverId: "verstappen", code: "VER" } },
  { position: "2", Driver: { driverId: "piastri", code: "PIA" } },
  { position: "3", Driver: { driverId: "perez", code: "PER" } },
  { position: "5", Driver: { driverId: "norris", code: "NOR" } },
];

describe("computeRaceSummary", () => {
  const s = computeRaceSummary(results, qualifying);
  it("identifies winner and pole-to-win", () => {
    expect(s.winner?.code).toBe("VER");
    expect(s.pole?.code).toBe("VER");
    expect(s.poleToWin).toBe(true);
  });
  it("uses the rank-1 fastest lap, not P1's lap", () => {
    expect(s.fastestLap?.code).toBe("NOR");
    expect(s.fastestLap?.time).toBe("1:31.5");
  });
  it("reads win margin from P2 gap", () => {
    expect(s.winMargin).toBe("+5.231");
  });
  it("counts DNFs and finishers", () => {
    expect(s.dnfCount).toBe(1);
    expect(s.finishers).toBe(3);
    expect(s.totalDrivers).toBe(4);
  });
  it("finds biggest gainer (NOR P5->P2 = +3)", () => {
    expect(s.biggestGainer?.code).toBe("NOR");
    expect(s.biggestGainer?.delta).toBe(3);
  });
  it("returns empty summary for no results", () => {
    expect(computeRaceSummary([], []).winner).toBeNull();
  });
});

describe("computeQualiRaceDelta", () => {
  it("sorts gainers first and sinks DNFs", () => {
    const rows = computeQualiRaceDelta(results);
    expect(rows[0].code).toBe("NOR");
    expect(rows[0].delta).toBe(3);
    expect(rows[rows.length - 1].isDNF).toBe(true);
  });
});

describe("computeTeammateH2H", () => {
  const rows = computeTeammateH2H(results, qualifying);
  it("pairs both 2-driver teams", () => {
    expect(rows).toHaveLength(2);
  });
  it("scores McLaren race H2H (NOR P2 beats PIA P3)", () => {
    const mcl = rows.find((r) => r.team === "mclaren")!;
    expect(mcl.raceWinner).toBe("NOR");
    expect(mcl.qualiWinner).toBe("PIA");
  });
  it("awards race H2H to the finisher when teammate DNFs (Red Bull)", () => {
    const rb = rows.find((r) => r.team === "red_bull")!;
    expect(rb.raceWinner).toBe("VER");
  });
});
