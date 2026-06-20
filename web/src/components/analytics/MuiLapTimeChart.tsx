import React, { useState, useEffect, useMemo, useCallback } from "react";
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
import { Loader2, Clock, Wrench } from "lucide-react";
import { useLapTimeData, Driver } from "@/hooks/useLapTimeData";
import DriverSelector from "./DriverSelector";
import DisplayModeToggle from "./DisplayModeToggle";
import { F1ChartLoading } from "@/components/charts/F1ChartLoading";
import { F1ChartEmpty } from "@/components/charts/F1ChartEmpty";
import { F1ErrorState } from "@/components/f1/F1ErrorState";
import { useTheme } from "@/context/ThemeContext";
import { getPitStops } from "@/services/f1Service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const [pitStopsLoading, setPitStopsLoading] = useState(false);
  const { baseTheme } = useTheme();
  const isDark = baseTheme === 'dark';

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
    hoveredDriver,
    isLoading,
    isError,
    loadingProgress,
    errorMessage,
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
  const { muiChartData, yAxisMin, yAxisMax, teammateIndices } = useMemo(() => {
    if (!chartData.length) return { muiChartData: { xAxisData: [], series: [] }, yAxisMin: 0, yAxisMax: 100, teammateIndices: [] };

    const xAxisData = chartData.map(d => d.lap);
    
    const visibleDriversData = availableDrivers.filter(d => visibleDrivers.includes(d.code));
    
    // Calculate min and max values for Y-axis from visible drivers' data
    let allValues: number[] = [];
    
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
        color: TEAM_COLORS[driver.team] || DRIVER_COLORS[driver.code] || "#666",
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
        color: TEAM_COLORS[driver.team] || DRIVER_COLORS[driver.code] || "#666",
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


  // Render loading state with progress indicator
  if (isLoading) {
    return (
      <div className="min-h-[350px] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center justify-center space-y-3 max-w-xs">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <div className="w-full space-y-2 text-center">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <span>Loading lap times</span>
              <span className="font-mono text-xs">{loadingProgress}%</span>
            </div>
            <Progress value={loadingProgress} className="h-1.5 w-full" />
            {retryCount > 0 && (
              <p className="text-[10px] text-muted-foreground">
                Rate limited. Retry {retryCount}/15
              </p>
            )}
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
          title="Unable to Load Lap Times"
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
          title="No Lap Time Data"
          message="Lap time data is not available for this race. This may be because the race hasn't occurred yet."
          icon={<Clock className="h-12 w-12 text-muted-foreground" />}
        />
      </div>
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
      <div className="rounded-md border border-border bg-background/95 px-2 py-1.5 text-[11px] shadow-md">
        <div className="font-mono text-muted-foreground mb-1">Lap {label}</div>
        {rows.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.stroke }} />
            <span className="font-bold w-9">{p.dataKey}</span>
            <span className="font-mono">{formatTime(p.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
      <div className="h-full flex flex-col">
        <div className="flex flex-row gap-1.5 items-center mb-2">
          <DisplayModeToggle displayMode={displayMode} onToggle={toggleDisplayMode} />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPitStops(!showPitStops)}
            className={cn(
              "h-6 gap-1 text-[10px] px-2",
              showPitStops 
                ? "bg-zinc-700/50 text-zinc-200 hover:bg-zinc-700/70" 
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            )}
          >
            <Wrench className="h-3 w-3" />
            Pits
            {visiblePitStops.length > 0 && (
              <span className="text-[9px] text-zinc-400">({visiblePitStops.length})</span>
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
        
        <div className="flex-1 mt-2 min-h-0">
          {lines.length > 0 && (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <LineChart
                data={chartData}
                margin={{ top: 10, right: isMobile ? 10 : 20, bottom: 25, left: isMobile ? 5 : 10 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke={isDark ? '#333' : '#e5e5e5'}
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="lap"
                  type="number"
                  domain={[1, maxLap]}
                  allowDecimals={false}
                  tickLine={false}
                  tick={{ fontSize: isMobile ? 10 : 11, fill: isDark ? '#a1a1aa' : '#666' }}
                />
                <YAxis
                  domain={displayMode === 'gap' ? [0, 'auto'] : [yAxisMin, yAxisMax]}
                  tickFormatter={formatTime}
                  width={isMobile ? 52 : 62}
                  tickLine={false}
                  tick={{ fontSize: isMobile ? 10 : 11, fill: isDark ? '#a1a1aa' : '#666' }}
                />
                <Tooltip content={<LapTooltip />} />
                {fastestLapTime && displayMode === 'absolute' && (
                  <ReferenceLine
                    y={fastestLapTime.time}
                    stroke="#c026d3"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: `FL ${formatTime(fastestLapTime.time)} (${fastestLapTime.driver})`,
                      position: 'insideTopRight',
                      fontSize: 10,
                      fill: '#c026d3',
                    }}
                  />
                )}
                {showPitStops && pitStopsByLap.map((ps) => {
                  const color = ps.teams[0] ? (TEAM_COLORS[ps.teams[0]] || '#f59e0b') : '#f59e0b';
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
                        fontSize: 9,
                        fill: color,
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

export default MuiLapTimeChart;
