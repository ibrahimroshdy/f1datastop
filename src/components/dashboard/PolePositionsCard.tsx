import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Flag } from "lucide-react";
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

const PolePositionsCard = () => {
  const [qualifyingResults, setQualifyingResults] = useState<QualifyingResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [circuitName, setCircuitName] = useState<string>("");
  const [countryName, setCountryName] = useState<string>("");
  const [countryCode, setCountryCode] = useState<string>("");
  const [lastRace, setLastRace] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Get last race results to identify the last race round and year
  const lastRaceResult = useLastRaceResults();
  const { data: raceScheduleData } = useRaceSchedule();

  useEffect(() => {
    const fetchQualifyingData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        if (!raceScheduleData?.data || !lastRaceResult.data) {
          throw new Error("Race data not available");
        }
        
        // Find the last completed race from the schedule
        const races = raceScheduleData.data;
        const now = new Date();
        const completedRaces = races.filter((race: any) => new Date(race.date) < now);
        
        if (completedRaces.length === 0) {
          throw new Error("No completed races found");
        }
        
        // Get the last completed race
        const lastRace = completedRaces[completedRaces.length - 1];
        
        // Set circuit name and country
        setCircuitName(getRaceNameWithoutEmoji(lastRace.raceName) || "");
        const country = lastRace.Circuit?.Location?.country || "";
        setCountryName(country);
        setCountryCode(getCountryCode(country) || "");
        setLastRace(lastRace);
        
        // Fetch qualifying data for the last race
        const year = parseInt(lastRace.season);
        const round = lastRace.round;
        
        const qualifyingData = await getRaceQualifying(year, round);
        
        if (!qualifyingData?.data?.QualifyingResults || qualifyingData.data.QualifyingResults.length === 0) {
          throw new Error("No qualifying data available");
        }
        
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
        setError(error.message || "Failed to load qualifying data");
        setIsLoading(false);
      }
    };
    
    if (lastRaceResult.data && raceScheduleData?.data) {
      fetchQualifyingData();
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
      <Card className="h-full overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-primary" />
            Pole Positions
          </CardTitle>
          <CardDescription>
            Top 5 qualifiers from the last race
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {error}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
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

export default PolePositionsCard; 