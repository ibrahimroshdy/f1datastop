import { describe, expect, it } from "vitest";
import { buildSankeyFromRoundResults, processDataForSankey } from "./sankey";

// The live feed sometimes sends a result row without its team (owner, 2026-11-11: the
// Australian Grand Prix quick look crashed on one). The Sankey must draw it, not throw.
const withTeam = (pos: number, code: string) => ({
  position: String(pos),
  grid: String(pos),
  points: "0",
  status: "Finished",
  Driver: { driverId: code.toLowerCase(), code, givenName: "A", familyName: code },
  Constructor: { constructorId: "mercedes", name: "Mercedes" },
});
const noTeam = (pos: number, code: string) => {
  const { Constructor: _team, ...row } = withTeam(pos, code);
  return row;
};

describe("Sankey builders with a row missing its team", () => {
  it("buildSankeyFromRoundResults keeps the row and marks the team unknown", () => {
    const quali = [withTeam(1, "AAA"), noTeam(2, "BBB")];
    const race = [withTeam(1, "BBB"), noTeam(2, "AAA")];
    const out = buildSankeyFromRoundResults(quali, race);
    expect(out.links.length).toBeGreaterThan(0);
    expect(out.nodes.some((n) => n.team === "unknown")).toBe(true);
  });

  it("processDataForSankey does not throw", () => {
    const quali = { QualifyingResults: [withTeam(1, "AAA"), noTeam(2, "BBB")] };
    const race = { Results: [withTeam(1, "BBB"), noTeam(2, "AAA")] };
    expect(() => processDataForSankey(quali, race)).not.toThrow();
  });
});
