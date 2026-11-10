import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import RaceDetailDialog from "./RaceDetailDialog";
import { useRaceSchedule } from "@/hooks/f1";
import { parseQuickLook, QUICK_LOOK_PARAM, quickLookValue } from "@/lib/links";

interface ScheduleRace {
  season: string;
  round: string;
}

/**
 * A race's quick look (docs/design/decisions.md D30): the race dialog, opened by the address
 * (`?race=2026-21`) rather than by local state, so Back closes it, a link opens it, and every
 * place that opens a race opens the same thing. Mounted once, in the shell.
 */
export function QuickLookHost() {
  const [params, setParams] = useSearchParams();
  const want = parseQuickLook(params.get(QUICK_LOOK_PARAM));
  const { data } = useRaceSchedule(want?.season);
  const races = (data?.data ?? []) as ScheduleRace[];
  const race = want ? races.find((r) => Number(r.round) === want.round && Number(r.season) === want.season) : undefined;

  const close = () => {
    // Opening pushed a history entry, so going back removes the parameter and keeps Back honest.
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) window.history.back();
    else
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.delete(QUICK_LOOK_PARAM);
          return p;
        },
        { replace: true },
      );
  };

  if (!want || !race) return null;
  return <RaceDetailDialog isOpen onClose={close} race={race} />;
}

/** Opens a race's quick look from anywhere: `open(2026, 21)`. */
export function useOpenQuickLook() {
  const [, setParams] = useSearchParams();
  return useCallback(
    (season: number | string, round: number | string) =>
      setParams((prev) => {
        const p = new URLSearchParams(prev);
        p.set(QUICK_LOOK_PARAM, quickLookValue(season, round));
        return p;
      }),
    [setParams],
  );
}
