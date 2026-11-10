import CountryFlag from "@/components/common/CountryFlag";
import { F1Skeleton, SessionSelector, type SessionOption } from "@/components/f1";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import { isSprintWeekend, type RaceContext } from "./raceContext";

interface RacePickerProps {
  selectedRace: string;
  raceSchedule: RaceContext[] | undefined;
  isRaceScheduleLoading: boolean;
  availableSessions: SessionOption[];
  selectedSessionKey: number | null;
  isSessionsLoading: boolean;
  onRaceChange: (round: string) => void;
  onSessionChange: (value: string) => void;
}

/**
 * Which Grand Prix of the season, and which session of it. The season itself is the one in
 * the top bar (useSeason), so there is no season picker here. Races are named by flag and
 * Grand Prix name, never by round number.
 */
export function RacePicker({
  selectedRace,
  raceSchedule,
  isRaceScheduleLoading,
  availableSessions,
  selectedSessionKey,
  isSessionsLoading,
  onRaceChange,
  onSessionChange,
}: RacePickerProps) {
  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
      <div className="w-full sm:w-72">
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="race-picker">
          Grand Prix
        </label>
        {isRaceScheduleLoading ? (
          <F1Skeleton className="h-10 w-full" />
        ) : (
          <Select value={selectedRace} onValueChange={onRaceChange}>
            <SelectTrigger id="race-picker" className="h-10 w-full">
              <SelectValue placeholder="Pick a Grand Prix" />
            </SelectTrigger>
            <SelectContent>
              {raceSchedule?.map((race) => (
                <SelectItem key={race.round} value={race.round}>
                  <span className="flex items-center gap-2">
                    <CountryFlag country={race.Circuit?.Location?.country || ""} size={14} />
                    <span>{getRaceNameWithoutEmoji(race.raceName)}</span>
                    {isSprintWeekend(race) ? <span className="text-xs text-muted-foreground">Sprint</span> : null}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <SessionSelector
        sessions={availableSessions}
        selectedSessionKey={selectedSessionKey}
        onSessionChange={onSessionChange}
        isLoading={isSessionsLoading}
        label="Session"
      />
    </div>
  );
}
