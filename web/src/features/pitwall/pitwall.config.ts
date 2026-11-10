import { TYRE_COLORS as BASE_TYRE_COLORS, TYRE_LABELS } from "@/constants/tyres";
import type { LucideIcon } from "lucide-react";
import { CircleDot, CloudSun, Gauge, LineChart, ListOrdered } from "lucide-react";
import { TEAM_COLORS } from "@/constants/f1Colors";

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

export const MAX_DRIVERS = 6;

export type CompareMode = "focus" | "overlay";

export type PanelId = "lap" | "position" | "telemetry" | "stint" | "weather";

export interface PanelDef {
  id: PanelId;
  label: string;
  icon: LucideIcon;
}

export const PANELS: PanelDef[] = [
  { id: "lap", label: "Lap times", icon: LineChart },
  { id: "position", label: "Positions", icon: ListOrdered },
  { id: "telemetry", label: "Telemetry", icon: Gauge },
  { id: "stint", label: "Stints and pits", icon: CircleDot },
  { id: "weather", label: "Weather", icon: CloudSun },
];

export const DEFAULT_PANELS: PanelId[] = PANELS.map((p) => p.id);

/** F1 tyre compound → colour: the one Pirelli set in constants/tyres.ts (D16), letter or full-name keys. */
export const TYRE_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(BASE_TYRE_COLORS).flatMap(([k, v]) => [[k, v], [TYRE_LABELS[k].toUpperCase(), v]]),
);

export const tyreColor = (c?: string | null): string =>
  (c && TYRE_COLORS[c.trim().toUpperCase()]) || TEAM_COLORS.default;
