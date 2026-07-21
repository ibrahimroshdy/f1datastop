/**
 * Official F1 media "right" full-body portraits on media.formula1.com (Cloudinary).
 * Paths are scraped from https://www.formula1.com/en/drivers (preload URLs).
 * Headshots use URL transforms (face-aware thumb), not separate assets.
 *
 * Re-sync when the grid or asset keys change: see scripts/sync-f1-driver-portrait-paths.mjs
 */

export const F1_MEDIA_UPLOAD_BASE = "https://media.formula1.com/image/upload";

/** Cloudinary version segment from formula1.com preload URLs (bump if images 404). */
export const F1_DRIVER_PORTRAIT_VERSION = "v1740000001";

/**
 * Face-aware square thumb from the tall "right" pose — reads as a headshot in avatars.
 * `z_0.76` ≈ two ~15% zoom-out steps vs default (1/1.15²) for more upper body in frame.
 */
export const F1_DRIVER_HEADSHOT_TRANSFORMS = "c_thumb,w_384,h_384,g_face,z_0.76,q_auto";

/** Season folder in common/f1/{season}/… */
export const F1_DRIVER_PORTRAIT_SEASON = 2026;

/**
 * Ergast `Driver.driverId` → path under `common/f1/{season}/` (no leading slash).
 * Example: mercedes/georus01/2026mercedesgeorus01right.webp
 */
export const ERGAST_DRIVER_ID_TO_F1_PORTRAIT_PATH: Record<string, string> = {
  russell: "2026/mercedes/georus01/2026mercedesgeorus01right.webp",
  antonelli: "2026/mercedes/andant01/2026mercedesandant01right.webp",
  leclerc: "2026/ferrari/chalec01/2026ferrarichalec01right.webp",
  hamilton: "2026/ferrari/lewham01/2026ferrarilewham01right.webp",
  norris: "2026/mclaren/lannor01/2026mclarenlannor01right.webp",
  piastri: "2026/mclaren/oscpia01/2026mclarenoscpia01right.webp",
  ocon: "2026/haasf1team/estoco01/2026haasf1teamestoco01right.webp",
  bearman: "2026/haasf1team/olibea01/2026haasf1teamolibea01right.webp",
  gasly: "2026/alpine/piegas01/2026alpinepiegas01right.webp",
  colapinto: "2026/alpine/fracol01/2026alpinefracol01right.webp",
  max_verstappen: "2026/redbullracing/maxver01/2026redbullracingmaxver01right.webp",
  hadjar: "2026/redbullracing/isahad01/2026redbullracingisahad01right.webp",
  lawson: "2026/racingbulls/lialaw01/2026racingbullslialaw01right.webp",
  // Ergast driverId (F1.com slug is /en/drivers/arvid-lindblad)
  arvid_lindblad: "2026/racingbulls/arvlin01/2026racingbullsarvlin01right.webp",
  lindblad: "2026/racingbulls/arvlin01/2026racingbullsarvlin01right.webp",
  hulkenberg: "2026/audi/nichul01/2026audinichul01right.webp",
  bortoleto: "2026/audi/gabbor01/2026audigabbor01right.webp",
  sainz: "2026/williams/carsai01/2026williamscarsai01right.webp",
  albon: "2026/williams/alealb01/2026williamsalealb01right.webp",
  perez: "2026/cadillac/serper01/2026cadillacserper01right.webp",
  bottas: "2026/cadillac/valbot01/2026cadillacvalbot01right.webp",
  alonso: "2026/astonmartin/feralo01/2026astonmartinferalo01right.webp",
  stroll: "2026/astonmartin/lanstr01/2026astonmartinlanstr01right.webp",
  // Reserve / FP1 drivers (Ergast driverId + slug alias)
  crawford: "2026/astonmartin/jakcra01/2026astonmartinjakcra01right.webp",
  jak_crawford: "2026/astonmartin/jakcra01/2026astonmartinjakcra01right.webp",
};

/** Driver code → Ergast driverId. Recent/live sessions store an empty driver_id
 *  (FastF1 can't reach Ergast yet), so the photo + team logo resolve off the code instead. */
export const DRIVER_CODE_TO_ERGAST_ID: Record<string, string> = {
  RUS: "russell", ANT: "antonelli", LEC: "leclerc", HAM: "hamilton",
  NOR: "norris", PIA: "piastri", OCO: "ocon", BEA: "bearman",
  GAS: "gasly", COL: "colapinto", VER: "max_verstappen", HAD: "hadjar",
  // Lindblad's Ergast id carries his first name. The portrait map holds both spellings so
  // the photo resolved either way, but anything keyed on the real id — the standings
  // lookup behind the team logo — missed silently. Use the canonical form.
  LAW: "lawson", LIN: "arvid_lindblad", HUL: "hulkenberg", BOR: "bortoleto",
  SAI: "sainz", ALB: "albon", PER: "perez", BOT: "bottas",
  ALO: "alonso", STR: "stroll", CRA: "crawford",
};

/** Canonical Ergast driverId for a row — prefers the stored id, falls back to the code. */
export function ergastIdForDriver(driverId: string | null | undefined, code: string | null | undefined): string {
  return (driverId && driverId.trim()) || DRIVER_CODE_TO_ERGAST_ID[(code || "").toUpperCase()] || "";
}

/** Reserve / FP1 drivers who aren't in the championship standings → their team
 *  constructorId, so the board can still show a team logo. */
export const DRIVER_CODE_TO_CONSTRUCTOR: Record<string, string> = {
  CRA: "aston_martin",
};

export function buildF1DriverHeadshotUrl(portraitPathUnderCommonF1: string): string {
  const path = portraitPathUnderCommonF1.replace(/^\/+/, "");
  return `${F1_MEDIA_UPLOAD_BASE}/${F1_DRIVER_HEADSHOT_TRANSFORMS}/${F1_DRIVER_PORTRAIT_VERSION}/common/f1/${path}`;
}

export function getF1PortraitPathForErgastDriverId(driverId: string, season = F1_DRIVER_PORTRAIT_SEASON): string | undefined {
  if (season !== F1_DRIVER_PORTRAIT_SEASON) return undefined;
  const key = (driverId || "").toLowerCase();
  return ERGAST_DRIVER_ID_TO_F1_PORTRAIT_PATH[key];
}
