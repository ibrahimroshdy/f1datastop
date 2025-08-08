import { useEffect, useState, useMemo, useCallback } from "react";
import { formatDistance } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CalendarDays } from "lucide-react";
import PageSelector from "@/components/navigation/PageSelector";
import RaceDetailDialog from "@/components/calendar/RaceDetailDialog";
import CountryFlag from "@/components/common/CountryFlag";
import BuyMeCoffeeWidget from "@/components/common/BuyMeCoffeeWidget";
import { getNextSession } from "@/utils/nextSessionUtils";

interface HeaderSectionProps {
  nextRace: any;
  isOffline: boolean;
}

const HeaderSection = ({ nextRace, isOffline }: HeaderSectionProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  
  // Get the next session instead of just the race - memoize to prevent unnecessary re-renders
  const { session: nextSession, raceName, country } = useMemo(() => getNextSession(nextRace), [nextRace]);
  
  // Memoize the session date to prevent recalculation on every render
  const sessionDate = useMemo(() => {
    if (!nextSession) return null;
    return new Date(nextSession.date + "T" + (nextSession.time || "00:00:00Z"));
  }, [nextSession]);
  
  // Memoize the calculation function
  const calculateTimeLeft = useCallback(() => {
    if (!sessionDate) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    
    const now = new Date();
    const difference = sessionDate.getTime() - now.getTime();
    
    if (difference <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    }
    
    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / (1000 * 60)) % 60),
      seconds: Math.floor((difference / 1000) % 60)
    };
  }, [sessionDate]);
  
  useEffect(() => {
    if (!sessionDate) return;
    
    // Set initial countdown
    setCountdown(calculateTimeLeft());
    
    // Set up interval with stable reference
    const timer = setInterval(() => {
      setCountdown(calculateTimeLeft());
    }, 1000);
    
    return () => clearInterval(timer);
  }, [sessionDate, calculateTimeLeft]);
  
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
  
  const openRaceDetails = () => {
    setIsDialogOpen(true);
  };
  
  const closeRaceDetails = () => {
    setIsDialogOpen(false);
  };

  return (
    <header className="mb-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between w-full">
        <div className="w-full md:w-auto">
          <h1 className="md:text-3xl tracking-tight flex items-center gap-2 text-xl font-medium">
            Formula 1 Season {new Date().getFullYear()}
          </h1>
          <div className="flex items-center mt-2">
            <p className="text-muted-foreground text-sm">Live race data, standings and schedule</p>
            <BuyMeCoffeeWidget size="small" className="ml-3" />
          </div>
        </div>
        {nextRace && nextSession && 
          <div 
            className="mt-3 md:mt-0 bg-gradient-to-r from-purple-500/5 to-transparent rounded-lg px-3 md:px-4 py-3 flex items-center gap-2 border border-purple-500/20 hover:shadow-md hover:shadow-purple-500/10 md:hover:scale-102 hover:bg-gradient-to-r hover:from-purple-500/10 hover:to-transparent cursor-pointer transition-all duration-300 transform hover:border-purple-500/40 text-sm md:text-base w-full md:w-auto justify-between"
            onClick={openRaceDetails}
          >
            <div className="w-full">
              <div className="flex items-center justify-between gap-2 md:gap-3">
                <div className="flex items-center gap-2">
                  <CountryFlag country={country} size={18} svg={true} />
                  <span className="font-medium text-foreground">
                    {removeFlag(raceName)} {nextSession.shortName}
                  </span>
                </div>
                <div className="text-[10px] md:text-xs font-mono flex gap-1">
                  <span><span className={`font-bold ${countdown.days < 3 ? "text-red-500" : "text-purple-600 dark:text-purple-400"}`}>{countdown.days}</span><span className={`font-normal ${countdown.days < 3 ? "text-red-400" : "text-muted-foreground"}`}>d</span></span>
                  <span><span className={`font-bold ${countdown.days < 3 ? "text-red-500" : "text-purple-600 dark:text-purple-400"}`}>{countdown.hours}</span><span className={`font-normal ${countdown.days < 3 ? "text-red-400" : "text-muted-foreground"}`}>h</span></span>
                  <span><span className={`font-bold ${countdown.days < 3 ? "text-red-500" : "text-purple-600 dark:text-purple-400"}`}>{countdown.minutes}</span><span className={`font-normal ${countdown.days < 3 ? "text-red-400" : "text-muted-foreground"}`}>m</span></span>
                  <span><span className={`font-bold ${countdown.days < 3 ? "text-red-500" : "text-purple-600 dark:text-purple-400"}`}>{countdown.seconds}</span><span className={`font-normal ${countdown.days < 3 ? "text-red-400" : "text-muted-foreground"}`}>s</span></span>
                </div>
              </div>
            </div>
          </div>
        }
      </div>
      
      <div className="mt-4">
        <PageSelector />
      </div>
      
      {isOffline && <Alert className="mt-4 bg-yellow-900/20 border-yellow-600 text-yellow-200">
          <AlertCircle className="h-4 w-4 text-yellow-400" />
          <AlertTitle>API Connection Issue</AlertTitle>
          <AlertDescription>
            Unable to connect to the F1 API. Showing offline data instead. Some information might not be up to date.
          </AlertDescription>
        </Alert>}
        
      {nextRace && 
        <RaceDetailDialog 
          isOpen={isDialogOpen} 
          onClose={closeRaceDetails} 
          race={nextRace} 
        />
      }
    </header>
  );
};

export default HeaderSection;
