import { parseISO } from "date-fns";
import { f1ToLocal } from "@/lib/time";
import type { ErgastResult } from "./types";

export function formatRaceTime(result: { Time?: { time?: string }; status?: string }) {
  if (!result) return "None";
  if (result.Time?.time) return result.Time.time;
  return result.status || "None";
}

/** "1:12.486" or "72.486" as seconds; undefined when there is no time. */
export function lapSeconds(time?: string): number | undefined {
  if (!time) return undefined;
  const parts = time.split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n))) return undefined;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

/** A session's start in the user's time zone, "20 Nov 2026, 02:30". */
export function getSessionDate(session: { date?: string; time?: string }) {
  if (!session?.date) return "Not set";
  return f1ToLocal(session.date, session.time, "d MMM yyyy, HH:mm");
}

export function isSessionPast(date: string, time?: string) {
  // F1 times are UTC — anchor the parse the same way f1ToLocal does, so a
  // "Z"-less time isn't misread as local time (up to ±14h error).
  const t = time || "00:00:00";
  const hasTz = /[zZ]$|[+-]\d\d:?\d\d$/.test(t);
  const sessionDateTime = parseISO(`${date}T${t}${hasTz ? "" : "Z"}`);
  return sessionDateTime < new Date();
}

/** The sprint grid in grid order, numbered from 1 (Ergast has no sprint qualifying table). */
export function getSprintQualifyingResults(sprintResults: { SprintResults?: ErgastResult[] } | undefined) {
  if (!sprintResults?.SprintResults) return null;
  const sortedByGrid = [...sprintResults.SprintResults].sort((a, b) => {
    const gridA = parseInt(a.grid || "999", 10) || 999;
    const gridB = parseInt(b.grid || "999", 10) || 999;
    return gridA - gridB;
  });
  return sortedByGrid.map((result, index) => ({ ...result, position: (index + 1).toString() }));
}
