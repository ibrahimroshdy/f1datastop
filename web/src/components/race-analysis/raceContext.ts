/** A race as the schedule describes it, and small helpers for showing it. */
export type RaceContext = {
  round: string;
  raceName: string;
  date?: string;
  Circuit?: { circuitId?: string; circuitName?: string; Location?: { country?: string; locality?: string } };
  FirstPractice?: { date?: string };
  /** Present on sprint weekends (Ergast/Jolpica). Either key may appear. */
  Sprint?: unknown;
  SprintQualifying?: unknown;
};

/** Sprint weekends carry a Sprint / SprintQualifying entry in the schedule. */
export const isSprintWeekend = (r?: { Sprint?: unknown; SprintQualifying?: unknown } | null) =>
  !!(r && (r.Sprint || r.SprintQualifying));

const day = (iso: string) => new Date(`${iso}T12:00:00Z`);
const MONTH = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });

/** "6 to 8 Nov", or "30 Oct to 1 Nov" across a month end. */
export function weekendDates(race: RaceContext): string | null {
  if (!race.date) return null;
  const end = day(race.date);
  const start = race.FirstPractice?.date ? day(race.FirstPractice.date) : null;
  const endText = `${end.getUTCDate()} ${MONTH.format(end)}`;
  if (!start || start.getTime() === end.getTime()) return endText;
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  return `${start.getUTCDate()}${sameMonth ? "" : ` ${MONTH.format(start)}`} to ${endText}`;
}

