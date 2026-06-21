import { Calendar, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import CountryFlag from "@/components/common/CountryFlag";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";

interface RaceScheduleContentProps {
  raceSchedule: any[];
  nextRace: any;
}

const RaceScheduleContent = ({ raceSchedule, nextRace }: RaceScheduleContentProps) => {
  const removeFlag = getRaceNameWithoutEmoji;

  if (!raceSchedule || raceSchedule.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No race schedule available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {raceSchedule.map((race) => {
        const isNext = nextRace && race.round === nextRace.round;
        const country = race.Circuit?.Location?.country || "";

        return (
          <div
            key={race.round}
            className={cn(
              "flex items-center justify-between p-4 rounded-lg border transition-colors",
              isNext ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/50"
            )}
          >
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                <span className="text-sm font-bold">R{race.round}</span>
              </div>
              <div className="flex items-center gap-3">
                <CountryFlag country={country} size={24} />
                <div>
                  <h3 className="font-bold text-foreground">{removeFlag(race.raceName)}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>{race.Circuit?.circuitName}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isNext && (
                <Badge variant="default" className="bg-primary">
                  Next Race
                </Badge>
              )}
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{new Date(race.date).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RaceScheduleContent;
