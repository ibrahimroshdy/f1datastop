import {
  colorWithAlpha,
  darkenColor,
  getTeamColorById,
  lightenColor,
  TEAM_COLORS,
} from "@/constants/f1Colors";
import type {
  ErgastConstructorRef,
  ErgastConstructorStandingRow,
  ErgastDriverRef,
  ErgastDriverStandingRow,
  F1Driver,
  F1Team,
  OpenF1DriverRow,
} from "@/lib/f1/types";

/** Resolve team accent color from Ergast constructorId. */
export function resolveTeamColor(constructorId: string): string {
  if (!constructorId) return TEAM_COLORS.default;
  return getTeamColorById(constructorId) || TEAM_COLORS.default;
}

/** Current team — last constructor in the standing row (Ergast convention). */
export function getPrimaryConstructor(
  entry: ErgastDriverStandingRow,
): ErgastConstructorRef | null {
  const list = entry.Constructors ?? [];
  return list.length > 0 ? list[list.length - 1] : null;
}

export function normalizeErgastDriver(
  driver: ErgastDriverRef,
  constructor: ErgastConstructorRef | null,
  options: {
    teamColor?: string;
    position?: number;
    points?: number;
    wins?: number;
  } = {},
): F1Driver {
  const teamId = constructor?.constructorId ?? "";
  const teamColor = options.teamColor ?? resolveTeamColor(teamId);

  return {
    ergastId: driver.driverId,
    code: driver.code ?? "",
    url: driver.url ?? "",
    givenName: driver.givenName,
    familyName: driver.familyName,
    fullName: `${driver.givenName} ${driver.familyName}`.trim(),
    nationality: driver.nationality ?? "",
    permanentNumber: driver.permanentNumber ?? "",
    dateOfBirth: driver.dateOfBirth ?? "",
    teamId,
    teamName: constructor?.name ?? "",
    teamColor,
    teamColorLight: lightenColor(teamColor, 0.3),
    teamColorDark: darkenColor(teamColor, 0.3),
    position: options.position ?? 0,
    points: options.points ?? 0,
    wins: options.wins ?? 0,
  };
}

export function normalizeErgastDriverStanding(
  entry: ErgastDriverStandingRow,
  teamColor?: string,
): F1Driver {
  const constructor = getPrimaryConstructor(entry);
  const resolvedColor =
    teamColor ?? resolveTeamColor(constructor?.constructorId ?? "");

  return normalizeErgastDriver(entry.Driver, constructor, {
    teamColor: resolvedColor,
    position: parseInt(entry.position, 10) || 0,
    points: parseFloat(entry.points) || 0,
    wins: parseInt(entry.wins, 10) || 0,
  });
}

export function normalizeErgastConstructorStanding(
  entry: ErgastConstructorStandingRow,
  driverCodes: string[] = [],
): F1Team {
  const constructor = entry.Constructor;
  const color = resolveTeamColor(constructor.constructorId);

  return {
    ergastId: constructor.constructorId,
    url: constructor.url ?? "",
    name: constructor.name,
    nationality: constructor.nationality ?? "",
    color,
    colorLight: lightenColor(color, 0.3),
    colorDark: darkenColor(color, 0.3),
    position: parseInt(entry.position, 10) || 0,
    points: parseFloat(entry.points) || 0,
    wins: parseInt(entry.wins, 10) || 0,
    driverCodes,
  };
}

/** Map OpenF1 driver row to canonical partial (headshot, number, acronym). */
export function normalizeOpenF1Driver(driver: OpenF1DriverRow): Partial<F1Driver> {
  return {
    openF1Number: driver.driver_number,
    code: driver.name_acronym || driver.last_name.substring(0, 3).toUpperCase(),
    givenName: driver.first_name,
    familyName: driver.last_name,
    fullName: `${driver.first_name} ${driver.last_name}`.trim(),
    permanentNumber: driver.driver_number.toString(),
    nationality: driver.country_code ?? "",
    teamName: driver.team_name ?? "",
    headshotUrl: driver.headshot_url,
  };
}

/** Merge Ergast-normalized driver with OpenF1 enrichment. */
export function mergeDriver(ergast: F1Driver, openF1?: Partial<F1Driver> | null): F1Driver {
  if (!openF1) return ergast;

  return {
    ...ergast,
    openF1Number: openF1.openF1Number ?? ergast.openF1Number,
    headshotUrl: openF1.headshotUrl ?? ergast.headshotUrl,
    permanentNumber: openF1.permanentNumber || ergast.permanentNumber,
    code: openF1.code || ergast.code,
  };
}

/** Legacy Ergast-shaped object for components still expecting raw API format. */
export function openF1DriverToErgastShape(driver: OpenF1DriverRow) {
  return {
    driverId: driver.driver_number.toString(),
    code:
      driver.name_acronym || driver.last_name.substring(0, 3).toUpperCase(),
    permanentNumber: driver.driver_number.toString(),
    givenName: driver.first_name,
    familyName: driver.last_name,
    dateOfBirth: "",
    nationality: driver.country_code,
    Constructor: {
      constructorId:
        driver.team_name?.toLowerCase().replace(/\s+/g, "-") || "unknown",
      name: driver.team_name || "Unknown Team",
      nationality: "",
    },
  };
}

/** Team color for a raw Ergast driver standing row. */
export function teamColorForStanding(entry: ErgastDriverStandingRow): string {
  const constructor = getPrimaryConstructor(entry);
  return resolveTeamColor(constructor?.constructorId ?? "");
}

/** @deprecated Use openF1DriverToErgastShape — kept for apiAdapters re-export. */
export const mapOpenF1DriverToErgast = openF1DriverToErgastShape;

export { colorWithAlpha };
