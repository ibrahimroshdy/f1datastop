import React, { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";
import { Progress } from "@/components/ui/progress";
import { Loader2, TrendingUp, Wrench } from "lucide-react";
import { usePositionChangeData } from "@/hooks/usePositionChangeData";
import DriverSelectionGrid from "./charts/DriverSelectionGrid";
import { F1ChartEmpty } from "@/components/charts/F1ChartEmpty";
import { F1ErrorState } from "@/components/f1/F1ErrorState";
import { getPitStops } from "@/services/f1Service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MuiPositionChartProps {
  year: number;
  round: string;
}

interface PitStopData {
  driver: string;
  lap: number;
  duration: string;
  stop?: number;
}

const MuiPositionChart: React.FC<MuiPositionChartProps> = ({ year, round }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [showPitStops, setShowPitStops] = useState(true);
  const [pitStops, setPitStops] = useState<PitStopData[]>([]);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch pit stop data
  useEffect(() => {
    const fetchPitStops = async () => {
      try {
        const response = await getPitStops(year, round);
        if (response?.data?.Races?.[0]?.PitStops) {
          const stopsByDriver: { [driver: string]: number } = {};
          const pitStopData = response.data.Races[0].PitStops.map((ps: any) => {
            const driverId = ps.driverId;
            stopsByDriver[driverId] = (stopsByDriver[driverId] || 0) + 1;
            return {
              driver: driverId,
              lap: parseInt(ps.lap, 10),
              duration: ps.duration,
              stop: stopsByDriver[driverId],
            };
          });
          setPitStops(pitStopData);
        } else {
          setPitStops([]);
        }
      } catch (error) {
        console.error('Error fetching pit stops:', error);
        setPitStops([]);
      }
    };

    if (year && round) {
      fetchPitStops();
    }
  }, [year, round]);

  const {
    chartData,
    availableDrivers,
    selectedDrivers,
    visibleDrivers,
    isLoading,
    isError,
    loadingProgress,
    maxLap,
    handleDriverToggle,
    handleDriverHover,
    getPositionChangeSummary,
  } = usePositionChangeData(year, round);

  // Map driver IDs to codes and team colors for matching
  const driverIdToInfo = useMemo(() => {
    const map: { [id: string]: { code: string; team: string } } = {};
    availableDrivers.forEach(d => {
      map[d.driverId.toLowerCase()] = { code: d.code, team: d.team };
      map[d.code.toLowerCase()] = { code: d.code, team: d.team };
    });
    return map;
  }, [availableDrivers]);

  // Recharts line descriptors: one per visible driver, second teammate dashed.
  const lines = useMemo(() => {
    const visibleDriversData = availableDrivers.filter(d => visibleDrivers.includes(d.code));
    const teamCounts: { [team: string]: number } = {};
    return visibleDriversData.map(driver => {
      const teamCount = teamCounts[driver.team] || 0;
      teamCounts[driver.team] = teamCount + 1;
      return {
        code: driver.code,
        color: TEAM_COLORS[driver.team] || DRIVER_COLORS[driver.code] || "#666",
        dashed: teamCount > 0,
      };
    });
  }, [availableDrivers, visibleDrivers]);

  // Max position for Y-axis upper bound (positions are inverted: P1 at top).
  const maxPosition = useMemo(() => {
    let max = 1;
    const visibleCodes = availableDrivers
      .filter(d => visibleDrivers.includes(d.code))
      .map(d => d.code);
    chartData.forEach(d => {
      visibleCodes.forEach(code => {
        const val = d[code] as number | null | undefined;
        if (val != null && !isNaN(val as number) && (val as number) > max) {
          max = val as number;
        }
      });
    });
    return Math.max(max, 20);
  }, [chartData, availableDrivers, visibleDrivers]);

  // Get pit stops for visible drivers only with enriched data
  const visiblePitStops = useMemo(() => {
    if (!showPitStops || pitStops.length === 0) return [];
    
    const visibleCodes = visibleDrivers.map(code => code.toLowerCase());
    
    return pitStops.filter(ps => {
      const info = driverIdToInfo[ps.driver.toLowerCase()];
      return info && visibleCodes.includes(info.code.toLowerCase());
    }).map(ps => {
      const info = driverIdToInfo[ps.driver.toLowerCase()];
      return {
        ...ps,
        driverCode: info?.code || ps.driver,
        team: info?.team || '',
      };
    });
  }, [pitStops, visibleDrivers, driverIdToInfo, showPitStops]);

  // Group pit stops by lap with driver info
  const pitStopsByLap = useMemo(() => {
    const lapsMap = new Map<number, { 
      drivers: string[]; 
      teams: string[]; 
      stops: number[]; 
      durations: string[];
    }>();
    
    visiblePitStops.forEach(ps => {
      const existing = lapsMap.get(ps.lap) || { drivers: [], teams: [], stops: [], durations: [] };
      existing.drivers.push(ps.driverCode);
      existing.teams.push(ps.team);
      existing.stops.push(ps.stop || 1);
      existing.durations.push(ps.duration);
      lapsMap.set(ps.lap, existing);
    });
    
    return Array.from(lapsMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([lap, info]) => ({ lap, ...info }));
  }, [visiblePitStops]);

  // Render loading state with progress indicator
  if (isLoading) {
    return (
      <div className="min-h-[350px] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center justify-center space-y-3 max-w-xs">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <div className="w-full space-y-2 text-center">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <span>Loading positions</span>
              <span className="font-mono text-xs">{loadingProgress}%</span>
            </div>
            <Progress value={loadingProgress} className="h-1.5 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // Handle error state
  if (isError && chartData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <F1ErrorState
          type="rate-limit"
          title="Unable to Load Position Data"
          message="The F1 API rate limit was reached. Please wait a moment and try again."
          variant="card"
        />
      </div>
    );
  }

  // Handle no data state
  if (chartData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <F1ChartEmpty
          chartType="line"
          title="No Position Data"
          message="Position data is not available for this race."
          icon={<TrendingUp className="h-12 w-12 text-muted-foreground" />}
        />
      </div>
    );
  }

  const chartHeight = isMobile ? 220 : 280;

  // Custom tooltip mirroring the old MUI hover (sorted by position, P1 first).
  const PositionTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const rows = payload
      .filter((p: any) => p.value != null)
      .sort((a: any, b: any) => a.value - b.value);
    if (!rows.length) return null;
    return (
      <div className="rounded-md border border-border bg-background/95 px-2 py-1.5 text-[11px] shadow-md">
        <div className="font-mono text-muted-foreground mb-1">Lap {label}</div>
        {rows.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.stroke }} />
            <span className="font-bold w-9">{p.dataKey}</span>
            <span className="font-mono">P{p.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
      <div className="h-full flex flex-col">
        {/* Pit stop toggle */}
        <div className="flex justify-end mb-2">
          <Button
            variant={showPitStops ? "default" : "outline"}
            size="sm"
            onClick={() => setShowPitStops(!showPitStops)}
            className="h-7 gap-1.5 text-xs"
          >
            <Wrench className="h-3.5 w-3.5" />
            Pit Stops
            {visiblePitStops.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 text-[10px] px-1.5">
                {visiblePitStops.length}
              </Badge>
            )}
          </Button>
        </div>

        {/* Pit stops summary for visible drivers */}
        {showPitStops && visiblePitStops.length > 0 && (
          <div className={cn(
            "flex flex-wrap gap-1 mb-2 p-1.5 rounded-md text-[9px]",
            "bg-muted/30 border border-border"
          )}>
            {Object.entries(
              visiblePitStops.reduce((acc, ps) => {
                if (!acc[ps.driverCode]) acc[ps.driverCode] = [];
                acc[ps.driverCode].push(ps);
                return acc;
              }, {} as { [driver: string]: typeof visiblePitStops })
            ).map(([driver, stops]) => {
              const team = stops[0]?.team || '';
              const teamColor = TEAM_COLORS[team] || '#666';
              return (
                <div 
                  key={driver} 
                  className={cn(
                    "flex items-center gap-1 px-1.5 py-0.5 rounded",
                    "bg-card border border-border"
                  )}
                  style={{ borderLeft: `2px solid ${teamColor}` }}
                >
                  <span className="font-bold">{driver}</span>
                  <span className="text-muted-foreground">:</span>
                  {stops.sort((a, b) => (a.stop || 1) - (b.stop || 1)).map((stop, i) => (
                    <span key={i} className="flex items-center gap-0.5">
                      <span className="text-muted-foreground">P{stop.stop || i+1}</span>
                      <span className="font-mono text-amber-500">L{stop.lap}</span>
                      <span className="font-mono text-emerald-500">{stop.duration}s</span>
                      {i < stops.length - 1 && <span className="text-muted-foreground mx-0.5">|</span>}
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Driver selection grid */}
        <DriverSelectionGrid
          availableDrivers={availableDrivers}
          selectedDrivers={selectedDrivers}
          onDriverToggle={handleDriverToggle}
          onDriverHover={handleDriverHover}
          getPositionChangeSummary={getPositionChangeSummary}
        />
        
        <div className="flex-1 mt-2 min-h-0">
          {lines.length > 0 && (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <LineChart
                data={chartData}
                margin={{
                  top: 10,
                  right: isMobile ? 10 : 20,
                  bottom: 35,
                  left: isMobile ? 35 : 45,
                }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="hsl(var(--chart-grid))"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="lap"
                  type="number"
                  domain={[0, maxLap]}
                  allowDecimals={false}
                  tickLine={false}
                  tick={{ fontSize: isMobile ? 10 : 11, fill: 'hsl(var(--chart-axis))' }}
                />
                <YAxis
                  reversed
                  domain={[1, maxPosition]}
                  allowDecimals={false}
                  tickCount={10}
                  width={isMobile ? 35 : 45}
                  tickLine={false}
                  tick={{ fontSize: isMobile ? 10 : 11, fill: 'hsl(var(--chart-axis))' }}
                />
                <Tooltip content={<PositionTooltip />} />
                {showPitStops && pitStopsByLap.map((ps) => {
                  const color = ps.teams[0] ? (TEAM_COLORS[ps.teams[0]] || '#f59e0b') : '#f59e0b';
                  const label = ps.drivers.map((d, i) => `${d}:P${ps.stops[i]}`).join(' ');
                  return (
                    <ReferenceLine
                      key={`pit-${ps.lap}`}
                      x={ps.lap}
                      stroke={color}
                      strokeDasharray="2 4"
                      strokeWidth={1.5}
                      strokeOpacity={0.7}
                      label={{
                        value: label,
                        position: 'insideBottomLeft',
                        angle: -90,
                        fontSize: 7,
                        fontWeight: 600,
                        fill: color,
                      }}
                    />
                  );
                })}
                {lines.map((ln) => (
                  <Line
                    key={ln.code}
                    type="stepAfter"
                    dataKey={ln.code}
                    stroke={ln.color}
                    strokeWidth={2}
                    strokeDasharray={ln.dashed ? '5 3' : undefined}
                    dot={false}
                    activeDot={{ r: 3 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
  );
};

export default MuiPositionChart;
