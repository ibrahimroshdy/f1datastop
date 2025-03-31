import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/context/SessionContext";
import { useNextRace, useRaceStatus, useWeatherData } from "@/hooks/useF1Data";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

const LiveRaceInfo = () => {
  const { activeSessionId } = useSession();
  const { data: nextRaceData, isLoading: isNextRaceLoading } = useNextRace();
  const { data: raceStatusData, isLoading: isRaceStatusLoading } = useRaceStatus(activeSessionId);
  const { data: weatherData, isLoading: isWeatherLoading } = useWeatherData(activeSessionId);
  
  const isLoading = isNextRaceLoading || isRaceStatusLoading || isWeatherLoading;
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);
  
  if (isLoading) {
    return (
      <Card className="race-card">
        <CardContent className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-f1-red" />
        </CardContent>
      </Card>
    );
  }
  
  const nextRace = nextRaceData?.data?.[0] || null;
  const raceStatus = raceStatusData?.data?.[0] || null;
  const weather = weatherData?.data?.[0] || null;
  
  const isLive = nextRace?.session_status === "Ongoing";
  
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
      "Yas Marina": "🇦🇪",
    };
    
    if (!location) return "🏁";
    
    for (const [key, value] of Object.entries(countryFlags)) {
      if (location.includes(key)) {
        return value;
      }
    }
    return "🏁"; // Default racing flag
  };
  
  const flag = getCountryFlag(nextRace?.location || "");
  const raceName = nextRace?.meeting_name || "No Live Race";
  const trackName = nextRace?.location || "Circuit";
  const currentLap = raceStatus?.lap_number || "?";
  const totalLaps = nextRace?.total_laps || "?";
  const airTemp = weather?.air_temperature ? `${Math.round(weather.air_temperature)}°C` : "?°C";
  const trackTemp = weather?.track_temperature ? `${Math.round(weather.track_temperature)}°C` : "?°C";
  const humidity = weather?.humidity ? `${Math.round(weather.humidity)}%` : "?%";
  
  return (
    <Card className="race-card">
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{flag}</span>
              <h2 className="text-xl font-bold">{raceName}</h2>
              {isLive ? (
                <Badge variant="outline" className="bg-f1-red text-white border-0">LIVE</Badge>
              ) : (
                <Badge variant="outline" className="bg-blue-600 text-white border-0">UPCOMING</Badge>
              )}
            </div>
            <p className="text-sm text-gray-400">{trackName}</p>
          </div>
          
          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-gray-400">Lap</p>
              <p className="font-medium text-lg">{currentLap}/{totalLaps}</p>
            </div>
            <div>
              <p className="text-gray-400">Weather</p>
              <p className="font-medium text-lg">{airTemp}</p>
            </div>
            <div>
              <p className="text-gray-400">Track</p>
              <p className="font-medium text-lg">{trackTemp}</p>
            </div>
            <div>
              <p className="text-gray-400">Humidity</p>
              <p className="font-medium text-lg">{humidity}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LiveRaceInfo;
