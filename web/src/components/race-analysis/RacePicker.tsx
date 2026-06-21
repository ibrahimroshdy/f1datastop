import YearSelector from "@/components/common/YearSelector";
import CountryFlag from "@/components/common/CountryFlag";
import {
  F1Card,
  F1CardContent,
  F1CardHeader,
  F1CardTitle,
  SessionSelector,
  type SessionOption,
} from "@/components/f1";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useThemeVariant } from "@/hooks/useThemeVariant";
import { cn } from "@/lib/utils";
import { Flag, Loader2 } from "lucide-react";
import type { RaceContext } from "./RaceAnalysisHeader";

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

  return (
    <F1Card
      variant={cardVariant}
      glassVariant={glassVariant}
      className={cn("overflow-hidden p-0", isGlass && "border-white/10")}
    >
      <F1CardHeader className="px-4 pb-3 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-primary" />
            <F1CardTitle className="text-base">Race Selection</F1CardTitle>
          </div>
          {currentRace ? (
            <div className="flex items-center gap-2">
              <CountryFlag
                country={currentRace.Circuit?.Location?.country || ""}
                size={16}
              />
              <span className="text-sm font-medium">
                {currentRace.raceName
                  ?.replace("Grand Prix", "GP")
                  .replace(/[\u{1F1E0}-\u{1F1FF}]{2}/gu, "")
                  .trim()}
              </span>
            </div>
          ) : null}
        </div>
      </F1CardHeader>
      <F1CardContent className="px-4 pb-4">
        <div className="flex flex-wrap gap-4">
          <div className="w-full sm:w-auto">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Season
            </label>
            <YearSelector selectedYear={selectedYear} onYearChange={onYearChange} />
          </div>

          <div className="w-full sm:min-w-[200px] sm:flex-1">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Grand Prix
            </label>
            {isRaceScheduleLoading ? (
              <div className="flex w-full items-center gap-2">
                <Skeleton className="h-10 w-full" />
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Select value={selectedRace} onValueChange={onRaceChange}>
                <SelectTrigger
                  className={cn("w-full", isGlass && "border-white/10 bg-white/5")}
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
                        <span className="text-xs text-muted-foreground">
                          R{race.round}
                        </span>
                        {race.Circuit?.circuitName || race.raceName}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {hasOpenF1Data ? (
            <SessionSelector
              sessions={availableSessions}
              selectedSessionKey={selectedSessionKey}
              onSessionChange={onSessionChange}
              isLoading={isOpenF1Loading}
            />
          ) : null}
        </div>
      </F1CardContent>
    </F1Card>
  );
}
