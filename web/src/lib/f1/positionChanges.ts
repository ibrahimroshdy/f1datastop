/** Ergast race result status patterns that indicate DNF. */
export const ERGAST_DNF_STATUSES = [
  "Accident",
  "Collision",
  "Collision damage",
  "Engine",
  "Gearbox",
  "Transmission",
  "Hydraulics",
  "Brakes",
  "Suspension",
  "Retired",
  "Electrical",
  "Mechanical",
  "Wheel",
  "Tyre",
  "Puncture",
  "Overheating",
  "Power Unit",
  "ERS",
  "Turbo",
  "Oil pressure",
  "Fuel pressure",
  "Fuel pump",
  "Water pressure",
  "Clutch",
  "Driveshaft",
  "Electronics",
  "Throttle",
  "Steering",
  "Spun off",
  "Damage",
  "Did not start",
  "Did not finish",
  "Disqualified",
  "Excluded",
  "Withdrew",
  "Not classified",
  "Illness",
  "Injury",
  "Safety",
] as const;

export interface PositionDriver {
  driverId: string;
  code: string;
  name: string;
  team: string;
  finishPosition: number;
  grid: number;
  status?: string;
  isDNF?: boolean;
}

export interface PositionChangeSummary {
  start: number;
  end: number;
  change: number;
  improved: boolean;
  isDNF?: boolean;
  status?: string;
}

export type PositionChartLap = { lap: number; [driverCode: string]: number };

export function isErgastDriverDNF(status: string, position: number): boolean {
  const finishedStatuses = ["Finished", "finished"];
  const isFinished =
    finishedStatuses.includes(status) || status.includes("+") || status.includes("Lap");

  return (
    !isFinished &&
    (ERGAST_DNF_STATUSES.some((dnfStatus) =>
      status.toLowerCase().includes(dnfStatus.toLowerCase()),
    ) ||
      (position === 0 && status !== ""))
  );
}

export function mapErgastResultsToDrivers(results: Array<{
  Driver: { driverId: string; code?: string; givenName: string; familyName: string };
  Constructor?: { constructorId?: string };
  position: string;
  grid?: string;
  status?: string;
}>): PositionDriver[] {
  return results.map((result) => {
    const status = result.status || "";
    const finishPosition = parseInt(result.position, 10) || 0;
    const isDNF = isErgastDriverDNF(status, finishPosition);

    return {
      driverId: result.Driver.driverId,
      code:
        result.Driver.code ||
        result.Driver.familyName.substring(0, 3).toUpperCase(),
      name: `${result.Driver.givenName} ${result.Driver.familyName}`,
      team: result.Constructor?.constructorId || "unknown",
      finishPosition,
      grid: parseInt(result.grid || "0", 10) || 0,
      status,
      isDNF,
    };
  });
}

export function buildPositionChartData(
  lapTimesData: { data?: { Races?: Array<{ Laps?: Array<{ number: string; Timings: Array<{ driverId: string; position: string }> }> }> } },
  availableDrivers: PositionDriver[],
): PositionChartLap[] {
  if (!lapTimesData?.data?.Races?.length) return [];

  const race = lapTimesData.data.Races[0];
  if (!race.Laps?.length) return [];

  return race.Laps.map((lap) => {
    const lapNumber = parseInt(lap.number, 10);
    const lapData: PositionChartLap = { lap: lapNumber };

    lap.Timings.forEach((timing) => {
      const driver = availableDrivers.find((d) => d.driverId === timing.driverId);
      const driverCode =
        driver?.code || timing.driverId.substring(0, 3).toUpperCase();
      lapData[driverCode] = parseInt(timing.position, 10);
    });

    return lapData;
  });
}

export function getPositionChangeSummary(
  driverCode: string,
  driver: PositionDriver,
  chartData: PositionChartLap[],
): PositionChangeSummary | null {
  const startPos = driver.grid || 0;
  const endPos = driver.finishPosition || 0;
  const isDNF = driver.isDNF;

  if (startPos === 0) {
    if (chartData.length === 0) return null;
    const firstLap = chartData[0];
    if (!firstLap[driverCode]) return null;

    const lapStartPos = firstLap[driverCode] as number;
    const posChange = lapStartPos - endPos;

    return {
      start: lapStartPos,
      end: isDNF ? 0 : endPos,
      change: isDNF ? 0 : posChange,
      improved: !isDNF && posChange > 0,
      isDNF,
      status: driver.status,
    };
  }

  const posChange = startPos - endPos;

  return {
    start: startPos,
    end: isDNF ? 0 : endPos,
    change: isDNF ? 0 : posChange,
    improved: !isDNF && posChange > 0,
    isDNF,
    status: driver.status,
  };
}
