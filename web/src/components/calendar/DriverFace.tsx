import { Link } from "react-router-dom";
import { F1Avatar } from "@/components/f1";
import { getTeamColorById } from "@/constants/f1Colors";
import { buildF1DriverHeadshotUrl, getF1PortraitPathForErgastDriverId } from "@/constants/f1DriverPortraitMedia";
import { driverHref } from "@/lib/links";
import { cn } from "@/lib/utils";

/**
 * A driver's face alone, ringed in the team colour and linked to their page: the winner on a
 * Races row, the winner, pole and fastest lap in a quick look. `label` is its accessible name.
 */
export function DriverFace({
  driverId,
  givenName,
  familyName,
  constructorId,
  season,
  label,
  size = "xs",
  className,
}: {
  driverId: string;
  givenName?: string;
  familyName: string;
  constructorId?: string;
  season?: number;
  label: string;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const path = getF1PortraitPathForErgastDriverId(driverId);
  const color = constructorId ? getTeamColorById(constructorId) : undefined;
  return (
    <Link
      to={driverHref(driverId, season)}
      aria-label={label}
      title={label}
      onClick={(e) => e.stopPropagation()}
      className={cn("inline-flex shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
    >
      <F1Avatar
        size={size}
        src={path ? buildF1DriverHeadshotUrl(path) : undefined}
        alt=""
        fallback={`${givenName?.[0] ?? ""}${familyName[0] ?? ""}`}
        teamColor={color}
        showRing={!!color}
      />
    </Link>
  );
}
