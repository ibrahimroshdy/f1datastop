
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useSession } from "@/context/SessionContext";
import { useNextRace, useRaceStatus, useDriverInfo, useWeatherData } from "@/hooks/useF1Data";
import { Loader2 } from "lucide-react";

const SessionStatus = () => {
  const { activeSessionId } = useSession();
  const { data: nextRaceData, isLoading: isNextRaceLoading } = useNextRace();
  const { data: raceStatusData, isLoading: isRaceStatusLoading } = useRaceStatus(activeSessionId);
  const { data: driverInfoData, isLoading: isDriverInfoLoading } = useDriverInfo(activeSessionId);
  const { data: weatherData, isLoading: isWeatherLoading } = useWeatherData(activeSessionId);
  
  const isLoading = isNextRaceLoading || isRaceStatusLoading || isDriverInfoLoading || isWeatherLoading;
  
  const getTeamColor = (teamName: string) => {
    const teamColors: Record<string, string> = {
      "Red Bull Racing": "bg-redbull",
      "Ferrari": "bg-ferrari",
      "Mercedes": "bg-mercedes",
      "McLaren": "bg-mclaren",
      "Aston Martin": "bg-aston-martin",
      "Alpine": "bg-alpine",
      "Racing Bulls": "bg-alphatauri",
      "Haas F1 Team": "bg-haas",
      "Williams": "bg-williams",
      "Kick Sauber": "bg-alfa-romeo",
    };
    return teamColors[teamName] || "bg-gray-600";
  };

  if (isLoading) {
    return (
      <Card className="race-card h-full">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">Current Session</CardTitle>
            <Badge variant="outline" className="bg-gray-600 text-white border-0">LOADING</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-f1-red" />
        </CardContent>
      </Card>
    );
  }

  const nextRace = nextRaceData?.data?.[0] || null;
  const raceStatus = raceStatusData?.data?.[0] || null;
  const drivers = driverInfoData?.data || [];
  const weather = weatherData?.data?.[0] || null;
  
  // Get top 3 drivers sorted by position
  const topDrivers = [...drivers]
    .sort((a, b) => (a.position || 999) - (b.position || 999))
    .slice(0, 3);

  // Fallback values if API data is missing
  const sessionName = nextRace?.session_name || "Unknown Session";
  const trackName = nextRace?.location || "Unknown Track";
  const sessionType = nextRace?.session_type || "Unknown";
  const currentLap = raceStatus?.lap_number || "?";
  const totalLaps = nextRace?.total_laps || "?";
  const temperature = weather?.air_temperature ? `${Math.round(weather.air_temperature)}°C` : "?°C";
  const weatherCondition = weather?.condition || "Unknown";

  return (
    <Card className="race-card h-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">Current Session</CardTitle>
          {nextRace?.session_status === "Ongoing" ? (
            <Badge variant="outline" className="bg-f1-red text-white border-0">LIVE</Badge>
          ) : (
            <Badge variant="outline" className="bg-blue-600 text-white border-0">UPCOMING</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="text-lg font-bold">{nextRace?.meeting_name || "Next Race"}</h3>
          <p className="text-sm text-gray-400">{trackName}</p>
        </div>
        
        <div className="flex justify-between text-sm">
          <div>
            <p className="text-gray-400">Session</p>
            <p className="font-medium">{sessionType}</p>
          </div>
          <div>
            <p className="text-gray-400">Lap</p>
            <p className="font-medium">{currentLap}/{totalLaps}</p>
          </div>
          <div>
            <p className="text-gray-400">Weather</p>
            <p className="font-medium">{weatherCondition}, {temperature}</p>
          </div>
        </div>
        
        <Separator className="bg-gray-800" />
        
        <div>
          <div className="flex justify-between mb-2">
            <p className="text-sm font-medium">Race Leaders</p>
            <p className="text-sm font-medium">Gap</p>
          </div>
          <div className="space-y-2">
            {topDrivers.length > 0 ? (
              topDrivers.map((driver, index) => (
                <div key={driver.driver_number} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-6 ${getTeamColor(driver.team_name)} rounded-sm`}></div>
                    <p className={index === 0 ? "font-medium" : ""}>{driver.full_name}</p>
                  </div>
                  <p className="text-sm">{index === 0 ? "-" : `+${driver.gap_to_leader || "?.?"}s`}</p>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-400 py-2">No driver data available</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SessionStatus;
