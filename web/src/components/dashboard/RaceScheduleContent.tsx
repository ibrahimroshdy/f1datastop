import { F1Card, F1CardContent } from "@/components/f1";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatDistance } from "date-fns";
import { useState } from "react";
import RaceDetailDialog from "@/components/calendar/RaceDetailDialog";

interface RaceScheduleContentProps {
  raceSchedule: any;
  nextRace: any;
  getCountryFlag: (country: string) => string;
}

const RaceScheduleContent = ({ raceSchedule, nextRace, getCountryFlag }: RaceScheduleContentProps) => {
  const { isGlass } = useTheme();
  const surfaceVariant = isGlass ? ("glass" as const) : ("default" as const);
  const surfaceGlass = isGlass ? ("panel" as const) : ("default" as const);
  const [selectedRace, setSelectedRace] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const removeFlag = (raceName: string) => {
    if (raceName && raceName.length > 3 && raceName.indexOf(' ') > 0) {
      return raceName.substring(raceName.indexOf(' ') + 1);
    }
    return raceName;
  };

  const formatRaceDate = (dateStr: string, timeStr: string) => {
    const raceDate = new Date(dateStr + "T" + (timeStr || "00:00:00Z"));
    return {
      date: raceDate.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric"
      }),
      time: raceDate.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit"
      }),
      fromNow: formatDistance(raceDate, new Date(), {
        addSuffix: true
      })
    };
  };
  
  const openRaceDetails = (race: any) => {
    setSelectedRace(race);
    setIsDialogOpen(true);
  };
  
  const closeRaceDetails = () => {
    setIsDialogOpen(false);
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {raceSchedule?.data?.slice(0, 6).map(race => {
          const raceTime = formatRaceDate(race.date, race.time || "");
          const isPast = new Date(race.date) < new Date();
          const isNextRace = nextRace && nextRace.round === race.round;
          
          return (
            <F1Card
              key={race.round}
              variant={surfaceVariant}
              glassVariant={surfaceGlass}
              className={cn(
                "cursor-pointer p-0 transition-all duration-200 hover:shadow-md",
                isPast && "opacity-70",
                isGlass && "border-white/10"
              )}
              onClick={() => openRaceDetails(race)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openRaceDetails(race);
                }
              }}
            >
              <F1CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getCountryFlag(race.Circuit.Location.country)}</span>
                    <div>
                      <h3 className="font-bold text-foreground">{removeFlag(race.raceName)}</h3>
                      <p className="text-sm text-muted-foreground">{race.Circuit.circuitName}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`${isPast ? 'bg-green-600' : isNextRace ? 'bg-f1-red' : 'bg-gray-500'} text-white border-0`}>
                    {isPast ? 'COMPLETED' : isNextRace ? 'NEXT RACE' : 'UPCOMING'}
                  </Badge>
                </div>
                <div className="mt-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date:</span>
                    <span className="text-foreground">{raceTime.date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Time:</span>
                    <span className="text-foreground">{raceTime.time}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-muted-foreground">Round:</span>
                    <span className="font-medium">{race.round} / {raceSchedule.data.length}</span>
                  </div>
                </div>
              </F1CardContent>
            </F1Card>
          );
        })}
      </div>
      
      {selectedRace && (
        <RaceDetailDialog 
          isOpen={isDialogOpen} 
          onClose={closeRaceDetails} 
          race={selectedRace} 
        />
      )}
    </>
  );
};

export default RaceScheduleContent;
