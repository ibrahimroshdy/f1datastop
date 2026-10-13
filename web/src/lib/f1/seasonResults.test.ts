import { describe, expect, it } from "vitest";
import { byDriverFromRaces, mergeRacePages, remainingOffsets } from "@/lib/f1/seasonResults";

describe("season results paging (BUG-007)", () => {
  it("pages through the full total", () => {
    expect(remainingOffsets(374)).toEqual([100, 200, 300]);
    expect(remainingOffsets(100)).toEqual([]);
    expect(remainingOffsets(0)).toEqual([]);
  });
  it("merges a round split across pages", () => {
    const r = (id: string) => ({ Driver: { driverId: id }, points: "1" });
    const merged = mergeRacePages([
      [{ round: "5", Results: [r("a")] }],
      [{ round: "5", Results: [r("b")] }, { round: "6", Results: [r("a")] }],
    ]);
    expect(merged.map((x) => [x.round, x.Results?.length])).toEqual([["5", 2], ["6", 1]]);
  });
});

describe("byDriverFromRaces", () => {
  it("adds sprint points to the weekend and classifies by positionText", () => {
    const races = [
      { round: "17", Results: [
        { Driver: { driverId: "antonelli" }, points: "15", position: "3", positionText: "3", status: "Finished" },
        { Driver: { driverId: "albon" }, points: "0", position: "18", positionText: "18", status: "Retired" },
        { Driver: { driverId: "stroll" }, points: "0", position: "20", positionText: "R", status: "Retired" },
        { Driver: { driverId: "piastri" }, points: "0", position: "22", positionText: "W", status: "Did not start" },
      ] },
    ];
    const sprints = [{ round: "17", SprintResults: [{ Driver: { driverId: "antonelli" }, points: "5" }] }];
    const out = byDriverFromRaces(races, sprints);
    expect(out.antonelli[0].points).toBe(20);
    expect(out.albon[0].isDNF).toBe(false);
    expect(out.stroll[0].isDNF).toBe(true);
    expect(out.piastri[0].isDNF).toBe(false);
  });
});
