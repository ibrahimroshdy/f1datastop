import { F1Card, F1CardContent, F1EmptyState, F1Skeleton } from "@/components/f1";
import { format, parseISO } from "date-fns";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import { Star, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import CountryFlag from "@/components/common/CountryFlag";
import { CircuitTrackMap, getCircuitTrack } from "@/components/calendar/CircuitTrackMap";
import { cn } from "@/lib/utils";
import { SINGLE_RACE, raceTypeColors } from "@/components/calendar/raceCalendarUtils";
import type { RaceStatus, RaceWithBreakItem } from "@/hooks/useRaceCalendar";

interface RaceCalendarGridViewProps {
  selectedYear: number;
  isLoading: boolean;
  raceCount: number;
  racesWithBreak: RaceWithBreakItem[];
  raceTypes: string[];
  cardVariant: "default" | "glass";
  glassVariant: "default" | "panel";
  isGlass: boolean;
  getRaceStatus: (race: any) => RaceStatus;
  openRaceDetails: (race: any) => void;
}

export default function RaceCalendarGridView({
  selectedYear,
  isLoading,
  raceCount,
  racesWithBreak,
  raceTypes,
  cardVariant,
  glassVariant,
  isGlass,
  getRaceStatus,
  openRaceDetails,
}: RaceCalendarGridViewProps) {
  return (
    <div className="mt-3">
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
          {Array(10)
            .fill(0)
            .map((_, index) => (
              <F1Card
                key={index}
                variant={cardVariant}
                glassVariant={glassVariant}
                className={cn("overflow-hidden p-0", isGlass && "border-white/10")}
              >
                <F1Skeleton className="h-0.5 w-full" />
                <F1CardContent className="p-1.5 sm:p-2.5">
                  <F1Skeleton className="mb-1.5 h-3.5 w-3/4" />
                  <F1Skeleton className="h-3 w-1/2" />
                </F1CardContent>
              </F1Card>
            ))}
        </div>
      ) : raceCount === 0 ? (
        <F1EmptyState
          type="no-races"
          title={`No schedule for ${selectedYear}`}
          description="Try another season from the year selector."
          size="md"
          showDecoration={false}
          className={cn(
            "rounded-xl border py-10 sm:py-12",
            isGlass ? "border-white/10 bg-white/2" : "border-border bg-card/40",
          )}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
          {racesWithBreak.map((item, idx) => {
            if (item.isSummerBreak) {
              return (
                <div
                  key={`summer-break-${idx}`}
                  className="col-span-2 sm:col-span-3 lg:col-span-4 xl:col-span-5 flex items-center gap-3 my-1.5 sm:my-2"
                >
                  <div className="h-px flex-1 bg-linear-to-r from-transparent via-border to-transparent" />
                  <span className="instrument-label shrink-0 whitespace-nowrap tabular-nums text-muted-foreground">
                    Summer break · {item.dates.start} – {item.dates.end}
                  </span>
                  <div className="h-px flex-1 bg-linear-to-l from-transparent via-border to-transparent" />
                </div>
              );
            }

            const race = item.race;
            const index = item.index;
            const status = getRaceStatus(race);
            const raceDate = parseISO(race.date);
            const country = race.Circuit?.Location?.country || "";
            const raceName = getRaceNameWithoutEmoji(race.raceName);
            const locality =
              race.Circuit?.Location?.locality || race.Circuit?.circuitName || country;
            const circuitId = race.Circuit?.circuitId as string | undefined;
            const circuitName = race.Circuit?.circuitName || raceName;
            const track = getCircuitTrack(circuitName, locality);
            const raceType = raceTypes[index] || SINGLE_RACE;
            const hasSprint = !!race.Sprint;

            return (
              <F1Card
                key={race.round}
                variant={cardVariant}
                glassVariant={glassVariant}
                className={cn(
                  "cursor-pointer overflow-hidden p-0 transition-all hover:shadow-md",
                  status === "next" && "ring-1 ring-primary",
                  isGlass && "border-white/10",
                )}
                onClick={() => openRaceDetails(race)}
              >
                <div className={`h-0.5 w-full ${raceTypeColors[raceType]}`} />
                <F1CardContent className="p-1.5 sm:p-2.5">
                  <div className="flex flex-col items-center text-center gap-1 sm:gap-2">
                    {circuitId ? (
                      <Link
                        to={`/circuits/${circuitId}`}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`${circuitName} circuit details`}
                        className="group/circ flex h-12 w-12 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/30 transition-colors hover:border-primary/50"
                      >
                        {track ? (
                          <CircuitTrackMap
                            circuitName={circuitName}
                            locality={locality}
                            className="h-9 w-9 text-primary transition-transform group-hover/circ:scale-110"
                          />
                        ) : (
                          <MapPin className="h-5 w-5 text-muted-foreground/50" />
                        )}
                      </Link>
                    ) : (
                      <span className="flex h-12 w-12 items-center justify-center rounded-md border border-border bg-muted/30">
                        {track ? (
                          <CircuitTrackMap circuitName={circuitName} locality={locality} className="h-9 w-9 text-primary" />
                        ) : (
                          <MapPin className="h-5 w-5 text-muted-foreground/50" />
                        )}
                      </span>
                    )}
                    <div className="w-full">
                      <h3 className="flex items-center justify-center gap-1 truncate text-xs font-semibold leading-tight sm:text-sm mb-0.5">
                        <CountryFlag country={country} size={13} className="shrink-0" />
                        <span className="truncate">{raceName}</span>
                      </h3>
                      <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                        <span className="timing">R{race.round}</span>
                        {hasSprint && (
                          <>
                            <span>•</span>
                            <Star className="h-2.5 w-2.5 fill-position-gold text-position-gold" />
                          </>
                        )}
                      </div>
                      <p className="timing text-[11px] text-muted-foreground mt-1">
                        {format(raceDate, "dd MMM")}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide",
                        status === "next" &&
                          "border-primary/40 bg-primary/10 text-primary",
                        status === "completed" &&
                          "border-border bg-secondary/50 text-muted-foreground",
                        status !== "next" &&
                          status !== "completed" &&
                          "border-border bg-secondary/50 text-secondary-foreground",
                      )}
                    >
                      {status === "completed"
                        ? "Done"
                        : status === "next"
                          ? "Next"
                          : "Upcoming"}
                    </span>
                  </div>
                </F1CardContent>
              </F1Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
