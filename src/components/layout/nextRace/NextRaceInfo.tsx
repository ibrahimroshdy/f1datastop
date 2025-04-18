import { useNextRace } from "@/hooks/useF1Data";
import { CalendarDays } from "lucide-react";
import { format } from "date-fns";
import CountryFlag from "@/components/common/CountryFlag";

const NextRaceInfo = () => {
  const { data: nextRaceData, isLoading } = useNextRace();
  const nextRace = nextRaceData?.data;

  if (isLoading || !nextRace) {
    return null;
  }

  const formatDateString = (dateStr: string, timeStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hour, minute] = timeStr.split(':').map(Number);
      const date = new Date(year, month - 1, day, hour, minute);
      return format(date, 'EEE, MMM d, yyyy - HH:mm');
    } catch (error) {
      console.error("Error parsing date:", error);
      return "Date unavailable";
    }
  };

  let raceName = "";
  let country = "";
  
  if (nextRace) {
    raceName = nextRace.raceName;
    country = nextRace.Circuit?.Location?.country || "";
  }

  return (
    <div className="hidden md:flex items-center gap-2 text-sm bg-card rounded-lg px-3 py-1.5">
      <CalendarDays size={16} className="text-primary" />
      <div className="flex items-center flex-nowrap whitespace-nowrap">
        <span className="font-medium text-foreground">Next Race:</span>
        <span className="inline-flex items-center gap-1 mx-1">
          <CountryFlag country={country} size={16} svg={true} />
          <span>{raceName}</span>
        </span>
        {nextRace.date && nextRace.time && (
          <span className="text-muted-foreground">
            {formatDateString(nextRace.date, nextRace.time)}
          </span>
        )}
      </div>
    </div>
  );
};

export default NextRaceInfo;
