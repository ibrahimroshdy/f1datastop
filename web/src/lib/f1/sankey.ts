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
      if (driver.position) {
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
    if (driver.grid != null && driver.grid !== "" && !isNaN(parseInt(driver.grid))) {
      gridPosition = parseInt(driver.grid);
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
      qualiNodeByPosition.set(position, {
        id: `${qualifyingIdPrefix}${position}`,
        name: driver.Driver.code,
        fullName: `${driver.Driver.givenName} ${driver.Driver.familyName}`,
        team: driver.Constructor.constructorId,
        teamName: driver.Constructor.name,
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
