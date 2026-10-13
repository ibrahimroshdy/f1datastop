/**
 * Season results aggregation for the /standings points progression (BUG-007).
 *
 * Jolpica caps `limit` at 100, so `results.json?limit=1000` returned only the first ~4.5
 * rounds (100 of 374 rows for 2026) and the chart stopped at round 5. Pages are now fetched
 * by offset until `total`, and sprint points are folded in so the line ends on the
 * standings value (race + sprint).
 */
export const JOLPICA_PAGE = 100;

/** Offsets needed to read `total` rows in Jolpica-sized pages (first page excluded). */
export function remainingOffsets(total: number, page = JOLPICA_PAGE): number[] {
  const out: number[] = [];
  for (let o = page; o < total; o += page) out.push(o);
  return out;
}

interface RaceRow {
  round: string;
  raceName?: string;
  date?: string;
  Circuit?: { circuitName?: string; Location?: { country?: string } };
  Results?: ResultRow[];
  SprintResults?: ResultRow[];
}
interface ResultRow {
  Driver?: { driverId?: string };
  Constructor?: { name?: string };
  position?: string;
  positionText?: string;
  status?: string;
  points?: string;
}

/**
 * Merge paged `Races` arrays (a round can be split across two pages) into one race per
 * round, with its Results concatenated.
 */
export function mergeRacePages(pages: RaceRow[][], key: "Results" | "SprintResults" = "Results"): RaceRow[] {
  const byRound = new Map<string, RaceRow>();
  for (const races of pages) {
    for (const r of races) {
      const cur = byRound.get(r.round);
      if (!cur) byRound.set(r.round, { ...r, [key]: [...(r[key] ?? [])] });
      else cur[key] = [...(cur[key] ?? []), ...(r[key] ?? [])];
    }
  }
  return [...byRound.values()].sort((a, b) => Number(a.round) - Number(b.round));
}

export interface DriverRoundResult {
  round: string;
  raceName?: string;
  date?: string;
  circuit?: string;
  country?: string;
  position?: string;
  status: string;
  isDNF: boolean;
  /** Grand Prix + sprint points scored that weekend. */
  points: number;
  constructor?: string;
}

/** DNF by positionText when present (numeric = classified; W/F = DNS), else status. */
function isDnf(r: ResultRow): boolean {
  const status = r.status || "";
  if (status.toLowerCase() === "did not start") return false;
  const pt = (r.positionText || "").trim().toUpperCase();
  if (pt) return !/^\d+$/.test(pt) && !["W", "F"].includes(pt);
  const finished = status === "Finished" || status === "Lapped" || status.startsWith("+");
  return !finished && status !== "";
}

export function byDriverFromRaces(races: RaceRow[], sprints: RaceRow[] = []): Record<string, DriverRoundResult[]> {
  const sprintPts = new Map<string, number>(); // `${driverId}|${round}`
  for (const s of sprints)
    for (const r of s.SprintResults ?? []) {
      const id = r.Driver?.driverId;
      if (id) sprintPts.set(`${id}|${s.round}`, (sprintPts.get(`${id}|${s.round}`) ?? 0) + Number(r.points || 0));
    }
  const out: Record<string, DriverRoundResult[]> = {};
  for (const race of races)
    for (const r of race.Results ?? []) {
      const id = r.Driver?.driverId;
      if (!id) continue;
      (out[id] ??= []).push({
        round: race.round,
        raceName: race.raceName,
        date: race.date,
        circuit: race.Circuit?.circuitName,
        country: race.Circuit?.Location?.country,
        position: r.position,
        status: r.status || "",
        isDNF: isDnf(r),
        points: Number(r.points || 0) + (sprintPts.get(`${id}|${race.round}`) ?? 0),
        constructor: r.Constructor?.name,
      });
    }
  Object.values(out).forEach((l) => l.sort((a, b) => Number(a.round) - Number(b.round)));
  return out;
}
