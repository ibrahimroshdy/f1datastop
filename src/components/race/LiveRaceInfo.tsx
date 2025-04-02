
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/context/SessionContext";
import { useNextRace, useRaceStatus, useWeatherData } from "@/hooks/useF1Data";
import { Loader2 } from "lucide-react";
import { getCountryFlag, getRaceNameWithoutEmoji } from "@/utils/countryUtils";

const LiveRaceInfo = () => {
  const { activeSessionId } = useSession();
  const { data: nextRaceData, isLoading: isNextRaceLoading } = useNextRace();
  const { data: raceStatusData, isLoading: isRaceStatusLoading } = useRaceStatus(activeSessionId);
  const { data: weatherData, isLoading: isWeatherLoading } = useWeatherData(activeSessionId);
  
  const isLoading = isNextRaceLoading || isRaceStatusLoading || isWeatherLoading;
  
  if (isLoading) {
    return (
      <Card className="race-card">
        <CardContent className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-f1-red" />
        </CardContent>
      </Card>
    );
  }
  
  const nextRace = nextRaceData?.data || null;
  const raceStatus = raceStatusData?.data?.[0] || null;
  const weather = weatherData?.data?.[0] || null;
  
  let flag = "🏁";
  let raceName = "Upcoming Race";
  let trackName = "Circuit";
  
  if (nextRace) {
    // Get country from location data
    const location = nextRace.Circuit?.Location?.locality || "";
    const country = nextRace.Circuit?.Location?.country || "";
    flag = getCountryFlag(country || location);
    raceName = getRaceNameWithoutEmoji(nextRace.raceName || nextRace.meeting_name || "");
    trackName = nextRace.Circuit?.circuitName || nextRace.location || "Circuit";
  }
  
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
              {nextRace?.session_status === "Ongoing" ? (
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
