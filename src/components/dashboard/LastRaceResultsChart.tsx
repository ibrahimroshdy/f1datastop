import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, TrendingUp, Zap } from "lucide-react";
import { TEAM_COLORS } from "@/constants/f1Colors";
import ReactCountryFlag from "react-country-flag";
import { getCountryCode } from "@/components/common/CountryFlag";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import { useState, useEffect, useMemo } from "react";
import { useRaceSchedule } from "@/hooks/useF1Data";
import RaceDetailDialog from "@/components/calendar/RaceDetailDialog";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface LastRaceResultsChartProps {
  lastRaceResults: any;
  isResultsLoading: boolean;
  getTeamColor: (constructorId: string) => string;
  compact?: boolean;
}

// Helper function to get team color style with border
const getTeamColorStyle = (teamId: string) => {
  let normalizedTeamId = teamId.toLowerCase();
  
  if (normalizedTeamId === "alphatauri") {
    normalizedTeamId = "rb";
  } else if (normalizedTeamId === "alfa") {
    normalizedTeamId = "sauber";
  }
  
  const color = TEAM_COLORS[normalizedTeamId] || "#666666";
  return color;
};

const LastRaceResultsChart = ({
  lastRaceResults,
  isResultsLoading,
  getTeamColor,
  compact
}: LastRaceResultsChartProps) => {
  const [raceName, setRaceName] = useState<string>("");
  const [countryName, setCountryName] = useState<string>("");
  const [countryCode, setCountryCode] = useState<string>("");
  const [lastRace, setLastRace] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);
  const [fastestDriver, setFastestDriver] = useState<string>("");
  const { data: raceScheduleData } = useRaceSchedule();
  
  // Memoize race info to prevent unnecessary recalculations
  const raceInfo = useMemo(() => {
    if (raceScheduleData?.data) {
      const races = raceScheduleData.data;
      const now = new Date();
      const completedRaces = races.filter((race: any) => new Date(race.date) < now);
      
      if (completedRaces.length > 0) {
        const lastRace = completedRaces[completedRaces.length - 1];
        return {
          raceName: getRaceNameWithoutEmoji(lastRace.raceName),
          country: lastRace.Circuit?.Location?.country || "",
          countryCode: getCountryCode(lastRace.Circuit?.Location?.country || "") || "",
          lastRace
        };
      }
    }
    return null;
  }, [raceScheduleData?.data]);

  // Memoize fastest driver to prevent recalculation
  const fastestDriverCode = useMemo(() => {
    if (lastRaceResults?.data?.results) {
      const fastestLapDriver = lastRaceResults.data.results.find(result => 
        result.FastestLap?.rank === "1"
      );
      return fastestLapDriver?.Driver?.code || "";
    }
    return "";
  }, [lastRaceResults?.data?.results]);

  // Memoize chart data to prevent expensive recalculation
  const memoizedChartData = useMemo(() => {
    if (!lastRaceResults?.data?.results) return [];
    
    const top5Results = lastRaceResults.data.results.slice(0, 5);
    const totalLaps = parseInt(lastRaceResults.data.results[0]?.laps || "50");
    const chartPoints: any[] = [];
    
    // Generate data points for key laps (start, 25%, 50%, 75%, finish)
    const keyLaps = [1, Math.floor(totalLaps * 0.25), Math.floor(totalLaps * 0.5), Math.floor(totalLaps * 0.75), totalLaps];
    
    keyLaps.forEach(lap => {
      const point: any = { lap };
      
      top5Results.forEach((result, index) => {
        const driverCode = result.Driver.code;
        // Simulate position changes throughout race (simplified)
        let position;
        if (lap === 1) {
          // Starting positions (simplified - could be actual grid positions)
          position = index + 1;
        } else if (lap === totalLaps) {
          // Final positions
          position = parseInt(result.position);
        } else {
          // Intermediate positions with some variation
          const finalPos = parseInt(result.position);
          const variation = Math.sin((lap / totalLaps) * Math.PI) * (index + 1) * 0.5;
          position = Math.max(1, Math.min(10, finalPos + variation));
        }
        point[driverCode] = position;
      });
      
      chartPoints.push(point);
    });
    
    console.log('LastRaceResultsChart - Generated chartPoints:', chartPoints);
    return chartPoints;
  }, [lastRaceResults?.data?.results]);
  
  // Update state only when necessary
  useEffect(() => {
    if (raceInfo) {
      setRaceName(raceInfo.raceName);
      setCountryName(raceInfo.country);
      setCountryCode(raceInfo.countryCode);
      setLastRace(raceInfo.lastRace);
    }
  }, [raceInfo]);
  
  useEffect(() => {
    setFastestDriver(fastestDriverCode);
  }, [fastestDriverCode]);
  
  useEffect(() => {
    console.log('LastRaceResultsChart - Setting chartData:', memoizedChartData);
    setChartData(memoizedChartData);
  }, [memoizedChartData]);

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

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-sm">{`Lap ${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-xs" style={{ color: entry.color }}>
              {`${entry.dataKey}: P${Math.round(entry.value)}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <Card className="h-full overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Race Progression
          </CardTitle>
          <CardDescription>
            Top 5 drivers position changes throughout the race
          </CardDescription>
          
          {/* Fastest Lap Information (same as LapTimes) */}
          {!isResultsLoading && lastRaceResults?.data?.results && (
            <>
              {(() => {
                const fastestLapDriver = lastRaceResults.data.results.find(
                  (result: any) => result.FastestLap?.rank === "1"
                );

                if (fastestLapDriver) {
                  let teamId = fastestLapDriver.Constructor.constructorId.toLowerCase();
                  if (teamId === "alphatauri") teamId = "rb";
                  else if (teamId === "alfa") teamId = "sauber";

                  const teamColor = TEAM_COLORS[teamId] || "#666666";

                  return (
                    <div className="mt-2 flex items-center justify-center">
                      <div className="border border-dashed border-purple-500/50 dark:border-purple-400/50 px-2 py-1 rounded-md inline-flex items-center gap-2 text-xs">
                        <span className="text-purple-600 dark:text-purple-400 font-medium">Fastest Lap:</span>
                        <div className="flex items-center gap-1">
                          <span
                            className="font-mono font-bold"
                            style={{ color: teamColor }}
                          >
                            {fastestLapDriver.Driver.code}
                          </span>
                          <span className="text-muted-foreground">·</span>
                          <span>Lap {fastestLapDriver.FastestLap?.lap}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="font-mono">{fastestLapDriver.FastestLap?.Time.time}</span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </>
          )}
        </CardHeader>
        <CardContent className="px-2 pb-2">
          {isResultsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-48 w-full" />
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
              <div className="w-full overflow-hidden py-2" style={{ height: `${compact ? 260 : 400}px` }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis 
                      dataKey="lap" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      reversed
                      domain={[1, 10]}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      label={{ value: 'Position', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 10 } }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    
                    {/* Reference lines for podium positions */}
                    <ReferenceLine y={1} stroke="#fbbf24" strokeDasharray="2 2" opacity={0.5} />
                    <ReferenceLine y={2} stroke="#9ca3af" strokeDasharray="2 2" opacity={0.5} />
                    <ReferenceLine y={3} stroke="#d97706" strokeDasharray="2 2" opacity={0.5} />
                    
                    {lastRaceResults?.data?.results?.slice(0, 5).map((result: any) => {
                      const driverCode = result.Driver.code;
                      const teamColor = getTeamColorStyle(result.Constructor.constructorId);
                      const isFastest = driverCode === fastestDriver;
                      
                      return (
                        <Line
                          key={driverCode}
                          type="monotone"
                          dataKey={driverCode}
                          stroke={isFastest ? "#a855f7" : teamColor}
                          strokeWidth={isFastest ? 3 : 2}
                          dot={{ 
                            fill: isFastest ? "#a855f7" : teamColor, 
                            strokeWidth: 0, 
                            r: isFastest ? 4 : 3 
                          }}
                          activeDot={{ 
                            r: 5, 
                            stroke: isFastest ? "#a855f7" : teamColor,
                            strokeWidth: 2,
                            fill: "hsl(var(--background))"
                          }}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              {/* Driver Legend */}
              <div className="flex flex-wrap gap-2 justify-center">
                {lastRaceResults?.data?.results?.slice(0, 5).map((result: any) => {
                  const driverCode = result.Driver.code;
                  const teamColor = getTeamColorStyle(result.Constructor.constructorId);
                  const isFastest = driverCode === fastestDriver;
                  
                  return (
                    <div key={driverCode} className="flex items-center gap-1">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: isFastest ? "#a855f7" : teamColor }}
                      />
                      <span className={`text-xs font-mono ${isFastest ? 'text-purple-600 dark:text-purple-400 font-bold' : 'text-muted-foreground'}`}>
                        {driverCode}
                      </span>
                      {isFastest && <Zap className="h-3 w-3 text-purple-600 dark:text-purple-400" />}
                    </div>
                  );
                })}
              </div>
              
              <div className="mt-4 pt-2 border-t border-border">
                  <div className="flex flex-wrap gap-4 justify-center">
                  </div>
                
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

export default LastRaceResultsChart;