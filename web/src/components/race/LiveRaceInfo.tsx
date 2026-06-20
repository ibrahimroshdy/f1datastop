import { F1Card, F1CardContent } from "@/components/f1";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/context/SessionContext";
import { useNextRace, useRaceStatus, useWeatherData } from "@/hooks/useF1Data";
import { Loader2 } from "lucide-react";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import CountryFlag from "@/components/common/CountryFlag";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

const LiveRaceInfo = () => {
  const { activeSessionId } = useSession();
  const { data: nextRaceData, isLoading: isNextRaceLoading } = useNextRace();
  const { data: raceStatusData, isLoading: isRaceStatusLoading } = useRaceStatus(activeSessionId);
  const { data: weatherData, isLoading: isWeatherLoading } = useWeatherData(activeSessionId);
  const { isGlass } = useTheme();
  const surfaceVariant = isGlass ? ("glass" as const) : ("default" as const);
  const surfaceGlass = isGlass ? ("panel" as const) : ("default" as const);
  
  const isLoading = isNextRaceLoading || isRaceStatusLoading || isWeatherLoading;
  
  if (isLoading) {
    return (
      <F1Card variant={surfaceVariant} glassVariant={surfaceGlass} className={cn("race-card p-0", isGlass && "border-white/10")}>
        <F1CardContent className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </F1CardContent>
      </F1Card>
    );
  }
  
  const nextRace = nextRaceData?.data || null;
  const raceStatus = raceStatusData?.data?.[0] || null;
  const weather = weatherData?.data?.[0] || null;
  
  let country = "";
  let raceName = "Upcoming Race";
  let trackName = "Circuit";
  
  if (nextRace) {
    const location = nextRace.Circuit?.Location?.locality || "";
    country = nextRace.Circuit?.Location?.country || location;
    raceName = getRaceNameWithoutEmoji(nextRace.raceName || nextRace.meeting_name || "");
    trackName = nextRace.Circuit?.circuitName || nextRace.location || "Circuit";
  }
  
  const currentLap = raceStatus?.lap_number || "?";
  const totalLaps = nextRace?.total_laps || "?";
  const airTemp = weather?.air_temperature ? `${Math.round(weather.air_temperature)}°C` : "?°C";
  const trackTemp = weather?.track_temperature ? `${Math.round(weather.track_temperature)}°C` : "?°C";
  const humidity = weather?.humidity ? `${Math.round(weather.humidity)}%` : "?%";
  
  return (
    <F1Card variant={surfaceVariant} glassVariant={surfaceGlass} className={cn("race-card p-0", isGlass && "border-white/10")}>
      <F1CardContent className="p-4">
        <div className="flex flex-col justify-between gap-4 md:flex-row">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CountryFlag country={country} size={24} svg={true} />
              <div>
                <h3 className="text-lg font-bold">{raceName}</h3>
                <p className="text-sm text-muted-foreground">{trackName}</p>
              </div>
              {nextRace?.session_status === "Ongoing" ? (
                <Badge variant="outline" className="border-0 bg-f1-red text-white">LIVE</Badge>
              ) : (
                <Badge variant="outline" className="border-0 bg-blue-600 text-white">UPCOMING</Badge>
              )}
            </div>
          </div>
          
          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-muted-foreground">Lap</p>
              <p className="text-lg font-medium">{currentLap}/{totalLaps}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Weather</p>
              <p className="text-lg font-medium">{airTemp}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Track</p>
              <p className="text-lg font-medium">{trackTemp}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Humidity</p>
              <p className="text-lg font-medium">{humidity}</p>
            </div>
          </div>
        </div>
      </F1CardContent>
    </F1Card>
  );
};

export default LiveRaceInfo;
