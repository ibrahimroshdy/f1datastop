import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { TEAM_COLORS } from "@/constants/f1Colors";

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
  return (
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
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LastRaceResultsCard;
