
// Types for the F1 Race Map components
export interface Race {
  round: string;
  raceName: string;
  date: string;
  Circuit: {
    circuitName: string;
    Location: {
      lat: string;
      long: string;
      locality: string;
      country: string;
    }
  }
}

export type RaceStatus = "first" | "upcoming" | "completed";

export interface RaceMapProps {
  selectedYear: number;
  onYearChange: (year: number) => void;
}
