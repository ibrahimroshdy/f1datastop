import { useMemo } from "react";
import { getPrimaryConstructor, resolveTeamColor } from "@/lib/f1/adapters";
import type { ErgastDriverStandingRow } from "@/lib/f1/types";
import { useLatestDriver, useLatestSessionDrivers } from "@/hooks/useOpenF1Data";
import { useDriverResultsBySeason } from "@/hooks/useF1Data";
import type { DriverRaceResult } from "./driverCardTypes";

interface UseDriverCardOptions {
  driver: ErgastDriverStandingRow;
  teamTotalPoints?: number;
  seasonYear?: number;
  seasonResults?: DriverRaceResult[];
}

export function useDriverCard({
  driver,
  teamTotalPoints,
  seasonYear,
  seasonResults,
}: UseDriverCardOptions) {
  const currentConstructor = getPrimaryConstructor(driver);
  const constructorId = currentConstructor?.constructorId ?? "default";
  const teamColor = resolveTeamColor(constructorId);
  const teamName = currentConstructor?.name || "Unknown Team";

  const birthYear = driver.Driver.dateOfBirth
    ? new Date(driver.Driver.dateOfBirth).getFullYear()
    : null;
  const age = birthYear ? new Date().getFullYear() - birthYear : "N/A";

  const codeAcronym = (driver.Driver.code || "").toUpperCase();

  const batchDriversQuery = useLatestSessionDrivers(!!codeAcronym);
  const driverFromBatch = useMemo(() => {
    const rows = batchDriversQuery.data?.data;
    if (!rows?.length || !codeAcronym) return undefined;
    return rows.find(
      (d: { name_acronym?: string }) =>
        String(d.name_acronym || "").toUpperCase() === codeAcronym,
    );
  }, [batchDriversQuery.data?.data, codeAcronym]);

  const needsPerDriverFallback =
    !!codeAcronym &&
    (batchDriversQuery.isError ||
      (batchDriversQuery.isSuccess && !driverFromBatch));

  const latestDriverQuery = useLatestDriver(
    undefined,
    codeAcronym,
    needsPerDriverFallback,
  );

  const openF1Driver = driverFromBatch ?? latestDriverQuery.data?.data;
  const headshotUrl: string | undefined = openF1Driver?.headshot_url;
  const latestNumber: number | undefined = openF1Driver?.driver_number;
  const displayDriverNumber =
    latestNumber ?? driver.Driver.permanentNumber ?? "N/A";

  const driverPoints = Number(driver.points) || 0;
  const teamPoints = Number(teamTotalPoints) || 0;
  const contributionPercent =
    teamPoints > 0 && driverPoints > 0
      ? Math.round((driverPoints / teamPoints) * 100)
      : null;

  const season = seasonYear || new Date().getFullYear();
  const hasProvidedResults = seasonResults !== undefined;
  const { data: resultsByRaceResp } = useDriverResultsBySeason(
    season,
    driver.Driver.driverId,
    !hasProvidedResults,
  );
  const pointsHistory: DriverRaceResult[] = hasProvidedResults
    ? seasonResults
    : resultsByRaceResp?.data || [];

  const wins =
    Number(driver.wins) ||
    pointsHistory.filter((r) => r.position === "1").length;

  const driverFullName = `${driver.Driver.givenName} ${driver.Driver.familyName}`;

  return {
    teamColor,
    teamName,
    age,
    headshotUrl,
    displayDriverNumber,
    contributionPercent,
    teamPoints,
    season,
    pointsHistory,
    wins,
    driverFullName,
  };
}
