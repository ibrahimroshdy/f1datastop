/** The Ergast result row as the quick look reads it (race, sprint and qualifying share it). */
export type ErgastDriver = {
  driverId: string;
  code?: string;
  givenName?: string;
  familyName: string;
  nationality?: string;
};

export type ErgastResult = {
  position: string;
  points?: string;
  grid?: string;
  Q1?: string;
  Q2?: string;
  Q3?: string;
  status?: string;
  Time?: { time?: string };
  FastestLap?: { rank?: string; lap?: string; Time?: { time?: string } };
  Driver: ErgastDriver;
  /** Missing on some rows from the live feed (a reserve or a late entry); never assume it. */
  Constructor?: { constructorId: string; name: string };
};
