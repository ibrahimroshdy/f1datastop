import { getCountryCode } from "@/components/common/CountryFlag";
import { TEAM_COLORS } from "@/constants/f1Colors";

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

// FastF1 / OpenF1 hand us 3-letter IOC codes (GBR, NED, MON…) rather than demonyms.
// Rows ingested before the demonym normalisation still carry these.
export const IOC_TO_ISO: Record<string, string> = {
  GBR: "GB", NED: "NL", GER: "DE", ITA: "IT", FRA: "FR", ESP: "ES", MON: "MC", AUS: "AU",
  CAN: "CA", MEX: "MX", JPN: "JP", FIN: "FI", DEN: "DK", THA: "TH", CHN: "CN", USA: "US",
  BRA: "BR", ARG: "AR", NZL: "NZ", SUI: "CH", AUT: "AT", BEL: "BE", POL: "PL", RUS: "RU",
  SWE: "SE", POR: "PT", IRL: "IE", EST: "EE", COL: "CO", IND: "IN", RSA: "ZA", VEN: "VE",
  HUN: "HU", CZE: "CZ", SGP: "SG", SIN: "SG", MAS: "MY", INA: "ID", CHI: "CL", URU: "UY",
  ISR: "IL", TUR: "TR",
};

export const getNationalityCode = (nationality: string | undefined): string => {
  if (!nationality) return "";
  const key = nationality.trim();
  return (
    NATIONALITY_TO_CODE[key] ||
    IOC_TO_ISO[key.toUpperCase()] ||
    getCountryCode(key) ||
    ""
  );
};
