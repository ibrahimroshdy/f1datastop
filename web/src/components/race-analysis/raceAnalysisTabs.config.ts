import {
  Car,
  Clock,
  Cloud,
  Flag,
  Gauge,
  Radio,
  TrendingUp,
  TrendingUpIcon,
  Trophy,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type RaceAnalysisTabId =
  | "lapTimes"
  | "positions"
  | "qualifying"
  | "progression"
  | "pitstops"
  | "weather"
  | "radio"
  | "telemetry"
  | "results"
  | "overtakes";

export type RaceAnalysisTabGroup = "essentials" | "advanced";

export interface RaceAnalysisTabConfig {
  id: RaceAnalysisTabId;
  label: string;
  icon: LucideIcon;
  group: RaceAnalysisTabGroup;
}

export const ESSENTIALS_TABS: RaceAnalysisTabConfig[] = [
  { id: "lapTimes", label: "Lap Times", icon: Clock, group: "essentials" },
  { id: "positions", label: "Positions", icon: TrendingUp, group: "essentials" },
  { id: "qualifying", label: "Qualifying", icon: Flag, group: "essentials" },
  {
    id: "progression",
    label: "Quali → Race",
    icon: TrendingUpIcon,
    group: "essentials",
  },
  { id: "pitstops", label: "Pit Stops", icon: Wrench, group: "essentials" },
];

export const ADVANCED_TABS: RaceAnalysisTabConfig[] = [
  { id: "weather", label: "Weather", icon: Cloud, group: "advanced" },
  { id: "radio", label: "Team Radio", icon: Radio, group: "advanced" },
  { id: "telemetry", label: "Telemetry", icon: Gauge, group: "advanced" },
  { id: "results", label: "Results", icon: Trophy, group: "advanced" },
  { id: "overtakes", label: "Overtakes", icon: Car, group: "advanced" },
];

export const DEFAULT_RACE_ANALYSIS_TAB: RaceAnalysisTabId = "lapTimes";

export function isAdvancedTab(tabId: string): tabId is RaceAnalysisTabId {
  return ADVANCED_TABS.some((tab) => tab.id === tabId);
}

export function getVisibleTabs(hasOpenF1Data: boolean): RaceAnalysisTabConfig[] {
  return hasOpenF1Data
    ? [...ESSENTIALS_TABS, ...ADVANCED_TABS]
    : [...ESSENTIALS_TABS];
}
