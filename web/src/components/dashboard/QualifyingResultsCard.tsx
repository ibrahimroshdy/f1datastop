import { useEffect, useState } from "react";
import { F1Card, F1CardContent, F1CardHeader } from "@/components/f1";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Flag, Clock } from "lucide-react";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { useLastRaceResults, useRaceSchedule } from "@/hooks/useF1Data";
import { getRaceQualifying } from "@/services/f1Service";
import ReactCountryFlag from "react-country-flag";
import { getCountryCode } from "@/components/common/CountryFlag";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import RaceDetailDialog from "@/components/calendar/RaceDetailDialog";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { F1EmptyState } from "@/components/f1/F1EmptyState";

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

// Helper to get team hex color
const getTeamHexColor = (teamId: string): string => {
  let normalizedTeamId = teamId.toLowerCase();
  if (normalizedTeamId === "alphatauri") normalizedTeamId = "rb";
  else if (normalizedTeamId === "alfa") normalizedTeamId = "sauber";
  return TEAM_COLORS[normalizedTeamId] || "#666666";
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
  const { isGlass } = useTheme();
  const surfaceVariant = isGlass ? ("glass" as const) : ("default" as const);
  const surfaceGlass = isGlass ? ("panel" as const) : ("default" as const);
  
  const lastRaceResult = useLastRaceResults();
  const { data: raceScheduleData } = useRaceSchedule();

  useEffect(() => {
    const fetchQualifyingData = async (targetRace: any, fallbackToOlder: boolean = false) => {
      setIsLoading(true);
      setError(null);
      setIsPendingData(false);
      
      try {
        if (!targetRace) throw new Error("Race data not available");
        
        setCircuitName(getRaceNameWithoutEmoji(targetRace.raceName) || "");
        const country = targetRace.Circuit?.Location?.country || "";
        setCountryName(country);
        setCountryCode(getCountryCode(country) || "");
        setLastRace(targetRace);
        
        const year = parseInt(targetRace.season);
        const round = targetRace.round;
        const qualifyingData = await getRaceQualifying(year, round);
        
        if (!qualifyingData?.data?.QualifyingResults?.length) {
          if (fallbackToOlder) throw new Error("No qualifying data available for any recent races");
          
          const now = new Date();
          const qualifyingDate = new Date(targetRace.qualifyingDate);
          const hoursSinceQuali = (now.getTime() - qualifyingDate.getTime()) / (1000 * 60 * 60);
          
          if (hoursSinceQuali < 3 && retryCount < 3) {
            setRetryCount(prev => prev + 1);
            setIsPendingData(true);
            setError("Qualifying data is not yet available, results will appear soon");
            setIsLoading(false);
            setTimeout(() => fetchQualifyingData(targetRace, false), 60000);
            return;
          }
          
          throw new Error("Recent qualifying data not available yet");
        }
        
        setRetryCount(0);
        
        const processedResults = qualifyingData.data.QualifyingResults.map((result: any) => {
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
        
        const topFive = processedResults
          .sort((a: QualifyingResult, b: QualifyingResult) => a.position - b.position)
          .slice(0, 5);
        
        setQualifyingResults(topFive);
        setIsLoading(false);
      } catch (error: any) {
        if (!fallbackToOlder && (raceScheduleData?.data?.length ?? 0) > 0) {
          const races = raceScheduleData!.data;
          const now = new Date();
          
          const racesWithQualifyingStatus = races.map((race: any) => {
            const raceDate = new Date(race.date);
            const qualifyingDate = new Date(raceDate);
            qualifyingDate.setDate(raceDate.getDate() - 1);
            return { ...race, qualifyingDate, hasQualifyingOccurred: qualifyingDate < now };
          });
          
          const racesWithCompletedQualifying = racesWithQualifyingStatus.filter(
            (race: any) => race.hasQualifyingOccurred
          );
          
          if (racesWithCompletedQualifying.length > 1) {
            const previousQualifying = racesWithCompletedQualifying[racesWithCompletedQualifying.length - 2];
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
      
      const racesWithQualifyingStatus = races.map((race: any) => {
        const raceDate = new Date(race.date);
        const qualifyingDate = new Date(raceDate);
        qualifyingDate.setDate(raceDate.getDate() - 1);
        return { ...race, qualifyingDate, hasQualifyingOccurred: qualifyingDate < now };
      });
      
      const racesWithCompletedQualifying = racesWithQualifyingStatus.filter(
        (race: any) => race.hasQualifyingOccurred
      );
      
      if (racesWithCompletedQualifying.length === 0) {
        // Season hasn't started yet - show empty state instead of error
        setError(null);
        setIsLoading(false);
      } else {
        const lastQualifyingRace = racesWithCompletedQualifying[racesWithCompletedQualifying.length - 1];
        fetchQualifyingData(lastQualifyingRace);
      }
    }
  }, [lastRaceResult.data, raceScheduleData]);

  // Get fastest qualifying time
  const fastestDriver = qualifyingResults.length > 0 
    ? qualifyingResults.reduce((fastest, current) => {
        if (!fastest) return current;
        if (current.bestTime === "No time") return fastest;
        if (fastest.bestTime === "No time") return current;
        return current.bestTime < fastest.bestTime ? current : fastest;
      }, null as QualifyingResult | null)
    : null;
  
  return (
    <>
      <F1Card
        variant={surfaceVariant}
        glassVariant={surfaceGlass}
        className={cn("h-full min-h-[280px] overflow-hidden p-0", isGlass && "border-white/10")}
      >
        <F1CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-primary shrink-0" />
              <h3 className="font-semibold text-sm">Last Qualifying</h3>
            </div>
            
            {/* GP Badge - Top Right */}
            {!isLoading && !error && circuitName && (
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
                <span>{circuitName}</span>
              </button>
            )}
          </div>
          
          {/* Fastest Time Highlight */}
          {!isLoading && !error && fastestDriver && (
            <div className="mt-2 flex items-center justify-center">
              <div className="border border-dashed border-purple-500/50 dark:border-purple-400/50 px-2 py-0.5 rounded inline-flex items-center gap-1.5 text-[10px]">
                <span className="text-purple-600 dark:text-purple-400 font-medium">Pole:</span>
                        <span 
                          className="font-mono font-bold" 
                  style={{ color: getTeamHexColor(fastestDriver.team) }}
                        >
                          {fastestDriver.driver.code}
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span className="font-mono">{fastestDriver.bestTime}</span>
                      </div>
            </div>
          )}
        </F1CardHeader>
        
        <F1CardContent className="px-2">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : error ? (
            <Alert variant={isPendingData ? "default" : "destructive"}>
              {isPendingData ? 
                <Clock className="h-4 w-4 animate-pulse" /> : 
                <AlertTriangle className="h-4 w-4" />
              }
              <AlertTitle>{isPendingData ? "Processing" : "Error"}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : qualifyingResults.length === 0 && !error ? (
            <F1EmptyState 
              type="season-start"
              title="Qualifying Starting Soon"
              description="Qualifying results will appear here once the first session is completed."
              size="sm"
            />
          ) : (
            <div className="space-y-3 max-w-3xl mx-auto">
              {qualifyingResults.map((result) => {
                const teamColor = getTeamHexColor(result.team);
                
                return (
                <div
                  key={result.position}
                  className="flex items-center justify-between p-2 bg-card rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-xl font-bold">{result.position}</div>
                      <div style={{ borderLeft: `3px solid ${teamColor}`, paddingLeft: '0.5rem' }}>
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
                );
              })}
              
            </div>
          )}
        </F1CardContent>
      </F1Card>
      
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

export default QualifyingResultsCard; 
