import { createContext, useContext } from "react";
import CountryFlag from "@/components/common/CountryFlag";
import { F1Avatar, TeamName } from "@/components/f1";
import { getTeamColorById } from "@/constants/f1Colors";
import { buildF1DriverHeadshotUrl, getF1PortraitPathForErgastDriverId } from "@/constants/f1DriverPortraitMedia";
import { useDriverStandings } from "@/hooks/useF1Data";

/** The season the Sankey shows, so its tooltip can find each driver in that season's standings. */
export const SankeySeasonContext = createContext<number | undefined>(undefined);

interface StandingDriver {
  Driver?: { driverId?: string; code?: string; nationality?: string; givenName?: string; familyName?: string };
}

/**
 * The top of a Sankey tooltip: the driver's face ringed in the team
 * colour, their name, and under it their flag and team with its emblem (D26, D33, D34).
 * The chart's data has only the three-letter code, so the driver is found by code in the
 * season's standings (already cached by Home and Standings). Unknown drivers keep a plain name.
 */
export function SankeyTooltipPerson({
  code,
  name,
  constructorId,
  teamName,
}: {
  code?: string;
  name?: string;
  constructorId?: string;
  teamName?: string;
}) {
  const season = useContext(SankeySeasonContext);
  const { data } = useDriverStandings(season);
  const rows = ((data as { data?: StandingDriver[] } | undefined)?.data ?? []) as StandingDriver[];
  const driver = code ? rows.find((r) => r.Driver?.code === code)?.Driver : undefined;
  const path = driver?.driverId ? getF1PortraitPathForErgastDriverId(driver.driverId) : undefined;
  const team = constructorId && constructorId !== "unknown" ? constructorId : undefined;
  const color = team ? getTeamColorById(team) : undefined;
  const initials = (name ?? code ?? "?")
    .split(" ")
    .map((w) => w[0])
    .slice(-2)
    .join("");

  return (
    <div className="mb-2 flex items-center gap-2.5">
      <F1Avatar
        size="md"
        src={path ? buildF1DriverHeadshotUrl(path) : undefined}
        alt=""
        fallback={initials}
        teamColor={color}
        showRing={!!color}
      />
      <div className="flex min-w-0 flex-col">
        <span className="font-sans text-sm font-semibold leading-tight text-heading">{name || code}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-sans text-[13px] text-muted-foreground">
          {driver?.nationality ? <CountryFlag country={driver.nationality} size={14} /> : null}
          {team && teamName ? <TeamName constructorId={team} name={teamName} size={13} /> : teamName ? <span>{teamName}</span> : null}
        </span>
      </div>
    </div>
  );
}
