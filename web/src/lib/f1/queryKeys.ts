/**
 * Hierarchical React Query keys for F1 DataStop.
 *
 * Convention:
 * - `f1.*` — Jolpica/Ergast API data
 * - `openF1.*` — OpenF1 API data
 * - `metadata.*` — processed standings metadata (derived from Ergast)
 * - `telemetry.*` — merged telemetry fetches
 *
 * Usage:
 *   queryKey: f1Keys.standings.drivers(2025)
 *   queryClient.invalidateQueries({ queryKey: f1Keys.standings.all })
 */

const f1Root = ["f1"] as const;
const openF1Root = ["openF1"] as const;
const metadataRoot = ["metadata"] as const;
const telemetryRoot = ["telemetry"] as const;

/** Optional segment — keeps keys stable when a filter is absent. */
function optional<T>(value: T | undefined | null, fallback: string | number = "all"): T | string | number {
  return value ?? fallback;
}

export const f1Keys = {
  all: f1Root,
  standings: {
    all: [...f1Root, "standings"] as const,
    drivers: (year?: number) => [...f1Root, "standings", "drivers", year] as const,
    constructors: (year?: number) => [...f1Root, "standings", "constructors", year] as const,
  },
  schedule: (year?: number) => [...f1Root, "schedule", year] as const,
  raceResults: (year: number, round: string) => [...f1Root, "race", year, round, "results"] as const,
  qualifying: (year: number, round: string) => [...f1Root, "race", year, round, "qualifying"] as const,
  lapTimes: (year: number, round: string, scope: "firstDriverOnly" | "allDrivers") =>
    [...f1Root, "race", year, round, "lapTimes", scope] as const,
  pitStops: (year: number, round: string) => [...f1Root, "race", year, round, "pitStops"] as const,
  sprintResults: (year: number, round: string) => [...f1Root, "race", year, round, "sprint"] as const,
  lastRaceResults: (year?: number) => [...f1Root, "lastRace", year, "results"] as const,
  lastRacePitStops: (year?: number) => [...f1Root, "lastRace", year, "pitStops"] as const,
  nextRace: (year?: number) => [...f1Root, "nextRace", year] as const,
  raceStatus: (sessionId?: string) => [...f1Root, "raceStatus", sessionId] as const,
  driverInfo: (year?: number) => [...f1Root, "drivers", year, "info"] as const,
  driverResultsBySeason: (year: number, driverId: string) =>
    [...f1Root, "drivers", year, driverId, "results"] as const,
  allDriverResultsBySeason: (year: number) => [...f1Root, "drivers", year, "allResults"] as const,
  weatherData: (sessionId?: string) => [...f1Root, "weather", sessionId] as const,
  news: () => [...f1Root, "news"] as const,
  circuits: () => [...f1Root, "circuits"] as const,
  qualifyingToRace: (year?: number) => [...f1Root, "qualifyingToRace", year] as const,
  qualifyingToRaceRound: (year: number, round: string) =>
    [...f1Root, "qualifyingToRace", year, round] as const,
};

export const openF1Keys = {
  all: openF1Root,
  latestSession: () => [...openF1Root, "latestSession"] as const,
  latestSessionDrivers: () => [...openF1Root, "latestSession", "drivers"] as const,
  latestDriver: (driverNumber?: number, nameAcronym?: string) =>
    [...openF1Root, "latestDriver", optional(driverNumber), optional(nameAcronym, "any")] as const,
  sessions: (year: number) => [...openF1Root, "sessions", year] as const,
  session: (meetingKey: number, sessionType?: string) =>
    [...openF1Root, "session", meetingKey, optional(sessionType, "any")] as const,
  sessionFromErgast: (year: number, round: string, sessionType?: string) =>
    [...openF1Root, "sessionFromErgast", year, round, optional(sessionType, "Race")] as const,
  sessionResource: (
    resource: string,
    sessionKey: number,
    ...params: (string | number | undefined)[]
  ) => [...openF1Root, "session", sessionKey, resource, ...params.map((p) => optional(p))] as const,
  lapData: (sessionKey: number, driverNumber?: number) =>
    openF1Keys.sessionResource("lapData", sessionKey, driverNumber),
  carData: (sessionKey: number, driverNumber?: number) =>
    openF1Keys.sessionResource("carData", sessionKey, driverNumber),
  weatherData: (sessionKey: number) => [...openF1Root, "session", sessionKey, "weather"] as const,
  drivers: (sessionKey: number, driverNumber?: number) =>
    openF1Keys.sessionResource("drivers", sessionKey, driverNumber),
  teamRadio: (sessionKey: number, driverNumber?: number) =>
    openF1Keys.sessionResource("teamRadio", sessionKey, driverNumber),
  raceControl: (sessionKey: number) => [...openF1Root, "session", sessionKey, "raceControl"] as const,
  positionData: (sessionKey: number, driverNumber?: number) =>
    openF1Keys.sessionResource("positionData", sessionKey, driverNumber),
  overtakes: (
    sessionKey: number,
    overtakingDriverNumber?: number,
    overtakenDriverNumber?: number,
    position?: number,
  ) =>
    [
      ...openF1Root,
      "session",
      sessionKey,
      "overtakes",
      optional(overtakingDriverNumber),
      optional(overtakenDriverNumber),
      optional(position),
    ] as const,
  laps: (sessionKey: number, driverNumber?: number, lapNumber?: number) =>
    openF1Keys.sessionResource("laps", sessionKey, driverNumber, lapNumber),
  startingGrid: (sessionKey: number) => [...openF1Root, "session", sessionKey, "startingGrid"] as const,
};

export const metadataKeys = {
  all: metadataRoot,
  drivers: (year: number) => [...metadataRoot, "drivers", year] as const,
  constructors: (year: number) => [...metadataRoot, "constructors", year] as const,
};

export const telemetryKeys = {
  all: telemetryRoot,
  session: (sessionKey: number, driverNumber?: number) =>
    [...telemetryRoot, sessionKey, optional(driverNumber)] as const,
};

export type F1QueryKey =
  | ReturnType<(typeof f1Keys)["standings"]["drivers"]>
  | ReturnType<(typeof openF1Keys)["lapData"]>
  | ReturnType<(typeof metadataKeys)["drivers"]>;
