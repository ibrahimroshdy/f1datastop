import YearSelector from "@/components/common/YearSelector";
import CountryFlag from "@/components/common/CountryFlag";
import {
  F1Card,
  SessionSelector,
  F1Loader,
  F1Skeleton,
  type SessionOption,
} from "@/components/f1";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useThemeVariant } from "@/hooks/useThemeVariant";
import { cn } from "@/lib/utils";
import { Flag, Star } from "lucide-react";
import type { RaceContext } from "./RaceAnalysisHeader";

/** Sprint weekends carry a Sprint / SprintQualifying entry in the schedule. */
const isSprintRace = (r: { Sprint?: unknown; SprintQualifying?: unknown }) =>
  !!(r.Sprint || r.SprintQualifying);

type RaceScheduleEntry = RaceContext & {
  date: string;
};

interface RacePickerProps {
  selectedYear: number;
  selectedRace: string;
  currentRace: RaceContext | null;
  raceSchedule: RaceScheduleEntry[] | undefined;
  isRaceScheduleLoading: boolean;
  hasOpenF1Data: boolean;
  availableSessions: SessionOption[];
  selectedSessionKey: number | null;
  isOpenF1Loading: boolean;
  onYearChange: (year: number) => void;
  onRaceChange: (round: string) => void;
  onSessionChange: (value: string) => void;
}

export function RacePicker({
  selectedYear,
  selectedRace,
  currentRace,
  raceSchedule,
  isRaceScheduleLoading,
  hasOpenF1Data,
  availableSessions,
  selectedSessionKey,
  isOpenF1Loading,
  onYearChange,
  onRaceChange,
  onSessionChange,
}: RacePickerProps) {
  const { cardVariant, glassVariant, isGlass } = useThemeVariant();

  const raceLabel = currentRace?.raceName
    ?.replace("Grand Prix", "GP")
    .replace(/[\u{1F1E0}-\u{1F1FF}]{2}/gu, "")
    .trim();

  return (
    <F1Card
      size="sm"
      variant={cardVariant}
      glassVariant={glassVariant}
      className={cn("overflow-hidden p-0", isGlass && "border-white/10")}
    >
      {/* Compact summary strip — primary readout (flag + GP + round) */}
      <div className="flex items-center gap-2.5 border-b border-border px-3 py-2 md:px-4">
        <span className="instrument-label flex shrink-0 items-center gap-1.5 text-primary">
          <Flag className="h-3 w-3" />
          <span className="hidden sm:inline">Race</span>
        </span>
        {currentRace ? (
          <>
            <span className="shrink-0 rounded bg-muted p-1">
              <CountryFlag
                country={currentRace.Circuit?.Location?.country || ""}
                size={16}
              />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold leading-tight">
              {raceLabel}
            </span>
            {isSprintRace(currentRace) && (
              <Star
                className="h-3.5 w-3.5 shrink-0 text-position-gold"
                fill="currentColor"
                aria-label="Sprint weekend"
              />
            )}
            <span className="timing shrink-0 rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
              R{currentRace.round}
            </span>
          </>
        ) : (
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground">
            Select a Grand Prix
          </span>
        )}
      </div>

      {/* Tight controls row — instrument-label fields */}
      <div className="flex flex-wrap gap-2 px-3 py-2.5 md:gap-3 md:px-4">
        <div className="flex w-full items-end sm:w-auto">
          {/* YearSelector renders its own "Season:" label */}
          <YearSelector
            selectedYear={selectedYear}
            onYearChange={onYearChange}
            className="h-9"
          />
        </div>

        <div className="w-full sm:min-w-[180px] sm:flex-1">
          <label className="instrument-label mb-1 block">Grand Prix</label>
          {isRaceScheduleLoading ? (
            <div className="flex w-full items-center gap-2">
              <F1Skeleton className="h-9 w-full" />
              <F1Loader size="sm" />
            </div>
          ) : (
            <Select value={selectedRace} onValueChange={onRaceChange}>
              <SelectTrigger
                className={cn("h-9 w-full", isGlass && "border-white/10 bg-white/5")}
              >
                <SelectValue placeholder="Select race" />
              </SelectTrigger>
              <SelectContent>
                {raceSchedule?.map((race) => (
                  <SelectItem key={race.round} value={race.round}>
                    <span className="flex items-center gap-2">
                      <CountryFlag
                        country={race.Circuit?.Location?.country || ""}
                        size={14}
                      />
                      <span className="timing text-xs text-muted-foreground">
                        R{race.round}
                      </span>
                      {race.Circuit?.circuitName || race.raceName}
                      {isSprintRace(race) && (
                        <Star
                          className="h-3 w-3 shrink-0 text-position-gold"
                          fill="currentColor"
                          aria-label="Sprint weekend"
                        />
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {hasOpenF1Data ? (
          <div className="w-full sm:w-auto">
            <label className="instrument-label mb-1 block">Session</label>
            <SessionSelector
              sessions={availableSessions}
              selectedSessionKey={selectedSessionKey}
              onSessionChange={onSessionChange}
              isLoading={isOpenF1Loading}
              label=""
              triggerClassName="h-9 w-full md:w-[180px]"
            />
          </div>
        ) : null}
      </div>
    </F1Card>
  );
}
