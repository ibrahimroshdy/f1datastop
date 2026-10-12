/** Per-race result row from Ergast season results (single or batched fetch). */
export interface DriverRaceResult {
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
}
