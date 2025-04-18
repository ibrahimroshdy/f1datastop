import { useEffect, useState } from "react";
import { formatDistance } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";
import PageSelector from "@/components/navigation/PageSelector";
import RaceDetailDialog from "@/components/calendar/RaceDetailDialog";
import CountryFlag from "@/components/common/CountryFlag";

interface HeaderSectionProps {
  nextRace: any;
  isOffline: boolean;
}

const HeaderSection = ({ nextRace, isOffline }: HeaderSectionProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  
  useEffect(() => {
    if (!nextRace) return;
    
    const calculateTimeLeft = () => {
      const raceDate = new Date(nextRace.date + "T" + (nextRace.time || "00:00:00Z"));
      const now = new Date();
      const difference = raceDate.getTime() - now.getTime();
      
      if (difference <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }
      
      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / (1000 * 60)) % 60),
        seconds: Math.floor((difference / 1000) % 60)
      };
    };
    
    setCountdown(calculateTimeLeft());
    const timer = setInterval(() => {
      setCountdown(calculateTimeLeft());
    }, 1000);
    
    return () => clearInterval(timer);
  }, [nextRace]);
  
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
    <header className="mb-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between">
        <div>
          <h1 className="md:text-4xl tracking-tight flex items-center gap-2 text-2xl font-normal">
            Formula 1 Season {new Date().getFullYear()}
          </h1>
          <div className="flex items-center mt-1">
            <p className="text-muted-foreground">Live race data, standings and schedule</p>
            <a 
              href="https://www.producthunt.com/posts/f1-datastop?embed=true&utm_source=badge-featured&utm_medium=badge&utm_souce=badge-f1&#0045;datastop" 
              target="_blank" 
              rel="noopener noreferrer"
              className="ml-3"
            >
              <img 
                src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=950747&theme=light&t=1744238501973" 
                alt="F1 DataStop on Product Hunt" 
                style={{ width: "120px", height: "26px" }} 
                width="120" 
                height="26" 
              />
            </a>
          </div>
        </div>
        {nextRace && 
          <div 
            className="mt-4 md:mt-0 bg-card rounded-lg px-3 md:px-4 py-2 flex items-center gap-2 border border-border hover:shadow-md md:hover:scale-102 hover:bg-card/90 cursor-pointer transition-all duration-300 transform hover:border-primary text-sm md:text-base"
            onClick={openRaceDetails}
          >
            <CountryFlag country={nextRace.Circuit.Location.country} size={24} svg={true} />
            <div>
              <div className="flex items-center gap-1 md:gap-2">
                <Badge className="bg-primary text-primary-foreground border-0 text-xs">NEXT RACE</Badge>
                <span className="font-medium text-foreground truncate max-w-[150px] md:max-w-full">{removeFlag(nextRace.raceName)}</span>
              </div>
              <div className="text-xs md:text-sm text-muted-foreground flex gap-1 md:gap-2">
                <span><span className="font-semibold">{countdown.days}</span><span className="font-normal">d</span></span>
                <span><span className="font-semibold">{countdown.hours}</span><span className="font-normal">h</span></span>
                <span><span className="font-semibold">{countdown.minutes}</span><span className="font-normal">m</span></span>
                <span><span className="font-semibold">{countdown.seconds}</span><span className="font-normal">s</span></span>
              </div>
            </div>
          </div>
        }
      </div>
      
      <PageSelector />
      
      {isOffline && <Alert className="mt-6 bg-yellow-900/20 border-yellow-600 text-yellow-200">
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
