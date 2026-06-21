/**
 * Race insights — synthesis computed from Ergast race results + qualifying.
 * Pure functions, no data fetching. Powers the Race Analysis "Overview" tab.
 */
import { mapErgastResultsToDrivers } from "./positionChanges";

export interface ErgastResultRow {
  position: string;
  points?: string;
  grid?: string;
  status?: string;
  Driver: {
    driverId: string;
    code?: string;
    givenName: string;
    familyName: string;
  };
  Constructor?: { constructorId?: string; name?: string };
  Time?: { time?: string };
  FastestLap?: {
    rank?: string;
    lap?: string;
    Time?: { time?: string };
    AverageSpeed?: { speed?: string; units?: string };
  };
}

export interface ErgastQualifyingRow {
  position: string;
  Driver: { driverId: string; code?: string };
  Q1?: string;
  Q2?: string;
  Q3?: string;
}

export interface RaceSummary {
  winner: { code: string; name: string; team: string } | null;
  pole: { code: string; driverId: string } | null;
  poleToWin: boolean;
  fastestLap: { code: string; team: string; time: string } | null;
  winMargin: string | null;
  biggestGainer: { code: string; team: string; delta: number } | null;
  biggestLoser: { code: string; team: string; delta: number } | null;
  dnfCount: number;
  finishers: number;
  totalDrivers: number;
}

export interface QualiRaceDeltaRow {
  driverId: string;
  code: string;
  team: string;
  grid: number;
  finish: number;
  delta: number;
  isDNF: boolean;
}

export interface TeammateH2HRow {
  team: string;
  driverACode: string;
  driverBCode: string;
  gridA: number;
  gridB: number;
  finishA: number;
  finishB: number;
  qualiWinner: string | null;
  raceWinner: string | null;
  dnfA: boolean;
  dnfB: boolean;
}

/** Per-driver grid → finish delta, classified drivers first, sorted by delta desc. */
export function computeQualiRaceDelta(
  results: ErgastResultRow[] | undefined | null,
): QualiRaceDeltaRow[] {
  if (!results?.length) return [];
  const drivers = mapErgastResultsToDrivers(results);
  return drivers
    .map((d) => ({
      driverId: d.driverId,
      code: d.code,
      team: d.team,
      grid: d.grid,
      finish: d.finishPosition,
      delta: d.grid > 0 && !d.isDNF ? d.grid - d.finishPosition : 0,
      isDNF: !!d.isDNF,
    }))
    .sort((a, b) => {
      // DNFs sink to the bottom, otherwise by delta gained
      if (a.isDNF !== b.isDNF) return a.isDNF ? 1 : -1;
      return b.delta - a.delta;
    });
}

export function computeRaceSummary(
  results: ErgastResultRow[] | undefined | null,
  qualifying: ErgastQualifyingRow[] | undefined | null,
): RaceSummary {
  const empty: RaceSummary = {
    winner: null,
    pole: null,
    poleToWin: false,
    fastestLap: null,
    winMargin: null,
    biggestGainer: null,
    biggestLoser: null,
    dnfCount: 0,
    finishers: 0,
    totalDrivers: 0,
  };
  if (!results?.length) return empty;

  const drivers = mapErgastResultsToDrivers(results);
  const codeOf = (driverId: string) =>
    drivers.find((d) => d.driverId === driverId)?.code ?? driverId.slice(0, 3).toUpperCase();

  const winnerRow = results.find((r) => parseInt(r.position, 10) === 1) ?? null;
  const winner = winnerRow
    ? {
        code: winnerRow.Driver.code || winnerRow.Driver.familyName.slice(0, 3).toUpperCase(),
        name: `${winnerRow.Driver.givenName} ${winnerRow.Driver.familyName}`,
        team: winnerRow.Constructor?.constructorId || "unknown",
      }
    : null;

  const poleRow = qualifying?.find((q) => parseInt(q.position, 10) === 1) ?? null;
  const pole = poleRow
    ? { code: poleRow.Driver.code || codeOf(poleRow.Driver.driverId), driverId: poleRow.Driver.driverId }
    : null;

  const poleToWin = !!(pole && winnerRow && pole.driverId === winnerRow.Driver.driverId);

  const flRow = results.find((r) => r.FastestLap?.rank === "1");
  const fastestLap = flRow?.FastestLap?.Time?.time
    ? {
        code: flRow.Driver.code || flRow.Driver.familyName.slice(0, 3).toUpperCase(),
        team: flRow.Constructor?.constructorId || "unknown",
        time: flRow.FastestLap.Time.time,
      }
    : null;

  // Margin = gap of P2 to the winner (Ergast Time.time for P2 is "+x.xxx")
  const p2 = results.find((r) => parseInt(r.position, 10) === 2);
  const winMargin = p2?.Time?.time ?? null;

  const deltas = computeQualiRaceDelta(results).filter((d) => !d.isDNF && d.grid > 0);
  const gainers = [...deltas].sort((a, b) => b.delta - a.delta);
  const biggestGainer =
    gainers.length && gainers[0].delta > 0
      ? { code: gainers[0].code, team: gainers[0].team, delta: gainers[0].delta }
      : null;
  const losers = [...deltas].sort((a, b) => a.delta - b.delta);
  const biggestLoser =
    losers.length && losers[0].delta < 0
      ? { code: losers[0].code, team: losers[0].team, delta: losers[0].delta }
      : null;

  const dnfCount = drivers.filter((d) => d.isDNF).length;

  return {
    winner,
    pole,
    poleToWin,
    fastestLap,
    winMargin,
    biggestGainer,
    biggestLoser,
    dnfCount,
    finishers: drivers.length - dnfCount,
    totalDrivers: drivers.length,
  };
}

/** Teammate head-to-head (qualifying + race) for every team that fielded 2 drivers. */
export function computeTeammateH2H(
  results: ErgastResultRow[] | undefined | null,
  qualifying: ErgastQualifyingRow[] | undefined | null,
): TeammateH2HRow[] {
  if (!results?.length) return [];
  const drivers = mapErgastResultsToDrivers(results);

  const qualiPos = new Map<string, number>();
  qualifying?.forEach((q) => {
    qualiPos.set(q.Driver.driverId, parseInt(q.position, 10) || 0);
  });

  const byTeam = new Map<string, typeof drivers>();
  drivers.forEach((d) => {
    const list = byTeam.get(d.team) ?? [];
    list.push(d);
    byTeam.set(d.team, list);
  });

  const rows: TeammateH2HRow[] = [];
  byTeam.forEach((list, team) => {
    if (list.length !== 2) return;
    // Order by finish so A is the better-finishing car (DNFs last)
    const [a, b] = [...list].sort((x, y) => {
      if (!!x.isDNF !== !!y.isDNF) return x.isDNF ? 1 : -1;
      return x.finishPosition - y.finishPosition;
    });

    const qa = qualiPos.get(a.driverId) || 0;
    const qb = qualiPos.get(b.driverId) || 0;
    let qualiWinner: string | null = null;
    if (qa > 0 && qb > 0) qualiWinner = qa < qb ? a.code : b.code;

    let raceWinner: string | null = null;
    if (!a.isDNF && !b.isDNF) raceWinner = a.finishPosition < b.finishPosition ? a.code : b.code;
    else if (a.isDNF !== b.isDNF) raceWinner = a.isDNF ? b.code : a.code;

    rows.push({
      team,
      driverACode: a.code,
      driverBCode: b.code,
      gridA: a.grid,
      gridB: b.grid,
      finishA: a.finishPosition,
      finishB: b.finishPosition,
      qualiWinner,
      raceWinner,
      dnfA: !!a.isDNF,
      dnfB: !!b.isDNF,
    });
  });

  return rows;
}
