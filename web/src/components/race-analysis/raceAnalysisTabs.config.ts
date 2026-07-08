import {
  Activity,
  Car,
  Clock,
  Cloud,
  Flag,
  Gauge,
  LayoutDashboard,
  Radio,
  TrendingUp,
  TrendingUpIcon,
  Trophy,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type RaceAnalysisTabId =
  | "overview"
  | "lapTimes"
  | "positions"
  | "qualifying"
  | "progression"
  | "pitstops"
  | "deepDive"
  | "weather"
  | "radio"
  | "telemetry"
  | "results"
  | "overtakes";

export type RaceAnalysisTabGroup = "core" | "live";

export interface RaceAnalysisTabConfig {
  id: RaceAnalysisTabId;
  label: string;
  icon: LucideIcon;
  group: RaceAnalysisTabGroup;
}

// CORE — served from Ergast / FastF1 / the warehouse. Works for every season,
// no live-timing dependency. Ordered: session summary → race progression →
// qualifying → strategy → deep pace.
export const CORE_TABS: RaceAnalysisTabConfig[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, group: "core" },
  { id: "results", label: "Results", icon: Trophy, group: "core" },
  { id: "lapTimes", label: "Lap Times", icon: Clock, group: "core" },
  { id: "positions", label: "Positions", icon: TrendingUp, group: "core" },
  { id: "qualifying", label: "Qualifying", icon: Flag, group: "core" },
  { id: "progression", label: "Quali → Race", icon: TrendingUpIcon, group: "core" },
  { id: "pitstops", label: "Pit Stops", icon: Wrench, group: "core" },
  { id: "telemetry", label: "Telemetry", icon: Gauge, group: "core" },
  { id: "deepDive", label: "Deep Dive", icon: Activity, group: "core" },
];

// LIVE — OpenF1 live-timing only (position / overtakes / weather / radio).
// OpenF1 covers 2023+ and lags the current season, so these are gated on
// session availability.
export const LIVE_TABS: RaceAnalysisTabConfig[] = [
  { id: "overtakes", label: "Overtakes", icon: Car, group: "live" },
  { id: "weather", label: "Weather", icon: Cloud, group: "live" },
  { id: "radio", label: "Team Radio", icon: Radio, group: "live" },
];

export const DEFAULT_RACE_ANALYSIS_TAB: RaceAnalysisTabId = "overview";

/** Live (OpenF1-backed) tabs — gated behind session availability. */
export function isLiveTab(tabId: string): tabId is RaceAnalysisTabId {
  return LIVE_TABS.some((tab) => tab.id === tabId);
}

export function getVisibleTabs(hasOpenF1Data: boolean): RaceAnalysisTabConfig[] {
  return hasOpenF1Data ? [...CORE_TABS, ...LIVE_TABS] : [...CORE_TABS];
}
