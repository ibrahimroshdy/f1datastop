/** Raw Ergast/Jolpica API shapes (minimal fields we consume). */

export type ErgastDriverRef = {
  driverId: string;
  code?: string;
  url?: string;
  givenName: string;
  familyName: string;
  dateOfBirth?: string;
  nationality?: string;
  permanentNumber?: string;
};

export type ErgastConstructorRef = {
  constructorId: string;
  name: string;
  nationality?: string;
  url?: string;
};

export type ErgastDriverStandingRow = {
  position: string;
  points: string;
  wins: string;
  Driver: ErgastDriverRef;
  Constructors: ErgastConstructorRef[];
};

export type ErgastConstructorStandingRow = {
  position: string;
  points: string;
  wins: string;
  Constructor: ErgastConstructorRef;
};

/** Raw OpenF1 driver row (sessions/drivers endpoint). */
export type OpenF1DriverRow = {
  driver_number: number;
  name_acronym?: string;
  first_name: string;
  last_name: string;
  team_name?: string;
  country_code?: string;
  headshot_url?: string;
};

/** Canonical driver — carries Ergast id and optional OpenF1 keys. */
export type F1Driver = {
  ergastId: string;
  openF1Number?: number;
  code: string;
  url: string;
  givenName: string;
  familyName: string;
  fullName: string;
  nationality: string;
  permanentNumber: string;
  dateOfBirth: string;
  teamId: string;
  teamName: string;
  teamColor: string;
  teamColorLight: string;
  teamColorDark: string;
  position: number;
  points: number;
  wins: number;
  headshotUrl?: string;
};

/** Canonical team/constructor. */
export type F1Team = {
  ergastId: string;
  url: string;
  name: string;
  nationality: string;
  color: string;
  colorLight: string;
  colorDark: string;
  position: number;
  points: number;
  wins: number;
  driverCodes: string[];
};

/** Per-race result row (Ergast driver results or batch map value). */
export type F1DriverRaceResult = {
  round: string;
  raceName: string;
  date: string;
  circuit?: string;
  country?: string;
  position?: string;
  status?: string;
  isDNF?: boolean;
  points: number;
  constructor?: string;
};

/** Canonical race/session identifiers bridging both APIs. */
export type F1Race = {
  ergastSeason: string;
  ergastRound: string;
  name: string;
  date: string;
  circuitId?: string;
  circuitName?: string;
  country?: string;
  openF1MeetingKey?: number;
};

export type F1Session = {
  ergastSeason?: string;
  ergastRound?: string;
  openF1SessionKey?: number;
  openF1MeetingKey?: number;
  sessionType: string;
  name: string;
  dateStart: string;
};
