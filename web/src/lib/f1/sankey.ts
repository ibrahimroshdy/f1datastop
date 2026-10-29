// Process data for Sankey chart

interface SankeyNode {
  id: string;
  name: string;
  fullName?: string;
  team?: string;
  teamName?: string;
  position: number;
  type: string;
  status?: string;
  isDNF?: boolean;
  points?: number;
}

interface SankeyLink {
  source: string;
  target: string;
  value: number;
  code?: string;
  name: string;
  fullName?: string;
  team?: string;
  teamName?: string;
  qualifyingPosition?: number;
  gridPosition?: number;
  racePosition?: number;
  positionChange?: number;
  status?: string;
  isDNF?: boolean;
  points?: number;
}

export const processDataForSankey = (qualifyingData: any, raceData: any) => {
  // Accept both "Results" (API standard) and "results" (our normalized format)
  const qualifyingResults = qualifyingData?.QualifyingResults;
  const raceResults = raceData?.results || raceData?.Results;
  
  if (!qualifyingResults || !raceResults) {
    return null;
  }
  
  // Create nodes (drivers)
  const drivers = new Set<string>();
  
  // Map qualifying results
  const qualifyingResultsMapped = qualifyingResults.map((result: any) => {
    const driverCode = result.Driver.code || result.Driver.familyName.substring(0, 3).toUpperCase();
    drivers.add(driverCode);
    
    return {
      code: driverCode,
      name: `${result.Driver.givenName} ${result.Driver.familyName}`,
      team: result.Constructor.constructorId,
      qualifyingPosition: parseInt(result.position),
      teamName: result.Constructor.name
    };
  });
  
  // Map race results (which include grid positions)
  const raceResultsMapped = raceResults.map((result: any) => {
    const driverCode = result.Driver.code || result.Driver.familyName.substring(0, 3).toUpperCase();
    drivers.add(driverCode);
    
    // Determine driver status
    const status = result.status || "";
    const isDNF = status !== "Finished" && !status.startsWith("+");
    
    return {
      code: driverCode,
      name: `${result.Driver.givenName} ${result.Driver.familyName}`,
      team: result.Constructor.constructorId,
      racePosition: parseInt(result.position),
      gridPosition: parseInt(result.grid), // Add grid position from race results
      teamName: result.Constructor.name,
      status: status,
      isDNF: isDNF
    };
  });
  
  // Create links between qualifying, grid, and race results
  const links: SankeyLink[] = [];
  const driverMap = new Map();
  
  // Create a map of driver codes to their data
  qualifyingResultsMapped.forEach((quali: any) => {
    if (!driverMap.has(quali.code)) {
      driverMap.set(quali.code, { ...quali });
    } else {
      driverMap.set(quali.code, { ...driverMap.get(quali.code), ...quali });
    }
  });
  
  raceResultsMapped.forEach((race: any) => {
    if (!driverMap.has(race.code)) {
      driverMap.set(race.code, { ...race });
    } else {
      driverMap.set(race.code, { ...driverMap.get(race.code), ...race });
    }
  });
  
  // Create links for each driver (qualifying -> grid -> race)
  driverMap.forEach((driver) => {
    if (driver.qualifyingPosition !== undefined && driver.gridPosition !== undefined && driver.racePosition !== undefined) {
      // Link from qualifying to grid
      links.push({
        source: driver.code + "_quali",
        target: driver.code + "_grid",
        value: 1, // Required for d3-sankey
        code: driver.code,
        name: driver.name,
        team: driver.team,
        teamName: driver.teamName,
        qualifyingPosition: driver.qualifyingPosition,
        gridPosition: driver.gridPosition,
        racePosition: driver.racePosition,
        positionChange: driver.qualifyingPosition - driver.gridPosition,
        status: driver.status || "",
        isDNF: driver.isDNF || false
      });
      
      // Link from grid to race
      links.push({
        source: driver.code + "_grid",
        target: driver.code + "_race",
        value: 1, // Required for d3-sankey
        code: driver.code,
        name: driver.name,
        team: driver.team,
        teamName: driver.teamName,
        qualifyingPosition: driver.qualifyingPosition,
        gridPosition: driver.gridPosition,
        racePosition: driver.racePosition,
        positionChange: driver.gridPosition - driver.racePosition,
        status: driver.status || "",
        isDNF: driver.isDNF || false
      });
    }
  });
  
  // Create nodes array
  const qualifyingNodes: SankeyNode[] = [];
  const gridNodes: SankeyNode[] = [];
  const raceNodes: SankeyNode[] = [];
  
  // Add qualifying nodes
  qualifyingResultsMapped.forEach((driver: any) => {
    qualifyingNodes.push({
      id: driver.code + "_quali",
      name: driver.code,
      team: driver.team,
      position: driver.qualifyingPosition,
      type: "qualifying",
      teamName: driver.teamName,
      fullName: driver.name
    });
  });
  
  // Add grid nodes
  raceResultsMapped.forEach((driver: any) => {
    gridNodes.push({
      id: driver.code + "_grid",
      name: driver.code,
      team: driver.team,
      position: driver.gridPosition,
      type: "grid",
      teamName: driver.teamName,
      fullName: driver.name
    });
  });
  
  // Add race nodes
  raceResultsMapped.forEach((driver: any) => {
    raceNodes.push({
      id: driver.code + "_race",
      name: driver.code,
      team: driver.team,
      position: driver.racePosition,
      type: "race",
      teamName: driver.teamName,
      fullName: driver.name,
      status: driver.status || "",
      isDNF: driver.isDNF || false
    });
  });
  
  // Sort nodes by position within their groups
  qualifyingNodes.sort((a, b) => a.position - b.position);
  gridNodes.sort((a, b) => a.position - b.position);
  raceNodes.sort((a, b) => a.position - b.position);
  
  // Combine sorted nodes
  const nodes = [...qualifyingNodes, ...gridNodes, ...raceNodes];
  
  return {
    nodes,
    links,
    race: {
      name: raceData.raceName,
      circuit: raceData.Circuit?.circuitName,
      country: raceData.Circuit?.Location?.country,
      date: raceData.date
    }
  };
};

export const buildSankeyFromRoundResults = (qualifying: any[], raceResults: any[]) => {
  // Create nodes for qualifying, grid, and race positions
  const nodes: SankeyNode[] = [];
  const links: SankeyLink[] = [];
  
  const qualifyingIdPrefix = "Q";
  const gridIdPrefix = "G";
  const raceIdPrefix = "R";

  const hasQualifying = qualifying.length > 0;

  // Build a lookup from driverId -> qualifying position (from API)
  const qualiByDriverId = new Map<string, number>();
  if (hasQualifying) {
    qualifying.forEach((driver: any) => {
      if (driver.position && driver.Driver?.driverId) {
        qualiByDriverId.set(driver.Driver.driverId, parseInt(driver.position));
      }
    });
  }

  // Find max qualifying position so we can assign synthetic grid positions (20, 21, ...) for drivers without quali/grid
  const maxQualiPosition = hasQualifying
    ? Math.max(...Array.from(qualiByDriverId.values()), 0)
    : 0;
  let nextSyntheticGrid = Math.max(maxQualiPosition + 1, 20);
  
  // Process every race result: ensure each driver has grid position (API, quali fallback, or synthetic)
  raceResults.forEach((driver: any) => {
    if (!driver.position) return;
    
    // Every field here is optional in practice: for the first hours after a race the
    // warehouse serves rows built from live timing, where Ergast-only fields (Constructor,
    // status, points) aren't populated yet. An unguarded `status.includes(...)` threw and
    // took down every page that renders this chart, so treat the payload as partial.
    const racePosition = parseInt(driver.position);
    const driverCode = driver.Driver?.code ?? "";
    const driverName = `${driver.Driver?.givenName ?? ""} ${driver.Driver?.familyName ?? ""}`.trim();
    const team = driver.Constructor?.constructorId ?? "unknown";
    const teamName = driver.Constructor?.name ?? "Unknown";
    const points = parseFloat(driver.points) || 0;
    const status = driver.status ?? "";
    const isDNF = status !== "" && status !== "Finished" && !status.includes("+");

    const qualiPos = qualiByDriverId.get(driver.Driver.driverId) ?? null;
    let gridPosition: number;
    // grid must be a real slot (>= 1). FastF1 writes -1 when it can't resolve the grid
    // for a just-finished race; an unguarded parseInt("-1") put every driver at grid -1,
    // which coloured every quali->grid leg as a "gain" and stacked a bogus red bar. Treat
    // anything <= 0 as "no grid" and fall back to the quali position.
    const gridNum = parseInt(driver.grid);
    if (driver.grid != null && driver.grid !== "" && !isNaN(gridNum) && gridNum > 0) {
      gridPosition = gridNum;
    } else if (qualiPos != null) {
      gridPosition = qualiPos;
    } else {
      gridPosition = nextSyntheticGrid++;
    }

    // Qualifying position for chart: use actual quali if available, else grid (so they appear in Qualifying column)
    const qualifyingPosition = qualiPos ?? gridPosition;

    // Grid node
    nodes.push({
      id: `${gridIdPrefix}${gridPosition}`,
      name: driverCode,
      fullName: driverName,
      team,
      teamName,
      position: gridPosition,
      type: 'grid'
    });
    
    // Race node
    nodes.push({
      id: `${raceIdPrefix}${racePosition}`,
      name: driverCode,
      fullName: driverName,
      team,
      teamName,
      position: racePosition,
      type: 'race',
      status,
      isDNF,
      points
    });

    // Quali -> Grid link for every driver (use grid as "quali" when no quali result)
    links.push({
      source: `${qualifyingIdPrefix}${qualifyingPosition}`,
      target: `${gridIdPrefix}${gridPosition}`,
      value: 1,
      name: driverCode,
      code: driverCode,
      fullName: driverName,
      team,
      teamName,
      qualifyingPosition,
      gridPosition,
      racePosition,
      positionChange: qualifyingPosition - gridPosition,
      status,
      isDNF,
      points: 0
    });
    
    links.push({
      source: `${gridIdPrefix}${gridPosition}`,
      target: `${raceIdPrefix}${racePosition}`,
      value: 1,
      name: driverCode,
      code: driverCode,
      fullName: driverName,
      team,
      teamName,
      qualifyingPosition,
      gridPosition,
      racePosition,
      positionChange: gridPosition - racePosition,
      status,
      isDNF,
      points
    });
  });

  // Build qualifying nodes: from API for drivers who qualified, and synthetic for the rest (from link driver info)
  const qualiNodeByPosition = new Map<number, { id: string; name: string; fullName: string; team: string; teamName: string; position: number }>();
  
  if (hasQualifying) {
    qualifying.forEach((driver: any) => {
      if (!driver.position) return;
      const position = parseInt(driver.position);
      // Same partial-payload guard as the race path above: the warehouse can serve a
      // qualifying row with a null Constructor (and Driver fields absent) before Ergast
      // enrichment lands. Unguarded `driver.Constructor.constructorId` here threw and blanked
      // the whole progression chart ("No progression data") whenever quali had positions but
      // no constructor yet.
      qualiNodeByPosition.set(position, {
        id: `${qualifyingIdPrefix}${position}`,
        name: driver.Driver?.code ?? "",
        fullName: `${driver.Driver?.givenName ?? ""} ${driver.Driver?.familyName ?? ""}`.trim(),
        team: driver.Constructor?.constructorId ?? "unknown",
        teamName: driver.Constructor?.name ?? "Unknown",
        position
      });
    });
  }

  // Add qualifying node for every position used as link source (from API or synthetic from link)
  const qualifyingPositionsUsed = new Set<number>();
  links.forEach((link: any) => {
    if (link.source.startsWith(qualifyingIdPrefix)) {
      const pos = parseInt(link.source.slice(1), 10);
      if (!isNaN(pos)) qualifyingPositionsUsed.add(pos);
    }
  });

  qualifyingPositionsUsed.forEach((position) => {
    if (qualiNodeByPosition.has(position)) {
      const n = qualiNodeByPosition.get(position)!;
      nodes.push({
        id: n.id,
        name: n.name,
        fullName: n.fullName,
        team: n.team,
        teamName: n.teamName,
        position: n.position,
        type: 'qualifying'
      });
      return;
    }
    // Synthetic: use driver info from the link that has this quali position as source
    const link = links.find((l: any) => l.source === `${qualifyingIdPrefix}${position}`);
    if (link) {
      nodes.push({
        id: `${qualifyingIdPrefix}${position}`,
        name: link.name,
        fullName: link.fullName,
        team: link.team,
        teamName: link.teamName,
        position,
        type: 'qualifying'
      });
    }
  });

  return { nodes, links };
};

// ───────────────────────────── season sankey ─────────────────────────────

/** A classified finish (Finished / Lapped / +N Lap) is never a DNF — mirrors
 *  the same rule in f1Warehouse + the ingest pipeline, guarding against stale
 *  warehouse rows where is_dnf is set but the driver was classified. */
const isClassifiedFinish = (status: string): boolean => {
  const s = (status ?? "").trim();
  return s === "Finished" || s === "Lapped" || /^\+\d+\s+Lap/i.test(s);
};

const isValidPosition = (v: unknown): boolean => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
};

const isDNFResult = (position: unknown, status: string): boolean => {
  return !isValidPosition(position) || !isClassifiedFinish(status);
};

// Nodes outside the normal P1..Pn range sort last (bottom of their column).
const POSITION_NODE_LAST = 9999;

export interface SeasonSankeyLink {
  source: string; // node id: "grid-1" | "grid-pitlane"
  target: string; // node id: "finish-3" | "finish-dnf"
  value: number; // number of races with this grid → finish
  gridPosition: number | null; // null ⇒ pit-lane start
  racePosition: number | null; // null ⇒ DNF
  isDNF: boolean;
  isPitLane: boolean;
  teams: string[]; // constructorIds of the contributing drivers (deduped)
  drivers: Array<{
    code: string;
    name: string;
    team: string;
    teamName: string;
  }>;
}

interface SeasonLinkAccum {
  source: string;
  target: string;
  value: number;
  gridPosition: number | null;
  racePosition: number | null;
  isDNF: boolean;
  isPitLane: boolean;
  teams: Set<string>;
  drivers: Array<{
    code: string;
    name: string;
    team: string;
    teamName: string;
  }>;
}

/**
 * Aggregate every driver's grid → finishing position across all races in a
 * season into one Sankey.
 *
 * - One link per driver per race (value = 1), summed by (grid, finish) pair,
 *   so link value = count of races with that grid → finish.
 * - Left column: starting positions (P1…Pn) plus a dedicated "Pit lane" node.
 * - Right column: finishing positions (P1…Pn) plus a dedicated "DNF" node.
 * - Drivers starting from the pit lane (grid null / 0 / invalid) flow from the
 *   "Pit lane" node; drivers who don't finish flow into the "DNF" node.
 *
 * Returns empty nodes/links (never throws) when there is nothing to show.
 */
export const buildSeasonSankey = (
  roundResults: any[]
): { nodes: SankeyNode[]; links: SeasonSankeyLink[] } => {
  const linkMap = new Map<string, SeasonLinkAccum>();
  const gridPositions = new Set<number>();
  const finishPositions = new Set<number>();
  let hasPitLane = false;
  let hasDNF = false;

  roundResults.forEach((race: any) => {
    const results = Array.isArray(race?.Results) ? race.Results : [];
    results.forEach((result: any) => {
      const gridRaw = result.grid;
      const gridNum = Number(gridRaw);
      const isPitLane =
        gridRaw == null || gridRaw === "" || !Number.isFinite(gridNum) || gridNum <= 0;

      const position = result.position;
      const status = String(result.status ?? "");
      const dnf = isDNFResult(position, status);

      const driverCode = result.Driver?.code ?? "";
      const driverName =
        `${result.Driver?.givenName ?? ""} ${result.Driver?.familyName ?? ""}`.trim() ||
        driverCode;
      const team = result.Constructor?.constructorId ?? "unknown";
      const teamName = result.Constructor?.name ?? "Unknown";

      const sourceId = isPitLane ? "grid-pitlane" : `grid-${gridNum}`;
      const targetId = dnf ? "finish-dnf" : `finish-${Number(position)}`;

      if (isPitLane) hasPitLane = true;
      else gridPositions.add(gridNum);
      if (dnf) hasDNF = true;
      else finishPositions.add(Number(position));

      const key = `${sourceId}|${targetId}`;
      const existing = linkMap.get(key);
      if (existing) {
        existing.value += 1;
        existing.teams.add(team);
        existing.drivers.push({ code: driverCode, name: driverName, team, teamName });
      } else {
        linkMap.set(key, {
          source: sourceId,
          target: targetId,
          value: 1,
          gridPosition: isPitLane ? null : gridNum,
          racePosition: dnf ? null : Number(position),
          isDNF: dnf,
          isPitLane,
          teams: new Set([team]),
          drivers: [{ code: driverCode, name: driverName, team, teamName }],
        });
      }
    });
  });

  const nodes: SankeyNode[] = [];
  [...gridPositions]
    .sort((a, b) => a - b)
    .forEach((pos) => {
      nodes.push({ id: `grid-${pos}`, name: `P${pos}`, position: pos, type: "grid" });
    });
  if (hasPitLane) {
    nodes.push({
      id: "grid-pitlane",
      name: "Pit lane",
      position: POSITION_NODE_LAST,
      type: "pit-lane",
    });
  }
  [...finishPositions]
    .sort((a, b) => a - b)
    .forEach((pos) => {
      nodes.push({ id: `finish-${pos}`, name: `P${pos}`, position: pos, type: "finish" });
    });
  if (hasDNF) {
    nodes.push({
      id: "finish-dnf",
      name: "DNF",
      position: POSITION_NODE_LAST,
      type: "dnf",
      isDNF: true,
    });
  }

  const links: SeasonSankeyLink[] = Array.from(linkMap.values()).map(
    ({ teams, drivers, ...rest }) => ({
      ...rest,
      teams: Array.from(teams),
      drivers,
    })
  );

  return { nodes, links };
};
