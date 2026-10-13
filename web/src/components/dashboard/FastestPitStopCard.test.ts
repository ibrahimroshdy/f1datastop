import { describe, it, expect } from "vitest";
import { processDriverFastestPitStops } from "./FastestPitStopCard";

const pit = (driverId: string, duration: string, lap = "2") => ({ driverId, lap, stop: "1", time: "14:00:00", duration });
const data = (stops: unknown[]) => ({ MRData: { RaceTable: { Races: [{ PitStops: stops }] } } });

describe("processDriverFastestPitStops", () => {
  it("reads M:SS.sss durations as minutes, not 1s", () => {
    const out = processDriverFastestPitStops(null, data([
      pit("piastri", "1:21.474"),
      pit("stroll", "1:00.446"),
      pit("norris", "23.591"),
    ]));
    expect(out[0].driver.code).toBe("NOR");
    expect(out[0].duration).toBeCloseTo(23.591, 3);
    expect(out.find((s) => s.driver.code === "STR")!.duration).toBeCloseTo(60.446, 3);
    expect(out.find((s) => s.driver.code === "PIA")!.duration).toBeCloseTo(81.474, 3);
  });

  it("keeps each driver's fastest stop and skips missing durations", () => {
    const out = processDriverFastestPitStops(null, data([
      pit("hulkenberg", "1:01.177", "2"),
      pit("hulkenberg", "24.100", "30"),
      pit("bortoleto", ""),
    ]));
    expect(out).toHaveLength(1);
    expect(out[0].duration).toBeCloseTo(24.1, 3);
    expect(out[0].lap).toBe(30);
  });
});
