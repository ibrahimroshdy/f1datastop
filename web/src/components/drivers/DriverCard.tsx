import { useState, useEffect, useMemo } from "react";
import {
  F1Card,
  F1CardContent,
  F1CardDescription,
  F1CardFooter,
  F1CardHeader,
  F1CardTitle,
} from "@/components/f1";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Info, Trophy, TrendingUp, ChevronDown, ChevronUp, Flag, Calendar, Target, List, BarChart3, X } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerClose } from "@/components/ui/drawer";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { useLatestDriver, useLatestSessionDrivers } from "@/hooks/useOpenF1Data";
import { useDriverResultsBySeason } from "@/hooks/useF1Data";
import CountryFlag from "@/components/common/CountryFlag";
import { getRaceNameWithoutEmoji } from "@/utils/countryUtils";
import { useIsMobile } from "@/hooks/use-mobile";
import { getCachedImage, getDriverImageUrls } from "@/utils/imageCache";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

// Position Progression Chart Component - shadcn/ui chart design
interface PositionProgressionChartProps {
  history: Array<{
    round: string;
    raceName: string;
    position?: string;
    status?: string;
    isDNF?: boolean;
    points: number;
    country?: string;
  }>;
  teamColor: string;
  isGlass: boolean;
}

const PositionProgressionChart = ({ history, teamColor, isGlass }: PositionProgressionChartProps) => {
  // Transform data for Recharts
  const chartData = useMemo(() => {
    return history.map((race) => ({
      round: `R${race.round}`,
      position: race.isDNF ? null : Number(race.position),
      raceName: getRaceNameWithoutEmoji(race.raceName),
      isDNF: race.isDNF,
      points: race.points,
    }));
  }, [history]);

  // Calculate stats
  const stats = useMemo(() => {
    const positions = history.filter(r => r.position && !r.isDNF).map(r => Number(r.position));
    const wins = positions.filter(p => p === 1).length;
    const dnfs = history.filter(r => r.isDNF).length;
    return { wins, dnfs };
  }, [history]);

  // Chart config for shadcn/ui
  const chartConfig = {
    position: {
      label: "Position",
      color: teamColor,
    },
  } satisfies ChartConfig;

  // Calculate Y-axis domain (inverted: P1 at top)
  const yDomain = useMemo(() => {
    const positions = chartData.filter(d => d.position !== null).map(d => d.position as number);
    if (positions.length === 0) return [1, 20];
    const min = Math.max(1, Math.min(...positions) - 1);
    const max = Math.min(22, Math.max(...positions) + 2);
    return [min, max];
  }, [chartData]);

  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        No race data available
      </div>
    );
  }

  return (
    <F1Card
      variant={isGlass ? "glass" : "default"}
      glassVariant={isGlass ? "panel" : "default"}
      className={cn("p-0", isGlass && "border-white/10")}
    >
      <F1CardHeader className="pb-2">
        <F1CardTitle className="!text-sm !font-medium">Season Position Trend</F1CardTitle>
        <F1CardDescription>
          Race finishing positions throughout the season
        </F1CardDescription>
      </F1CardHeader>
      <F1CardContent className="pb-2">
        <ChartContainer config={chartConfig} className="h-[180px] w-full">
          <LineChart
            data={chartData}
            margin={{ top: 20, left: 12, right: 12, bottom: 0 }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="round"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={history.length > 15 ? 2 : history.length > 10 ? 1 : 0}
              fontSize={10}
            />
            <YAxis
              domain={yDomain}
              reversed={true}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `P${value}`}
              width={32}
              fontSize={10}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="line"
                  labelFormatter={(value, payload) => {
                    if (payload && payload[0]) {
                      const data = payload[0].payload;
                      return (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{data.raceName}</span>
                          <span className="text-muted-foreground text-xs">{value}</span>
                        </div>
                      );
                    }
                    return value;
                  }}
                  formatter={(value, name, item) => {
                    const data = item.payload;
                    if (data.isDNF) {
                      return (
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                          <span className="text-red-500 font-medium">DNF</span>
                        </div>
                      );
                    }
                    const pos = Number(value);
                    const color = pos === 1 ? 'text-yellow-500' : pos <= 3 ? 'text-amber-500' : pos <= 10 ? 'text-green-500' : '';
                    return (
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2.5 h-2.5 rounded-full" 
                          style={{ backgroundColor: pos === 1 ? '#eab308' : pos <= 3 ? '#f59e0b' : pos <= 10 ? '#22c55e' : teamColor }}
                        />
                        <span className={cn("font-medium", color)}>P{value}</span>
                        {data.points > 0 && (
                          <span className="text-muted-foreground text-xs">+{data.points} pts</span>
                        )}
                      </div>
                    );
                  }}
                />
              }
            />
            <Line
              dataKey="position"
              type="natural"
              stroke="var(--color-position)"
              strokeWidth={2}
              dot={({ cx, cy, payload }) => {
                if (payload.isDNF || payload.position === null) {
                  return (
                    <circle
                      key={`dot-${payload.round}`}
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill="#ef4444"
                      stroke="#ef4444"
                      strokeWidth={1}
                    />
                  );
                }
                const pos = Number(payload.position);
                const fillColor = pos === 1 ? '#eab308' : pos <= 3 ? '#f59e0b' : pos <= 10 ? '#22c55e' : teamColor;
                return (
                  <circle
                    key={`dot-${payload.round}`}
                    cx={cx}
                    cy={cy}
                    r={pos === 1 ? 5 : 4}
                    fill={fillColor}
                    stroke="white"
                    strokeWidth={1.5}
                  />
                );
              }}
              activeDot={{
                r: 6,
                fill: teamColor,
                stroke: "white",
                strokeWidth: 2,
              }}
              connectNulls={false}
            />
          </LineChart>
        </ChartContainer>
      </F1CardContent>
      <F1CardFooter className="flex-col items-start gap-2 text-sm pt-0 border-t-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
            <span className="text-muted-foreground text-xs">Win</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-muted-foreground text-xs">Podium</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span className="text-muted-foreground text-xs">Points</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-muted-foreground text-xs">DNF</span>
          </div>
        </div>
        <div className="flex gap-2 text-xs text-muted-foreground leading-none">
          {stats.wins > 0 && (
            <span className="flex items-center gap-1">
              <Trophy className="h-3 w-3 text-yellow-500" />
              {stats.wins} win{stats.wins > 1 ? 's' : ''}
            </span>
          )}
          {stats.dnfs > 0 && (
            <span className="text-red-500">{stats.dnfs} DNF{stats.dnfs > 1 ? 's' : ''}</span>
          )}
        </div>
      </F1CardFooter>
    </F1Card>
  );
};

interface DriverCardProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Ergast driver standing row
  driver: any;
  teamTotalPoints?: number;
  seasonYear?: number;
  // Pre-fetched per-race results for this driver (from the batched season query).
  // When provided, the per-card fetch is skipped — avoids the Drivers-grid N+1.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  seasonResults?: any[];
}

const DriverCard = ({ driver, teamTotalPoints, seasonYear, seasonResults }: DriverCardProps) => {
  const [showDetails, setShowDetails] = useState(false);
  const [cachedImageUrl, setCachedImageUrl] = useState<string>('');
  const [imageLoading, setImageLoading] = useState(true);
  const [historyExpanded, setHistoryExpanded] = useState(true); // Always expanded by default
  const isMobile = useIsMobile();
  const { isGlass } = useTheme();
  
  // Get the current constructor (last in array)
  const currentConstructor = driver.Constructors.length > 0 
    ? driver.Constructors[driver.Constructors.length - 1] 
    : null;
  
  // Get the team color using the constructor ID
  const constructorId = currentConstructor?.constructorId || 'default';
  const teamColor = TEAM_COLORS[constructorId] || TEAM_COLORS.default;

  // Extract birth year for age calculation
  const birthYear = driver.Driver.dateOfBirth 
    ? new Date(driver.Driver.dateOfBirth).getFullYear() 
    : null;
  const currentYear = new Date().getFullYear();
  const age = birthYear ? currentYear - birthYear : "N/A";

  // Get driver number (fallback to Ergast, prefer OpenF1 latest)
  const driverNumber = driver.Driver.permanentNumber || 'N/A';
  const codeAcronym = (driver.Driver.code || '').toUpperCase();

  const batchDriversQuery = useLatestSessionDrivers(!!codeAcronym);
  const driverFromBatch = useMemo(() => {
    const rows = batchDriversQuery.data?.data;
    if (!rows?.length || !codeAcronym) return undefined;
    return rows.find(
      (d: { name_acronym?: string }) =>
        String(d.name_acronym || "").toUpperCase() === codeAcronym
    );
  }, [batchDriversQuery.data?.data, codeAcronym]);

  const needsPerDriverFallback =
    !!codeAcronym &&
    (batchDriversQuery.isError ||
      (batchDriversQuery.isSuccess && !driverFromBatch));

  const latestDriverQuery = useLatestDriver(
    undefined,
    codeAcronym,
    needsPerDriverFallback
  );

  const openF1Driver = driverFromBatch ?? latestDriverQuery.data?.data;
  const headshotUrl: string | undefined = openF1Driver?.headshot_url;
  const latestNumber: number | undefined = openF1Driver?.driver_number;
  const displayDriverNumber = latestNumber ?? driver.Driver.permanentNumber ?? 'N/A';
  
  // Driver contribution to constructor points
  const driverPoints = Number(driver.points) || 0;
  const teamPoints = Number(teamTotalPoints) || 0;
  const contributionPercent = teamPoints > 0 && driverPoints > 0 ? Math.round((driverPoints / teamPoints) * 100) : null;

  // Season year for per-race points history.
  // If the grid supplied this driver's results (batched), skip the per-card fetch.
  const season = seasonYear || new Date().getFullYear();
  const hasProvidedResults = seasonResults !== undefined;
  const { data: resultsByRaceResp } = useDriverResultsBySeason(
    season,
    driver.Driver.driverId,
    !hasProvidedResults,
  );
  const pointsHistory: Array<{
    round: string;
    raceName: string;
    date: string;
    circuit?: string;
    country?: string;
    position?: string;
    status?: string;
    isDNF?: boolean; // From API - properly detected DNF
    points: number;
    constructor?: string;
  }> = hasProvidedResults ? seasonResults : (resultsByRaceResp?.data || []);

  // Calculate stats from history
  const totalRaces = pointsHistory.length;
  const podiums = pointsHistory.filter(r => r.position && Number(r.position) <= 3).length;
  const wins = Number(driver.wins) || pointsHistory.filter(r => r.position === "1").length;
  const avgPosition = totalRaces > 0 
    ? (pointsHistory.reduce((sum, r) => sum + (Number(r.position) || 20), 0) / totalRaces).toFixed(1) 
    : "N/A";
  
  // Load and cache driver image (OpenF1 when available, local fallback)
  useEffect(() => {
    const loadDriverImage = async () => {
      try {
        setImageLoading(true);
        const imageUrls = getDriverImageUrls(driver.Driver.driverId, headshotUrl, season);
        if (imageUrls.primary) {
          const cached = await getCachedImage(imageUrls.primary, imageUrls.fallback);
          setCachedImageUrl(cached);
        } else {
          setCachedImageUrl('');
        }
      } catch (error) {
        console.warn(`Failed to load image for driver ${driver.Driver.driverId}:`, error);
        setCachedImageUrl('');
      } finally {
        setImageLoading(false);
      }
    };

    loadDriverImage();
  }, [driver.Driver.driverId, headshotUrl, season]);

  // Calculate best, worst positions and DNF count
  const bestPosition = useMemo(() => {
    const validPositions = pointsHistory.filter(r => r.position).map(r => Number(r.position));
    return validPositions.length > 0 ? Math.min(...validPositions) : null;
  }, [pointsHistory]);
  
  const worstPosition = useMemo(() => {
    const validPositions = pointsHistory.filter(r => r.position).map(r => Number(r.position));
    return validPositions.length > 0 ? Math.max(...validPositions) : null;
  }, [pointsHistory]);
  
  const dnfCount = useMemo(() => {
    // Use isDNF from API - properly detected DNFs
    return pointsHistory.filter(r => r.isDNF === true).length;
  }, [pointsHistory]);

  // Component for the detail content (shared between dialog and drawer)
  const DetailContent = () => (
    <div className="space-y-3">
      {/* Summary Stats - Compact 2 rows */}
      <div className="grid grid-cols-4 gap-1.5">
        <div className={cn(
          "text-center p-2 rounded-md",
          isGlass ? "bg-white/5" : "bg-muted"
        )}>
          <Trophy className="h-3 w-3 mx-auto mb-0.5 text-yellow-500" />
          <p className="text-sm font-bold">{wins}</p>
          <p className="text-[8px] text-muted-foreground">Wins</p>
        </div>
        <div className={cn(
          "text-center p-2 rounded-md",
          isGlass ? "bg-white/5" : "bg-muted"
        )}>
          <Flag className="h-3 w-3 mx-auto mb-0.5 text-orange-500" />
          <p className="text-sm font-bold">{podiums}</p>
          <p className="text-[8px] text-muted-foreground">Podiums</p>
        </div>
        <div className={cn(
          "text-center p-2 rounded-md",
          isGlass ? "bg-white/5" : "bg-muted"
        )}>
          <Target className="h-3 w-3 mx-auto mb-0.5 text-blue-500" />
          <p className="text-sm font-bold">{avgPosition}</p>
          <p className="text-[8px] text-muted-foreground">Avg Pos</p>
        </div>
        <div className={cn(
          "text-center p-2 rounded-md",
          isGlass ? "bg-white/5" : "bg-muted"
        )}>
          <TrendingUp className="h-3 w-3 mx-auto mb-0.5 text-green-500" />
          <p className="text-sm font-bold">{driver.points}</p>
          <p className="text-[8px] text-muted-foreground">Points</p>
        </div>
      </div>

      {/* Best/Worst/DNF + Team Contribution Row */}
      <div className="grid grid-cols-2 gap-1.5">
        {/* Best/Worst/DNF Positions */}
        <div className={cn(
          "p-1.5 rounded-md flex items-center justify-around",
          isGlass ? "bg-white/5" : "bg-muted"
        )}>
          <div className="text-center">
            <p className="text-[7px] text-muted-foreground">Best</p>
            <p className="text-xs font-bold text-green-500">P{bestPosition || '-'}</p>
          </div>
          <div className="w-px h-5 bg-border/30"></div>
          <div className="text-center">
            <p className="text-[7px] text-muted-foreground">Worst</p>
            <p className="text-xs font-bold text-orange-500/70">P{worstPosition || '-'}</p>
          </div>
          <div className="w-px h-5 bg-border/30"></div>
          <div className="text-center">
            <p className="text-[7px] text-muted-foreground">DNF</p>
            <p className="text-xs font-bold text-red-500">{dnfCount}</p>
          </div>
        </div>

        {/* Team Contribution */}
        {contributionPercent !== null ? (
          <div className={cn(
            "p-1.5 rounded-md",
            isGlass ? "bg-white/5" : "bg-muted"
          )}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[7px] text-muted-foreground">Team ({teamPoints} pts)</span>
              <span className="text-[10px] font-bold">{contributionPercent}%</span>
            </div>
            <Progress 
              value={contributionPercent} 
              className="h-1"
              indicatorStyle={{ backgroundColor: teamColor }}
            />
          </div>
        ) : (
          <div className={cn(
            "p-1.5 rounded-md flex items-center justify-center",
            isGlass ? "bg-white/5" : "bg-muted"
          )}>
            <span className="text-[7px] text-muted-foreground">No team data</span>
          </div>
        )}
      </div>

      {/* Personal Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="font-medium text-sm text-muted-foreground mb-2">Personal</h4>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Born:</span>
              <span>{driver.Driver.dateOfBirth || "Unknown"} ({age})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nationality:</span>
              <span>{driver.Driver.nationality}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Number:</span>
              <span>#{displayDriverNumber}</span>
            </div>
          </div>
        </div>
        
        <div>
          <h4 className="font-medium text-sm text-muted-foreground mb-2">Season {season}</h4>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Position:</span>
              <span className="font-semibold">P{driver.position}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Races:</span>
              <span>{totalRaces}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Team:</span>
              <span className="truncate max-w-[100px]">{currentConstructor?.name || 'Unknown'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Race History with Tabs - Always visible */}
      {pointsHistory.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Race History ({totalRaces} races)</span>
          </div>
          <Tabs defaultValue="chart">
            <TabsList className="w-full h-7 p-0.5">
              <TabsTrigger value="chart" className="flex-1 text-[10px] h-6 gap-1 px-2">
                <BarChart3 className="h-2.5 w-2.5" />
                Chart
              </TabsTrigger>
              <TabsTrigger value="list" className="flex-1 text-[10px] h-6 gap-1 px-2">
                <List className="h-2.5 w-2.5" />
                List
              </TabsTrigger>
            </TabsList>
            
            {/* Chart View */}
            <TabsContent value="chart" className="mt-1">
              <PositionProgressionChart 
                history={pointsHistory} 
                teamColor={teamColor} 
                isGlass={isGlass} 
              />
            </TabsContent>
              
              {/* List View */}
              <TabsContent value="list" className="mt-2">
                <div className={cn(
                  "max-h-48 overflow-auto rounded-lg p-2 space-y-1.5",
                  isGlass ? "bg-white/5" : "bg-muted/50"
                )}>
                  {pointsHistory.map((race) => {
                    const pos = Number(race.position);
                    const isPodium = pos <= 3;
                    const isWin = pos === 1;
                    const displayName = getRaceNameWithoutEmoji(race.raceName);
                    
                    return (
                      <div 
                        key={`${race.round}-${race.raceName}`} 
                        className={cn(
                          "flex items-center justify-between text-sm p-2 rounded",
                          isGlass ? "hover:bg-white/5" : "hover:bg-muted",
                          isPodium && "border-l-2",
                          isWin && "border-l-yellow-500",
                          pos === 2 && "border-l-gray-400",
                          pos === 3 && "border-l-amber-600"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <CountryFlag country={race.country || ''} size={14} svg={true} />
                          <span className={cn(
                            "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold shrink-0",
                            isWin && "bg-yellow-500 text-yellow-950",
                            pos === 2 && "bg-gray-300 text-gray-800",
                            pos === 3 && "bg-amber-600 text-amber-50",
                            pos > 3 && "bg-muted text-muted-foreground"
                          )}>
                            {race.round}
                          </span>
                          <div className="truncate">
                            <p className="truncate font-medium text-xs">{displayName}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {race.date}{race.position ? ` • P${race.position}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className={cn(
                          "ml-2 shrink-0 font-semibold text-xs",
                          race.points > 0 ? "text-green-500" : "text-muted-foreground"
                        )}>
                          {race.points > 0 ? `+${race.points}` : "0"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>
            </Tabs>
        </div>
      )}

      {/* Wikipedia Link */}
      {driver.Driver.url && (
        <a 
          href={driver.Driver.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className={cn(
            "block text-center text-sm py-2 rounded-lg transition-colors",
            isGlass 
              ? "bg-white/5 hover:bg-white/10 text-primary" 
              : "bg-muted hover:bg-accent text-primary"
          )}
        >
          View Wikipedia Profile →
        </a>
      )}
    </div>
  );

  return (
    <>
      <F1Card
        variant={isGlass ? "glass" : "default"}
        glassVariant={isGlass ? "panel" : "default"}
        className={cn(
          "overflow-hidden border-t-4 p-0 hover:shadow-md transition-shadow",
          isGlass ? "border-white/10" : "border-border"
        )}
        style={{ borderTopColor: teamColor }}
      >
        <F1CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <Avatar className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: teamColor }}>
              {cachedImageUrl && (
                <AvatarImage 
                  src={cachedImageUrl} 
                  alt={`${driver.Driver.givenName} ${driver.Driver.familyName}`} 
                />
              )}
              <AvatarFallback style={{ backgroundColor: teamColor }}>
                {imageLoading ? '...' : (driver.Driver.code?.slice(0, 2) || driver.Driver.familyName.slice(0, 2))}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-lg font-bold">{driver.Driver.givenName} {driver.Driver.familyName}</h3>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: teamColor }}></span>
                {currentConstructor?.name || 'Unknown Team'}
                <span className="ml-1 text-xs font-medium">#{displayDriverNumber}</span>

              </p>
            </div>
          </div>
          <Badge variant="outline" className={cn("bg-card", isGlass && "bg-white/10 border-white/20")}>
            P{driver.position}
          </Badge>
        </F1CardHeader>
        <F1CardContent className="pb-2">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground">Points</p>
              <p className="font-semibold">{driver.points}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Wins</p>
              <p className="font-semibold flex items-center gap-1">
                {wins > 0 && <Trophy className="h-3 w-3 text-yellow-500" />}
                {wins}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Nationality</p>
              <p className="font-semibold">{driver.Driver.nationality}</p>
            </div>
            {contributionPercent !== null && (
              <div>
                <p className="text-muted-foreground">Team Contrib.</p>
                <p className="font-semibold">{contributionPercent}%</p>
              </div>
            )}
          </div>
        </F1CardContent>
        <F1CardFooter className="border-t-0 pt-2">
          <Button 
            variant="outline" 
            className={cn("w-full", isGlass && "bg-white/5 border-white/20 hover:bg-white/10")}
            size="sm"
            onClick={() => setShowDetails(true)}
          >
            <Info className="h-4 w-4 mr-2" /> Driver Details
          </Button>
        </F1CardFooter>
      </F1Card>

      {isMobile ? (
        <Drawer open={showDetails} onOpenChange={setShowDetails}>
          <DrawerContent 
            className={cn(
              "mx-auto w-full max-w-md rounded-t-lg max-h-[85vh] p-0",
              isGlass && "border-white/10 glass-panel"
            )}
          >
            <DrawerHeader className="relative px-4 py-3 border-b sticky top-0 bg-background z-10">
              <DrawerClose asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute right-4 top-3 h-6 w-6"
                  onClick={() => setShowDetails(false)}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </DrawerClose>
              <DrawerTitle className="flex items-center gap-2 pr-8 text-base">
                <span 
                  className="inline-block w-4 h-4 rounded-full"
                  style={{ backgroundColor: teamColor }}
                ></span>
                {driver.Driver.givenName} {driver.Driver.familyName}
              </DrawerTitle>
              <DrawerDescription className="text-xs">
                {currentConstructor?.name || 'Unknown Team'} | #{displayDriverNumber}
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-4 overflow-y-auto max-h-[calc(85vh-56px)]">
              <DetailContent />
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogContent 
            className={cn(
              "sm:max-w-[640px] max-h-[90vh] overflow-y-auto",
              isGlass && "border-white/10 glass-panel"
            )}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 pr-8">
                <span 
                  className="inline-block w-4 h-4 rounded-full"
                  style={{ backgroundColor: teamColor }}
                ></span>
                {driver.Driver.givenName} {driver.Driver.familyName}
              </DialogTitle>
              <DialogDescription>
                {currentConstructor?.name || 'Unknown Team'} | #{displayDriverNumber}
              </DialogDescription>
            </DialogHeader>
            <DetailContent />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default DriverCard;

