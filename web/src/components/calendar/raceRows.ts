import { format, parseISO } from "date-fns";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";

/** The Ergast schedule row as the Races page reads it. */
export interface ScheduleRace {
  season: string;
  round: string;
  raceName: string;
  date: string;
  time?: string;
  Circuit?: { circuitId?: string; circuitName?: string; Location?: { locality?: string; country?: string } };
  FirstPractice?: { date: string; time?: string };
  Sprint?: { date: string; time?: string };
}

export type RaceStatus = "done" | "next" | "coming";
export const RACE_FILTERS = ["all", "coming", "done", "sprint"] as const;
export type RaceFilter = (typeof RACE_FILTERS)[number];
export const RACE_FILTER_LABEL: Record<RaceFilter, string> = {
  all: "All",
  coming: "Coming",
  done: "Done",
  sprint: "Sprint",
};

export interface RaceWinner {
  driverId: string;
  givenName?: string;
  familyName: string;
  constructorId?: string;
}

export interface RaceRow {
  race: ScheduleRace;
  name: string;
  circuitName: string;
  circuitId?: string;
  locality: string;
  country: string;
  dates: string;
  month: string;
  status: RaceStatus;
  sprint: boolean;
  winner?: RaceWinner;
}

function raceStart(race: ScheduleRace): Date {
  return parseISO(race.time ? `${race.date}T${race.time}` : `${race.date}T00:00:00Z`);
}

/** "6 to 8 Nov", "30 Oct to 1 Nov", or one day when the weekend has no practice dates. */
export function weekendDates(race: Pick<ScheduleRace, "date" | "FirstPractice">): string {
  const end = parseISO(race.date);
  const start = race.FirstPractice?.date ? parseISO(race.FirstPractice.date) : end;
  if (format(start, "yyyy-MM-dd") === format(end, "yyyy-MM-dd")) return format(end, "d MMM");
  if (format(start, "MM") === format(end, "MM")) return `${format(start, "d")} to ${format(end, "d MMM")}`;
  return `${format(start, "d MMM")} to ${format(end, "d MMM")}`;
}

/** One row per race: done once the race has started, the first one after that is next. */
export function buildRaceRows(
  races: ScheduleRace[],
  winners: Map<string, RaceWinner>,
  now: Date = new Date(),
): RaceRow[] {
  let nextSeen = false;
  return races.map((race) => {
    let status: RaceStatus = "coming";
    if (raceStart(race) < now) status = "done";
    else if (!nextSeen) {
      status = "next";
      nextSeen = true;
    }
    const name = getRaceNameWithoutEmoji(race.raceName);
    const country = race.Circuit?.Location?.country ?? "";
    return {
      race,
      name,
      circuitName: race.Circuit?.circuitName ?? name,
      circuitId: race.Circuit?.circuitId,
      locality: race.Circuit?.Location?.locality ?? country,
      country,
      dates: weekendDates(race),
      month: format(parseISO(race.date), "MMMM"),
      status,
      sprint: !!race.Sprint,
      winner: status === "done" ? winners.get(race.round) : undefined,
    };
  });
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function matchesFilter(row: RaceRow, filter: RaceFilter): boolean {
  if (filter === "coming") return row.status !== "done";
  if (filter === "done") return row.status === "done";
  if (filter === "sprint") return row.sprint;
  return true;
}

/** Search by Grand Prix, circuit, town or country, ignoring case and accents ("sao" finds São Paulo). */
export function matchesSearch(row: RaceRow, query: string): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  return [row.name, row.circuitName, row.locality, row.country].some((s) => fold(s).includes(q));
}

export function parseRaceFilter(value: string | null): RaceFilter {
  return (RACE_FILTERS as readonly string[]).includes(value ?? "") ? (value as RaceFilter) : "all";
}

/** Consecutive rows that share a month, in calendar order. */
export function groupByMonth(rows: RaceRow[]): { month: string; rows: RaceRow[] }[] {
  const out: { month: string; rows: RaceRow[] }[] = [];
  for (const row of rows) {
    const last = out[out.length - 1];
    if (last && last.month === row.month) last.rows.push(row);
    else out.push({ month: row.month, rows: [row] });
  }
  return out;
}
