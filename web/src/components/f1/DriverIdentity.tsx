import { Link } from "react-router-dom";
import CountryFlag from "@/components/common/CountryFlag";
import { F1Avatar } from "./F1Avatar";
import { TeamName } from "./TeamName";
import { getTeamColorById } from "@/constants/f1Colors";
import { buildF1DriverHeadshotUrl, getF1PortraitPathForErgastDriverId } from "@/constants/f1DriverPortraitMedia";
import { driverHref, teamHref } from "@/lib/links";
import { cn } from "@/lib/utils";

const AVATAR = { 28: "xs", 32: "sm", 40: "md", 56: "lg", 72: "xl" } as const;

/**
 * A driver as a row shows them (docs/design/decisions.md D19, D26, D33, D34): the headshot
 * ringed in the team colour, the name as a link to their page, and under it the nationality
 * flag and the team with its emblem. Country names are never written; the flag carries them.
 * `compact` shows the surname only, for summary cards (D29). Names wrap; nothing is cut.
 */
export function DriverIdentity({
  driverId,
  givenName,
  familyName,
  nationality,
  constructorId,
  teamName,
  size = 40,
  compact = false,
  extra,
  className,
}: {
  driverId: string;
  givenName?: string;
  familyName: string;
  nationality?: string;
  constructorId?: string;
  teamName?: string;
  size?: keyof typeof AVATAR;
  compact?: boolean;
  /** Something to add after the team on the second line, e.g. "fastest lap". */
  extra?: React.ReactNode;
  className?: string;
}) {
  const color = constructorId ? getTeamColorById(constructorId) : undefined;
  const path = getF1PortraitPathForErgastDriverId(driverId);
  const name = compact || !givenName ? familyName : `${givenName} ${familyName}`;
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <F1Avatar
        size={AVATAR[size]}
        src={path ? buildF1DriverHeadshotUrl(path) : undefined}
        alt=""
        fallback={`${givenName?.[0] ?? ""}${familyName[0] ?? ""}`}
        teamColor={color}
        showRing={!!color}
      />
      <span className="flex min-w-0 flex-col">
        <Link to={driverHref(driverId)} viewTransition className="font-semibold leading-tight text-heading hover:underline">
          {name}
        </Link>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-muted-foreground">
          {nationality ? <CountryFlag country={nationality} size={14} /> : null}
          {constructorId && teamName ? <TeamName constructorId={constructorId} name={teamName} to={teamHref(constructorId)} size={13} /> : null}
          {extra}
        </span>
      </span>
    </span>
  );
}
