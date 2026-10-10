export type OvertakeDriverInfo = {
  number: number;
  name: string;
  acronym: string;
  team: string;
  color: string;
  gridPosition: number;
  finalPosition: number;
};

export type DriverOvertakeStats = {
  driver_number: number;
  acronym: string;
  team: string;
  color: string;
  overtakes_made: number;
  overtakes_suffered: number;
  net_overtakes: number;
  starting_position: number;
  final_position: number;
  position_change: number;
  status: "running" | "dnf";
};

/** Positions per driver per lap (lap 0 = grid). */
export function buildPositionsByLap(
  positionData: Array<{ position?: number; date: string; driver_number: number }> | undefined,
  lapsData: Array<{ lap_number?: number; date_start?: string }> | undefined,
  drivers: Record<number, OvertakeDriverInfo>,
  startingGridData?: Array<{ driver_number: number; position: number }>,
): Record<number, Record<number, number>> {
  if (!positionData?.length || !lapsData?.length) return {};

  const lapTimestamps: Record<number, Date> = {};
  lapsData.forEach((lap) => {
    if (lap.lap_number && lap.date_start) {
      lapTimestamps[lap.lap_number] = new Date(lap.date_start);
    }
  });

  const positionsByDriver: Record<number, Record<number, number>> = {};

  Object.entries(drivers).forEach(([numStr, driver]) => {
    const num = parseInt(numStr, 10);
    positionsByDriver[num] = { 0: driver.gridPosition };
  });

  if (startingGridData?.length) {
    startingGridData.forEach((grid) => {
      if (!positionsByDriver[grid.driver_number]) {
        positionsByDriver[grid.driver_number] = {};
      }
      if (
        !positionsByDriver[grid.driver_number][0] ||
        positionsByDriver[grid.driver_number][0] === 20
      ) {
        positionsByDriver[grid.driver_number][0] = grid.position;
      }
    });
  }

  positionData.forEach((pos) => {
    if (!pos.position || pos.position < 1 || pos.position > 25) return;
    const posDate = new Date(pos.date);
    let closestLap = 1;
    let minDiff = Infinity;
    Object.entries(lapTimestamps).forEach(([lapNum, lapDate]) => {
      const diff = Math.abs(posDate.getTime() - lapDate.getTime());
      if (diff < minDiff) {
        minDiff = diff;
        closestLap = parseInt(lapNum, 10);
      }
    });
    if (!positionsByDriver[pos.driver_number]) {
      positionsByDriver[pos.driver_number] = {};
    }
    positionsByDriver[pos.driver_number][closestLap] = pos.position;
  });

  return positionsByDriver;
}

export function computeDriverOvertakeStats(
  drivers: Record<number, OvertakeDriverInfo>,
  overtakesData: Array<{ overtaking_driver_number: number; overtaken_driver_number: number }> | undefined,
  ergastResults: Array<{ Driver?: { code?: string }; status?: string }>,
): DriverOvertakeStats[] {
  if (!drivers || Object.keys(drivers).length === 0) return [];

  const stats: DriverOvertakeStats[] = [];

  Object.values(drivers).forEach((driver) => {
    let overtakesMade = 0;
    let overtakesSuffered = 0;
    overtakesData?.forEach((ot) => {
      if (ot.overtaking_driver_number === driver.number) overtakesMade++;
      if (ot.overtaken_driver_number === driver.number) overtakesSuffered++;
    });

    const ergastResult = ergastResults.find((r) => r.Driver?.code === driver.acronym);
    const status =
      ergastResult?.status === "Finished" || ergastResult?.status?.includes("+")
        ? "running"
        : "dnf";

    stats.push({
      driver_number: driver.number,
      acronym: driver.acronym,
      team: driver.team,
      color: driver.color,
      overtakes_made: overtakesMade,
      overtakes_suffered: overtakesSuffered,
      net_overtakes: overtakesMade - overtakesSuffered,
      starting_position: driver.gridPosition,
      final_position: driver.finalPosition,
      position_change: driver.gridPosition - driver.finalPosition,
      status,
    });
  });

  return stats.sort((a, b) => a.final_position - b.final_position);
}

export function buildOvertakePositionChartData(
  positionsByLap: Record<number, Record<number, number>>,
  drivers: Record<number, OvertakeDriverInfo>,
  totalLaps: number,
  selectedDriver: number | null,
): { rows: Array<Record<string, number | null>>; series: Array<{ label: string; color: string; id: string }> } {
  if (!drivers || Object.keys(positionsByLap).length === 0) {
    return { rows: [], series: [] };
  }

  const laps = Array.from({ length: totalLaps + 1 }, (_, i) => i);
  const series: Array<{ label: string; color: string; id: string }> = [];
  const driversToShow = selectedDriver
    ? [selectedDriver]
    : Object.keys(drivers).map(Number).slice(0, 10);

  const driverLapPositions: Array<{ label: string; positions: (number | null)[] }> = [];
  driversToShow.forEach((driverNumber) => {
    const driver = drivers[driverNumber];
    if (!driver) return;
    const driverPositions = positionsByLap[driverNumber] || {};
    let lastKnownPos: number | null = null;
    const positions = laps.map((lap) => {
      if (driverPositions[lap] !== undefined) lastKnownPos = driverPositions[lap];
      return lastKnownPos;
    });
    series.push({ label: driver.acronym, color: driver.color, id: `driver-${driverNumber}` });
    driverLapPositions.push({ label: driver.acronym, positions });
  });

  const rows = laps.map((lap, i) => {
    const row: Record<string, number | null> = { lap };
    driverLapPositions.forEach((d) => {
      row[d.label] = d.positions[i];
    });
    return row;
  });

  return { rows, series };
}

/** Re-export lap-time chart helpers from utils (canonical location migrating to lib/f1). */
export {
  convertLapTimeToSeconds,
  formatTime,
  formatPercentage,
  processLapTimeData,
  getDriverAverageLapTime,
} from "@/utils/lapTimeUtils";
