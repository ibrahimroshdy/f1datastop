import { useCallback, useMemo, useState } from "react";

export type RaceScheduleEntry = {
  round: string;
  raceName: string;
  date: string;
  time?: string;
};

/**
 * The latest race of the season: the most recent round whose race date has
 * already happened (`date <= now`). Mirrors the completed-race rule used by
 * `services/f1Service.getLastRaceResults` (`new Date(race.date) < now`).
 * Rounds are iterated in schedule order, so ties resolve to the latest round.
 */
export const getLatestRace = (
  races: RaceScheduleEntry[] | null | undefined,
): RaceScheduleEntry | null => {
  if (!races) return null;
  const now = new Date();
  let latest: RaceScheduleEntry | null = null;
  let latestTs = -Infinity;
  for (const race of races) {
    const ts = new Date(race.date).getTime();
    if (ts <= now.getTime() && ts > latestTs) {
      latest = race;
      latestTs = ts;
    }
  }
  return latest;
};

type ShieldChoice = "shielded" | "shown";

/**
 * Pure: whether results should be hidden given the stored device choice and
 * whether a latest race exists. Defaults to hidden only when there is a latest
 * race worth hiding; once the user has shown results, that choice sticks.
 */
export const isShieldedByDefault = (stored: ShieldChoice | null, hasLatestRace: boolean): boolean =>
  stored === "shielded" || (stored === null && hasLatestRace);

/**
 * Per-device spoiler shield for the latest race of a season.
 *
 * - localStorage key: `f1ds-spoiler-shield-{season}`
 * - Default: hidden (`isShielded === true`) when there is a latest race, shown otherwise.
 * - `showResults()` reveals everything and remembers the choice on the device;
 *   once shown, results stay revealed for that season.
 */
export function useSpoilerShield(options: {
  season: number;
  races: RaceScheduleEntry[] | null;
}) {
  const { season, races } = options;
  const storageKey = `f1ds-spoiler-shield-${season}`;

  const latestRace = useMemo(() => getLatestRace(races), [races]);
  const hasLatestRace = !!latestRace;

  const [stored, setStored] = useState<ShieldChoice | null>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw === "shielded" || raw === "shown" ? raw : null;
    } catch {
      return null;
    }
  });

  const isShielded = isShieldedByDefault(stored, hasLatestRace);

  const showResults = useCallback(() => {
    setStored("shown");
    try {
      localStorage.setItem(storageKey, "shown");
    } catch {
      // localStorage unavailable: keep the in-memory choice only.
    }
  }, [storageKey]);

  return { isShielded, showResults, latestRace, hasLatestRace };
}
