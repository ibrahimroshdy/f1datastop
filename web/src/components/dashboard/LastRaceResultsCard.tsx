import { F1Card } from "@/components/f1";
import { F1EmptyState } from "@/components/f1/F1EmptyState";
import { StandingsSkeleton } from "@/components/f1/F1Skeleton";
import { DriverIdentity } from "@/components/f1/DriverIdentity";
import CountryFlag from "@/components/common/CountryFlag";
import { useOpenQuickLook } from "@/components/calendar/QuickLook";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import { CompactRow } from "./CompactRow";

interface RaceResult {
  position: string;
  laps?: string;
  status?: string;
  Time?: { time?: string };
  Driver: { driverId: string; givenName?: string; familyName: string; nationality?: string };
  Constructor: { constructorId: string; name: string };
  FastestLap?: { rank?: string; lap?: string; Time?: { time?: string } };
}

export interface LastRaceResultsCardProps {
  lastRaceResults: { data?: { raceName?: string; season?: string; round?: string; results?: RaceResult[] } | null } | null | undefined;
  isResultsLoading: boolean;
  /** The schedule entry for the same race, for its country. */
  country?: string;
}

/** What the end of a podium row says: the winner's race time, then the gap or the status. */
const timeLabel = (r: RaceResult, winner: boolean) => {
  const t = r.Time?.time;
  if (!t) return r.status || "";
  return winner || t.startsWith("+") ? t : `+${t}`;
};

/** Home's last Grand Prix: its flag and name (opens the quick look), the fastest lap, the podium. */
const LastRaceResultsCard = ({ lastRaceResults, isResultsLoading, country }: LastRaceResultsCardProps) => {
  const openQuickLook = useOpenQuickLook();
  const race = lastRaceResults?.data;
  const results = race?.results ?? [];
  const fastest = results.find((r) => r.FastestLap?.rank === "1");

  return (
    <F1Card className="h-full">
      <div className="flex items-center gap-2.5">
        {country ? <CountryFlag country={country} size={24} /> : null}
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-ink-2">Last race</span>
      </div>

      {isResultsLoading ? (
        <StandingsSkeleton rows={3} />
      ) : !race?.raceName || !race.season || !race.round ? (
        <F1EmptyState
          type="no-results"
          title="No results yet"
          description="Results appear after the first race."
          size="sm"
          showDecoration={false}
        />
      ) : (
        <>
          <h2 className="mt-2.5 text-[22px] leading-tight">
            <button
              type="button"
              onClick={() => openQuickLook(race.season!, race.round!)}
              className="text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {getRaceNameWithoutEmoji(race.raceName)}
            </button>
          </h2>
          {fastest?.FastestLap?.Time?.time ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              Fastest lap{" "}
              <span className="font-mono tabular-nums text-fastest-lap">{fastest.FastestLap.Time.time}</span>
              , {fastest.Driver.familyName}
              {fastest.FastestLap.lap ? `, lap ${fastest.FastestLap.lap}` : ""}
            </p>
          ) : null}
          <ul className="mt-1.5 divide-y divide-border">
            {results.slice(0, 3).map((r, i) => (
              <CompactRow key={r.Driver.driverId} pos={r.position} figure={timeLabel(r, i === 0)}>
                <DriverIdentity
                  compact
                  size={32}
                  driverId={r.Driver.driverId}
                  givenName={r.Driver.givenName}
                  familyName={r.Driver.familyName}
                  nationality={r.Driver.nationality}
                  constructorId={r.Constructor.constructorId}
                  teamName={r.Constructor.name}
                />
              </CompactRow>
            ))}
          </ul>
        </>
      )}
    </F1Card>
  );
};

export default LastRaceResultsCard;
