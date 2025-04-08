
export interface Driver {
  driverId: string;
  code: string;
  name: string;
  team: string;
  finishPosition: number;
  hasFastestLap?: boolean;
  fastestLapTime?: number;
}

export interface FastestLapTime {
  time: number;
  driver: string;
}
