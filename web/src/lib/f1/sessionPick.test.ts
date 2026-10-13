import { describe, expect, it } from "vitest";
import { pickInitialSession } from "@/lib/f1/sessionPick";

const Q = { session_key: 6, session_type: "Q" };
const R = { session_key: 7, session_type: "R" };
const S = { session_key: 5, session_type: "S" };

describe("pickInitialSession (BUG-004)", () => {
  it("waits while the list loads instead of falling back to the race", () => {
    expect(pickInitialSession([Q, R], "S", false)).toBeUndefined();
  });
  it("opens the sprint once the list has it", () => {
    expect(pickInitialSession([S, Q, R], "S", true)).toBe(S);
  });
  it("falls back to the race when the round has no such session", () => {
    expect(pickInitialSession([Q, R], "S", true)).toBe(R);
  });
  it("defaults to the race without a URL session", () => {
    expect(pickInitialSession([Q, R], null, false)).toBe(R);
  });
  it("returns nothing for an empty list", () => {
    expect(pickInitialSession([], "R", true)).toBeUndefined();
  });
});
