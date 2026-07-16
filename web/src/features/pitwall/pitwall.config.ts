import type { LucideIcon } from "lucide-react";
import { CircleDot, CloudSun, Gauge, LineChart, ListOrdered } from "lucide-react";

/** Session codes our data pipeline keys on (telemetry/replay/warehouse). */
export type SessionCode = "R" | "Q" | "S";

export interface SessionDef {
  code: SessionCode;
  label: string;
  short: string;
}

export const ALL_SESSIONS: SessionDef[] = [
  { code: "R", label: "Race", short: "RACE" },
  { code: "Q", label: "Qualifying", short: "QUAL" },
  { code: "S", label: "Sprint", short: "SPR" },
];

const isSprintWeekend = (r?: { Sprint?: unknown; SprintQualifying?: unknown } | null) =>
  !!(r && (r.Sprint || r.SprintQualifying));

/** Sessions available for a race entry — Sprint only shows on sprint weekends. */
export function sessionsForRace(
  race?: { Sprint?: unknown; SprintQualifying?: unknown } | null,
): SessionDef[] {
  return ALL_SESSIONS.filter((s) => s.code !== "S" || isSprintWeekend(race));
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
