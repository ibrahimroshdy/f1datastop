import { useMemo } from "react";
import { useDriverStandings } from "@/hooks/f1";
import { normalizeTeamId } from "@/components/standings/standingsUtils";

interface StandingRow {
  Driver?: { driverId?: string };
  Constructors?: Array<{ constructorId?: string }>;
}

/**
 * Authoritative ergast driverId → constructor id (normalised, logo-ready) from the
 * season's driver standings. Replaces the brittle team-colour guessing so logos are
 * always correct.
 */
export function useConstructorByDriver(year: number): Map<string, string> {
  const standings = useDriverStandings(year);
  return useMemo(() => {
    const m = new Map<string, string>();
    const list = (standings.data?.data ?? []) as StandingRow[];
    for (const s of list) {
      const did = s.Driver?.driverId;
      const cons = s.Constructors?.[s.Constructors.length - 1]?.constructorId;
      if (did && cons) m.set(did, normalizeTeamId(cons));
    }
    return m;
  }, [standings.data]);
}
