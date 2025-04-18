import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Timer } from "lucide-react";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { useLastRaceResults } from "@/hooks/useF1Data";

interface FastestPitStopCardProps {
  pitStopData: any;
  isLoading: boolean;
  getTeamColor?: (teamId: string) => string;
}

interface FastestStop {
  driver: {
    code: string;
    name: string;
    team: string;
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

function getDriverFastestPitStop(raceData: any, pitStopData: any): FastestStop[] {
  // Extract pit stops data from the correct structure
  // First try the standard structure
  let pitStops = pitStopData?.data?.Races?.[0]?.PitStops;
  
  // If not found, try the MRData structure
  if (!pitStops && pitStopData?.MRData?.RaceTable?.Races?.[0]?.PitStops) {
    pitStops = pitStopData.MRData.RaceTable.Races[0].PitStops;
  }
  
  // If not found, try another common structure where MRData might be nested under data
  if (!pitStops && pitStopData?.data?.MRData?.RaceTable?.Races?.[0]?.PitStops) {
    pitStops = pitStopData.data.MRData.RaceTable.Races[0].PitStops;
  }
  
  // Check if we have the pit stops data
  if (!pitStops || !pitStops.length) {
    console.log("No pit stop data available");
    return [];
  }

  // Create a map to store driver information from race results
  const driverInfo = new Map();
  
  // Try to get driver info from race results if available
  if (raceData?.data?.Results) {
    raceData.data.Results.forEach((result: any) => {
      driverInfo.set(result.Driver.driverId, {
        code: result.Driver.code,
        name: `${result.Driver.givenName} ${result.Driver.familyName}`,
        team: result.Constructor?.constructorId || "unknown"
      });
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
        team
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

const FastestPitStopCard = ({ pitStopData, isLoading }: FastestPitStopCardProps) => {
  const [fastestPitStops, setFastestPitStops] = useState<FastestStop[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // We still need race results for driver information
  const lastRaceResult = useLastRaceResults();

  useEffect(() => {
    if (pitStopData) {
      try {
        const pitStops = getDriverFastestPitStop(lastRaceResult.data, pitStopData);
        
        if (pitStops.length > 0) {
          setFastestPitStops(pitStops);
          setError(null);
        } else {
          // Check if we have pit stop data directly before setting error
          const hasPitStops = 
            !!pitStopData?.data?.Races?.[0]?.PitStops ||
            !!pitStopData?.MRData?.RaceTable?.Races?.[0]?.PitStops ||
            !!pitStopData?.data?.MRData?.RaceTable?.Races?.[0]?.PitStops;

          if (!hasPitStops) {
            setError("No pit stop data available");
          } else {
            setError("Error processing pit stop data");
          }
        }
      } catch (err) {
        console.error("Error processing pit stop data:", err);
        setError("Error processing pit stop data");
      }
    } else if (!isLoading) {
      setError("No pit stop data available");
    }
  }, [pitStopData, lastRaceResult.data, isLoading]);

  // Combined loading state from both the prop and the race results query
  const combinedLoading = isLoading || lastRaceResult.isLoading;

  return (
    <Card className="h-full overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Timer className="h-5 w-5 text-primary" />
          Fastest Pit Stops
        </CardTitle>
        <CardDescription>
          Top 5 fastest pit stops from the last race
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2">
        {combinedLoading ? (
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
                      {stop.driver.team.replace('_', ' ')}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-medium">{stop.duration.toFixed(3)}s</div>
                  <Badge variant="outline" className="text-xs">
                    Lap {stop.lap}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FastestPitStopCard; 