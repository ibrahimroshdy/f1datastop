import { F1Card, F1CardContent, F1EmptyState } from "@/components/f1";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import {
  Calendar as CalendarIcon,
  Star,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
} from "lucide-react";
import CountryFlag from "@/components/common/CountryFlag";
import { cn } from "@/lib/utils";
import {
  SINGLE_RACE,
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
  return (
    <div className="mt-3">
      {isLoading ? (
        <div className="space-y-2">
          {Array(6)
            .fill(0)
            .map((_, index) => (
              <F1Card
                key={index}
                variant={cardVariant}
                glassVariant={glassVariant}
                className={cn("overflow-hidden p-0", isGlass && "border-white/10")}
              >
                <F1CardContent className="p-0">
                  <div className="flex min-h-[52px]">
                    <Skeleton className="w-1 shrink-0 self-stretch rounded-l-xl" />
                    <div className="flex flex-1 flex-col gap-2 p-3 sm:p-3.5">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                </F1CardContent>
              </F1Card>
            ))}
        </div>
      ) : raceCount === 0 ? (
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
      ) : (
        <ul className="list-none space-y-2 p-0 m-0" aria-label={`${selectedYear} race calendar`}>
          {racesWithBreak.map((item, idx) => {
            if (item.isSummerBreak) {
              return (
                <li key={`summer-break-${idx}`} className="list-none">
                  <div className="flex items-center gap-3 py-1 sm:py-2">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                    <span className="shrink-0 rounded-full border border-dashed border-border/80 bg-muted/30 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
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
            const circuitName = race.Circuit?.circuitName || "Unknown Circuit";
            const raceType = raceTypes[index] || SINGLE_RACE;
            const hasSprint = !!race.Sprint;
            const isExpanded = expandedRaces.has(race.round);
            const typeStripe = raceTypeColors[raceType] ?? raceTypeColors[SINGLE_RACE];

            return (
              <li key={race.round} className="list-none">
                <F1Card
                  variant={cardVariant}
                  glassVariant={glassVariant}
                  className={cn(
                    "overflow-hidden p-0 transition-shadow duration-200",
                    isGlass && "border-white/10",
                    status === "next" && "ring-1 ring-f1-red shadow-sm shadow-primary/10",
                    status === "completed" && "opacity-95 hover:opacity-100",
                  )}
                >
                  <F1CardContent className="p-0">
                    <div className="flex min-h-[56px]">
                      <div
                        className={cn("w-1 shrink-0 self-stretch rounded-l-xl", typeStripe)}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label={`${raceName}, round ${race.round}. Open race details.`}
                          className={cn(
                            "flex cursor-pointer items-start gap-2 p-3 outline-none transition-colors sm:gap-3 sm:p-3.5",
                            "hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                          )}
                          onClick={() => openRaceDetails(race)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openRaceDetails(race);
                            }
                          }}
                        >
                          <div className="flex shrink-0 flex-col items-center gap-1.5 pt-0.5">
                            <span className="rounded-md bg-muted/90 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground tabular-nums sm:text-[11px]">
                              R{race.round}
                            </span>
                            <CountryFlag country={country} size={22} className="shrink-0" />
                          </div>
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                              <h3 className="text-sm font-semibold leading-snug sm:text-base">
                                {raceName}
                              </h3>
                              {hasSprint && (
                                <Star
                                  className="h-3.5 w-3.5 shrink-0 fill-yellow-500 text-yellow-500"
                                  aria-label="Sprint weekend"
                                />
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground sm:text-xs">
                              <span className="inline-flex min-w-0 items-center gap-1">
                                <MapPin className="h-3 w-3 shrink-0 opacity-70" />
                                <span className="truncate">{circuitName}</span>
                              </span>
                              <span className="hidden text-border sm:inline">·</span>
                              <span className="inline-flex items-center gap-1 tabular-nums">
                                <CalendarIcon className="h-3 w-3 shrink-0 opacity-70" />
                                {format(raceDate, "EEE d MMM yyyy")}
                              </span>
                              {race.time && (
                                <>
                                  <span className="hidden text-border sm:inline">·</span>
                                  <span className="inline-flex items-center gap-1 tabular-nums">
                                    <Clock className="h-3 w-3 shrink-0 opacity-70" />
                                    {format(parseISO(`${race.date}T${race.time}`), "HH:mm")} UTC
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-start gap-1.5 pt-0.5">
                            <Badge
                              variant={status === "next" ? "default" : "secondary"}
                              className={cn(
                                "h-6 px-2 text-[10px] font-medium sm:h-6 sm:px-2.5 sm:text-[11px]",
                                status === "next" && "bg-primary hover:bg-primary/90",
                              )}
                            >
                              {status === "completed"
                                ? "Done"
                                : status === "next"
                                  ? "Next"
                                  : "Upcoming"}
                            </Badge>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 shrink-0 p-0"
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
                            </Button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="space-y-2 border-t border-border/60 bg-muted/20 px-3 py-3 sm:px-3.5">
                            <div className="flex flex-wrap gap-1.5">
                              {hasSprint && (
                                <Badge variant="outline" className="text-[10px] h-6 sm:text-xs">
                                  Sprint
                                </Badge>
                              )}
                              {race.Qualifying && (
                                <Badge variant="outline" className="text-[10px] h-6 sm:text-xs">
                                  Qualifying
                                </Badge>
                              )}
                              {race.FirstPractice && (
                                <Badge variant="outline" className="text-[10px] h-6 sm:text-xs">
                                  Practice
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </F1CardContent>
                </F1Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
