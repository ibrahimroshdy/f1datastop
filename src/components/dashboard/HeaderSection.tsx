
import { Button } from "@/components/ui/button";
import { CalendarCheck2, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { formatRelative } from 'date-fns';
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import BackendStatusIndicator from "./BackendStatusIndicator"; // Import the new component

interface HeaderSectionProps {
  nextRace: any;
  isOffline: boolean;
}

const HeaderSection = ({ nextRace, isOffline }: HeaderSectionProps) => {
  const raceDate = nextRace?.date && nextRace?.time 
    ? new Date(nextRace.date + "T" + nextRace.time.replace("Z", ""))
    : null;

  const relativeTime = raceDate
    ? formatRelative(raceDate, new Date())
    : "Date not available";

  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-10">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold mb-2">F1 Dashboard</h1>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          {!isOffline && (
            <div className="flex items-center gap-1 text-gray-300">
              <Clock className="h-4 w-4" />
              <span>
                Next Race: {nextRace?.raceName 
                  ? getRaceNameWithoutEmoji(nextRace.raceName) 
                  : "Loading..."}
              </span>
            </div>
          )}
          <div className="flex items-center">
            <BackendStatusIndicator />
          </div>
        </div>
      </div>
      <div className="mt-4 md:mt-0 flex gap-2 flex-wrap">
        <Link to="/calendar">
          <Button variant="default" className="bg-f1-red hover:bg-red-700">
            <CalendarCheck2 className="mr-2 h-4 w-4" />
            Race Calendar
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default HeaderSection;
