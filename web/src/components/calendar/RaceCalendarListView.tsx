import { F1Card, F1EmptyState } from "@/components/f1";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { f1ToLocal, userTzLabel } from "@/lib/time";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import { Link } from "react-router-dom";
import {
  Star,
  ChevronDown,
  ChevronUp,
  MapPin,
} from "lucide-react";
import CountryFlag from "@/components/common/CountryFlag";
import { CircuitTrackMap, getCircuitTrack } from "@/components/calendar/CircuitTrackMap";
import CircuitDrawer from "@/components/calendar/CircuitDrawer";
import { cn } from "@/lib/utils";
import {
  SINGLE_RACE,
  DOUBLE_HEADER,
  TRIPLE_HEADER,
  raceTypeColors,
} from "@/components/calendar/raceCalendarUtils";
import type { RaceStatus, RaceWithBreakItem } from "@/hooks/useRaceCalendar";

interface RaceCalendarListViewProps {
  selectedYear: number;
  isLoading: boolean;
  raceCount: number;
  racesWithBreak: RaceWithBreakItem[];
  raceTypes: string[];
  expandedRaces: Set<string>;
  cardVariant: "default" | "glass";
  glassVariant: "default" | "panel";
  isGlass: boolean;
  getRaceStatus: (race: any) => RaceStatus;
  openRaceDetails: (race: any) => void;
  toggleRaceExpansion: (raceRound: string, event: React.MouseEvent) => void;
}

// Short label for the weekend-header encoding (kept from raceTypeColors)
const raceTypeLabel: Record<string, string> = {
  [DOUBLE_HEADER]: "Double",
  [TRIPLE_HEADER]: "Triple",
};

export default function RaceCalendarListView({
  selectedYear,
  isLoading,
  raceCount,
  racesWithBreak,
  raceTypes,
  expandedRaces,
  cardVariant,
  glassVariant,
  isGlass,
  getRaceStatus,
  openRaceDetails,
  toggleRaceExpansion,
}: RaceCalendarListViewProps) {
  if (isLoading) {
    return (
      <F1Card
        variant={cardVariant}
        glassVariant={glassVariant}
        className={cn("overflow-hidden p-0", isGlass && "border-white/10")}
      >
        <ul className="divide-y divide-border">
          {Array(8)
            .fill(0)
            .map((_, index) => (
              <li key={index} className="flex min-h-[56px] items-center">
                <Skeleton className="h-9 w-1 shrink-0 self-stretch" />
                <div className="flex flex-1 items-center gap-3 px-4 py-3">
                  <Skeleton className="h-7 w-7 shrink-0 rounded-md" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-3 w-12 shrink-0" />
                </div>
              </li>
            ))}
        </ul>
      </F1Card>
    );
  }

  if (raceCount === 0) {
    return (
      <F1EmptyState
        type="no-races"
        title={`No schedule for ${selectedYear}`}
        description="Try another season from the year selector, or check back when the calendar is published."
        size="md"
        showDecoration={false}
        className={cn(
          "rounded-xl border py-10 sm:py-12",
          isGlass ? "border-white/10 bg-white/[0.02]" : "border-border bg-card/40",
        )}
      />
    );
  }

  // Track month boundaries so we can drop a compact instrument sub-header
  let lastMonthKey = "";

  return (
    <F1Card
      variant={cardVariant}
      glassVariant={glassVariant}
      className={cn("overflow-hidden p-0", isGlass && "border-white/10")}
    >
      <ul
        className="stagger-children m-0 list-none divide-y divide-border p-0"
        aria-label={`${selectedYear} race calendar`}
      >
        {racesWithBreak.map((item, idx) => {
          if (item.isSummerBreak) {
            lastMonthKey = ""; // force the next race to re-print its month header
            return (
              <li key={`summer-break-${idx}`} className="list-none">
                <div className="flex items-center gap-3 bg-muted/20 px-4 py-2">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                  <span className="instrument-label shrink-0 whitespace-nowrap text-muted-foreground">
                    Summer break · {item.dates.start} – {item.dates.end}
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent via-border to-transparent" />
                </div>
              </li>
            );
          }

          const race = item.race;
          const index = item.index;
          const status = getRaceStatus(race);
          const raceDate = parseISO(race.date);
          const country = race.Circuit?.Location?.country || "";
          const raceName = getRaceNameWithoutEmoji(race.raceName);
          const locality =
            race.Circuit?.Location?.locality ||
            race.Circuit?.circuitName ||
            country;
          const circuitId = race.Circuit?.circuitId as string | undefined;
          const circuitName = race.Circuit?.circuitName || raceName;
          const track = getCircuitTrack(circuitName, locality);
          const raceType = raceTypes[index] || SINGLE_RACE;
          const hasSprint = !!race.Sprint;
          const isExpanded = expandedRaces.has(race.round);
          const typeStripe = raceTypeColors[raceType] ?? raceTypeColors[SINGLE_RACE];
          const isNext = status === "next";
          const isDone = status === "completed";

          // Compact month sub-header (instrument-label) when the month rolls over
          const monthKey = format(raceDate, "yyyy-MM");
          const showMonthHeader = monthKey !== lastMonthKey;
          lastMonthKey = monthKey;

          return (
            <li key={race.round} className="list-none">
              {showMonthHeader && (
                <div className="flex items-center gap-2 bg-muted/30 px-4 py-1.5">
                  <span className="instrument-label text-primary">
                    {format(raceDate, "MMMM yyyy")}
                  </span>
                  <span className="h-px flex-1 bg-border/70" />
                </div>
              )}

              <div
                className={cn(
                  "relative flex transition-colors duration-200",
                  isNext && "bg-primary/[0.06]",
                  isDone && "opacity-90",
                )}
              >
                {/* Left status / type stripe */}
                <div
                  className={cn(
                    "w-1 shrink-0 self-stretch",
                    isNext ? "bg-primary" : typeStripe,
                  )}
                  aria-hidden
                />

                <div className="min-w-0 flex-1">
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={`${raceName}, round ${race.round}. Open race details.`}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 px-4 py-2.5 outline-none transition-colors",
                      "hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                    )}
                    onClick={() => openRaceDetails(race)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openRaceDetails(race);
                      }
                    }}
                  >
                    {/* Round + circuit thumbnail → circuit deep-dive (row body opens
                        the race dialog; the thumbnail is a distinct action). */}
                    <div className="flex w-12 shrink-0 flex-col items-center gap-1">
                      <span
                        className={cn(
                          "timing text-2xs font-semibold",
                          isNext ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        R{String(race.round).padStart(2, "0")}
                      </span>
                      {circuitId ? (
                        <Link
                          to={`/circuits/${circuitId}`}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`${circuitName} circuit details`}
                          className="group/circ relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/30 transition-colors hover:border-primary/50"
                        >
                          {track ? (
                            <CircuitTrackMap
                              circuitName={circuitName}
                              locality={locality}
                              className="h-8 w-8 text-primary transition-transform group-hover/circ:scale-110"
                            />
                          ) : (
                            <MapPin className="h-4 w-4 text-muted-foreground/50" />
                          )}
                        </Link>
                      ) : (
                        <span className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-muted/30">
                          {track ? (
                            <CircuitTrackMap circuitName={circuitName} locality={locality} className="h-8 w-8 text-primary" />
                          ) : (
                            <MapPin className="h-4 w-4 text-muted-foreground/50" />
                          )}
                        </span>
                      )}
                    </div>

                    {/* GP name + locality */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="truncate text-sm font-semibold leading-tight">
                          {raceName}
                        </h3>
                        {hasSprint && (
                          <Star
                            className="h-3.5 w-3.5 shrink-0 fill-position-gold text-position-gold"
                            aria-label="Sprint weekend"
                          />
                        )}
                        {isNext && (
                          <span className="relative flex h-1.5 w-1.5 shrink-0">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-primary/60 animate-live-pulse" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-2xs text-muted-foreground">
                        <CountryFlag country={country} size={14} className="shrink-0" />
                        <span className="truncate">{locality}</span>
                        {raceTypeLabel[raceType] && (
                          <>
                            <span className="text-border">·</span>
                            <span className="instrument-label shrink-0">
                              {raceTypeLabel[raceType]}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Date / time (mono) + status chip */}
                    <div className="flex shrink-0 items-center gap-2.5">
                      <div className="text-right leading-tight">
                        <span className="timing block text-xs font-semibold text-foreground">
                          {format(raceDate, "EEE dd MMM")}
                        </span>
                        {race.time ? (
                          <span className="timing block text-2xs text-muted-foreground">
                            {f1ToLocal(race.date, race.time, "HH:mm")} {userTzLabel()}
                          </span>
                        ) : (
                          <span className="block text-2xs text-muted-foreground">
                            {selectedYear}
                          </span>
                        )}
                      </div>

                      <span
                        className={cn(
                          "hidden w-fit items-center rounded-md border px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide sm:inline-flex",
                          isNext &&
                            "border-primary/40 bg-primary/10 text-primary",
                          isDone &&
                            "border-border bg-secondary/50 text-muted-foreground",
                          !isNext &&
                            !isDone &&
                            "border-border bg-secondary/50 text-secondary-foreground",
                        )}
                      >
                        {isDone ? "Done" : isNext ? "Next" : "Upcoming"}
                      </span>

                      <button
                        type="button"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label={
                          isExpanded ? "Collapse race details" : "Expand race details"
                        }
                        aria-expanded={isExpanded}
                        onClick={(e) => toggleRaceExpansion(race.round, e)}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <CircuitDrawer
                      circuitId={circuitId}
                      circuitName={circuitName}
                      locality={locality}
                      onOpenDetails={() => openRaceDetails(race)}
                    />
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </F1Card>
  );
}

