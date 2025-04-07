
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistance } from "date-fns";

interface RaceScheduleContentProps {
  raceSchedule: any;
  nextRace: any;
  getCountryFlag: (country: string) => string;
}

const RaceScheduleContent = ({ raceSchedule, nextRace, getCountryFlag }: RaceScheduleContentProps) => {
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {raceSchedule?.data?.slice(0, 6).map(race => {
        const raceTime = formatRaceDate(race.date, race.time || "");
        const isPast = new Date(race.date) < new Date();
        const isNextRace = nextRace && nextRace.round === race.round;
        
        return (
          <Card key={race.round} className={`bg-gray-900 border-gray-800 ${isPast ? 'opacity-70' : ''}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{getCountryFlag(race.Circuit.Location.country)}</span>
                  <div>
                    <h3 className="font-bold">{removeFlag(race.raceName)}</h3>
                    <p className="text-sm text-gray-400">{race.Circuit.circuitName}</p>
                  </div>
                </div>
                <Badge variant="outline" className={`${isPast ? 'bg-green-600' : isNextRace ? 'bg-f1-red' : 'bg-gray-500'} text-white border-0`}>
                  {isPast ? 'COMPLETED' : isNextRace ? 'NEXT RACE' : 'UPCOMING'}
                </Badge>
              </div>
              <div className="mt-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Date:</span>
                  <span>{raceTime.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Time:</span>
                  <span>{raceTime.time}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-gray-400">Round:</span>
                  <span className="font-medium">{race.round} / {raceSchedule.data.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default RaceScheduleContent;
