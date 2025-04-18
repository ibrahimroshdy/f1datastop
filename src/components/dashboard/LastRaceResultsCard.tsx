import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { TEAM_COLORS } from "@/constants/f1Colors";
import ReactCountryFlag from "react-country-flag";
import { getCountryCode } from "@/components/common/CountryFlag";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import { useState, useEffect } from "react";
import { useRaceSchedule } from "@/hooks/useF1Data";
import RaceDetailDialog from "@/components/calendar/RaceDetailDialog";

interface LastRaceResultsCardProps {
  lastRaceResults: any;
  isResultsLoading: boolean;
  getTeamColor: (constructorId: string) => string;
}

// Helper function to get team color style with border
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

const LastRaceResultsCard = ({
  lastRaceResults,
  isResultsLoading,
  getTeamColor
}: LastRaceResultsCardProps) => {
  // Track race info in state
  const [raceName, setRaceName] = useState<string>("");
  const [countryName, setCountryName] = useState<string>("");
  const [countryCode, setCountryCode] = useState<string>("");
  const [lastRace, setLastRace] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { data: raceScheduleData } = useRaceSchedule();
  
  // Update race info whenever lastRaceResults or raceScheduleData changes
  useEffect(() => {
    // Priority: Get data from race schedule first for consistency
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
        
        console.log("LastRaceResultsCard country info:", {
          raceName: lastRace.raceName,
          country,
          countryCode: getCountryCode(country)
        });
      }
    } 
    // Fallback to lastRaceResults if race schedule doesn't have data
    else if (lastRaceResults?.data?.raceName) {
      setRaceName(getRaceNameWithoutEmoji(lastRaceResults.data.raceName));
      const country = lastRaceResults.data?.Circuit?.Location?.country || "";
      setCountryName(country);
      setCountryCode(getCountryCode(country) || "");
      setLastRace(lastRaceResults.data);
    } else {
      setRaceName("");
      setCountryName("");
      setCountryCode("");
      setLastRace(null);
    }
  }, [lastRaceResults, raceScheduleData]);

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
            <Clock className="h-5 w-5 text-primary" />
            Last Race Results
          </CardTitle>
          <CardDescription>
            Top 5 results from the most recent race
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2">
          {isResultsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !lastRaceResults?.data?.raceName ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                No recent race data available
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {lastRaceResults?.data?.results?.slice(0, 5).map(result => (
                <div 
                  key={result.position} 
                  className="flex items-center justify-between p-2 bg-card rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-xl font-bold">{result.position}</div>
                    <div style={getTeamColorStyle(result.Constructor.constructorId)}>
                      <div className="font-semibold">{result.Driver.code}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {result.Constructor.name}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-medium">
                      {result.position === '1' ? result.Time?.time : result.Time?.time?.startsWith('+') ? result.Time.time : result.status === "Finished" ? "+" + result.Time?.time : result.status}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Lap {result.FastestLap?.lap || result.laps}
                    </Badge>
                  </div>
                </div>
              ))}
              
              {/* Race Circuit Badge */}
              {!isResultsLoading && raceName && (
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

export default LastRaceResultsCard;
