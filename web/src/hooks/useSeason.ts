import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { currentSeason, FIRST_SEASON } from "@/lib/links";

/**
 * The one season (docs/design/decisions.md D21), kept in the address as `?season=` so a link
 * carries it and Back restores it. No parameter means the current season. Pages read it from
 * here instead of keeping their own year state. Older `?year=` links still work.
 */
export function useSeason(): [number, (season: number) => void] {
  const [params, setParams] = useSearchParams();
  const raw = Number(params.get("season") ?? params.get("year"));
  const season = Number.isInteger(raw) && raw >= FIRST_SEASON && raw <= currentSeason() ? raw : currentSeason();

  const setSeason = useCallback(
    (next: number) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.delete("year");
          if (next === currentSeason()) p.delete("season");
          else p.set("season", String(next));
          return p;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return [season, setSeason];
}
