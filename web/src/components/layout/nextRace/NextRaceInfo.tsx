import { useNextRace } from "@/hooks/useF1Data";
import { CalendarDays } from "lucide-react";
import { format } from "date-fns";
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
      <div 
        className="hidden md:flex items-center gap-2 text-sm bg-card rounded-lg px-3 py-1.5 border border-transparent hover:border-primary hover:shadow-md cursor-pointer transition-all duration-200 hover:bg-card/90"
        onClick={openRaceDetails}
      >
      <CalendarDays size={16} className="text-primary" />
      <div className="flex items-center flex-nowrap whitespace-nowrap">
        <span className="font-medium text-foreground">
          {nextSession ? `Next ${nextSession.shortName}:` : 'Next Race:'}
        </span>
        <span className="inline-flex items-center gap-1 mx-1">
          <CountryFlag country={country} size={16} svg={true} />
          <span>{raceName}</span>
        </span>
        {nextSession && (
          <span className="text-muted-foreground">
            {formatSessionDateTime(nextSession.date, nextSession.time)}
          </span>
        )}
      </div>
    </div>
      
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
