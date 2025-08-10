import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Timer } from "lucide-react";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { useLastRaceResults, useLastRacePitStops, useRaceSchedule } from "@/hooks/useF1Data";
import ReactCountryFlag from "react-country-flag";
import { getCountryCode } from "@/components/common/CountryFlag";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import RaceDetailDialog from "@/components/calendar/RaceDetailDialog";

// Helper function to format pit stop duration into MM:ss.sss format
const formatPitStopDuration = (durationInSeconds: number): string => {
  const minutes = Math.floor(durationInSeconds / 60);
  const seconds = durationInSeconds % 60;
  
  if (minutes > 0) {
    return `${minutes}:${seconds.toFixed(3).padStart(6, '0')}`;
  } else {
    return `${seconds.toFixed(3)}`;
  }
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

// Helper function to normalize team IDs and get the correct color
const getTeamColorStyle = (teamId: string) => {
  // Normalize the team ID to match the keys in TEAM_COLORS
  let normalizedTeamId = teamId.toLowerCase();
  
  // Handle specific mappings
  if (normalizedTeamId === "alphatauri") {
    normalizedTeamId = "rb";
  } else if (normalizedTeamId === "alfa") {
    normalizedTeamId = "sauber";
  }
  
  // Get color from TEAM_COLORS or default to a gray color
  const color = TEAM_COLORS[normalizedTeamId] || "#666666";
  
  return {
    borderLeft: `3px solid ${color}`,
    paddingLeft: "0.5rem"
  };
};

// Map driver IDs to team IDs for fallback mechanism
const DRIVER_TEAM_MAPPING: Record<string, string> = {
  // Red Bull
  "max_verstappen": "red_bull",
  "perez": "red_bull",
  // Ferrari
  "leclerc": "ferrari",
  "sainz": "ferrari",
  "bearman": "ferrari",
  // Mercedes
  "hamilton": "mercedes",
  "russell": "mercedes",
  "antonelli": "mercedes",
  // McLaren
  "norris": "mclaren",
  "piastri": "mclaren",
  // Aston Martin
  "alonso": "aston_martin",
  "stroll": "aston_martin",
  // Alpine
  "gasly": "alpine",
  "ocon": "alpine",
  "doohan": "alpine",
  // Williams
  "albon": "williams",
  "sargeant": "williams",
  // Racing Bulls
  "tsunoda": "rb",
  "lawson": "rb",
  "ricciardo": "rb",
  // Sauber
  "bottas": "sauber",
  "zhou": "sauber",
  "bortoleto": "sauber",
  // Haas
  "hulkenberg": "haas",
  "magnussen": "haas",
  "hadjar": "haas"
};

function processDriverFastestPitStops(raceData: any, pitStopData: any): FastestStop[] {
  // Extract pit stops data from the correct structure
  // Try multiple possible data structures
  
  // 1. Try direct MRData structure (from API response)
  let pitStops = pitStopData?.MRData?.RaceTable?.Races?.[0]?.PitStops;
  
  // 2. Try nested under data.MRData structure
  if (!pitStops || !pitStops.length) {
    pitStops = pitStopData?.data?.MRData?.RaceTable?.Races?.[0]?.PitStops;
  }
  
  // 3. Try old structure with data.Races
  if (!pitStops || !pitStops.length) {
    pitStops = pitStopData?.data?.Races?.[0]?.PitStops;
  }
  
  // Log the pit stop data structure for debugging
  console.log("Pit stop data structure:", JSON.stringify(pitStopData, null, 2).substring(0, 500) + "...");
  
  // Check if we have the pit stops data
  if (!pitStops || !pitStops.length) {
    console.log("No pit stop data available");
    return [];
  }

  // Create a map to store driver information from race results
  const driverInfo = new Map();
  const constructorNames = new Map();
  
  // Try to get driver info from race results if available
  if (raceData?.data?.results) {
    raceData.data.results.forEach((result: any) => {
      driverInfo.set(result.Driver.driverId, {
        code: result.Driver.code,
        name: `${result.Driver.givenName} ${result.Driver.familyName}`,
        team: result.Constructor.constructorId,
        constructor: result.Constructor.name
      });
      constructorNames.set(result.Constructor.constructorId, result.Constructor.name);
    });
  }

  // Create a map to store the fastest pit stop for each driver
  const fastestPitStops = new Map<string, FastestStop>();

  // Process each pit stop
  pitStops.forEach((stop: any) => {
    const driverId = stop.driverId;
    let driver = driverInfo.get(driverId);
    
    // If driver info is not available from race results, create fallback driver info
    if (!driver) {
      // Use driverId as the code, with basic formatting
      const code = driverId.toUpperCase().substring(0, 3);
      
      // Use team mapping or default to unknown
      const team = DRIVER_TEAM_MAPPING[driverId] || "default";
      
      driver = {
        code,
        name: driverId.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
        team,
        constructor: team.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
      };
    }
    
    const duration = parseFloat(stop.duration);
    
    // If we haven't seen this driver yet, or if this stop is faster than the previous fastest
    if (!fastestPitStops.has(driverId) || duration < fastestPitStops.get(driverId)!.duration) {
      fastestPitStops.set(driverId, {
        driver,
        lap: parseInt(stop.lap),
        time: stop.time,
        duration
      });
    }
  });

  // Convert to array and sort by duration (fastest first)
  return Array.from(fastestPitStops.values())
    .sort((a, b) => a.duration - b.duration)
    .slice(0, 5); // Get top 5
}

const FastestPitStopCard = () => {
  const [fastestPitStops, setFastestPitStops] = useState<FastestStop[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [raceName, setRaceName] = useState<string>("");
  const [countryName, setCountryName] = useState<string>("");
  const [countryCode, setCountryCode] = useState<string>("");
  const [lastRace, setLastRace] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Get race results and pit stops from the hooks
  const lastRaceResult = useLastRaceResults();
  const lastRacePitStops = useLastRacePitStops();
  const { data: raceScheduleData } = useRaceSchedule();

  useEffect(() => {
    if (lastRaceResult.data && lastRacePitStops.data) {
      try {
        const pitStops = processDriverFastestPitStops(lastRaceResult.data, lastRacePitStops.data);
        
        if (pitStops.length > 0) {
          setFastestPitStops(pitStops);
          setError(null);
        } else {
          setError("No pit stop data available");
        }
        
        // Find the last completed race from the schedule
        if (raceScheduleData?.data) {
          const races = raceScheduleData.data;
          const now = new Date();
          const completedRaces = races.filter((race: any) => new Date(race.date) < now);
          
          if (completedRaces.length > 0) {
            const lastRace = completedRaces[completedRaces.length - 1];
            setRaceName(getRaceNameWithoutEmoji(lastRace.raceName));
            const country = lastRace.Circuit?.Location?.country || "";
            setCountryName(country);
            setCountryCode(getCountryCode(country) || "");
            setLastRace(lastRace);
            
            console.log("FastestPitStopCard country info:", {
              raceName: lastRace.raceName,
              country,
              countryCode: getCountryCode(country)
            });
          }
        }
      } catch (err) {
        console.error("Error processing pit stop data:", err);
        setError("Error processing pit stop data");
      }
    } else if (!lastRaceResult.isLoading && !lastRacePitStops.isLoading) {
      setError("No pit stop data available");
    }
  }, [lastRaceResult.data, lastRacePitStops.data, lastRaceResult.isLoading, lastRacePitStops.isLoading, raceScheduleData]);

  // Open race details dialog
  const openRaceDetails = () => {
    if (lastRace) {
      setIsDialogOpen(true);
    }
  };

  // Close race details dialog
  const closeRaceDetails = () => {
    setIsDialogOpen(false);
  };

  // Combined loading state from both queries
  const isLoading = lastRaceResult.isLoading || lastRacePitStops.isLoading;

  return (
    <>
      <Card className="h-full overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" />
            Fastest Pit Stops
          </CardTitle>
          <CardDescription>
            Top 5 fastest individual pit stops from the last race (duration includes pit entry, exit and red flag time)
          </CardDescription>
          
          {/* Fastest Pit Stop */}
          {!isLoading && !error && fastestPitStops.length > 0 && (
            <div className="mt-2 flex items-center justify-center">
              {(() => {
                // Get the fastest pit stop (already sorted by duration, so first one is fastest)
                const fastestStop = fastestPitStops[0];
                
                if (fastestStop) {
                  // Get team color
                  let teamId = fastestStop.driver.team.toLowerCase();
                  // Handle specific mappings
                  if (teamId === "alphatauri") teamId = "rb";
                  else if (teamId === "alfa") teamId = "sauber";
                  
                  // Get color from TEAM_COLORS
                  const teamColor = TEAM_COLORS[teamId] || "#666666";
                  
                  return (
                    <div className="border border-dashed border-purple-500/50 dark:border-purple-400/50 px-2 py-1 rounded-md inline-flex items-center gap-2 text-xs">
                      <span className="text-purple-600 dark:text-purple-400 font-medium">Record Stop:</span>
                      <div className="flex items-center gap-1">
                        <span 
                          className="font-mono font-bold" 
                          style={{ color: teamColor }}
                        >
                          {fastestStop.driver.code}
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span>Lap {fastestStop.lap}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="font-mono">{formatPitStopDuration(fastestStop.duration)}</span>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          )}
        </CardHeader>
        <CardContent className="px-2">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : error && fastestPitStops.length === 0 ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {error}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {fastestPitStops.map((stop, index) => (
                <div
                  key={`${stop.driver.code}-${index}`}
                  className="flex items-center justify-between p-2 bg-card rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-xl font-bold">{index + 1}</div>
                    <div style={getTeamColorStyle(stop.driver.team)}>
                      <div className="font-semibold">{stop.driver.code}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {stop.driver.constructor}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-medium">{formatPitStopDuration(stop.duration)}</div>
                    <Badge variant="outline" className="text-xs">
                      Lap {stop.lap}
                    </Badge>
                  </div>
                </div>
              ))}
              
              {/* Race Circuit Badge */}
              {!isLoading && !error && raceName && (
                <div className="mt-4 text-center">
                  <Badge 
                    variant="secondary" 
                    className="flex items-center justify-center gap-2 mx-auto py-1 px-3 cursor-pointer hover:outline hover:outline-2 hover:outline-red-500 transition-all"
                    onClick={openRaceDetails}
                  >
                    <span className="inline-flex items-center">
                      <ReactCountryFlag
                        countryCode={countryCode || ""}
                        svg
                        style={{
                          width: "16px",
                          height: "auto",
                          display: "inline-block",
                          verticalAlign: "middle"
                        }}
                        title={countryName}
                      />
                    </span>
                    <span>{raceName}</span>
                  </Badge>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Race Detail Dialog */}
      {lastRace && (
        <RaceDetailDialog 
          isOpen={isDialogOpen} 
          onClose={closeRaceDetails} 
          race={lastRace} 
        />
      )}
    </>
  );
};

export default FastestPitStopCard; 