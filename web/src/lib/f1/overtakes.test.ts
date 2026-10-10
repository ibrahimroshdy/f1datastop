import { describe, expect, it } from "vitest";
import { computeDriverOvertakeStats } from "@/lib/f1/overtakes";

const drivers = {
  1: {
    number: 1,
    name: "Max Verstappen",
    acronym: "VER",
    team: "Red Bull",
    color: "#3671C6",
    gridPosition: 1,
    finalPosition: 1,
  },
  44: {
    number: 44,
    name: "Lewis Hamilton",
    acronym: "HAM",
    team: "Mercedes",
    color: "#00D2BE",
    gridPosition: 3,
    finalPosition: 2,
  },
};

describe("computeDriverOvertakeStats", () => {
  it("counts overtakes made and suffered", () => {
    const stats = computeDriverOvertakeStats(
      drivers,
      [
        { overtaking_driver_number: 44, overtaken_driver_number: 1 },
        { overtaking_driver_number: 44, overtaken_driver_number: 1 },
        { overtaking_driver_number: 1, overtaken_driver_number: 44 },
      ],
      [
        { Driver: { code: "VER" }, status: "Finished" },
        { Driver: { code: "HAM" }, status: "Finished" },
      ],
    );

    const ver = stats.find((s) => s.acronym === "VER");
    const ham = stats.find((s) => s.acronym === "HAM");

    expect(ver?.overtakes_made).toBe(1);
    expect(ver?.overtakes_suffered).toBe(2);
    expect(ver?.net_overtakes).toBe(-1);
    expect(ver?.status).toBe("running");

    expect(ham?.overtakes_made).toBe(2);
    expect(ham?.overtakes_suffered).toBe(1);
    expect(ham?.net_overtakes).toBe(1);
    expect(ham?.position_change).toBe(1);
  });

  it("returns empty array when no drivers", () => {
    expect(computeDriverOvertakeStats({}, [], [])).toEqual([]);
  });
});
