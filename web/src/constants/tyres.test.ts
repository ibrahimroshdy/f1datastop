import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { TYRE_COLORS, tyreCode, tyreColor } from "./tyres";

// D16: one tyre colour set, shared by the app and the social cards.
describe("tyre colours", () => {
  it("match the social cards' Pirelli set exactly", () => {
    const py = readFileSync(resolve(process.cwd(), "..", "analysis/social/session_results/session_results.py"), "utf8");
    const line = py.slice(py.indexOf("TYRE = {"), py.indexOf("}", py.indexOf("TYRE = {")));
    const fromPy: Record<string, string> = {};
    for (const m of line.matchAll(/\("([SMHIW])", \((\d+), (\d+), (\d+)\)\)/g)) {
      fromPy[m[1]] = "#" + [m[2], m[3], m[4]].map((n) => Number(n).toString(16).padStart(2, "0").toUpperCase()).join("");
    }
    expect(fromPy).toEqual(TYRE_COLORS);
  });

  it("reads letters and full names, and never guesses an unknown compound", () => {
    expect(tyreCode("soft")).toBe("S");
    expect(tyreCode("INTERMEDIATE")).toBe("I");
    expect(tyreCode("H")).toBe("H");
    expect(tyreCode("UNKNOWN")).toBeNull();
    expect(tyreCode(null)).toBeNull();
    expect(tyreColor("X")).toBe("hsl(var(--muted-foreground))");
  });
});
