import { useNextRace } from "@/hooks/useF1Data";
import { CalendarDays } from "lucide-react";
import CountryFlag from "@/components/common/CountryFlag";
import { useState } from "react";
import RaceDetailDialog from "@/components/calendar/RaceDetailDialog";
import { getNextSession, formatSessionDateTime } from "@/utils/nextSessionUtils";

const NextRaceInfo = () => {
  const { data: nextRaceData, isLoading } = useNextRace();
  const nextRace = nextRaceData?.data;
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  if (isLoading || !nextRace) {
    return null;
  }

  const { session: nextSession, raceName, country } = getNextSession(nextRace);
  
  const openRaceDetails = () => {
    setIsDialogOpen(true);
  };
  
  const closeRaceDetails = () => {
    setIsDialogOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className="press hidden min-w-0 items-center gap-2 rounded-full bg-card px-3.5 py-2 text-sm ring-1 ring-border hover:ring-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex"
        onClick={openRaceDetails}
      >
      <CalendarDays size={16} className="text-primary" />
      <div className="flex items-center flex-nowrap whitespace-nowrap">
        <span className="font-medium text-foreground">
          {nextSession ? `Next ${nextSession.shortName}:` : 'Next Race:'}
        </span>
        <span className="inline-flex items-center gap-1 mx-1">
          <CountryFlag country={country} size={16} />
          <span>{raceName}</span>
        </span>
        {nextSession && (
          <span className="text-muted-foreground">
            {formatSessionDateTime(nextSession.date, nextSession.time)}
          </span>
        )}
      </div>
    </button>

      {nextRace && 
        <RaceDetailDialog 
          isOpen={isDialogOpen} 
          onClose={closeRaceDetails} 
          race={nextRace} 
        />
      }
    </>
  );
};

export default NextRaceInfo;
