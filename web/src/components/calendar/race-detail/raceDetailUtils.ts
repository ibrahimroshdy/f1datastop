import { format, parseISO } from "date-fns";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { resolveTeamColor } from "@/lib/f1/adapters";
import { f1ToLocal } from "@/lib/time";

/** Normalize legacy constructor aliases for TEAM_COLORS lookup. */
export function getTeamColor(constructorId: string): string {
  let normalizedTeamId = constructorId.toLowerCase();
  if (normalizedTeamId === "alphatauri") normalizedTeamId = "rb";
  else if (normalizedTeamId === "alfa") normalizedTeamId = "sauber";
  return TEAM_COLORS[normalizedTeamId] || resolveTeamColor(normalizedTeamId) || "#666666";
}

export function getTeamColorStyle(constructorId: string) {
  const color = getTeamColor(constructorId);
  return {
    borderLeft: `4px solid ${color}`,
    paddingLeft: "0.5rem",
  };
}

export function formatSessionTime(timeString: string) {
  if (!timeString) return "-";
  if (timeString.includes("+")) return timeString;
  if (timeString.includes(":")) return timeString;
  try {
    return format(parseISO(timeString), "HH:mm");
  } catch {
    return timeString;
  }
}

export function formatRaceTime(result: {
  Time?: { time?: string };
  status?: string;
}) {
  if (!result) return "-";
  if (result.Time?.time) return result.Time.time;
  if (result.status?.startsWith("+")) return result.status;
  return result.status || "-";
}

export function getSessionDate(session: { date?: string; time?: string }) {
  if (!session?.date) return "-";
  // F1 times are UTC → render in the user's local timezone.
  return f1ToLocal(session.date, session.time, "MMM d, yyyy · HH:mm");
}

export function isSessionPast(date: string, time?: string) {
  const sessionDateTime = time
    ? parseISO(`${date}T${time}`)
    : parseISO(`${date}T00:00:00Z`);
  return sessionDateTime < new Date();
}

export function getSprintQualifyingResults(
  sprintResults: { SprintResults?: Array<{ grid?: string; Driver: unknown; Constructor: unknown; position?: string }> } | undefined,
) {
  if (!sprintResults?.SprintResults) return null;

  const sortedByGrid = [...sprintResults.SprintResults].sort((a, b) => {
    const gridA = parseInt(a.grid || "999", 10) || 999;
    const gridB = parseInt(b.grid || "999", 10) || 999;
    return gridA - gridB;
  });

  return sortedByGrid.map((result, index) => ({
    ...result,
    position: (index + 1).toString(),
    gridPosition: result.grid,
    Driver: result.Driver as { code?: string; givenName?: string; familyName?: string },
    Constructor: result.Constructor as { constructorId: string; name: string },
  }));
}
