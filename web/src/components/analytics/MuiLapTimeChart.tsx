import React, { useState, useEffect, useMemo } from 'react';
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
import { Clock, Wrench } from "lucide-react";
import { useLapTimeData } from '@/hooks/useLapTimeData';
import DriverSelector from "./DriverSelector";
import DisplayModeToggle from "./DisplayModeToggle";
import { F1ChartContainer } from "@/components/f1";
import { getPitStops } from "@/services/f1Service";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { chartTheme, ScopeDefs, SCOPE_GLOW } from "@/lib/chartTheme";

interface MuiLapTimeChartProps {
  year: number;
  round: string;
}

interface PitStopData {
  driver: string;
  lap: number;
  duration: string;
  team?: string;
  stop?: number; // Pit stop number (1, 2, 3...)
}

const MuiLapTimeChart: React.FC<MuiLapTimeChartProps> = ({ year, round }) => {
  const [displayMode, setDisplayMode] = useState<'absolute' | 'gap'>('absolute');
  const [isMobile, setIsMobile] = useState(false);
  const [showPitStops, setShowPitStops] = useState(true);
  const [pitStops, setPitStops] = useState<PitStopData[]>([]);
  const [, setPitStopsLoading] = useState(false);

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
      setPitStopsLoading(true);
      try {
        const response = await getPitStops(year, round);
        if (response?.data?.Races?.[0]?.PitStops) {
          // Group by driver to assign stop numbers
          const stopsByDriver: { [driver: string]: number } = {};
          const pitStopData = response.data.Races[0].PitStops.map((ps: any) => {
            const driverId = ps.driverId;
            stopsByDriver[driverId] = (stopsByDriver[driverId] || 0) + 1;
            return {
              driver: driverId,
              lap: parseInt(ps.lap, 10),
              duration: ps.duration,
              stop: stopsByDriver[driverId],
              team: '',
            };
          });
          setPitStops(pitStopData);
        } else {
          setPitStops([]);
        }
      } catch (error) {
        console.error('Error fetching pit stops:', error);
        setPitStops([]);
      } finally {
        setPitStopsLoading(false);
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
    fastestLapTime,
    handleDriverToggle,
    handleDriverHover,
    getAverageTime,
    retryCount,
  } = useLapTimeData(year, round, displayMode);

  const toggleDisplayMode = () => {
    setDisplayMode(prev => prev === 'absolute' ? 'gap' : 'absolute');
  };

  // Map driver IDs to codes and team colors for matching
  const driverIdToInfo = useMemo(() => {
    const map: { [id: string]: { code: string; team: string } } = {};
    availableDrivers.forEach(d => {
      map[d.driverId.toLowerCase()] = { code: d.code, team: d.team };
      map[d.code.toLowerCase()] = { code: d.code, team: d.team };
    });
    return map;
  }, [availableDrivers]);

  // Transform data for MUI X Charts and calculate Y-axis bounds
  const { yAxisMin, yAxisMax } = useMemo(() => {
    if (!chartData.length) return { muiChartData: { xAxisData: [], series: [] }, yAxisMin: 0, yAxisMax: 100, teammateIndices: [] };

    const xAxisData = chartData.map(d => d.lap);
    
    const visibleDriversData = availableDrivers.filter(d => visibleDrivers.includes(d.code));
    
    // Calculate min and max values for Y-axis from visible drivers' data
    const allValues: number[] = [];
    
    // Track teammates - second driver from same team gets dashed line
    const teamDriverCounts: { [team: string]: number } = {};
    const secondTeammateIdx: number[] = [];
    
    const series = visibleDriversData.map((driver, idx) => {
      const data = chartData.map(d => {
        const val = d[driver.code] as number | null;
        if (val !== null && val !== undefined && !isNaN(val)) {
          allValues.push(val);
        }
        return val;
      });
      
      // Check if this is a second teammate
      const teamCount = teamDriverCounts[driver.team] || 0;
      teamDriverCounts[driver.team] = teamCount + 1;
      
      if (teamCount > 0) {
        secondTeammateIdx.push(idx);
      }
      
      return {
        data,
        label: driver.code,
        color: TEAM_COLORS[driver.team] || DRIVER_COLORS[driver.code] || TEAM_COLORS.default,
        showMark: false,
        curve: 'linear' as const,
        connectNulls: true,
      };
    });

    // Calculate appropriate Y-axis bounds with padding
    let minVal = allValues.length > 0 ? Math.min(...allValues) : 60;
    let maxVal = allValues.length > 0 ? Math.max(...allValues) : 120;
    
    // Add 5% padding
    const range = maxVal - minVal;
    const padding = range * 0.05;
    minVal = Math.max(0, minVal - padding);
    maxVal = maxVal + padding;

    return {
      muiChartData: { xAxisData, series },
      yAxisMin: minVal,
      yAxisMax: maxVal,
      teammateIndices: secondTeammateIdx,
    };
  }, [chartData, availableDrivers, visibleDrivers]);

  // Recharts line descriptors: one per visible driver, second teammate dashed.
  const lines = useMemo(() => {
    const visibleDriversData = availableDrivers.filter(d => visibleDrivers.includes(d.code));
    const teamCounts: { [team: string]: number } = {};
    return visibleDriversData.map(driver => {
      const teamCount = teamCounts[driver.team] || 0;
      teamCounts[driver.team] = teamCount + 1;
      return {
        code: driver.code,
        color: TEAM_COLORS[driver.team] || DRIVER_COLORS[driver.code] || TEAM_COLORS.default,
        dashed: teamCount > 0,
      };
    });
  }, [availableDrivers, visibleDrivers]);
  
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
  
  // Group pit stops by lap with driver info and pit stop numbers
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


  // Loading / error / empty routed through F1ChartContainer (ChartSkeleton, F1ErrorState, F1EmptyState)
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Loading lap times • {loadingProgress}%
          {retryCount > 0 ? ` • rate-limited retry ${retryCount}/15` : ""}
        </p>
        <F1ChartContainer isLoading useSkeleton minHeight={300} />
      </div>
    );
  }

  if (isError && chartData.length === 0) {
    return (
      <F1ChartContainer
        minHeight={300}
        error="The F1 API rate limit was reached. Please wait a moment and try again."
      />
    );
  }

  if (chartData.length === 0) {
    return (
      <F1ChartContainer
        minHeight={300}
        isEmpty
        emptyTitle="No Lap Time Data"
        emptyDescription="Lap time data is not available for this race. This may be because the race hasn't occurred yet."
      />
    );
  }

  // Format time for Y-axis (MM:SS.s format)
  const formatTime = (value: number) => {
    if (displayMode === 'absolute') {
      const mins = Math.floor(value / 60);
      const secs = (value % 60).toFixed(1);
      return `${mins}:${secs.padStart(4, '0')}`;
    } else {
      return `+${value.toFixed(1)}s`;
    }
  };

  // Calculate chart height based on available space
  const chartHeight = isMobile ? 220 : 280;

  // Custom tooltip mirroring the old MUI hover (sorted fastest-first, formatted time)
  const LapTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const rows = payload
      .filter((p: any) => p.value != null)
      .sort((a: any, b: any) => a.value - b.value);
    if (!rows.length) return null;
    return (
      <div className="rounded-lg border border-border bg-card px-2 py-1.5 font-mono text-xs shadow-card">
        <div className="mb-1 font-mono uppercase tracking-widest text-muted-foreground">
          Lap {label}
        </div>
        {rows.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.stroke }} />
            <span className="w-9 font-mono font-bold text-foreground">{p.dataKey}</span>
            <span className="font-mono tabular-nums text-foreground">{formatTime(p.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
      <div className="flex h-full flex-col gap-2">
        <div className="flex flex-row items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Pace
          </span>
          <DisplayModeToggle displayMode={displayMode} onToggle={toggleDisplayMode} />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPitStops(!showPitStops)}
            className={cn(
              "h-7 gap-1 px-2 text-xs font-mono",
              showPitStops
                ? "bg-accent text-accent-foreground hover:bg-accent/80"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Wrench className="h-3 w-3" />
            Pits
            {visiblePitStops.length > 0 && (
              <span className="text-xs tabular-nums text-muted-foreground">({visiblePitStops.length})</span>
            )}
          </Button>
        </div>

        {/* Driver selection grid */}
        <DriverSelector
          availableDrivers={availableDrivers}
          selectedDrivers={selectedDrivers}
          onDriverToggle={handleDriverToggle}
          onDriverHover={handleDriverHover}
          displayMode={displayMode}
          fastestLapTime={fastestLapTime}
          getAverageTime={getAverageTime}
        />
        
        <F1ChartContainer
          className="min-h-0 flex-1"
          minHeight={chartHeight}
          isEmpty={lines.length === 0}
          emptyTitle="No Drivers Selected"
          emptyDescription="Select one or more drivers above to plot lap times."
        >
          {lines.length > 0 && (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <LineChart
                data={chartData}
                margin={{ top: 10, right: isMobile ? 10 : 20, bottom: 25, left: isMobile ? 5 : 10 }}
              >
                <defs>
                  <ScopeDefs id="lap" color={chartTheme.primary} />
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke={chartTheme.grid}
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="lap"
                  type="number"
                  domain={[1, maxLap]}
                  allowDecimals={false}
                  tickLine={false}
                  stroke={chartTheme.axis}
                  tick={chartTheme.tick}
                />
                <YAxis
                  domain={displayMode === 'gap' ? [0, 'auto'] : [yAxisMin, yAxisMax]}
                  tickFormatter={formatTime}
                  width={isMobile ? 52 : 62}
                  tickLine={false}
                  stroke={chartTheme.axis}
                  tick={chartTheme.tick}
                />
                <Tooltip content={<LapTooltip />} cursor={chartTheme.cursor} />
                {fastestLapTime && displayMode === 'absolute' && (
                  <ReferenceLine
                    y={fastestLapTime.time}
                    stroke="hsl(var(--primary))"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: `FL ${formatTime(fastestLapTime.time)} (${fastestLapTime.driver})`,
                      position: 'insideTopRight',
                      fontSize: 11,
                      fill: 'hsl(var(--primary))',
                      fontFamily: 'var(--font-mono, monospace)',
                    }}
                  />
                )}
                {showPitStops && pitStopsByLap.map((ps) => {
                  const color = ps.teams[0] ? (TEAM_COLORS[ps.teams[0]] || TEAM_COLORS.default) : TEAM_COLORS.default;
                  return (
                    <ReferenceLine
                      key={`pit-${ps.lap}`}
                      x={ps.lap}
                      stroke={color}
                      strokeDasharray="2 4"
                      strokeWidth={1.5}
                      strokeOpacity={0.6}
                      label={{
                        value: ps.drivers.map((d, i) => `${d} ${ps.durations[i]}s`).join(' · '),
                        position: 'insideBottomLeft',
                        angle: -90,
                        fontSize: 11,
                        fill: color,
                        fontFamily: 'var(--font-mono, monospace)',
                      }}
                    />
                  );
                })}
                {lines.map((ln) => (
                  <Line
                    key={ln.code}
                    type="linear"
                    dataKey={ln.code}
                    stroke={ln.color}
                    strokeWidth={2}
                    strokeDasharray={ln.dashed ? '5 3' : undefined}
                    filter={SCOPE_GLOW}
                    dot={false}
                    activeDot={{ r: 3 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </F1ChartContainer>
      </div>
  );
};

export default MuiLapTimeChart;
