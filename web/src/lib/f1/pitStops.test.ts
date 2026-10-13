import { describe, expect, it } from "vitest";
import { durationStats, parseDuration } from "@/lib/f1/pitStops";

describe("pit-stop durations (BUG-008)", () => {
  it("treats missing durations as null, not NaN", () => {
    expect(parseDuration(null)).toBeNull();
    expect(parseDuration(undefined)).toBeNull();
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("23.591")).toBe(23.591);
  });
  it("ignores null durations in min/max", () => {
    expect(durationStats([23.6, null, 24.1])).toEqual({ min: 23.6, max: 24.1 });
    expect(durationStats([null])).toEqual({ min: null, max: null });
  });
});

describe("parseDuration M:SS.sss", () => {
  it("reads minutes:seconds", () => {
    expect(parseDuration("1:21.474")).toBeCloseTo(81.474, 3);
    expect(parseDuration("35:54.149")).toBeCloseTo(2154.149, 3);
    expect(parseDuration("23.591")).toBe(23.591);
  });
  it("rejects malformed values", () => {
    expect(parseDuration("1:2:3")).toBeNull();
    expect(parseDuration("abc")).toBeNull();
  });
  it("fastest stop ignores the minute-long stops", () => {
    expect(durationStats(["1:21.474", "23.1", "1:00.446"].map(parseDuration)).min).toBe(23.1);
  });
});
