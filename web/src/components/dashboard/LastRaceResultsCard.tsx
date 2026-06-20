import { Clock, Flag } from "lucide-react";
import { F1Card, F1CardContent, F1CardHeader } from "@/components/f1";
import { Badge } from "@/components/ui/badge";
import { TEAM_COLORS } from "@/constants/f1Colors";
import ReactCountryFlag from "react-country-flag";
import { getCountryCode } from "@/components/common/CountryFlag";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import { useState, useEffect } from "react";
import { useRaceSchedule } from "@/hooks/useF1Data";
import RaceDetailDialog from "@/components/calendar/RaceDetailDialog";
import { F1EmptyState } from "@/components/f1/F1EmptyState";
import { StandingsSkeleton } from "@/components/f1/F1Skeleton";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

interface LastRaceResultsCardProps {
  lastRaceResults: any;
  isResultsLoading: boolean;
  getTeamColor: (constructorId: string) => string;
}

// Helper function to get team color
const getTeamHexColor = (teamId: string): string => {
  let normalizedTeamId = teamId.toLowerCase();
  if (normalizedTeamId === "alphatauri") normalizedTeamId = "rb";
  else if (normalizedTeamId === "alfa") normalizedTeamId = "sauber";
  return TEAM_COLORS[normalizedTeamId] || "#666666";
};

const LastRaceResultsCard = ({
  lastRaceResults,
  isResultsLoading,
  getTeamColor: _getTeamColor,
}: LastRaceResultsCardProps) => {
  const [raceName, setRaceName] = useState<string>("");
  const [countryName, setCountryName] = useState<string>("");
  const [countryCode, setCountryCode] = useState<string>("");
  const [lastRace, setLastRace] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { data: raceScheduleData } = useRaceSchedule();
  const { isGlass } = useTheme();
  const surfaceVariant = isGlass ? ("glass" as const) : ("default" as const);
  const surfaceGlass = isGlass ? ("panel" as const) : ("default" as const);
  
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
    } else if (lastRaceResults?.data?.raceName) {
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

  // Get fastest lap driver
  const fastestLapDriver = lastRaceResults?.data?.results?.find(
    (result: any) => result.FastestLap?.rank === "1"
  );

  return (
    <>
      <F1Card
        variant={surfaceVariant}
        glassVariant={surfaceGlass}
        className={cn("h-full overflow-hidden p-0", isGlass && "border-white/10")}
      >
        <F1CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary shrink-0" />
              <h3 className="font-semibold text-sm">Last Race Results</h3>
            </div>
          
            {/* GP Badge - Top Right */}
            {!isResultsLoading && raceName && (
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
          
          {/* Fastest Lap */}
          {!isResultsLoading && fastestLapDriver && (
                    <div className="mt-2 flex items-center justify-center">
              <div className="border border-dashed border-purple-500/50 dark:border-purple-400/50 px-2 py-0.5 rounded inline-flex items-center gap-1.5 text-[10px]">
                <span className="text-purple-600 dark:text-purple-400 font-medium">Fastest:</span>
                          <span 
                            className="font-mono font-bold" 
                  style={{ color: getTeamHexColor(fastestLapDriver.Constructor.constructorId) }}
                          >
                            {fastestLapDriver.Driver.code}
                          </span>
                          <span className="text-muted-foreground">·</span>
                          <span className="font-mono">{fastestLapDriver.FastestLap?.Time.time}</span>
                        </div>
                      </div>
          )}
        </F1CardHeader>
        
        <F1CardContent className="px-2">
          {isResultsLoading ? (
            <StandingsSkeleton rows={5} />
          ) : !lastRaceResults?.data?.raceName ? (
            <F1EmptyState
              type="no-results"
              title="No Results Yet"
              description="Results appear after races."
              icon={<Flag className="h-8 w-8 text-muted-foreground" />}
              size="sm"
              showDecoration={false}
            />
          ) : (
            <div className="space-y-3 max-w-3xl mx-auto">
              {lastRaceResults?.data?.results?.slice(0, 5).map((result: any) => {
                const position = Number(result.position);
                const teamColor = getTeamHexColor(result.Constructor.constructorId);
                const isWinner = position === 1;
                
                return (
                <div 
                  key={result.position} 
                  className="flex items-center justify-between p-2 bg-card rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-xl font-bold">{result.position}</div>
                      <div style={{ borderLeft: `3px solid ${teamColor}`, paddingLeft: '0.5rem' }}>
                      <div className="font-semibold">{result.Driver.code}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {result.Constructor.name}
                      </div>
                    </div>
                  </div>
                    
                  <div className="text-right">
                    <div className="font-mono font-medium">
                        {isWinner 
                          ? result.Time?.time 
                          : result.Time?.time?.startsWith('+') 
                            ? result.Time.time 
                            : result.status === "Finished" 
                              ? "+" + result.Time?.time 
                              : result.status
                        }
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Lap {result.laps}
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

export default LastRaceResultsCard;
