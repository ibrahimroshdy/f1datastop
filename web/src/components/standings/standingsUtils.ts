import { getCountryCode } from "@/components/common/CountryFlag";
import { TEAM_COLORS } from "@/constants/f1Colors";

export const DEFAULT_CONSTRUCTORS_VISIBLE = 11;
export const DEFAULT_DRIVERS_VISIBLE = 10;

export const NATIONALITY_TO_CODE: Record<string, string> = {
  Argentine: "AR", Australian: "AU", Austrian: "AT", Belgian: "BE", Brazilian: "BR",
  British: "GB", Canadian: "CA", Chinese: "CN", Danish: "DK", Dutch: "NL",
  English: "GB", Egyptian: "EG", Finnish: "FI", French: "FR", German: "DE",
  Italian: "IT", Japanese: "JP", Mexican: "MX", Monegasque: "MC", Portuguese: "PT",
  Polish: "PL", Russian: "RU", Spanish: "ES", Swedish: "SE", Swiss: "CH",
  Thai: "TH", American: "US", Venezuelan: "VE", Singaporean: "SG",
  "Saudi Arabian": "SA", Saudi: "SA", Emirati: "AE", Qatari: "QA",
  "South African": "ZA", "New Zealander": "NZ",
};

export const normalizeTeamId = (constructorId: string): string => {
  const id = (constructorId || "").toLowerCase();
  if (id === "alphatauri") return "rb";
  if (id === "alfa") return "sauber";
  return id;
};

export const getTeamHexColor = (constructorId: string): string => {
  const normalized = normalizeTeamId(constructorId);
  return TEAM_COLORS[normalized] || TEAM_COLORS.default;
};

export const getNationalityCode = (nationality: string | undefined): string => {
  if (!nationality) return "";
  return NATIONALITY_TO_CODE[nationality] || getCountryCode(nationality) || "";
};

export const getGaps = (index: number, list: any[]) => {
  if (!list || list.length === 0) return { toLeader: 0, toNext: 0 };
  const pts = Number(list?.[index]?.points || 0);
  const leader = Number(list?.[0]?.points || 0);
  const toLeader = Math.max(0, leader - pts);
  let toNext = 0;
  if (index > 0) {
    const aheadPts = Number(list?.[index - 1]?.points || 0);
    toNext = Math.max(0, aheadPts - pts);
  }
  return { toLeader, toNext };
};

export type TeamDriver = { code: string; name: string; points: number };

export const buildDriversByTeam = (
  driverStandings: any,
): Record<string, TeamDriver[]> => {
  const map: Record<string, TeamDriver[]> = {};
  (driverStandings?.data || []).forEach((d: any) => {
    const constructors = d.Constructors || [];
    const current = constructors.length ? constructors[constructors.length - 1] : null;
    const teamId = normalizeTeamId(current?.constructorId || "default");
    if (!map[teamId]) map[teamId] = [];
    map[teamId].push({
      code: d.Driver?.code || d.Driver?.familyName?.substring(0, 3).toUpperCase() || "",
      name: `${d.Driver?.givenName || ""} ${d.Driver?.familyName || ""}`.trim(),
      points: Number(d.points || 0),
    });
  });
  Object.keys(map).forEach((k) => map[k].sort((a, b) => b.points - a.points));
  return map;
};

export const buildTeamPointsMap = (constructorStandings: any): Record<string, number> => {
  const map: Record<string, number> = {};
  (constructorStandings?.data || []).forEach((team: any) => {
    const id = normalizeTeamId(team?.Constructor?.constructorId || "default");
    map[id] = Number(team?.points || 0);
  });
  return map;
};
