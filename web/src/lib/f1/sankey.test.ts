import { describe, expect, it } from "vitest";
import { buildSeasonSankey, type SeasonSankeyLink } from "./sankey";

type Result = {
  grid: string | number | null;
  position: string | number | null;
  status: string;
  Driver: { code: string; givenName: string; familyName: string };
  Constructor: { constructorId: string; name: string };
  points: string;
};

const result = ({
  code,
  grid,
  position,
  status = "Finished",
  team = "red_bull",
  teamName = "Red Bull",
  points = "0",
  givenName = code,
  familyName = "",
}: {
  code: string;
  grid: string | number | null;
  position: string | number | null;
  status?: string;
  team?: string;
  teamName?: string;
  points?: string;
  givenName?: string;
  familyName?: string;
}): Result => ({
  grid,
  position,
  status,
  Driver: { code, givenName, familyName },
  Constructor: { constructorId: team, name: teamName },
  points,
});

const race = (round: string, results: Result[]) => ({
  round,
  raceName: `Round ${round}`,
  Results: results,
});

const linkValue = (links: SeasonSankeyLink[], source: string, target: string): number => {
  const link = links.find((l) => l.source === source && l.target === target);
  return link ? link.value : 0;
};

const hasNode = (nodes: any[], id: string) => nodes.some((n) => n.id === id);

describe("buildSeasonSankey", () => {
  it("returns empty nodes/links for an empty season (never throws)", () => {
    expect(() => buildSeasonSankey([])).not.toThrow();
    const out = buildSeasonSankey([]);
    expect(out.nodes).toEqual([]);
    expect(out.links).toEqual([]);
  });

  it("sums grid→finish links across races in a season", () => {
    // Verstappen P1→P1 in both races; Hamilton P2→P2 then P2→P3.
    const rounds = [
      race("1", [result({ code: "VER", grid: 1, position: 1 }), result({ code: "HAM", grid: 2, position: 2 })]),
      race("2", [result({ code: "VER", grid: 1, position: 1 }), result({ code: "HAM", grid: 2, position: 3 })]),
    ];
    const { nodes, links } = buildSeasonSankey(rounds);

    expect(linkValue(links, "grid-1", "finish-1")).toBe(2); // VER twice
    expect(linkValue(links, "grid-2", "finish-2")).toBe(1); // HAM race 1
    expect(linkValue(links, "grid-2", "finish-3")).toBe(1); // HAM race 2

    // Nodes for every grid / finish position seen.
    expect(hasNode(nodes, "grid-1")).toBe(true);
    expect(hasNode(nodes, "grid-2")).toBe(true);
    expect(hasNode(nodes, "finish-1")).toBe(true);
    expect(hasNode(nodes, "finish-2")).toBe(true);
    expect(hasNode(nodes, "finish-3")).toBe(true);
    // No DNF / pit-lane nodes when nobody retired or started from pit lane.
    expect(hasNode(nodes, "finish-dnf")).toBe(false);
    expect(hasNode(nodes, "grid-pitlane")).toBe(false);
  });

  it("creates a dedicated DNF node for non-finishers", () => {
    const rounds = [
      race("1", [
        result({ code: "VER", grid: 3, position: "R", status: "Retired" }),
        result({ code: "HAM", grid: 1, position: 1 }),
      ]),
    ];
    const { nodes, links } = buildSeasonSankey(rounds);

    expect(hasNode(nodes, "finish-dnf")).toBe(true);
    const dnfNode = nodes.find((n) => n.id === "finish-dnf");
    expect(dnfNode?.isDNF).toBe(true);
    expect(dnfNode?.type).toBe("dnf");

    expect(linkValue(links, "grid-3", "finish-dnf")).toBe(1);
    expect(linkValue(links, "grid-1", "finish-1")).toBe(1);
    // No finish-3 node (VER did not finish).
    expect(hasNode(nodes, "finish-3")).toBe(false);
  });

  it("creates a dedicated Pit lane node for grid null / 0 / invalid starts", () => {
    const rounds = [
      race("1", [
        result({ code: "HAM", grid: null, position: 5, status: "Finished" }),
        result({ code: "VER", grid: 0, position: 1 }),
        result({ code: "LEC", grid: "", position: 2 }),
        result({ code: "SAI", grid: 4, position: 4 }),
      ]),
    ];
    const { nodes, links } = buildSeasonSankey(rounds);

    expect(hasNode(nodes, "grid-pitlane")).toBe(true);
    const pitLaneNode = nodes.find((n) => n.id === "grid-pitlane");
    expect(pitLaneNode?.type).toBe("pit-lane");

    // grid null → pit lane; grid 0 → pit lane; grid "" → pit lane
    expect(linkValue(links, "grid-pitlane", "finish-5")).toBe(1);
    expect(linkValue(links, "grid-pitlane", "finish-1")).toBe(1);
    expect(linkValue(links, "grid-pitlane", "finish-2")).toBe(1);
    // Normal grid start still flows from its grid node.
    expect(linkValue(links, "grid-4", "finish-4")).toBe(1);
    expect(hasNode(nodes, "grid-4")).toBe(true);
  });

  it("handles pit-lane start that also DNFs", () => {
    const rounds = [
      race("1", [result({ code: "HAM", grid: null, position: null, status: "Retired" })]),
    ];
    const { links } = buildSeasonSankey(rounds);
    expect(linkValue(links, "grid-pitlane", "finish-dnf")).toBe(1);
  });

  it("classifies classified finishes (Lapped / +N Lap) as not DNF", () => {
    const rounds = [
      race("1", [
        result({ code: "VER", grid: 1, position: 1, status: "Finished" }),
        result({ code: "HAM", grid: 2, position: 2, status: "Lapped" }),
        result({ code: "LEC", grid: 3, position: 3, status: "+1 Lap" }),
      ]),
    ];
    const { nodes, links } = buildSeasonSankey(rounds);
    expect(hasNode(nodes, "finish-dnf")).toBe(false);
    expect(linkValue(links, "grid-2", "finish-2")).toBe(1);
    expect(linkValue(links, "grid-3", "finish-3")).toBe(1);
  });

  it("sorts grid nodes ascending with pit lane last, finish nodes ascending with DNF last", () => {
    const rounds = [
      race("1", [
        result({ code: "A", grid: 5, position: 8 }),
        result({ code: "B", grid: null, position: "R", status: "Retired" }),
      ]),
    ];
    const { nodes } = buildSeasonSankey(rounds);
    const grid = nodes.filter((n) => n.type === "grid").map((n) => n.position);
    const pitLane = nodes.find((n) => n.type === "pit-lane");
    const finish = nodes.filter((n) => n.type === "finish").map((n) => n.position);
    const dnf = nodes.find((n) => n.type === "dnf");
    expect(grid).toEqual([5]);
    expect(pitLane?.position).toBe(9999);
    expect(finish).toEqual([8]);
    expect(dnf?.position).toBe(9999);
  });
});
