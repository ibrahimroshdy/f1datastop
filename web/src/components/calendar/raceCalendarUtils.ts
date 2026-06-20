import { differenceInDays, getMonth, getWeek, getYear, parseISO } from "date-fns";

export type CalendarView = "list" | "grid" | "globe" | "distribution";

export const SINGLE_RACE = "single";
export const DOUBLE_HEADER = "double";
export const TRIPLE_HEADER = "triple";

export const raceTypeColors: Record<string, string> = {
  [SINGLE_RACE]: "bg-blue-500",
  [DOUBLE_HEADER]: "bg-green-500",
  [TRIPLE_HEADER]: "bg-purple-500",
  "summer-break": "bg-sky-400/50",
};

export const statusColors = {
  completed: "bg-muted text-muted-foreground",
  next: "bg-f1-red text-white",
  upcoming: "bg-muted text-muted-foreground",
};

export interface RaceTypeResult {
  raceTypes: string[];
  summerBreakStart: number;
  summerBreakEnd: number;
}

export const areConsecutiveWeekends = (date1: Date, date2: Date): boolean => {
  const week1 = getWeek(date1);
  const week2 = getWeek(date2);
  const year1 = getYear(date1);
  const year2 = getYear(date2);

  if (year1 === year2) {
    return week2 - week1 === 1;
  }

  return year2 > year1 && week1 >= 52 && week2 <= 1;
};

export const determineRaceTypes = (races: any[]): RaceTypeResult => {
  if (!races || races.length === 0) {
    return { raceTypes: [], summerBreakStart: -1, summerBreakEnd: -1 };
  }

  const raceTypes = Array(races.length).fill(SINGLE_RACE);
  let summerBreakStart = -1;
  let summerBreakEnd = -1;

  let currentHeader: number[] = [];

  for (let i = 0; i < races.length; i++) {
    const currentRaceDate = parseISO(races[i].date);

    if (i > 0) {
      const prevRaceDate = parseISO(races[i - 1].date);
      if (areConsecutiveWeekends(prevRaceDate, currentRaceDate)) {
        currentHeader.push(i);
      } else {
        if (currentHeader.length > 0) {
          const headerType =
            currentHeader.length === 2
              ? DOUBLE_HEADER
              : currentHeader.length === 3
                ? TRIPLE_HEADER
                : SINGLE_RACE;

          if (headerType !== SINGLE_RACE) {
            for (const idx of currentHeader) {
              raceTypes[idx] = headerType;
            }
          }

          currentHeader = [i];
        } else {
          currentHeader = [i];
        }
      }
    } else {
      currentHeader = [i];
    }

    if (getMonth(currentRaceDate) === 7) {
      if (i < races.length - 1) {
        const nextRaceDate = parseISO(races[i + 1].date);
        const daysBetween = differenceInDays(nextRaceDate, currentRaceDate);

        if (daysBetween > 14) {
          summerBreakStart = i;
          summerBreakEnd = i + 1;
        }
      }
    }
  }

  if (currentHeader.length > 1) {
    const headerType =
      currentHeader.length === 2
        ? DOUBLE_HEADER
        : currentHeader.length === 3
          ? TRIPLE_HEADER
          : SINGLE_RACE;

    if (headerType !== SINGLE_RACE) {
      for (const idx of currentHeader) {
        raceTypes[idx] = headerType;
      }
    }
  }

  if (summerBreakStart === -1) {
    let longestBreakLength = 0;

    for (let i = 0; i < races.length - 1; i++) {
      const currentRaceDate = parseISO(races[i].date);
      const nextRaceDate = parseISO(races[i + 1].date);
      const daysBetween = differenceInDays(nextRaceDate, currentRaceDate);

      if (
        daysBetween > 21 &&
        daysBetween > longestBreakLength &&
        i >= races.length / 4 &&
        i <= (3 * races.length) / 4
      ) {
        longestBreakLength = daysBetween;
        summerBreakStart = i;
        summerBreakEnd = i + 1;
      }
    }
  }

  return { raceTypes, summerBreakStart, summerBreakEnd };
};
