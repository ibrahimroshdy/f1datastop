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
