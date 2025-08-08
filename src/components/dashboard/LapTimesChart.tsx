import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Clock, Zap } from "lucide-react";
import { TEAM_COLORS } from "@/constants/f1Colors";
import ReactCountryFlag from "react-country-flag";
import { getCountryCode } from "@/components/common/CountryFlag";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import { useState, useEffect, useMemo } from "react";
import { useRaceSchedule, useLapTimes } from "@/hooks/useF1Data";
import RaceDetailDialog from "@/components/calendar/RaceDetailDialog";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface LapTimesChartProps {
  lastRaceResults: any;
  isResultsLoading: boolean;
  getTeamColor: (constructorId: string) => string;
  compact?: boolean;
}

// Helper function to get team color style
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

// Helper function to convert lap time to seconds
const lapTimeToSeconds = (lapTime: string): number => {
  if (!lapTime || lapTime === "N/A") return 0;
  
  // Handle format like "1:23.456" or "23.456"
  const parts = lapTime.split(':');
  if (parts.length === 2) {
    const minutes = parseInt(parts[0]);
    const seconds = parseFloat(parts[1]);
    return minutes * 60 + seconds;
  } else {
    return parseFloat(lapTime);
  }
};

// Helper function to format seconds back to lap time
const secondsToLapTime = (seconds: number): string => {
  if (seconds === 0) return "N/A";
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}:${remainingSeconds.toFixed(3).padStart(6, '0')}`;
  } else {
    return remainingSeconds.toFixed(3);
  }
};

// Interpolate missing series values per driver so charts don't break
function interpolateDriverSeries(points: any[], driverCodes: string[]) {
  const n = points.length;
  driverCodes.forEach((code) => {
    const values: Array<number | null> = points.map((p) => p[code] ?? null);
    let i = 0;
    while (i < n) {
      if (values[i] != null) {
        i++;
        continue;
      }
      // find previous and next non-null
      let prev = i - 1;
      while (prev >= 0 && values[prev] == null) prev--;
      let next = i + 1;
      while (next < n && values[next] == null) next++;
      if (prev >= 0 && next < n && values[prev] != null && values[next] != null) {
        const start = values[prev] as number;
        const end = values[next] as number;
        const len = next - prev;
        for (let k = prev + 1; k < next; k++) {
          const t = (k - prev) / len;
          values[k] = start + (end - start) * t;
        }
        i = next;
      } else if (prev >= 0 && values[prev] != null) {
        const val = values[prev] as number;
        while (i < n && values[i] == null) {
          values[i] = val;
          i++;
        }
      } else if (next < n && values[next] != null) {
        const val = values[next] as number;
        for (let k = 0; k < next; k++) {
          if (values[k] == null) values[k] = val;
        }
        i = next + 1;
      } else {
        // all nulls; leave zeros
        for (let k = 0; k < n; k++) {
          if (values[k] == null) values[k] = 0;
        }
        break;
      }
    }
    // write back
    for (let k = 0; k < n; k++) {
      points[k][code] = values[k];
    }
  });
  return points;
}

// Downsample to every 10 laps while ensuring we keep the first, last, and a specific lap (e.g., fastest)
function downsampleEveryTen(points: any[], includeLap?: number) {
  if (!points || points.length === 0) return points;
  const total = points[points.length - 1]?.lap ?? 0;
  const filtered = points.filter((p) => p.lap === 1 || p.lap === total || p.lap % 10 === 0 || (includeLap && p.lap === includeLap));
  // Ensure uniqueness and sorted order by lap
  const byLap = new Map<number, any>();
  filtered.forEach((p) => byLap.set(p.lap, p));
  return Array.from(byLap.values()).sort((a, b) => a.lap - b.lap);
}

const LapTimesChart = ({
  lastRaceResults,
  isResultsLoading,
  getTeamColor,
  compact
}: LapTimesChartProps) => {
  const [raceName, setRaceName] = useState<string>("");
  const [countryName, setCountryName] = useState<string>("");
  const [countryCode, setCountryCode] = useState<string>("");
  const [lastRace, setLastRace] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);
  const [fastestDriver, setFastestDriver] = useState<string>("");
  const [fastestLapTime, setFastestLapTime] = useState<number>(0);
  const { data: raceScheduleData } = useRaceSchedule();
  
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
    return "2 2"; // fallback style if ever needed
  };
  
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

  // Memoize fastest lap info to prevent recalculation
  const fastestLapInfo = useMemo(() => {
    if (lastRaceResults?.data?.results) {
      const fastestLapDriver = lastRaceResults.data.results.find(result => 
        result.FastestLap?.rank === "1"
      );
      const driverCode = fastestLapDriver?.Driver?.code || "";
      const fastestTime = fastestLapDriver?.FastestLap?.Time?.time || "0";
      const lapTime = lapTimeToSeconds(fastestTime);
      const lapNumber = parseInt(fastestLapDriver?.FastestLap?.lap || "0");
      
      return { driverCode, lapTime, lapNumber };
    }
    return { driverCode: "", lapTime: 0, lapNumber: 0 };
  }, [lastRaceResults?.data?.results]);

  // Determine the last completed race (season/round)
  const lastCompleted = useMemo(() => {
    const races = raceScheduleData?.data || [];
    const now = new Date();
    const completed = races.filter((race: any) => new Date(race.date) < now);
    if (completed.length === 0) return null;
    const last = completed[completed.length - 1];
    return { season: parseInt(last.season), round: last.round } as { season: number; round: string } | null;
  }, [raceScheduleData?.data]);

  // Load real lap times for that race (all drivers)
  const { data: lapTimesResp } = useLapTimes(lastCompleted?.season || 0, lastCompleted?.round || "", false);

  // Memoize chart data, prefer real lap times, fallback to simulated
  const memoizedChartData = useMemo(() => {
    const laps: any[] = lapTimesResp?.data?.Races?.[0]?.Laps || [];
    const top5Results = lastRaceResults?.data?.results?.slice(0, 5) || [];
    if (laps.length > 0 && top5Results.length > 0) {
      const driverIds: string[] = top5Results.map((r: any) => r.Driver.driverId);
      const driverCodeById: Record<string, string> = top5Results.reduce((acc: any, r: any) => {
        acc[r.Driver.driverId] = r.Driver.code; return acc;
      }, {});
      const points: any[] = [];
      laps.forEach((lapObj: any) => {
        const lapNum = parseInt(lapObj.number);
        const p: any = { lap: lapNum };
        driverIds.forEach((id) => {
          const t = (lapObj.Timings || []).find((tt: any) => tt.driverId === id);
          p[driverCodeById[id]] = t ? lapTimeToSeconds(t.time) : null;
        });
        points.push(p);
      });
      const interpolated = interpolateDriverSeries(points, Object.values(driverCodeById));
      return downsampleEveryTen(interpolated, fastestLapInfo?.lapNumber);
    }

    // Fallback if no lap times available
    if (!lastRaceResults?.data?.results) return [];
    const totalLaps = parseInt(lastRaceResults.data.results[0]?.laps || "50");
    const fallbackTop = lastRaceResults.data.results.slice(0, 5);
    const base = fastestLapInfo?.lapTime > 0 ? fastestLapInfo.lapTime : 90;
    const simulated: any[] = [];
    for (let lap = 1; lap <= totalLaps; lap += 1) {
      const row: any = { lap };
      fallbackTop.forEach((result: any, index: number) => {
        const driverCode = result.Driver.code;
        const positionPenalty = index * 0.5;
        const fuelLoad = Math.max(0, 1 - (lap / totalLaps)) * 2;
        const tireWear = (lap / totalLaps) * 1.5;
        const randomVariation = (Math.random() - 0.5) * 1;
        const lapTime = base + positionPenalty + fuelLoad + tireWear + randomVariation;
        row[driverCode] = Math.max(base - 2, lapTime);
      });
      simulated.push(row);
    }
    const interpolated = interpolateDriverSeries(simulated, fallbackTop.map((r:any)=>r.Driver.code));
    return downsampleEveryTen(interpolated, fastestLapInfo?.lapNumber);
  }, [lapTimesResp?.data, lastRaceResults?.data?.results, raceScheduleData?.data, fastestLapInfo]);
  
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
    setFastestDriver(fastestLapInfo.driverCode);
    setFastestLapTime(fastestLapInfo.lapTime);
  }, [fastestLapInfo]);
  
  useEffect(() => {
    console.log('LapTimesChart - Setting chartData:', memoizedChartData);
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
              {`${entry.dataKey}: ${secondsToLapTime(entry.value)}`}
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
            <Clock className="h-5 w-5 text-primary" />
            Lap Times
          </CardTitle>
          <CardDescription>
            Top 5 drivers lap time progression throughout the race
          </CardDescription>
          
          {/* Fastest Lap Information (provided snippet) */}
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
                      domain={['dataMin - 2', 'dataMax + 2']}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(value) => `${Math.floor(value / 60)}:${(value % 60).toFixed(0).padStart(2, '0')}`}
                      label={{ value: 'Lap Time', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 10 } }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    
                    {/* Highlight fastest lap with purple dotted line only */}
                    {fastestLapTime > 0 && (
                      <ReferenceLine y={fastestLapTime} stroke="#a855f7" strokeDasharray="4 3" opacity={0.9} />
                    )}
                    
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
                          stroke={isFastest ? "hsl(var(--muted-foreground))" : teamColor}
                          strokeWidth={isFastest ? 3 : 2}
                          strokeDasharray={strokeDasharray}
                          dot={{ 
                            fill: isFastest ? "hsl(var(--muted-foreground))" : teamColor, 
                            strokeWidth: 0, 
                            r: isFastest ? 4 : 3 
                          }}
                          activeDot={{ 
                            r: 5, 
                            stroke: isFastest ? "hsl(var(--muted-foreground))" : teamColor,
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
                  const lineColor = isFastest ? "hsl(var(--muted-foreground))" : teamColor;
                  
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
              
              {/* Race Circuit Badge */}
              {!isResultsLoading && raceName && (
                <div className="text-center pt-2 border-t border-dashed border-purple-500/30">
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

export default LapTimesChart;