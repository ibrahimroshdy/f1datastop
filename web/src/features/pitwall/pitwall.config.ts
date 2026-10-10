import type { LucideIcon } from "lucide-react";
import { CircleDot, CloudSun, Gauge, LineChart, ListOrdered } from "lucide-react";

/** Session codes our data pipeline keys on (telemetry/replay/warehouse).
 *  FP1/2/3 = practice, Q = qualifying, SQ = sprint qualifying (2024+),
 *  SS = sprint shootout (2023), S = sprint, R = race. */
export type SessionCode = "FP1" | "FP2" | "FP3" | "Q" | "SQ" | "SS" | "S" | "R";

export interface SessionDef {
  code: SessionCode;
  label: string;
  short: string;
}

// Chronological weekend order.
export const ALL_SESSIONS: SessionDef[] = [
  { code: "FP1", label: "Practice 1", short: "FP1" },
  { code: "FP2", label: "Practice 2", short: "FP2" },
  { code: "FP3", label: "Practice 3", short: "FP3" },
  { code: "SQ", label: "Sprint Qualifying", short: "SQ" },
  { code: "SS", label: "Sprint Shootout", short: "SS" },
  { code: "S", label: "Sprint", short: "SPR" },
  { code: "Q", label: "Qualifying", short: "QUAL" },
  { code: "R", label: "Race", short: "RACE" },
];

const isSprintWeekend = (r?: { Sprint?: unknown; SprintQualifying?: unknown } | null) =>
  !!(r && (r.Sprint || r.SprintQualifying));

/** Sessions available for a race entry. Practice 2/3 don't run on sprint weekends;
 *  the sprint sessions (SQ/SS/S) only run on sprint weekends. FP1, Q, R are always. */
export function sessionsForRace(
  race?: { Sprint?: unknown; SprintQualifying?: unknown } | null,
): SessionDef[] {
  const sprint = isSprintWeekend(race);
  return ALL_SESSIONS.filter((s) => {
    if (s.code === "FP2" || s.code === "FP3") return !sprint;
    if (s.code === "SQ" || s.code === "SS" || s.code === "S") return sprint;
    return true; // FP1, Q, R
  });
}

/** Seasons with FastF1 telemetry/position coverage (2018→now). */
export const PITWALL_SEASONS: number[] = (() => {
  const now = new Date().getFullYear();
  const arr: number[] = [];
  for (let y = now; y >= 2018; y--) arr.push(y);
  return arr;
})();

export const MAX_DRIVERS = 6;

export type CompareMode = "focus" | "overlay";

export type PanelId = "lap" | "position" | "telemetry" | "stint" | "weather";

export interface PanelDef {
  id: PanelId;
  label: string;
  icon: LucideIcon;
}

export const PANELS: PanelDef[] = [
  { id: "lap", label: "Lap Times", icon: LineChart },
  { id: "position", label: "Positions", icon: ListOrdered },
  { id: "telemetry", label: "Telemetry", icon: Gauge },
  { id: "stint", label: "Stints & Pits", icon: CircleDot },
  { id: "weather", label: "Weather", icon: CloudSun },
];

export const DEFAULT_PANELS: PanelId[] = PANELS.map((p) => p.id);

/** F1 tyre compound → chip colour (single-letter or full-name keys). */
export const TYRE_COLORS: Record<string, string> = {
  S: "#ef4444",
  SOFT: "#ef4444",
  M: "#eab308",
  MEDIUM: "#eab308",
  H: "#e5e7eb",
  HARD: "#e5e7eb",
  I: "#22c55e",
  INTERMEDIATE: "#22c55e",
  W: "#3b82f6",
  WET: "#3b82f6",
};

export const tyreColor = (c?: string | null): string =>
  (c && TYRE_COLORS[c.trim().toUpperCase()]) || "#9ca3af";
