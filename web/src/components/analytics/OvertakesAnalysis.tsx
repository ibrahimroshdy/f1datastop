import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Car, Loader2, AlertCircle, Trophy, Users, Zap, Play, Pause, RotateCcw, Flag, ChevronUp, ChevronDown, Wrench, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { usePositionData, useDrivers, useOvertakes, useLaps, useStartingGrid, useOpenF1SessionFromErgast } from "@/hooks/useOpenF1Data";
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
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface OvertakesAnalysisProps {
  year: number;
  round: string;
  sessionKey?: number;
  sessionName?: string;
}

interface DriverInfo {
  number: number;
  name: string;
  acronym: string;
  team: string;
  color: string;
  gridPosition: number;
  finalPosition: number;
}

interface PitStopInfo {
  driver: string;
  driverNumber: number;
  lap: number;
  duration: string;
  stop: number;
}

interface DriverStats {
  driver_number: number;
  acronym: string;
  team: string;
  color: string;
  overtakes_made: number;
  overtakes_suffered: number;
  net_overtakes: number;
  starting_position: number;
  final_position: number;
  position_change: number;
  status: 'running' | 'dnf';
}

// F1 Team Colors 2024
const teamColors: { [key: string]: string } = {
  "Red Bull Racing": "#3671C6",
  "red_bull": "#3671C6",
  "Ferrari": "#E8002D", 
  "ferrari": "#E8002D",
  "Mercedes": "#27F4D2",
  "mercedes": "#27F4D2",
  "McLaren": "#FF8000",
  "mclaren": "#FF8000",
  "Aston Martin": "#229971",
  "aston_martin": "#229971",
  "Alpine": "#FF87BC",
  "alpine": "#FF87BC",
  "Williams": "#64C4FF",
  "williams": "#64C4FF",
  "RB": "#6692FF",
  "rb": "#6692FF",
  "Haas F1 Team": "#B6BABD",
  "haas": "#B6BABD",
  "Kick Sauber": "#52E252",
  "sauber": "#52E252"
};

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
  
  const { isGlass, baseTheme } = useTheme();
  const isDark = baseTheme === 'dark';

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
      } catch (error) {
        console.error('Error fetching Ergast data:', error);
      } finally {
        setIsErgastLoading(false);
      }
    };

    if (year && round) {
      fetchErgastData();
    }
  }, [year, round]);

  const { data: sessionData, isLoading: isSessionLoading } = useOpenF1SessionFromErgast(year, round, "Race");
  const effectiveSessionKey = externalSessionKey || sessionData?.data?.session_key || 0;

  const { data: positionData, isLoading: isPositionLoading } = usePositionData(effectiveSessionKey);
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
        color: teamColors[driver.team_name] || teamColors[driver.team_name?.toLowerCase().replace(/\s+/g, '_')] || '#666666',
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
    if (!lapsData?.data) return 0;
    return Math.max(...lapsData.data.map((lap: any) => lap.lap_number || 0));
  }, [lapsData]);

  // Build position data by lap
  const positionsByLap = useMemo(() => {
    if (!positionData?.data || !lapsData?.data) return {};
    
    const lapTimestamps: { [lap: number]: Date } = {};
    lapsData.data.forEach((lap: any) => {
      if (lap.lap_number && lap.date_start) {
        lapTimestamps[lap.lap_number] = new Date(lap.date_start);
      }
    });
    
    const positionsByDriver: { [driverNumber: number]: { [lap: number]: number } } = {};
    
    // Initialize with grid positions from Ergast (lap 0)
    Object.entries(drivers).forEach(([numStr, driver]) => {
      const num = parseInt(numStr);
      positionsByDriver[num] = { 0: driver.gridPosition };
    });
    
    // Also try OpenF1 starting grid as fallback
    if (startingGridData?.data) {
      startingGridData.data.forEach((grid: any) => {
        if (!positionsByDriver[grid.driver_number]) {
          positionsByDriver[grid.driver_number] = {};
        }
        // Only use if we don't have Ergast data
        if (!positionsByDriver[grid.driver_number][0] || positionsByDriver[grid.driver_number][0] === 20) {
          positionsByDriver[grid.driver_number][0] = grid.position;
        }
      });
    }
    
    // Process position changes throughout the race
    positionData.data.forEach((pos: any) => {
      if (!pos.position || pos.position < 1 || pos.position > 25) return;
      const posDate = new Date(pos.date);
      let closestLap = 1;
      let minDiff = Infinity;
      Object.entries(lapTimestamps).forEach(([lapNum, lapDate]) => {
        const diff = Math.abs(posDate.getTime() - lapDate.getTime());
        if (diff < minDiff) { minDiff = diff; closestLap = parseInt(lapNum); }
      });
      if (!positionsByDriver[pos.driver_number]) positionsByDriver[pos.driver_number] = {};
      positionsByDriver[pos.driver_number][closestLap] = pos.position;
    });
    
    return positionsByDriver;
  }, [positionData, lapsData, startingGridData, drivers]);

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

  // Driver statistics
  const driverStats = useMemo((): DriverStats[] => {
    if (!drivers || Object.keys(drivers).length === 0) return [];
    const stats: DriverStats[] = [];
    
    Object.values(drivers).forEach(driver => {
      const driverPositions = positionsByLap[driver.number] || {};
      const startPos = driver.gridPosition;
      const finalPos = driver.finalPosition;
      
      let overtakesMade = 0, overtakesSuffered = 0;
      if (overtakesData?.data) {
        overtakesData.data.forEach((ot: any) => {
          if (ot.overtaking_driver_number === driver.number) overtakesMade++;
          if (ot.overtaken_driver_number === driver.number) overtakesSuffered++;
        });
      }
      
      // Check if DNF from Ergast
      const ergastResult = ergastData.results.find((r: any) => 
        r.Driver?.code === driver.acronym
      );
      const status = ergastResult?.status === 'Finished' || ergastResult?.status?.includes('+') ? 'running' : 'dnf';
      
      stats.push({ 
        driver_number: driver.number, 
        acronym: driver.acronym, 
        team: driver.team, 
        color: driver.color, 
        overtakes_made: overtakesMade, 
        overtakes_suffered: overtakesSuffered, 
        net_overtakes: overtakesMade - overtakesSuffered, 
        starting_position: startPos, 
        final_position: finalPos, 
        position_change: startPos - finalPos, 
        status 
      });
    });
    return stats.sort((a, b) => a.final_position - b.final_position);
  }, [drivers, positionsByLap, overtakesData, ergastData.results]);

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

  // Chart data for position progression (recharts: array of row objects keyed by series label)
  const positionChartData = useMemo(() => {
    if (!drivers || Object.keys(positionsByLap).length === 0) return { rows: [], series: [] };
    const laps = Array.from({ length: totalLaps + 1 }, (_, i) => i);
    const series: Array<{ label: string; color: string; id: string }> = [];
    const driversToShow = selectedDriver ? [selectedDriver] : Object.keys(drivers).map(Number).slice(0, 10);

    // Per-driver lap -> position lookup (carrying last-known position forward)
    const driverLapPositions: Array<{ label: string; positions: (number | null)[] }> = [];
    driversToShow.forEach(driverNumber => {
      const driver = drivers[driverNumber]; if (!driver) return;
      const driverPositions = positionsByLap[driverNumber] || {};
      let lastKnownPos: number | null = null;
      const positions = laps.map(lap => { if (driverPositions[lap] !== undefined) lastKnownPos = driverPositions[lap]; return lastKnownPos; });
      series.push({ label: driver.acronym, color: driver.color, id: `driver-${driverNumber}` });
      driverLapPositions.push({ label: driver.acronym, positions });
    });

    // Build one row per lap, keyed by driver acronym
    const rows = laps.map((lap, i) => {
      const row: { [key: string]: number | null } = { lap };
      driverLapPositions.forEach(d => { row[d.label] = d.positions[i]; });
      return row;
    });

    return { rows, series };
  }, [drivers, positionsByLap, totalLaps, selectedDriver]);

  const isLoading = isSessionLoading || isPositionLoading || isDriversLoading || isOvertakesLoading || isLapsLoading || isStartingGridLoading || isErgastLoading;
  const totalOvertakes = overtakesData?.data?.length || 0;
  const totalPitStops = pitStopsWithNumbers.length;

  // Custom tooltip for the position chart (sorted by position, P1 first)
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

  // Render position change indicator
  const PositionChangeIndicator = ({ change, type }: { change: number; type: 'lap' | 'total' }) => {
    if (change === 0) return null;
    const isGain = change > 0;
    return (
      <div className={cn(
        "flex items-center gap-0.5 text-[10px] font-bold",
        isGain ? "text-green-500" : "text-red-500"
      )}>
        {isGain ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
        <span>{Math.abs(change)}</span>
      </div>
    );
  };

  if (isLoading) return (
    <div className="min-h-[400px] flex flex-col items-center justify-center p-4">
      <Car className="h-8 w-8 text-primary mb-2 animate-pulse" />
      <p className="text-sm text-muted-foreground">Loading race data...</p>
    </div>
  );
  
  if (!effectiveSessionKey) return (
    <div className="min-h-[300px] flex flex-col items-center justify-center p-4 text-center">
      <AlertCircle className="h-8 w-8 text-muted-foreground mb-3" />
      <p className="text-muted-foreground">No session data available</p>
    </div>
  );
  
  if (!positionData?.data || positionData.data.length === 0) return (
    <div className="min-h-[300px] flex flex-col items-center justify-center p-4 text-center">
      <Car className="h-8 w-8 text-muted-foreground mb-3" />
      <p className="text-muted-foreground">No position data available</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: 'Overtakes', value: totalOvertakes, icon: Zap, color: 'text-primary' },
          { label: 'Pit Stops', value: totalPitStops, icon: Wrench, color: 'text-amber-500' },
          { label: 'Laps', value: totalLaps, icon: Flag, color: 'text-muted-foreground' },
          { label: 'Drivers', value: Object.keys(drivers).length, icon: Users, color: 'text-muted-foreground' },
          { label: 'Leader', value: currentPositions[0]?.driver.acronym || '-', icon: Trophy, color: 'text-yellow-500' },
        ].map(stat => (
          <div key={stat.label} className={cn("rounded-lg p-2 text-center", isGlass ? "bg-white/5 border border-white/10" : "bg-muted/50")}>
            <stat.icon className={cn("h-4 w-4 mx-auto mb-1", stat.color)} />
            <div className="text-lg font-bold">{stat.value}</div>
            <div className="text-[9px] text-muted-foreground uppercase">{stat.label}</div>
          </div>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={cn("inline-flex h-8", isGlass && "bg-white/5 border border-white/10")}>
          <TabsTrigger value="animation" className="text-xs px-3">Race Replay</TabsTrigger>
          <TabsTrigger value="position" className="text-xs px-3">Position Chart</TabsTrigger>
          <TabsTrigger value="stats" className="text-xs px-3">Results</TabsTrigger>
        </TabsList>

        {/* Race Replay - Animated Timing Tower */}
        <TabsContent value="animation" className="mt-3 space-y-3">
          {/* Controls */}
          <div className={cn("flex items-center gap-3 p-2 rounded-lg", isDark ? "bg-zinc-900" : "bg-slate-100")}>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { setIsPlaying(false); setCurrentProgress(0); }}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button size="sm" className={cn("h-9 w-9 rounded-full p-0", isPlaying ? "bg-red-500" : "bg-green-500")} onClick={() => setIsPlaying(!isPlaying)}>
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </Button>
            <Slider value={[currentProgress]} onValueChange={([v]) => setCurrentProgress(v)} max={100} step={0.5} className="flex-1" />
            <div className={cn("px-2 py-1 rounded font-mono text-xs font-bold min-w-[70px] text-center", isDark ? "bg-black text-white" : "bg-slate-900 text-white")}>
              LAP {currentLap}/{totalLaps}
            </div>
            <div className="flex gap-0.5">
              {[1, 2, 4].map(s => (
                <button key={s} onClick={() => setPlaybackSpeed(s)} className={cn("w-6 h-6 rounded text-[10px] font-bold transition-colors", playbackSpeed === s ? "bg-primary text-white" : isDark ? "bg-zinc-800 text-zinc-500 hover:bg-zinc-700" : "bg-slate-200 text-slate-500 hover:bg-slate-300")}>
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {/* Timing Tower */}
          <div className={cn("rounded-xl overflow-hidden", isDark ? "bg-gradient-to-b from-zinc-950 to-zinc-900" : "bg-gradient-to-b from-slate-50 to-white border border-slate-200")}>
            {/* Header */}
            <div className={cn("flex items-center justify-between px-3 py-2 border-b", isDark ? "border-zinc-800 bg-black/50" : "border-slate-200 bg-slate-100")}>
              <div className="flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full animate-pulse", isPlaying ? "bg-red-500" : "bg-green-500")} />
                <span className="text-xs font-medium">{isPlaying ? 'LIVE' : 'PAUSED'}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>GRID</span>
                <ArrowUp className="h-3 w-3 text-green-500" />
                <ArrowDown className="h-3 w-3 text-red-500" />
                <span>NOW</span>
              </div>
            </div>

            {/* Driver List */}
            <div className="p-2 space-y-0.5">
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
                        backgroundColor: isGaining ? 'rgba(34, 197, 94, 0.15)' : isLosing ? 'rgba(239, 68, 68, 0.15)' : 'transparent'
                      }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ 
                        layout: { type: "spring", stiffness: 350, damping: 30 },
                        backgroundColor: { duration: 0.5 }
                      }}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded-lg",
                        isDark ? "hover:bg-white/5" : "hover:bg-slate-100"
                      )}
                    >
                      {/* Position Badge */}
                      <div className={cn(
                        "w-7 h-7 rounded flex items-center justify-center text-xs font-bold shrink-0",
                        item.position === 1 && "bg-gradient-to-br from-yellow-400 to-yellow-600 text-black",
                        item.position === 2 && "bg-gradient-to-br from-slate-300 to-slate-500 text-black",
                        item.position === 3 && "bg-gradient-to-br from-amber-500 to-amber-700 text-white",
                        item.position > 3 && (isDark ? "bg-zinc-800 text-zinc-400" : "bg-slate-200 text-slate-600")
                      )}>
                        {item.position}
                      </div>

                      {/* Team Color Bar */}
                      <div className="w-1 h-6 rounded-full" style={{ backgroundColor: item.driver.color }} />

                      {/* Driver Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">{item.driver.acronym}</span>
                          <span className="text-[10px] text-muted-foreground truncate">{item.driver.team}</span>
                        </div>
                      </div>

                      {/* Grid Position */}
                      <div className="text-[10px] text-muted-foreground font-mono w-6 text-center">
                        P{item.gridPosition}
                      </div>

                      {/* Total Change from Grid */}
                      <div className="w-10 flex justify-center">
                        {item.totalChange !== 0 ? (
                          <div className={cn(
                            "flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-bold",
                            item.totalChange > 0 ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
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
                          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 text-[10px] font-bold"
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
                className={cn("flex items-center justify-center gap-2 py-3 border-t", isDark ? "border-zinc-800 bg-black/50" : "border-slate-200 bg-slate-50")}
              >
                <Flag className="h-4 w-4 text-primary" />
                <span className="font-bold">CHEQUERED FLAG</span>
              </motion.div>
            )}
          </div>

          {/* Pit Stop Timeline */}
          {pitStopsWithNumbers.length > 0 && (
            <div className={cn("rounded-lg p-3", isGlass ? "bg-white/5 border border-white/10" : "bg-muted/30")}>
              <div className="flex items-center gap-2 mb-2">
                <Wrench className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Pit Stops</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {pitStopsWithNumbers.filter(ps => ps.lap <= currentLap).slice(-10).map((ps, idx) => {
                  const driver = drivers[ps.driverNumber];
                  return (
                    <Badge 
                      key={`${ps.driver}-${ps.stop}`} 
                      variant="outline" 
                      className="text-[9px] px-1.5 py-0.5 gap-1"
                      style={{ borderColor: driver?.color }}
                    >
                      <span className="font-bold" style={{ color: driver?.color }}>{driver?.acronym || ps.driver}</span>
                      <span className="text-muted-foreground">L{ps.lap}</span>
                      <span className="font-mono text-amber-500">{ps.duration}s</span>
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Position Chart */}
        <TabsContent value="position" className="mt-3 space-y-3">
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1">
            {Object.values(drivers).slice(0, 20).map(driver => (
              <button 
                key={driver.number} 
                onClick={() => setSelectedDriver(selectedDriver === driver.number ? null : driver.number)}
                className={cn(
                  "flex items-center gap-1 px-1.5 py-1 rounded-full text-[10px] font-medium transition-all",
                  selectedDriver === driver.number ? "ring-2" : "opacity-70 hover:opacity-100", 
                  isGlass ? "bg-white/5" : "bg-muted/50"
                )}
                style={{ borderColor: driver.color, color: selectedDriver === driver.number ? driver.color : undefined }}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: driver.color }} />
                {driver.acronym}
              </button>
            ))}
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={positionChartData.rows}
                margin={{ left: 40, right: 20, top: 10, bottom: 35 }}
              >
                <CartesianGrid
                  stroke={isDark ? '#333' : '#e5e5e5'}
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="lap"
                  type="number"
                  domain={[0, totalLaps]}
                  allowDecimals={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: isDark ? '#a1a1aa' : '#666' }}
                  label={{ value: 'Lap', position: 'insideBottom', offset: -10, fontSize: 11, fill: isDark ? '#a1a1aa' : '#666' }}
                />
                <YAxis
                  reversed
                  domain={[1, 20]}
                  allowDecimals={false}
                  tickLine={false}
                  width={40}
                  tick={{ fontSize: 10, fill: isDark ? '#a1a1aa' : '#666' }}
                  label={{ value: 'Position', angle: -90, position: 'insideLeft', fontSize: 11, fill: isDark ? '#a1a1aa' : '#666' }}
                />
                <Tooltip content={<PositionTooltip />} />
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
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        {/* Final Results */}
        <TabsContent value="stats" className="mt-3">
          {/* Podium */}
          <div className="flex items-end justify-center gap-3 h-32 mb-4">
            {[1, 0, 2].map((idx) => {
              const stat = driverStats[idx];
              if (!stat) return null;
              const heights = ['h-24', 'h-20', 'h-16'];
              const sizes = ['w-14 h-14', 'w-12 h-12', 'w-12 h-12'];
              return (
                <motion.div 
                  key={stat.driver_number} 
                  initial={{ y: 50, opacity: 0 }} 
                  animate={{ y: 0, opacity: 1 }} 
                  transition={{ delay: idx * 0.1 }} 
                  className="flex flex-col items-center"
                >
                  {idx === 0 && <Trophy className="h-4 w-4 text-yellow-500 mb-1" />}
                  <div 
                    className={cn(sizes[idx], "rounded-full flex items-center justify-center text-white font-bold text-sm mb-1 shadow-lg", idx === 0 && "ring-2 ring-yellow-500")} 
                    style={{ backgroundColor: stat.color }}
                  >
                    {stat.acronym}
                  </div>
                  <div className={cn(heights[idx], "w-16 rounded-t flex flex-col items-center justify-center", 
                    idx === 0 ? "bg-gradient-to-b from-yellow-400 to-yellow-600" : 
                    idx === 1 ? "bg-gradient-to-b from-slate-300 to-slate-500" : 
                    "bg-gradient-to-b from-amber-500 to-amber-700"
                  )}>
                    <span className="text-xl font-bold text-white">{stat.final_position}</span>
                    {stat.position_change !== 0 && (
                      <span className={cn("text-[10px] font-bold", stat.position_change > 0 ? "text-green-200" : "text-red-200")}>
                        {stat.position_change > 0 ? '+' : ''}{stat.position_change}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
          
          {/* Results Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-1.5">
            {driverStats.slice(3).map((stat) => (
              <div 
                key={stat.driver_number} 
                className={cn("rounded-lg overflow-hidden", isDark ? "bg-zinc-900" : "bg-white border border-slate-200")}
              >
                <div className="h-1" style={{ backgroundColor: stat.color }} />
                <div className="p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">P{stat.final_position}</span>
                    {stat.position_change !== 0 && (
                      <span className={cn("text-[9px] font-bold flex items-center gap-0.5", stat.position_change > 0 ? "text-green-500" : "text-red-500")}>
                        {stat.position_change > 0 ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
                        {Math.abs(stat.position_change)}
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-sm">{stat.acronym}</div>
                  <div className="text-[9px] text-muted-foreground">
                    Grid: P{stat.starting_position}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OvertakesAnalysis;
