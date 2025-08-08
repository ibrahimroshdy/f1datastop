import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Flag, Clock } from "lucide-react";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { useLastRaceResults, useRaceSchedule } from "@/hooks/useF1Data";
import { getRaceQualifying } from "@/services/f1Service";
import ReactCountryFlag from "react-country-flag";
import { getCountryCode } from "@/components/common/CountryFlag";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import RaceDetailDialog from "@/components/calendar/RaceDetailDialog";

interface QualifyingResult {
  position: number;
  driver: {
    code: string;
    name: string;
  };
  team: string;
  bestTime: string;
  session: string;
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

const QualifyingResultsCard = () => {
  const [qualifyingResults, setQualifyingResults] = useState<QualifyingResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [circuitName, setCircuitName] = useState<string>("");
  const [countryName, setCountryName] = useState<string>("");
  const [countryCode, setCountryCode] = useState<string>("");
  const [lastRace, setLastRace] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPendingData, setIsPendingData] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  // Get last race results to identify the last race round and year
  const lastRaceResult = useLastRaceResults();
  const { data: raceScheduleData } = useRaceSchedule();

  useEffect(() => {
    const fetchQualifyingData = async (targetRace: any, fallbackToOlder: boolean = false) => {
      setIsLoading(true);
      setError(null);
      setIsPendingData(false);
      
      try {
        if (!targetRace) {
          throw new Error("Race data not available");
        }
        
        console.log(`Fetching qualifying data for ${targetRace.season} Round ${targetRace.round} - ${targetRace.raceName}`);
        
        // Set circuit name and country
        setCircuitName(getRaceNameWithoutEmoji(targetRace.raceName) || "");
        const country = targetRace.Circuit?.Location?.country || "";
        setCountryName(country);
        setCountryCode(getCountryCode(country) || "");
        setLastRace(targetRace);
        
        // Fetch qualifying data
        const year = parseInt(targetRace.season);
        const round = targetRace.round;
        
        const qualifyingData = await getRaceQualifying(year, round);
        
        if (!qualifyingData?.data?.QualifyingResults || qualifyingData.data.QualifyingResults.length === 0) {
          if (fallbackToOlder) {
            throw new Error("No qualifying data available for any recent races");
          }
          
          // Check if this is the most recent race with qualifying expected to be completed
          const now = new Date();
          const qualifyingDate = new Date(targetRace.qualifyingDate);
          const timeSinceQuali = now.getTime() - qualifyingDate.getTime();
          const hoursSinceQuali = timeSinceQuali / (1000 * 60 * 60);
          
          // If qualifying was very recent (within 3 hours), data might still be uploading
          if (hoursSinceQuali < 3 && retryCount < 3) {
            setRetryCount(prev => prev + 1);
            setIsPendingData(true);
            setError("Qualifying data is not yet available, results will appear soon");
            setIsLoading(false);
            
            // Retry after 1 minute
            setTimeout(() => {
              fetchQualifyingData(targetRace, false);
            }, 60000);
            return;
          }
          
          // If we've retried or it's been longer, try previous race with qualifying
          throw new Error("Recent qualifying data not available yet");
        }
        
        // Reset retry count on success
        setRetryCount(0);
        
        // Process qualifying data
        const processedResults = qualifyingData.data.QualifyingResults.map((result: any) => {
          // Determine best time (Q3 > Q2 > Q1)
          const bestTime = result.Q3 || result.Q2 || result.Q1 || "No time";
          let session = "Q1";
          if (result.Q3) session = "Q3";
          else if (result.Q2) session = "Q2";
          
          return {
            position: parseInt(result.position),
            driver: {
              code: result.Driver.code || result.Driver.familyName.substring(0, 3).toUpperCase(),
              name: `${result.Driver.givenName} ${result.Driver.familyName}`
            },
            team: result.Constructor.constructorId,
            bestTime,
            session
          };
        });
        
        // Sort by position and take top 5
        const topFive = processedResults
          .sort((a: QualifyingResult, b: QualifyingResult) => a.position - b.position)
          .slice(0, 5);
        
        setQualifyingResults(topFive);
        setIsLoading(false);
      } catch (error: any) {
        console.error("Error fetching qualifying data:", error);
        
        // If this is the first try and we failed, attempt to get previous qualifying
        if (!fallbackToOlder && raceScheduleData?.data && raceScheduleData.data.length > 0) {
          const races = raceScheduleData.data;
          const now = new Date();
          
          // Find races with completed qualifying
          const racesWithQualifyingStatus = races.map((race: any) => {
            const raceDate = new Date(race.date);
            const qualifyingDate = new Date(raceDate);
            qualifyingDate.setDate(raceDate.getDate() - 1);
            
            return {
              ...race,
              qualifyingDate,
              hasQualifyingOccurred: qualifyingDate < now
            };
          });
          
          const racesWithCompletedQualifying = racesWithQualifyingStatus.filter(
            (race: any) => race.hasQualifyingOccurred
          );
          
          // Try the second most recent race if available
          if (racesWithCompletedQualifying.length > 1) {
            const previousQualifying = racesWithCompletedQualifying[racesWithCompletedQualifying.length - 2];
            console.log("Falling back to previous qualifying:", previousQualifying.raceName);
            fetchQualifyingData(previousQualifying, true);
            return;
          }
        }
        
        setError(error.message || "Failed to load qualifying data");
        setIsLoading(false);
      }
    };
    
    if (raceScheduleData?.data) {
      const races = raceScheduleData.data;
      const now = new Date();
      
      // Process races to determine if qualifying has occurred
      const racesWithQualifyingStatus = races.map((race: any) => {
        const raceDate = new Date(race.date);
        // Estimate qualifying date as 1 day before race
        const qualifyingDate = new Date(raceDate);
        qualifyingDate.setDate(raceDate.getDate() - 1);
        
        return {
          ...race,
          qualifyingDate,
          hasQualifyingOccurred: qualifyingDate < now
        };
      });
      
      // Filter races where qualifying has already occurred
      const racesWithCompletedQualifying = racesWithQualifyingStatus.filter(
        (race: any) => race.hasQualifyingOccurred
      );
      
      if (racesWithCompletedQualifying.length === 0) {
        setError("No completed qualifying sessions found");
        setIsLoading(false);
      } else {
        // Get the most recent qualifying
        const lastQualifyingRace = racesWithCompletedQualifying[racesWithCompletedQualifying.length - 1];
        fetchQualifyingData(lastQualifyingRace);
      }
    }
  }, [lastRaceResult.data, raceScheduleData]);

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
  
  return (
    <>
      <Card className="bg-card border-border h-full overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-primary" />
            Last Qualifying Results
          </CardTitle>
          <CardDescription>
            Top 5 qualifying results from the most recent race
          </CardDescription>
          
          {/* Fastest Qualifying Time */}
          {!isLoading && !error && qualifyingResults.length > 0 && (
            <div className="mt-2 flex items-center justify-center">
              {(() => {
                // Find driver with fastest qualifying time
                const fastestDriver = qualifyingResults.reduce((fastest, current) => {
                  if (!fastest) return current;
                  
                  // Compare times, handling "No time" case
                  if (current.bestTime === "No time") return fastest;
                  if (fastest.bestTime === "No time") return current;
                  
                  // Compare time strings
                  return current.bestTime < fastest.bestTime ? current : fastest;
                }, null as QualifyingResult | null);
                
                if (fastestDriver) {
                  // Get team color
                  let teamId = fastestDriver.team.toLowerCase();
                  // Handle specific mappings
                  if (teamId === "alphatauri") teamId = "rb";
                  else if (teamId === "alfa") teamId = "sauber";
                  
                  // Get color from TEAM_COLORS
                  const teamColor = TEAM_COLORS[teamId] || "#666666";
                  
                  return (
                    <div className="border border-dashed border-purple-500/50 dark:border-purple-400/50 px-2 py-1 rounded-md inline-flex items-center gap-2 text-xs">
                      <span className="text-purple-600 dark:text-purple-400 font-medium">Fastest Time:</span>
                      <div className="flex items-center gap-1">
                        <span 
                          className="font-mono font-bold" 
                          style={{ color: teamColor }}
                        >
                          {fastestDriver.driver.code}
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span>{fastestDriver.session}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="font-mono">{fastestDriver.bestTime}</span>
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
          ) : error ? (
            <Alert variant={isPendingData ? "default" : "destructive"} className={isPendingData ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800" : ""}>
              {isPendingData ? 
                <Clock className="h-4 w-4 animate-pulse" /> : 
                <AlertTriangle className="h-4 w-4" />
              }
              <AlertTitle>{isPendingData ? "Processing" : "Error"}</AlertTitle>
              <AlertDescription>
                {error}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3 max-w-3xl mx-auto">
              {qualifyingResults.map((result) => (
                <div
                  key={result.position}
                  className="flex items-center justify-between p-2 bg-card rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-xl font-bold">{result.position}</div>
                    <div style={getTeamColorStyle(result.team)}>
                      <div className="font-semibold">{result.driver.code}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {result.team.replace("_", " ")}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-medium">{result.bestTime}</div>
                    <Badge variant="outline" className="text-xs">
                      {result.session}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!isLoading && !error && circuitName && (
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
                <span>{circuitName}</span>
              </Badge>
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

export default QualifyingResultsCard; 