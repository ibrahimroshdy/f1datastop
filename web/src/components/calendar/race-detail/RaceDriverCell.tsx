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
    <div className="flex items-stretch gap-2">
      <span
        className="w-1 shrink-0 self-stretch rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <div className="flex min-w-0 flex-col">
        <span className="font-medium">{driver.code}</span>
        <span className="text-[11px] text-muted-foreground truncate">
          {driver.familyName}
        </span>
      </div>
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
    <span className="inline-flex items-center gap-2">
      <span
        className="h-full min-h-[1.25rem] w-1 shrink-0 self-stretch rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span>
        {driver.givenName} {driver.familyName}
        <span className="timing text-xs text-muted-foreground ml-1">{driver.code}</span>
      </span>
    </span>
  );
}
