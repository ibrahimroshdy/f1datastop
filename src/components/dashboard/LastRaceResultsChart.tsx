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
import { useRaceSchedule, useLapTimes } from "@/hooks/useF1Data";
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
  // Interpolate missing series values per driver so lines remain continuous
  function interpolatePositions(points: any[], driverCodes: string[]) {
    const n = points.length;
    driverCodes.forEach((code) => {
      const values: Array<number | null> = points.map((p) => p[code] ?? null);
      let i = 0;
      while (i < n) {
        if (values[i] != null) { i++; continue; }
        let prev = i - 1; while (prev >= 0 && values[prev] == null) prev--;
        let next = i + 1; while (next < n && values[next] == null) next++;
        if (prev >= 0 && next < n && values[prev] != null && values[next] != null) {
          const start = values[prev] as number;
          const end = values[next] as number;
          const len = next - prev;
          for (let k = prev + 1; k < next; k++) {
            const t = (k - prev) / len;
            values[k] = Math.round(start + (end - start) * t);
          }
          i = next;
        } else if (prev >= 0 && values[prev] != null) {
          const val = values[prev] as number;
          while (i < n && values[i] == null) { values[i] = val; i++; }
        } else if (next < n && values[next] != null) {
          const val = values[next] as number;
          for (let k = 0; k < next; k++) if (values[k] == null) values[k] = val;
          i = next + 1;
        } else {
          for (let k = 0; k < n; k++) if (values[k] == null) values[k] = 10; // default mid-pack
          break;
        }
      }
      for (let k = 0; k < n; k++) points[k][code] = values[k];
    });
    return points;
  }
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

  // Build positions from real lap timing data
  const lastCompleted = useMemo(() => {
    const races = raceScheduleData?.data || [];
    const now = new Date();
    const completed = races.filter((race: any) => new Date(race.date) < now);
    if (completed.length === 0) return null;
    const last = completed[completed.length - 1];
    return { season: parseInt(last.season), round: last.round } as { season: number; round: string } | null;
  }, [raceScheduleData?.data]);

  const { data: lapTimesResp } = useLapTimes(lastCompleted?.season || 0, lastCompleted?.round || "", false);

  // Build per-team driver order for styling (same team gets different dash styles)
  const teamDriversOrder = useMemo(() => {
    const top5 = lastRaceResults?.data?.results?.slice(0, 5) || [];
    const map: Record<string, string[]> = {};
    top5.forEach((res: any) => {
      let teamId = res.Constructor?.constructorId?.toLowerCase?.() || "";
      if (teamId === "alphatauri") teamId = "rb";
      else if (teamId === "alfa") teamId = "sauber";
      if (!map[teamId]) map[teamId] = [];
      map[teamId].push(res.Driver?.code);
    });
    return map;
  }, [lastRaceResults?.data?.results]);

  const getStrokeDashForDriver = (driverCode: string, rawTeamId: string) => {
    let teamId = rawTeamId?.toLowerCase?.() || "";
    if (teamId === "alphatauri") teamId = "rb";
    else if (teamId === "alfa") teamId = "sauber";
    const order = teamDriversOrder[teamId] || [];
    const idx = order.indexOf(driverCode);
    if (idx <= 0) return undefined; // first driver solid
    if (idx === 1) return "6 3"; // second driver dashed
    return "2 2"; // fallback style if needed
  };

  // Downsample to every 10 laps, keep first/last and fastest lap
  function downsampleEveryTen(points: any[], includeLap?: number) {
    if (!points || points.length === 0) return points;
    const total = points[points.length - 1]?.lap ?? 0;
    const filtered = points.filter((p) => p.lap === 1 || p.lap === total || p.lap % 10 === 0 || (includeLap && p.lap === includeLap));
    const byLap = new Map<number, any>();
    filtered.forEach((p) => byLap.set(p.lap, p));
    return Array.from(byLap.values()).sort((a, b) => a.lap - b.lap);
  }

  const memoizedChartData = useMemo(() => {
    const laps: any[] = lapTimesResp?.data?.Races?.[0]?.Laps || [];
    const results = lastRaceResults?.data?.results || [];
    const top5 = results.slice(0, 5);
    if (laps.length === 0 || top5.length === 0) return [];
    const driverIds: string[] = top5.map((r: any) => r.Driver.driverId);
    const codeById: Record<string, string> = top5.reduce((acc: any, r: any) => {
      acc[r.Driver.driverId] = r.Driver.code; return acc;
    }, {});
    const points: any[] = [];
    laps.forEach((lapObj: any) => {
      const lapNum = parseInt(lapObj.number);
      const p: any = { lap: lapNum };
      driverIds.forEach((id) => {
        const t = (lapObj.Timings || []).find((tt: any) => tt.driverId === id);
        p[codeById[id]] = t ? parseInt(t.position) : null;
      });
      points.push(p);
    });
    const interpolated = interpolatePositions(points, Object.values(codeById));
    // Fastest lap number from results if available
    const fastest = results.find((r:any)=> r.FastestLap?.rank === "1");
    const fastestLapNum = fastest ? parseInt(fastest.FastestLap?.lap || "0") : 0;
    return downsampleEveryTen(interpolated, fastestLapNum);
  }, [lapTimesResp?.data, lastRaceResults?.data?.results, raceScheduleData?.data]);
  
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
      <Card className="bg-card border-border h-full overflow-hidden flex flex-col">
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
        <CardContent className="px-2 pb-2 flex-1 flex flex-col">
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
            <div className="space-y-3 h-full flex flex-col">
              <div className="w-full overflow-hidden py-2" style={{ height: `${compact ? 260 : 400}px` }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis 
                      dataKey="lap"
                      type="number"
                      domain={["dataMin", "dataMax"]}
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      ticks={(chartData || []).map((d: any) => d.lap)}
                    />
                    <YAxis 
                      reversed
                      domain={[1, 20]}
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
                      const strokeDasharray = getStrokeDashForDriver(driverCode, result.Constructor.constructorId);
                      
                      return (
                        <Line
                          key={driverCode}
                          type="monotone"
                          dataKey={driverCode}
                          stroke={isFastest ? "#a855f7" : teamColor}
                          strokeWidth={isFastest ? 3 : 2}
                          strokeDasharray={strokeDasharray}
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
                  const strokeDasharray = getStrokeDashForDriver(driverCode, result.Constructor.constructorId);
                  const lineColor = isFastest ? "#a855f7" : teamColor;
                  
                  return (
                    <div key={driverCode} className="flex items-center gap-1">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: isFastest ? "#a855f7" : teamColor }}
                      />
                      <svg width="18" height="6" className="mx-1">
                        <line x1="0" y1="3" x2="18" y2="3" stroke={lineColor} strokeWidth={2} strokeDasharray={strokeDasharray} />
                      </svg>
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