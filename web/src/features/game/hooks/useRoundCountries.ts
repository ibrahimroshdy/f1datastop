import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getGameSchedule, ACTIVE_GAME_SEASON } from "../api/gameClient";

/** round → race country for the season (from the game schedule), for RoundFlag. */
export function useRoundCountries(season = ACTIVE_GAME_SEASON): Map<number, string> {
  const { data } = useQuery({
    queryKey: ["game", "schedule", season],
    queryFn: () => getGameSchedule(season),
    staleTime: 60 * 60 * 1000,
  });
  return useMemo(() => {
    const m = new Map<number, string>();
    (data ?? []).forEach((r) => {
      if (r.country) m.set(r.round, r.country);
    });
    return m;
  }, [data]);
}
