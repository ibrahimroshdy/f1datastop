import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { searchPages } from "@/config/searchPages";
import { useDriverStandings, useRaceSchedule } from "@/hooks/useF1Data";
import type { ErgastDriverStandingRow } from "@/lib/f1/types";

export type SearchResultGroup = "pages" | "drivers" | "races";

export type SearchResult = {
  id: string;
  group: SearchResultGroup;
  title: string;
  subtitle?: string;
  href: string;
};

function normalize(value: string): string {
  return value.toLowerCase().trim();
}

function matchesQuery(query: string, ...parts: (string | undefined)[]): boolean {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return true;
  return parts.some((part) => part && normalize(part).includes(normalizedQuery));
}

export function useGlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  const { data: driverStandings } = useDriverStandings(currentYear);
  const { data: raceSchedule } = useRaceSchedule(currentYear);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const results = useMemo((): SearchResult[] => {
    const items: SearchResult[] = [];

    for (const page of searchPages) {
      if (
        matchesQuery(query, page.title, ...(page.keywords ?? []))
      ) {
        items.push({
          id: `page-${page.id}`,
          group: "pages",
          title: page.title,
          href: page.href,
        });
      }
    }

    for (const standing of (driverStandings?.data ?? []) as ErgastDriverStandingRow[]) {
      const driver = standing.Driver;
      const team = standing.Constructors?.[0]?.name;
      const fullName = `${driver.givenName} ${driver.familyName}`;

      if (
        matchesQuery(
          query,
          fullName,
          driver.code,
          driver.driverId,
          team
        )
      ) {
        items.push({
          id: `driver-${driver.driverId}`,
          group: "drivers",
          title: fullName,
          subtitle: team ? `${driver.code} · ${team}` : driver.code,
          href: `/drivers`,
        });
      }
    }

    for (const race of raceSchedule?.data ?? []) {
      const circuitName = race.Circuit?.circuitName;
      const country = race.Circuit?.Location?.country;
      const locality = race.Circuit?.Location?.locality;

      if (
        matchesQuery(
          query,
          race.raceName,
          circuitName,
          country,
          locality,
          `Round ${race.round}`
        )
      ) {
        items.push({
          id: `race-${race.season}-${race.round}`,
          group: "races",
          title: race.raceName,
          subtitle: [circuitName, country].filter(Boolean).join(" · "),
          href: `/race-analysis/${race.season}/${race.round}`,
        });
      }
    }

    return items.slice(0, 20);
  }, [query, driverStandings?.data, raceSchedule?.data]);

  const groupedResults = useMemo(() => {
    return {
      pages: results.filter((item) => item.group === "pages"),
      drivers: results.filter((item) => item.group === "drivers"),
      races: results.filter((item) => item.group === "races"),
    };
  }, [results]);

  const selectResult = useCallback(
    (result: SearchResult) => {
      setOpen(false);
      setQuery("");
      navigate(result.href);
    },
    [navigate]
  );

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setQuery("");
    }
  }, []);

  return {
    open,
    setOpen,
    query,
    setQuery,
    results,
    groupedResults,
    selectResult,
    handleOpenChange,
  };
}
