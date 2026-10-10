import { TEAM_COLORS, getTeamColorById } from "@/constants/f1Colors";

/** Team accent color as hex — delegates to the canonical TEAM_COLORS source. */
export const getTeamColor = (constructorId: string): string =>
  getTeamColorById(constructorId) || TEAM_COLORS.default;

export const removeFlag = (raceName: string) => {
  if (raceName && raceName.length > 3 && raceName.indexOf(' ') > 0) {
    return raceName.substring(raceName.indexOf(' ') + 1);
  }
  return raceName;
};
