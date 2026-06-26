import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Trophy,
  Users,
  Zap,
  Play,
  Pause,
  RotateCcw,
  Flag,
  ChevronUp,
  ChevronDown,
  Wrench,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  usePositionData,
  useDrivers,
  useOvertakes,
  useLaps,
  useStartingGrid,
  useOpenF1SessionFromErgast,
} from "@/hooks/useOpenF1Data";
import { getRaceResults, getPitStops as getErgastPitStops } from "@/services/f1Service";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';
import { chartTheme, ScopeDefs, SCOPE_GLOW } from "@/lib/chartTheme";
import { getTeamColorById } from '@/constants/f1Colors';
import { useThemeVariant } from '@/hooks/useThemeVariant';
import {
  F1Card,
  F1CardContent,
  F1ChartContainer,
  F1EmptyState,
  F1ErrorState,
  F1Skeleton,
} from '@/components/f1';
import { motion, AnimatePresence } from 'framer-motion';

interface OvertakesAnalysisProps {
  year: number;
  round: string;
  sessionKey?: number;
  sessionName?: string;
}

type DriverInfo = OvertakeDriverInfo;

interface PitStopInfo {
  driver: string;
  driverNumber: number;
  lap: number;
  duration: string;
  stop: number;
}

import {
  buildPositionsByLap,
  computeDriverOvertakeStats,
  buildOvertakePositionChartData,
  type OvertakeDriverInfo,
  type DriverOvertakeStats,
} from "@/lib/f1/overtakes";

const eyebrow = "text-xs font-semibold uppercase tracking-widest text-muted-foreground";

const underlineTabTrigger =
  "rounded-none border-b-2 border-transparent bg-transparent px-3 pb-2 pt-1 text-xs shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none";

const OvertakesAnalysis: React.FC<OvertakesAnalysisProps> = ({
  year,
  round,
  sessionKey: externalSessionKey,
}) => {
  const [selectedDriver, setSelectedDriver] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<string>("animation");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(2);
  const [ergastData, setErgastData] = useState<{ results: any[]; pitStops: PitStopInfo[] }>({ results: [], pitStops: [] });
  const [isErgastLoading, setIsErgastLoading] = useState(true);
  const animationRef = useRef<number>();
  const lastUpdateRef = useRef<number>(0);

  const { cardVariant, glassVariant } = useThemeVariant();

  // Fetch Ergast data for accurate grid positions and pit stops
  useEffect(() => {
    const fetchErgastData = async () => {
      setIsErgastLoading(true);
      try {
        const [resultsRes, pitStopsRes] = await Promise.all([
          getRaceResults(year, round),
          getErgastPitStops(year, round)
        ]);

        const results = resultsRes?.data?.Results || [];

        // Process pit stops
        const pitStopsByDriver: { [driver: string]: number } = {};
        const pitStops: PitStopInfo[] = (pitStopsRes?.data?.Races?.[0]?.PitStops || []).map((ps: any) => {
          pitStopsByDriver[ps.driverId] = (pitStopsByDriver[ps.driverId] || 0) + 1;
          return {
            driver: ps.driverId,
            driverNumber: 0, // Will be mapped later
            lap: parseInt(ps.lap, 10),
            duration: ps.duration,
            stop: pitStopsByDriver[ps.driverId]
          };
        });

        setErgastData({ results, pitStops });
      } catch {
        // Swallow — UI degrades gracefully via empty guards below.
        setErgastData({ results: [], pitStops: [] });
      } finally {
        setIsErgastLoading(false);
      }
    };

    if (year && round) {
      fetchErgastData();
    }
  }, [year, round]);

  const {
    data: sessionData,
    isLoading: isSessionLoading,
    isError: isSessionError,
  } = useOpenF1SessionFromErgast(year, round, "Race");
  const effectiveSessionKey = externalSessionKey || sessionData?.data?.session_key || 0;
  // OpenF1 returns no matching session → surface as empty, not a crash.
  const sessionUnavailable = !isSessionLoading && !effectiveSessionKey;

  const { data: positionData, isLoading: isPositionLoading, isError: isPositionError } = usePositionData(effectiveSessionKey);
  const { data: driversData, isLoading: isDriversLoading } = useDrivers(effectiveSessionKey);
  const { data: overtakesData, isLoading: isOvertakesLoading } = useOvertakes(effectiveSessionKey);
  const { data: lapsData, isLoading: isLapsLoading } = useLaps(effectiveSessionKey);
  const { data: startingGridData, isLoading: isStartingGridLoading } = useStartingGrid(effectiveSessionKey);

  // Build driver map with grid positions from Ergast (more reliable)
  const drivers = useMemo((): { [key: number]: DriverInfo } => {
    if (!driversData?.data) return {};

    const driverMap: { [key: number]: DriverInfo } = {};

    driversData.data.forEach((driver: any) => {
      // Find matching Ergast result for grid position
      const ergastResult = ergastData.results.find((r: any) =>
        r.Driver?.code === driver.name_acronym ||
        r.Driver?.driverId?.toLowerCase().includes(driver.last_name?.toLowerCase())
      );

      driverMap[driver.driver_number] = {
        number: driver.driver_number,
        name: `${driver.first_name} ${driver.last_name}`,
        acronym: driver.name_acronym || `${driver.first_name?.charAt(0)}${driver.last_name?.charAt(0)}`,
        team: driver.team_name || 'Unknown',
        color: getTeamColorById(driver.team_name),
        gridPosition: ergastResult ? parseInt(ergastResult.grid) : 20,
        finalPosition: ergastResult ? parseInt(ergastResult.position) : 20
      };
    });

    return driverMap;
  }, [driversData, ergastData.results]);

  // Map pit stops to driver numbers
  const pitStopsWithNumbers = useMemo(() => {
    return ergastData.pitStops.map(ps => {
      const driver = Object.values(drivers).find(d =>
        d.acronym.toLowerCase() === ps.driver.substring(0, 3).toLowerCase() ||
        d.name.toLowerCase().includes(ps.driver.toLowerCase())
      );
      return { ...ps, driverNumber: driver?.number || 0 };
    }).filter(ps => ps.driverNumber > 0);
  }, [ergastData.pitStops, drivers]);

  const totalLaps = useMemo(() => {
    if (!lapsData?.data?.length) return 0;
    return Math.max(...lapsData.data.map((lap: any) => lap.lap_number || 0));
  }, [lapsData]);

  const positionsByLap = useMemo(
    () =>
      buildPositionsByLap(
        positionData?.data,
        lapsData?.data,
        drivers,
        startingGridData?.data,
      ),
    [positionData, lapsData, startingGridData, drivers],
  );

  const currentLap = useMemo(() => Math.floor((currentProgress / 100) * totalLaps), [currentProgress, totalLaps]);
  const previousLap = useMemo(() => Math.max(0, currentLap - 1), [currentLap]);

  // Current positions with movement indicators
  const currentPositions = useMemo(() => {
    const positions: {
      driverNumber: number;
      position: number;
      previousPosition: number;
      gridPosition: number;
      driver: DriverInfo;
      posChange: number;
      totalChange: number;
      hasPitStop: boolean;
    }[] = [];

    // Get pit stops on current lap
    const currentLapPitStops = new Set(
      pitStopsWithNumbers.filter(ps => ps.lap === currentLap).map(ps => ps.driverNumber)
    );

    Object.entries(positionsByLap).forEach(([driverNum, lapPositions]) => {
      const driverNumber = parseInt(driverNum);
      const driver = drivers[driverNumber];
      if (!driver) return;

      let position = 20, previousPosition = 20;
      for (let lap = currentLap; lap >= 0; lap--) {
        if (lapPositions[lap] !== undefined) {
          position = lapPositions[lap];
          break;
        }
      }
      for (let lap = previousLap; lap >= 0; lap--) {
        if (lapPositions[lap] !== undefined) {
          previousPosition = lapPositions[lap];
          break;
        }
      }

      const gridPosition = driver.gridPosition;
      const posChange = previousPosition - position;
      const totalChange = gridPosition - position;

      positions.push({
        driverNumber,
        position,
        previousPosition,
        gridPosition,
        driver,
        posChange,
        totalChange,
        hasPitStop: currentLapPitStops.has(driverNumber)
      });
    });

    return positions.sort((a, b) => a.position - b.position);
  }, [positionsByLap, drivers, currentLap, previousLap, pitStopsWithNumbers]);

  const driverStats = useMemo(
    (): DriverOvertakeStats[] =>
      computeDriverOvertakeStats(drivers, overtakesData?.data, ergastData.results),
    [drivers, overtakesData, ergastData.results],
  );

  // Animation loop
  useEffect(() => {
    if (!isPlaying) return;
    const animate = (timestamp: number) => {
      const deltaTime = timestamp - lastUpdateRef.current;
      if (deltaTime >= (1000 / (playbackSpeed * 8))) {
        setCurrentProgress(prev => { const next = prev + 0.25 * playbackSpeed; return next >= 100 ? 100 : next; });
        lastUpdateRef.current = timestamp;
      }
      if (currentProgress < 100) animationRef.current = requestAnimationFrame(animate);
      else setIsPlaying(false);
    };
    animationRef.current = requestAnimationFrame(animate);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [isPlaying, playbackSpeed, currentProgress]);

  const positionChartData = useMemo(
    () => buildOvertakePositionChartData(positionsByLap, drivers, totalLaps, selectedDriver),
    [drivers, positionsByLap, totalLaps, selectedDriver],
  );

  const isLoading = isSessionLoading || isPositionLoading || isDriversLoading || isOvertakesLoading || isLapsLoading || isStartingGridLoading || isErgastLoading;
  const hasError = isSessionError || isPositionError;
  const totalOvertakes = overtakesData?.data?.length || 0;
  const totalPitStops = pitStopsWithNumbers.length;
  const hasPositionData = !!positionData?.data?.length;

  // Custom tooltip for the position chart (sorted by position, P1 first)
  const PositionTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const rows = payload
      .filter((p: any) => p.value != null)
      .sort((a: any, b: any) => a.value - b.value);
    if (!rows.length) return null;
    return (
      <div className="rounded-md border border-border bg-popover/95 px-2 py-1.5 text-xs shadow-premium-sm">
        <div className="mb-1 font-mono tabular-nums text-muted-foreground">LAP {label}</div>
        {rows.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.stroke }} />
            <span className="w-9 font-bold">{p.dataKey}</span>
            <span className="font-mono tabular-nums">P{p.value}</span>
          </div>
        ))}
      </div>
    );
  };

  // ── Loading / error / empty guards (never crash on missing OpenF1 data) ──
  if (isLoading) {
    return (
      <F1Card variant={cardVariant} glassVariant={glassVariant} size="sm">
        <F1CardContent className="space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <F1Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
          <F1Skeleton className="h-8 w-48" />
          <F1Skeleton className="h-[280px] w-full rounded-lg" />
        </F1CardContent>
      </F1Card>
    );
  }

  if (hasError) {
    return (
      <F1Card variant={cardVariant} glassVariant={glassVariant} size="sm">
        <F1CardContent>
          <F1ErrorState
            type="server"
            variant="inline"
            size="sm"
            message="Live timing data for this session could not be loaded."
            className="py-8"
          />
        </F1CardContent>
      </F1Card>
    );
  }

  if (sessionUnavailable || !hasPositionData) {
    return (
      <F1Card variant={cardVariant} glassVariant={glassVariant} size="sm">
        <F1CardContent>
          <F1EmptyState
            type="no-data"
            size="sm"
            showDecoration={false}
            title="No Telemetry Available"
            description="OpenF1 has no position or timing feed for this session yet."
            className="py-8"
          />
        </F1CardContent>
      </F1Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: 'Overtakes', value: totalOvertakes, icon: Zap, accent: 'text-primary' },
          { label: 'Pit Stops', value: totalPitStops, icon: Wrench, accent: 'text-muted-foreground' },
          { label: 'Laps', value: totalLaps, icon: Flag, accent: 'text-muted-foreground' },
          { label: 'Drivers', value: Object.keys(drivers).length, icon: Users, accent: 'text-muted-foreground' },
          { label: 'Leader', value: currentPositions[0]?.driver.acronym || '—', icon: Trophy, accent: 'text-position-gold' },
        ].map(stat => (
          <div key={stat.label} className="rounded-lg border border-border bg-muted/40 p-2 text-center">
            <stat.icon className={cn("mx-auto mb-1 h-3.5 w-3.5", stat.accent)} />
            <div className="font-mono text-lg font-bold tabular-nums">{stat.value}</div>
            <div className={eyebrow}>{stat.label}</div>
          </div>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="inline-flex h-auto w-full justify-start gap-0 rounded-none border-b border-border bg-transparent p-0">
          <TabsTrigger value="animation" className={underlineTabTrigger}>Race Replay</TabsTrigger>
          <TabsTrigger value="position" className={underlineTabTrigger}>Position Chart</TabsTrigger>
          <TabsTrigger value="stats" className={underlineTabTrigger}>Results</TabsTrigger>
        </TabsList>

        {/* Race Replay - Animated Timing Tower */}
        <TabsContent value="animation" className="mt-3 flex flex-col gap-3">
          {/* Controls */}
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-2">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { setIsPlaying(false); setCurrentProgress(0); }}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              className={cn("h-9 w-9 rounded-full p-0", isPlaying ? "bg-primary hover:bg-primary/90" : "bg-status-completed hover:bg-status-completed/90")}
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
            </Button>
            <Slider value={[currentProgress]} onValueChange={([v]) => setCurrentProgress(v)} max={100} step={0.5} className="flex-1" />
            <div className="min-w-[70px] rounded bg-foreground px-2 py-1 text-center font-mono text-xs font-bold tabular-nums text-background">
              LAP {currentLap}/{totalLaps}
            </div>
            <div className="flex gap-0.5">
              {[1, 2, 4].map(s => (
                <button
                  key={s}
                  onClick={() => setPlaybackSpeed(s)}
                  className={cn(
                    "h-6 w-6 rounded font-mono text-xs font-bold tabular-nums transition-colors",
                    playbackSpeed === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
                  )}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {/* Timing Tower */}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2">
              <div className="flex items-center gap-2">
                <div className={cn("h-2 w-2 animate-pulse rounded-full", isPlaying ? "bg-status-live" : "bg-status-completed")} />
                <span className={eyebrow}>{isPlaying ? 'LIVE' : 'PAUSED'}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>GRID</span>
                <ArrowUp className="h-3 w-3 text-status-completed" />
                <ArrowDown className="h-3 w-3 text-destructive" />
                <span>NOW</span>
              </div>
            </div>

            {/* Driver List */}
            <div className="flex flex-col gap-0.5 p-2">
              <AnimatePresence>
                {currentPositions.slice(0, 20).map((item) => {
                  const isGaining = item.posChange > 0;
                  const isLosing = item.posChange < 0;

                  return (
                    <motion.div
                      key={item.driverNumber}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{
                        opacity: 1,
                        x: 0,
                        backgroundColor: isGaining
                          ? 'hsl(var(--status-completed) / 0.15)'
                          : isLosing
                            ? 'hsl(var(--destructive) / 0.18)'
                            : 'transparent'
                      }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{
                        layout: { type: "spring", stiffness: 350, damping: 30 },
                        backgroundColor: { duration: 0.5 }
                      }}
                      className="flex items-center gap-2 rounded-lg border-b border-border/40 px-2 py-1.5 last:border-b-0 hover:bg-muted/50"
                    >
                      {/* Position */}
                      <div className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded font-mono text-xs font-bold tabular-nums",
                        item.position === 1 && "bg-position-gold text-background",
                        item.position === 2 && "bg-position-silver text-background",
                        item.position === 3 && "bg-position-bronze text-foreground",
                        item.position > 3 && "bg-muted text-muted-foreground"
                      )}>
                        {item.position}
                      </div>

                      {/* Team Color Bar (sanctioned dynamic team hex) */}
                      <div className="h-6 w-1 rounded-full" style={{ backgroundColor: item.driver.color }} />

                      {/* Driver Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold">{item.driver.acronym}</span>
                          <span className="truncate text-xs text-muted-foreground">{item.driver.team}</span>
                        </div>
                      </div>

                      {/* Grid Position */}
                      <div className="w-7 text-center font-mono text-xs tabular-nums text-muted-foreground">
                        P{item.gridPosition}
                      </div>

                      {/* Total Change from Grid */}
                      <div className="flex w-10 justify-center">
                        {item.totalChange !== 0 ? (
                          <div className={cn(
                            "flex items-center gap-0.5 rounded px-1 py-0.5 font-mono text-xs font-bold tabular-nums",
                            item.totalChange > 0 ? "bg-status-completed/20 text-status-completed" : "bg-destructive/20 text-destructive"
                          )}>
                            {item.totalChange > 0 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            {Math.abs(item.totalChange)}
                          </div>
                        ) : (
                          <Minus className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>

                      {/* Pit Stop Indicator */}
                      {item.hasPitStop && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="flex items-center gap-0.5 rounded bg-primary/15 px-1.5 py-0.5 text-xs font-bold text-primary"
                        >
                          <Wrench className="h-3 w-3" />
                          PIT
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Race Complete Banner */}
            {currentProgress >= 100 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-center gap-2 border-t border-border bg-muted/40 py-3"
              >
                <Flag className="h-4 w-4 text-primary" />
                <span className="font-bold">CHEQUERED FLAG</span>
              </motion.div>
            )}
          </div>

          {/* Pit Stop Timeline */}
          {pitStopsWithNumbers.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Wrench className="h-3.5 w-3.5 text-primary" />
                <span className={eyebrow}>Pit Stops</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {pitStopsWithNumbers.filter(ps => ps.lap <= currentLap).slice(-10).map((ps) => {
                  const driver = drivers[ps.driverNumber];
                  return (
                    <div
                      key={`${ps.driver}-${ps.stop}`}
                      className="flex items-center gap-1 rounded border bg-card px-1.5 py-0.5 text-xs"
                      style={{ borderColor: driver?.color }}
                    >
                      <span className="font-mono font-bold" style={{ color: driver?.color }}>{driver?.acronym || ps.driver}</span>
                      <span className="font-mono tabular-nums text-muted-foreground">L{ps.lap}</span>
                      <span className="font-mono tabular-nums text-primary">{ps.duration}s</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Position Chart */}
        <TabsContent value="position" className="mt-3 flex flex-col gap-3">
          <div className="grid grid-cols-5 gap-1 sm:grid-cols-10">
            {Object.values(drivers).slice(0, 20).map(driver => (
              <button
                key={driver.number}
                onClick={() => setSelectedDriver(selectedDriver === driver.number ? null : driver.number)}
                className={cn(
                  "flex items-center gap-1 rounded-full border bg-muted/40 px-1.5 py-1 font-mono text-xs font-medium transition-all",
                  selectedDriver === driver.number ? "ring-2" : "opacity-70 hover:opacity-100"
                )}
                style={{ borderColor: driver.color, color: selectedDriver === driver.number ? driver.color : undefined }}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: driver.color }} />
                {driver.acronym}
              </button>
            ))}
          </div>
          <F1ChartContainer
            minHeight={300}
            isEmpty={!positionChartData.rows.length || !positionChartData.series.length}
            emptyTitle="No Position Data"
            emptyDescription="Lap-by-lap positions are not available for this session."
          >
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={positionChartData.rows}
                margin={{ left: 40, right: 20, top: 10, bottom: 35 }}
              >
                <defs>
                  <ScopeDefs id="ot" color={chartTheme.primary} />
                </defs>
                <CartesianGrid
                  stroke={chartTheme.grid}
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="lap"
                  type="number"
                  domain={[0, totalLaps]}
                  allowDecimals={false}
                  tickLine={false}
                  stroke={chartTheme.axis}
                  tick={chartTheme.tick}
                  label={{ value: 'Lap', position: 'insideBottom', offset: -10, fontSize: 11, fill: 'hsl(var(--chart-axis))' }}
                />
                <YAxis
                  reversed
                  domain={[1, 20]}
                  allowDecimals={false}
                  tickLine={false}
                  width={40}
                  stroke={chartTheme.axis}
                  tick={chartTheme.tick}
                  label={{ value: 'Position', angle: -90, position: 'insideLeft', fontSize: 11, fill: 'hsl(var(--chart-axis))' }}
                />
                <Tooltip
                  content={<PositionTooltip />}
                  contentStyle={chartTheme.tooltipContentStyle}
                  labelStyle={chartTheme.tooltipLabelStyle}
                  cursor={chartTheme.cursor}
                />
                {positionChartData.series.map(s => (
                  <Line
                    key={s.id}
                    type="stepAfter"
                    dataKey={s.label}
                    stroke={s.color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3 }}
                    connectNulls
                    isAnimationActive={false}
                    filter={SCOPE_GLOW}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </F1ChartContainer>
        </TabsContent>

        {/* Final Results */}
        <TabsContent value="stats" className="mt-3">
          {!driverStats.length ? (
            <F1EmptyState
              type="no-results"
              size="sm"
              showDecoration={false}
              description="Classified results are not available for this session yet."
              className="py-8"
            />
          ) : (
            <div className="flex flex-col gap-4">
              {/* Podium */}
              <div className="mb-1 flex h-32 items-end justify-center gap-3">
                {[1, 0, 2].map((idx) => {
                  const stat = driverStats[idx];
                  if (!stat) return null;
                  const heights = ['h-24', 'h-20', 'h-16'];
                  const sizes = ['h-14 w-14', 'h-12 w-12', 'h-12 w-12'];
                  const podiumBg = idx === 0 ? 'bg-position-gold' : idx === 1 ? 'bg-position-silver' : 'bg-position-bronze';
                  const podiumText = idx === 2 ? 'text-foreground' : 'text-background';
                  return (
                    <motion.div
                      key={stat.driver_number}
                      initial={{ y: 50, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: idx * 0.1 }}
                      className="flex flex-col items-center"
                    >
                      {idx === 0 && <Trophy className="mb-1 h-4 w-4 text-position-gold" />}
                      <div
                        className={cn(sizes[idx], "mb-1 flex items-center justify-center rounded-full font-mono text-sm font-bold text-primary-foreground shadow-premium-md", idx === 0 && "ring-2 ring-position-gold")}
                        style={{ backgroundColor: stat.color }}
                      >
                        {stat.acronym}
                      </div>
                      <div className={cn(heights[idx], "flex w-16 flex-col items-center justify-center rounded-t", podiumBg)}>
                        <span className={cn("font-mono text-xl font-bold tabular-nums", podiumText)}>{stat.final_position}</span>
                        {stat.position_change !== 0 && (
                          <span className={cn("font-mono text-xs font-bold tabular-nums", podiumText)}>
                            {stat.position_change > 0 ? '+' : ''}{stat.position_change}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Results Grid */}
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 md:grid-cols-6">
                {driverStats.slice(3).map((stat) => (
                  <div
                    key={stat.driver_number}
                    className="overflow-hidden rounded-lg border border-border bg-card"
                  >
                    <div className="h-1" style={{ backgroundColor: stat.color }} />
                    <div className="p-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">P{stat.final_position}</span>
                        {stat.position_change !== 0 && (
                          <span className={cn("flex items-center gap-0.5 font-mono text-xs font-bold tabular-nums", stat.position_change > 0 ? "text-status-completed" : "text-destructive")}>
                            {stat.position_change > 0 ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
                            {Math.abs(stat.position_change)}
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-sm font-bold">{stat.acronym}</div>
                      <div className="text-xs text-muted-foreground">
                        Grid: P{stat.starting_position}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OvertakesAnalysis;
