
import { useEffect, useState } from "react";
import { formatDistance } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";
import PageSelector from "@/components/navigation/PageSelector";

interface HeaderSectionProps {
  nextRace: any;
  isOffline: boolean;
}

const HeaderSection = ({ nextRace, isOffline }: HeaderSectionProps) => {
  const getCountryFlag = (location: string) => {
    const countryFlags: Record<string, string> = {
      "Monte Carlo": "🇲🇨",
      "Monza": "🇮🇹",
      "Melbourne": "🇦🇺",
      "Sakhir": "🇧🇭",
      "Jeddah": "🇸🇦",
      "Shanghai": "🇨🇳",
      "Miami": "🇺🇸",
      "Imola": "🇮🇹",
      "Monaco": "🇲🇨",
      "Montreal": "🇨🇦",
      "Barcelona": "🇪🇸",
      "Spielberg": "🇦🇹",
      "Silverstone": "🇬🇧",
      "Budapest": "🇭🇺",
      "Spa": "🇧🇪",
      "Zandvoort": "🇳🇱",
      "Baku": "🇦🇿",
      "Singapore": "🇸🇬",
      "Suzuka": "🇯🇵",
      "Losail": "🇶🇦",
      "Austin": "🇺🇸",
      "Mexico City": "🇲🇽",
      "Sao Paulo": "🇧🇷",
      "Las Vegas": "🇺🇸",
      "Yas Marina": "🇦🇪"
    };
    for (const [key, value] of Object.entries(countryFlags)) {
      if (location?.includes(key)) {
        return value;
      }
    }
    return "🏁"; // Default racing flag
  };

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
    <header className="mb-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between">
        <div>
          <h1 className="md:text-4xl tracking-tight flex items-center gap-2 text-2xl font-normal">
            Formula 1 Season {new Date().getFullYear()}
          </h1>
          <p className="text-gray-400 mt-1">Live race data, standings and schedule</p>
        </div>
        {nextRace && <div className="mt-4 md:mt-0 bg-gray-800 rounded-lg px-4 py-2 flex items-center gap-2">
            <span className="text-xl">{getCountryFlag(nextRace.Circuit.Location.country)}</span>
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-f1-red text-white border-0">NEXT RACE</Badge>
                <span className="font-medium">{removeFlag(nextRace.raceName)}</span>
              </div>
              <div className="text-sm text-gray-400">
                {formatRaceDate(nextRace.date, nextRace.time || "").fromNow}
              </div>
            </div>
          </div>}
      </div>
      
      <PageSelector />
      
      {isOffline && <Alert className="mt-6 bg-yellow-900/20 border-yellow-600 text-yellow-200">
          <AlertCircle className="h-4 w-4 text-yellow-400" />
          <AlertTitle>API Connection Issue</AlertTitle>
          <AlertDescription>
            Unable to connect to the F1 API. Showing offline data instead. Some information might not be up to date.
          </AlertDescription>
        </Alert>}
    </header>
  );
};

export default HeaderSection;
