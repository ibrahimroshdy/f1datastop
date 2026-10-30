import { describe, it, expect } from "vitest";
import { buildSectorData, type SectorData } from "./MuiLapTimeChart";

const lap = (n: number, s1?: number | null, s2?: number | null, s3?: number | null) => ({
  n,
  s1: s1 ?? null,
  s2: s2 ?? null,
  s3: s3 ?? null,
});

const mkDriver = (code: string | null, laps: unknown[]) => ({
  driver_id: `${String(code)}_id`,
  code,
  laps,
});

describe("buildSectorData", () => {
  it("builds {driverCode: {lap: {s1,s2,s3}}} from a replay blob", () => {
    const blob = {
      drivers: [
        mkDriver("VER", [lap(1, 25123, 24456, 25789), lap(2, 24987, 25012, 24890)]),
        mkDriver("NOR", [lap(1, 25500, null, 26000)]),
        mkDriver(null, [lap(1, 1000, 1000, 1000)]),
        mkDriver("NOLAPS", []),
      ],
    } as unknown as { drivers: unknown[] };

    const out: SectorData = buildSectorData(blob as never);

    expect(out["VER"]).toEqual({
      1: { s1: 25123, s2: 24456, s3: 25789 },
      2: { s1: 24987, s2: 25012, s3: 24890 },
    });
    expect(out["NOR"]).toEqual({ 1: { s1: 25500, s2: null, s3: 26000 } });
    // driver without a code is skipped
    expect(out["NOCODE"]).toBeUndefined();
    // driver with no laps is skipped
    expect(out["NOLAPS"]).toBeUndefined();
  });

  it("returns an empty object for an empty blob", () => {
    const blob = { drivers: [] } as never;
    expect(buildSectorData(blob)).toEqual({});
  });

  it("keeps null sectors as null (silent degradation)", () => {
    const blob = {
      drivers: [mkDriver("VER", [lap(1, null, null, null)])],
    } as unknown as { drivers: unknown[] };
    const out: SectorData = buildSectorData(blob as never);
    expect(out["VER"]).toEqual({ 1: { s1: null, s2: null, s3: null } });
  });
});
