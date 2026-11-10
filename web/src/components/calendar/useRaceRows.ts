import { useMemo } from "react";
import { useAllDriverResultsBySeason, useDriverStandings, useRaceSchedule } from "@/hooks/f1";
import { buildRaceRows, type RaceWinner, type ScheduleRace } from "./raceRows";

type StandingRow = {
  Driver?: { driverId?: string; givenName?: string; familyName?: string };
  Constructors?: { constructorId?: string }[];
};
type RoundResult = { round: string; position?: string };

/** The season's races as rows, each finished race with its winner. */
export function useRaceRows(season: number) {
  const { data: schedule, isLoading } = useRaceSchedule(season);
  const { data: results } = useAllDriverResultsBySeason(season);
  const { data: standings } = useDriverStandings(season);

  return useMemo(() => {
    const names = new Map<string, StandingRow>();
    for (const s of (standings?.data ?? []) as StandingRow[]) if (s.Driver?.driverId) names.set(s.Driver.driverId, s);

    const winners = new Map<string, RaceWinner>();
    const byDriver = (results?.data ?? {}) as Record<string, RoundResult[]>;
    for (const [driverId, rounds] of Object.entries(byDriver)) {
      for (const r of rounds) {
        if (r.position !== "1") continue;
        const s = names.get(driverId);
        const teams = s?.Constructors ?? [];
        winners.set(r.round, {
          driverId,
          givenName: s?.Driver?.givenName,
          familyName: s?.Driver?.familyName ?? driverId.replace(/_/g, " "),
          constructorId: teams[teams.length - 1]?.constructorId,
        });
      }
    }
    const rows = buildRaceRows((schedule?.data ?? []) as ScheduleRace[], winners);
    return { rows, isLoading };
  }, [schedule?.data, results?.data, standings?.data, isLoading]);
}
