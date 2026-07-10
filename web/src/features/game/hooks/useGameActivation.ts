import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { activatePlayer, getMyEntry, ACTIVE_GAME_SEASON } from "../api/gameClient";

/** Reads the caller's entry for a season and exposes the "Join the F1 League" mutation. */
export function useGameActivation(season = ACTIVE_GAME_SEASON) {
  const qc = useQueryClient();
  const entry = useQuery({
    queryKey: ["game", "entry", season],
    queryFn: () => getMyEntry(season),
  });
  const activate = useMutation({
    mutationFn: () => activatePlayer(season),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["game", "entry", season] }),
  });
  return {
    entry: entry.data ?? null,
    entryId: entry.data?.id ?? null,
    isActivated: !!entry.data,
    isLoading: entry.isLoading,
    activate: activate.mutate,
    activating: activate.isPending,
    error: activate.error as Error | null,
  };
}
