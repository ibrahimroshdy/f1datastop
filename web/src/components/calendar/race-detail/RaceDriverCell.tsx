import { getTeamColor } from "./raceDetailUtils";

type DriverLike = {
  code?: string;
  familyName?: string;
};

export function RaceDriverCell({
  driver,
  constructorId,
}: {
  driver: DriverLike;
  constructorId: string;
}) {
  const color = getTeamColor(constructorId);
  return (
    <div
      className="flex flex-col"
      style={{ borderLeft: `3px solid ${color}`, paddingLeft: "0.25rem" }}
    >
      <span className="font-medium">{driver.code}</span>
      <span className="text-[10px] text-muted-foreground truncate max-w-16">
        {driver.familyName}
      </span>
    </div>
  );
}

export function RaceDriverNameCell({
  driver,
  constructorId,
}: {
  driver: DriverLike & { givenName?: string };
  constructorId: string;
}) {
  const color = getTeamColor(constructorId);
  return (
    <span style={{ borderLeft: `4px solid ${color}`, paddingLeft: "0.5rem" }}>
      {driver.givenName} {driver.familyName}
      <span className="text-xs text-muted-foreground ml-1">{driver.code}</span>
    </span>
  );
}
