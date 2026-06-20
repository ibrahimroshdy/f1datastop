/**
 * Official F1 team wordmarks (white) on media.formula1.com — same family as team pages
 * (e.g. https://www.formula1.com/en/teams/mercedes).
 * Paths are scraped from https://www.formula1.com/en/teams preload URLs.
 *
 * Re-sync: `node scripts/sync-f1-team-logo-paths.mjs`
 */

import {
  F1_MEDIA_UPLOAD_BASE,
  F1_DRIVER_PORTRAIT_VERSION,
} from "@/constants/f1DriverPortraitMedia";

export const F1_TEAM_LOGO_SEASON = 2026;

/** Resize for UI; logos are wide — `c_fit` preserves aspect like F1.com. */
export const F1_TEAM_LOGO_TRANSFORMS = "c_fit,h_192,q_auto";

/**
 * Normalized Ergast `constructorId`: lowercased, underscores removed (`red_bull` → `redbull`).
 */
export function normalizeConstructorIdForTeamLogo(constructorId: string): string {
  return (constructorId || "").toLowerCase().replace(/_/g, "");
}

/**
 * Normalized constructor id → path under `common/f1/{season}/`.
 */
export const NORMALIZED_CONSTRUCTOR_ID_TO_F1_TEAM_LOGO_PATH: Record<string, string> = {
  mercedes: "2026/mercedes/2026mercedeslogowhite.webp",
  ferrari: "2026/ferrari/2026ferrarilogowhite.webp",
  mclaren: "2026/mclaren/2026mclarenlogowhite.webp",
  williams: "2026/williams/2026williamslogowhite.webp",
  alpine: "2026/alpine/2026alpinelogowhite.webp",
  astonmartin: "2026/astonmartin/2026astonmartinlogowhite.webp",
  redbull: "2026/redbullracing/2026redbullracinglogowhite.webp",
  rb: "2026/racingbulls/2026racingbullslogowhite.webp",
  haas: "2026/haasf1team/2026haasf1teamlogowhite.webp",
  audi: "2026/audi/2026audilogowhite.webp",
  cadillac: "2026/cadillac/2026cadillaclogowhite.webp",
  // Legacy / UI aliases (normalize to these keys where applicable)
  alphatauri: "2026/racingbulls/2026racingbullslogowhite.webp",
  sauber: "2026/audi/2026audilogowhite.webp",
  kicksauber: "2026/audi/2026audilogowhite.webp",
};

export function getF1TeamLogoPathForConstructor(
  constructorId: string,
  season = F1_TEAM_LOGO_SEASON
): string | undefined {
  if (season !== F1_TEAM_LOGO_SEASON) return undefined;
  const key = normalizeConstructorIdForTeamLogo(constructorId);
  return NORMALIZED_CONSTRUCTOR_ID_TO_F1_TEAM_LOGO_PATH[key];
}

export function buildF1TeamLogoUrl(pathUnderCommonF1: string): string {
  const path = pathUnderCommonF1.replace(/^\/+/, "");
  return `${F1_MEDIA_UPLOAD_BASE}/${F1_TEAM_LOGO_TRANSFORMS}/${F1_DRIVER_PORTRAIT_VERSION}/common/f1/${path}`;
}

export function getF1TeamLogoUrl(constructorId: string, season = F1_TEAM_LOGO_SEASON): string | undefined {
  const rel = getF1TeamLogoPathForConstructor(constructorId, season);
  return rel ? buildF1TeamLogoUrl(rel) : undefined;
}
