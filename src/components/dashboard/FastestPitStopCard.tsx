import { useEffect, useState } from "react";
import { AlertTriangle, Timer } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { useLastRaceResults, useLastRacePitStops, useRaceSchedule } from "@/hooks/useF1Data";
import ReactCountryFlag from "react-country-flag";
import { getCountryCode } from "@/components/common/CountryFlag";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import RaceDetailDialog from "@/components/calendar/RaceDetailDialog";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { F1EmptyState } from "@/components/f1/F1EmptyState";

// Helper function to format pit stop duration
const formatPitStopDuration = (durationInSeconds: number): string => {
  const minutes = Math.floor(durationInSeconds / 60);
  const seconds = durationInSeconds % 60;
  
  if (minutes > 0) {
    return `${minutes}:${seconds.toFixed(3).padStart(6, '0')}`;
  }
  return `${seconds.toFixed(3)}`;
};

interface FastestStop {
  driver: {
    code: string;
    name: string;
    team: string;
    constructor: string;
  };
  lap: number;
  time: string;
  duration: number;
}

// Helper to get team hex color
const getTeamHexColor = (teamId: string): string => {
  let normalizedTeamId = teamId.toLowerCase();
  if (normalizedTeamId === "alphatauri") normalizedTeamId = "rb";
  else if (normalizedTeamId === "alfa") normalizedTeamId = "sauber";
  return TEAM_COLORS[normalizedTeamId] || "#666666";
};

// Driver to team mapping
const DRIVER_TEAM_MAPPING: Record<string, string> = {
  "max_verstappen": "red_bull", "perez": "red_bull",
  "leclerc": "ferrari", "sainz": "ferrari", "bearman": "ferrari",
  "hamilton": "mercedes", "russell": "mercedes", "antonelli": "mercedes",
  "norris": "mclaren", "piastri": "mclaren",
  "alonso": "aston_martin", "stroll": "aston_martin",
  "gasly": "alpine", "ocon": "alpine", "doohan": "alpine",
  "albon": "williams", "sargeant": "williams",
  "tsunoda": "rb", "lawson": "rb", "ricciardo": "rb",
  "bottas": "sauber", "zhou": "sauber", "bortoleto": "sauber",
  "hulkenberg": "haas", "magnussen": "haas", "hadjar": "haas"
};

function processDriverFastestPitStops(raceData: any, pitStopData: any): FastestStop[] {
  let pitStops = pitStopData?.MRData?.RaceTable?.Races?.[0]?.PitStops;
  if (!pitStops?.length) pitStops = pitStopData?.data?.MRData?.RaceTable?.Races?.[0]?.PitStops;
  if (!pitStops?.length) pitStops = pitStopData?.data?.Races?.[0]?.PitStops;
  
  if (!pitStops?.length) return [];

  const driverInfo = new Map();
  if (raceData?.data?.results) {
    raceData.data.results.forEach((result: any) => {
      driverInfo.set(result.Driver.driverId, {
        code: result.Driver.code,
        name: `${result.Driver.givenName} ${result.Driver.familyName}`,
        team: result.Constructor.constructorId,
        constructor: result.Constructor.name
      });
    });
  }

  const fastestPitStops = new Map<string, FastestStop>();

  pitStops.forEach((stop: any) => {
    const driverId = stop.driverId;
    let driver = driverInfo.get(driverId);
    
    if (!driver) {
      const code = driverId.toUpperCase().substring(0, 3);
      const team = DRIVER_TEAM_MAPPING[driverId] || "default";
      driver = {
        code,
        name: driverId.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
        team,
        constructor: team.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
      };
    }
    
    const duration = parseFloat(stop.duration);
    
    if (!fastestPitStops.has(driverId) || duration < fastestPitStops.get(driverId)!.duration) {
      fastestPitStops.set(driverId, {
        driver,
        lap: parseInt(stop.lap),
        time: stop.time,
        duration
      });
    }
  });

  return Array.from(fastestPitStops.values())
    .sort((a, b) => a.duration - b.duration)
    .slice(0, 5);
}

const FastestPitStopCard = () => {
  const [fastestPitStops, setFastestPitStops] = useState<FastestStop[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [raceName, setRaceName] = useState<string>("");
  const [countryName, setCountryName] = useState<string>("");
  const [countryCode, setCountryCode] = useState<string>("");
  const [lastRace, setLastRace] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { isGlass } = useTheme();
  
  const lastRaceResult = useLastRaceResults();
  const lastRacePitStops = useLastRacePitStops();
  const { data: raceScheduleData } = useRaceSchedule();

  useEffect(() => {
    if (raceScheduleData?.data) {
      const races = raceScheduleData.data;
      const now = new Date();
      const completedRaces = races.filter((race: any) => new Date(race.date) < now);

      if (completedRaces.length > 0) {
        const lastRaceData = completedRaces[completedRaces.length - 1];
        setRaceName(getRaceNameWithoutEmoji(lastRaceData.raceName));
        const country = lastRaceData.Circuit?.Location?.country || "";
        setCountryName(country);
        setCountryCode(getCountryCode(country) || "");
        setLastRace(lastRaceData);
      }
    }

    if (lastRaceResult.data && lastRacePitStops.data) {
      try {
        const pitStops = processDriverFastestPitStops(lastRaceResult.data, lastRacePitStops.data);

        if (pitStops.length > 0) {
          setFastestPitStops(pitStops);
          setError(null);
        } else {
          const hasCompletedRaces = raceScheduleData?.data?.some((race: any) => new Date(race.date) < new Date());
          if (!hasCompletedRaces) {
            setError(null);
          } else {
            setError("pending");
          }
        }
      } catch (err) {
        console.error("Error processing pit stop data:", err);
        setError("Error processing pit stop data");
      }
    } else if (!lastRaceResult.isLoading && !lastRacePitStops.isLoading) {
      const hasCompletedRaces = raceScheduleData?.data?.some((race: any) => new Date(race.date) < new Date());
      if (!hasCompletedRaces) {
        setError(null);
      } else {
        setError("pending");
      }
    }
  }, [lastRaceResult.data, lastRacePitStops.data, lastRaceResult.isLoading, lastRacePitStops.isLoading, raceScheduleData]);

  const isLoading = lastRaceResult.isLoading || lastRacePitStops.isLoading;
  const fastestStop = fastestPitStops[0];

  return (
    <>
      <Card 
        className={cn(
          "h-full overflow-hidden",
          isGlass && "border-white/10"
        )}
        style={isGlass ? {
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(var(--glass-blur))',
          WebkitBackdropFilter: 'blur(var(--glass-blur))',
          boxShadow: 'var(--glass-shadow), var(--glass-inner-shadow)'
        } : undefined}
      >
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-primary shrink-0" />
              <h3 className="font-semibold text-sm">Fastest Pit Stops</h3>
            </div>
            
            {/* GP Badge - Top Right */}
            {!isLoading && (!error || error === "pending") && raceName && (
              <button
                onClick={() => setIsDialogOpen(true)}
                className="shrink-0 rounded-md border text-xs font-medium border-border bg-secondary/50 text-secondary-foreground hover:bg-secondary flex items-center gap-1.5 py-1 px-2 cursor-pointer hover:border-primary/50 transition-all"
              >
                {countryCode && (
                  <ReactCountryFlag
                    countryCode={countryCode}
                    svg
                    style={{ width: "14px", height: "auto" }}
                    title={countryName}
                  />
                )}
                <span>{raceName}</span>
              </button>
            )}
          </div>
          
          {/* Record Stop Highlight */}
          {!isLoading && !error && fastestStop && (
            <div className="mt-2 flex items-center justify-center">
              <div className="border border-dashed border-purple-500/50 dark:border-purple-400/50 px-2 py-0.5 rounded inline-flex items-center gap-1.5 text-[10px]">
                <span className="text-purple-600 dark:text-purple-400 font-medium">Record:</span>
                        <span 
                          className="font-mono font-bold" 
                  style={{ color: getTeamHexColor(fastestStop.driver.team) }}
                        >
                          {fastestStop.driver.code}
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span className="font-mono">{formatPitStopDuration(fastestStop.duration)}</span>
                      </div>
            </div>
          )}
        </CardHeader>
        
        <CardContent className="px-2">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : error && error !== "pending" && fastestPitStops.length === 0 ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : error === "pending" && fastestPitStops.length === 0 ? (
            <F1EmptyState
              type="season-start"
              title="Pit Stop Data Pending"
              description="Pit stop data for the latest race is still being processed. Check back shortly."
              size="sm"
            />
          ) : fastestPitStops.length === 0 && !error ? (
            <F1EmptyState 
              type="season-start"
              title="Pit Stop Data Coming Soon"
              description="Pit stop times will appear here once the first race is completed."
              size="sm"
            />
          ) : (
            <div className="space-y-3">
              {fastestPitStops.map((stop, index) => {
                const teamColor = getTeamHexColor(stop.driver.team);
                
                return (
                <div
                  key={`${stop.driver.code}-${index}`}
                  className="flex items-center justify-between p-2 bg-card rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-xl font-bold">{index + 1}</div>
                      <div style={{ borderLeft: `3px solid ${teamColor}`, paddingLeft: '0.5rem' }}>
                      <div className="font-semibold">{stop.driver.code}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {stop.driver.constructor}
                      </div>
                    </div>
                  </div>
                    
                  <div className="text-right">
                      <div className="font-mono font-medium">
                        {formatPitStopDuration(stop.duration)}
                      </div>
                    <Badge variant="outline" className="text-xs">
                      Lap {stop.lap}
                    </Badge>
                  </div>
                </div>
                );
              })}
              
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Race Detail Dialog */}
      {lastRace && (
        <RaceDetailDialog 
          isOpen={isDialogOpen} 
          onClose={() => setIsDialogOpen(false)} 
          race={lastRace} 
        />
      )}
    </>
  );
};

export default FastestPitStopCard; 
