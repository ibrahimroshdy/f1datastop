import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { Wrench } from "lucide-react";
import { useLapTimeData } from '@/hooks/useLapTimeData';
import DriverSelector from "./DriverSelector";
import DisplayModeToggle from "./DisplayModeToggle";
import { F1ChartContainer } from "@/components/f1";
import { getPitStops } from "@/services/f1Service";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { chartTheme, ScopeDefs, SCOPE_GLOW } from "@/lib/chartTheme";
import { useDbRaceControl } from "@/hooks/useWarehouse";
import { deriveSafetyPeriods } from "@/lib/f1/safetyPeriods";
import { safetyBands } from "./safetyBands";
import { SafetyLegend } from "@/components/analytics/SafetyCarBands";
import {
  getRaceReplay,
  fetchRaceReplayBlob,
  type RaceReplayBlob,
} from "@/services/raceReplayService";

interface MuiLapTimeChartProps {
  year: number;
  round: string;
  /** When a moment link (?driver=&lap=) opens the page, select this driver. */
  focusDriver?: string;
  /** When a moment link (?driver=&lap=) opens the page, highlight this lap. */
  focusLap?: number;
}

interface PitStopData {
  driver: string;
  lap: number;
  duration: string;
  team?: string;
  stop?: number; // Pit stop number (1, 2, 3...)
}

/** A single Ergast pit stop row (untyped at the service boundary). */
interface ErgastPitStop {
  driverId: string;
  lap: string;
  duration: string;
  stop: string;
}

/** Per-lap sector times for one driver (ms), keyed by driver code then lap number. */
export type SectorLap = { s1: number | null; s2: number | null; s3: number | null };
export type SectorData = { [driverCode: string]: { [lap: number]: SectorLap } };

/** Build { [driverCode]: { [lap]: {s1,s2,s3} } } from a race replay blob.
 *  Silent-degradation friendly: missing codes/laps are skipped, null sectors stay null. */
export function buildSectorData(blob: RaceReplayBlob): SectorData {
  const data: SectorData = {};
  for (const driver of blob.drivers) {
    if (!driver.code || !driver.laps || driver.laps.length === 0) continue;
    data[driver.code] = {};
    for (const lap of driver.laps) {
      data[driver.code][lap.n] = {
        s1: lap.s1 ?? null,
        s2: lap.s2 ?? null,
        s3: lap.s3 ?? null,
      };
    }
  }
  return data;
}

const MuiLapTimeChart: React.FC<MuiLapTimeChartProps> = ({
  year,
  round,
  focusDriver,
  focusLap,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [displayMode, setDisplayMode] = useState<'absolute' | 'gap'>('absolute');
  const [isMobile, setIsMobile] = useState(false);
  const [showPitStops, setShowPitStops] = useState(true);
  const [pitStops, setPitStops] = useState<PitStopData[]>([]);
  const [, setPitStopsLoading] = useState(false);

  // Per-lap sector times (S1/S2/S3, ms) for the selected drivers, sourced from
  // the race replay blob (CDN-first, silent degradation when unavailable).
  const [sectorData, setSectorData] = useState<SectorData | null>(null);

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
          const pitStopData = response.data.Races[0].PitStops.map((ps: ErgastPitStop) => {
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

  // Fetch per-lap sector times from the race replay blob (CDN-first via
  // getRaceReplay / fetchRaceReplayBlob). Errors or missing blobs leave
  // sectorData null so the chart renders exactly as before.
  useEffect(() => {
    let cancelled = false;
    const fetchSectors = async () => {
      if (!year || !round) {
        setSectorData(null);
        return;
      }
      try {
        const index = await getRaceReplay(year, parseInt(round, 10), "R");
        if (!index?.public_url) {
          if (!cancelled) setSectorData(null);
          return;
        }
        const blob = await fetchRaceReplayBlob(index.public_url);
        if (!cancelled) setSectorData(buildSectorData(blob));
      } catch {
        if (!cancelled) setSectorData(null);
      }
    };
    fetchSectors();
    return () => {
      cancelled = true;
    };
  }, [year, round]);

  const {
    chartData,
    availableDrivers,
    selectedDrivers,
    setSelectedDrivers,
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
  } = useLapTimeData(year, round, displayMode, focusDriver);

  // When a moment link focuses a driver, select it (replacing the default
  // winner selection). useLapTimeData skips its own auto-selection while
  // focusDriver is set, so this is the single source of truth here.
  useEffect(() => {
    if (focusDriver) {
      setSelectedDrivers([focusDriver]);
    }
  }, [focusDriver, setSelectedDrivers]);

  // Scroll the chart container to bring the focused lap into view.
  useEffect(() => {
    if (focusLap == null || !chartRef.current || !maxLap || maxLap < 2) return;
    const container = chartRef.current;
    const scrollable = container.scrollWidth - container.clientWidth;
    if (scrollable <= 0) return;
    const progress = (focusLap - 1) / (maxLap - 1);
    container.scrollLeft = Math.round(progress * scrollable);
  }, [focusLap, maxLap]);

  const toggleDisplayMode = () => {
    setDisplayMode(prev => prev === 'absolute' ? 'gap' : 'absolute');
  };

  // Safety-car / VSC / red-flag lap-range bands from race-control messages.
  const { data: raceControl } = useDbRaceControl(year, parseInt(round, 10), "R");
  const safety = useMemo(() => deriveSafetyPeriods(raceControl), [raceControl]);

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

  // Format time as F1-standard m:ss.mmm (never rounded to whole/tenths).
  const formatTime = (value: number) => {
    if (displayMode === 'absolute') {
      const mins = Math.floor(value / 60);
      const secs = (value % 60).toFixed(3);
      return `${mins}:${secs.padStart(6, '0')}`;
    } else {
      return `+${value.toFixed(3)}s`;
    }
  };

  // Format a sector time (ms) as s.mmm.
  const formatSector = (ms: number | null) => {
    if (ms == null) return "–";
    return (ms / 1000).toFixed(3);
  };

  // Fastest-sector cell: highlights the minimum sector of the lap using the
  // --fastest-lap token color (never a raw hex).
  const SectorCell = ({
    value,
    isFastest,
  }: {
    value: number | null;
    isFastest: boolean;
  }) => {
    return (
      <span
        className="font-mono tabular-nums"
        style={{
          color: isFastest ? "hsl(var(--fastest-lap))" : undefined,
          fontWeight: isFastest ? "bold" : undefined,
        }}
      >
        {formatSector(value)}
      </span>
    );
  };

  // Calculate chart height based on available space
  const chartHeight = isMobile ? 220 : 280;

  // Custom tooltip mirroring the old MUI hover (sorted fastest-first, formatted time)
  type TipItem = {
    dataKey: string | number;
    value: number;
    color?: string;
    stroke?: string;
  };
  const LapTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: TipItem[];
    label?: string | number;
  }) => {
    if (!active || !payload?.length) return null;
    const rows = payload
      .filter((p) => p.value != null)
      .sort((a, b) => a.value - b.value);
    if (!rows.length) return null;
    return (
      <div className="rounded-lg border border-border bg-card px-2 py-1.5 font-mono text-xs shadow-card">
        <div className="mb-1 font-mono uppercase tracking-widest text-muted-foreground">
          Lap {label}
        </div>
        {rows.map((p) => (
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

        {/* Compact per-lap sector times for the selected drivers.
            Fastest sector of each lap is highlighted with --fastest-lap.
            Renders nothing when the replay blob is unavailable. */}
        {sectorData && Object.keys(sectorData).length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Sector times
            </span>
            {selectedDrivers.map((driverCode) => {
              const laps = sectorData[driverCode];
              if (!laps) return null;
              const driver = availableDrivers.find((d) => d.code === driverCode);
              const color = driver
                ? TEAM_COLORS[driver.team] ||
                    DRIVER_COLORS[driver.code] ||
                    TEAM_COLORS.default
                : TEAM_COLORS.default;
              const lapNumbers = Object.keys(laps)
                .map(Number)
                .sort((a, b) => a - b);
              return (
                <div key={driverCode} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="font-mono text-xs font-bold">
                      {driverCode}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-[180px] overflow-y-auto">
                    {lapNumbers.map((lap) => {
                      const s = laps[lap];
                      const vals = [s.s1, s.s2, s.s3].filter(
                        (v): v is number => v != null,
                      );
                      const fastest =
                        vals.length > 0 ? Math.min(...vals) : null;
                      return (
                        <div
                          key={lap}
                          className="flex items-center gap-1 font-mono text-[10px] tabular-nums"
                        >
                          <span className="w-5 text-muted-foreground">
                            L{lap}
                          </span>
                          <SectorCell
                            value={s.s1}
                            isFastest={s.s1 != null && s.s1 === fastest}
                          />
                          <span className="text-muted-foreground">·</span>
                          <SectorCell
                            value={s.s2}
                            isFastest={s.s2 != null && s.s2 === fastest}
                          />
                          <span className="text-muted-foreground">·</span>
                          <SectorCell
                            value={s.s3}
                            isFastest={s.s3 != null && s.s3 === fastest}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <F1ChartContainer
          ref={chartRef}
          className="min-h-0 flex-1 overflow-x-auto"
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
                {safetyBands(safety)}
                {focusLap != null && maxLap > 0 && (
                  <ReferenceLine
                    x={Math.max(1, Math.min(focusLap, maxLap))}
                    stroke="hsl(var(--primary))"
                    strokeDasharray="4 4"
                    strokeWidth={2}
                    label={{
                      value: `Lap ${focusLap}`,
                      position: 'insideTopRight',
                      fontSize: 11,
                      fill: 'hsl(var(--primary))',
                      fontFamily: 'var(--font-mono, monospace)',
                    }}
                  />
                )}
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
                        value: isMobile
                          ? (ps.drivers.length > 1
                              ? `${ps.drivers[0]} +${ps.drivers.length - 1}`
                              : `${ps.drivers[0]} ${ps.durations[0]}s`)
                          : ps.drivers.map((d, i) => `${d} ${ps.durations[i]}s`).join(' · '),
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
          {lines.length > 0 && (
            <SafetyLegend periods={safety} className="mt-2 justify-center" />
          )}
        </F1ChartContainer>
      </div>
  );
};

export default MuiLapTimeChart;
