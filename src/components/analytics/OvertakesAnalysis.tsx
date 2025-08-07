import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  SkipForward, 
  SkipBack,
  Zap,
  Clock,
  Car,
  TrendingUp,
  Users
} from "lucide-react";
import { usePositionData, useDrivers, useOvertakes, useOpenF1SessionFromErgast } from "@/hooks/useOpenF1Data";

interface OvertakesAnalysisProps {
  year: number;
  round: string;
  sessionKey?: number;
  sessionName?: string;
}

interface PositionSnapshot {
  timestamp: Date;
  positions: { [driverNumber: number]: number };
  overtakes: Array<{
    overtaking: number;
    overtaken: number;
    position: number;
  }>;
}

interface DriverInfo {
  number: number;
  name: string;
  acronym: string;
  team: string;
  color: string;
}

interface DriverStats {
  driver_number: number;
  name: string;
  acronym: string;
  team: string;
  color: string;
  overtakes_made: number;
  overtakes_suffered: number;
  net_overtakes: number;
  final_position: number;
  starting_position: number;
  position_change: number;
  status: 'running' | 'dnf';
}

const OvertakesAnalysis: React.FC<OvertakesAnalysisProps> = ({
  year,
  round,
  sessionKey: externalSessionKey,
  sessionName = "Race"
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(2);
  const [selectedDriver, setSelectedDriver] = useState<number | null>(null);
  
  const animationRef = useRef<number>();
  const lastUpdateRef = useRef<number>(0);

  // ALWAYS call all hooks unconditionally - this is critical for React
  // Get the OpenF1 session (always call this hook)
  const { 
    data: sessionData, 
    isLoading: isSessionLoading 
  } = useOpenF1SessionFromErgast(year, round, "Race");

  // Use the external session key if provided, otherwise use the one from the hook
  const effectiveSessionKey = externalSessionKey || sessionData?.data?.session_key || 0;

  // ALWAYS call these data hooks unconditionally
  const { data: positionData, isLoading: isPositionLoading } = usePositionData(effectiveSessionKey);
  const { data: driversData, isLoading: isDriversLoading } = useDrivers(effectiveSessionKey);
  const { data: overtakesData, isLoading: isOvertakesLoading } = useOvertakes(effectiveSessionKey);

  // Team colors mapping
  const teamColors: { [key: string]: string } = {
    "Red Bull Racing": "#1E90FF",
    "Ferrari": "#FF0000", 
    "Mercedes": "#00D2BE",
    "McLaren": "#FF8700",
    "Aston Martin": "#006F62",
    "Alpine": "#0090FF",
    "Williams": "#005AFF",
    "RB": "#1E41FF",
    "Haas F1 Team": "#FFFFFF",
    "Kick Sauber": "#32CD32"
  };

  // Process driver information
  const drivers = useMemo((): { [key: number]: DriverInfo } => {
    if (!driversData?.data) return {};
    
    const driverMap: { [key: number]: DriverInfo } = {};
    driversData.data.forEach((driver: any) => {
      driverMap[driver.driver_number] = {
        number: driver.driver_number,
        name: `${driver.first_name} ${driver.last_name}`,
        acronym: driver.name_acronym || `${driver.first_name.charAt(0)}${driver.last_name.charAt(0)}${driver.driver_number}`,
        team: driver.team_name || 'Unknown',
        color: teamColors[driver.team_name] || '#666666'
      };
    });
    return driverMap;
  }, [driversData]);

  // Process position data into snapshots
  const positionSnapshots = useMemo((): PositionSnapshot[] => {
    if (!positionData?.data || !overtakesData?.data) return [];

    const positionsByTime: { [timestamp: string]: { [driverNumber: number]: number } } = {};
    const overtakesByTime: { [timestamp: string]: Array<{overtaking: number, overtaken: number, position: number}> } = {};
    
    positionData.data.forEach((pos: any) => {
      const timestamp = new Date(pos.date).toISOString();
      if (!positionsByTime[timestamp]) positionsByTime[timestamp] = {};
      positionsByTime[timestamp][pos.driver_number] = pos.position;
    });

    overtakesData.data.forEach((overtake: any) => {
      const timestamp = new Date(overtake.date).toISOString();
      if (!overtakesByTime[timestamp]) overtakesByTime[timestamp] = [];
      overtakesByTime[timestamp].push({
        overtaking: overtake.overtaking_driver_number,
        overtaken: overtake.overtaken_driver_number,
        position: overtake.position
      });
    });

    const timestamps = Object.keys(positionsByTime).sort();
    const snapshots: PositionSnapshot[] = [];
    let lastPositions: { [driverNumber: number]: number } = {};

    timestamps.forEach(timestamp => {
      const currentPositions = { ...lastPositions, ...positionsByTime[timestamp] };
      snapshots.push({
        timestamp: new Date(timestamp),
        positions: currentPositions,
        overtakes: overtakesByTime[timestamp] || []
      });
      lastPositions = currentPositions;
    });

    return snapshots;
  }, [positionData, overtakesData]);

  // Current snapshot
  const currentSnapshot = useMemo(() => {
    if (positionSnapshots.length === 0) return null;
    const index = Math.min(
      Math.floor((currentTime / 100) * (positionSnapshots.length - 1)),
      positionSnapshots.length - 1
    );
    return positionSnapshots[index];
  }, [positionSnapshots, currentTime]);

  // Driver statistics - FIXED LOGIC
  const driverStats = useMemo((): DriverStats[] => {
    if (!driversData?.data || !positionSnapshots.length || !overtakesData?.data) return [];

    const stats: { [key: number]: DriverStats } = {};
    const firstSnapshot = positionSnapshots[0];
    const lastSnapshot = positionSnapshots[positionSnapshots.length - 1];

    // Initialize stats for all drivers
    driversData.data.forEach((driver: any) => {
      const driverInfo = drivers[driver.driver_number];
      if (!driverInfo) return;

      // Check if driver ever had position data
      const hadPositionData = positionSnapshots.some(snapshot => snapshot.positions[driver.driver_number]);
      
      // Get actual starting and final positions
      const startPos = firstSnapshot.positions[driver.driver_number] || (hadPositionData ? 21 : 22); // 22 for DNS
      const finalPos = lastSnapshot.positions[driver.driver_number];
      
      // Determine driver status
      let status: 'running' | 'dnf' = 'running';
      let displayFinalPos = finalPos || 21;
      
      if (!hadPositionData) {
        status = 'dnf'; // DNS (Did Not Start)
        displayFinalPos = 22;
      } else if (!finalPos && hadPositionData) {
        status = 'dnf'; // DNF (Did Not Finish)
        displayFinalPos = 21;
      } else if (finalPos && finalPos > 20) {
        status = 'dnf'; // Classified as DNF
        displayFinalPos = 21;
      }

      stats[driver.driver_number] = {
        driver_number: driver.driver_number,
        name: driverInfo.name,
        acronym: driverInfo.acronym,
        team: driverInfo.team,
        color: driverInfo.color,
        overtakes_made: 0,
        overtakes_suffered: 0,
        net_overtakes: 0,
        starting_position: startPos,
        final_position: displayFinalPos,
        position_change: status === 'dnf' ? -(displayFinalPos - startPos) : (startPos - (finalPos || startPos)),
        status: status
      };
    });

    // Process overtakes to get accurate counts
    overtakesData.data.forEach((overtake: any) => {
      const overtakingNumber = overtake.overtaking_driver_number;
      const overtakenNumber = overtake.overtaken_driver_number;

      if (stats[overtakingNumber]) stats[overtakingNumber].overtakes_made++;
      if (stats[overtakenNumber]) stats[overtakenNumber].overtakes_suffered++;
    });

    // Calculate net overtakes
    Object.values(stats).forEach(stat => {
      stat.net_overtakes = stat.overtakes_made - stat.overtakes_suffered;
    });

    // Sort by net overtakes, then by final position
    return Object.values(stats).sort((a, b) => {
      if (b.net_overtakes !== a.net_overtakes) return b.net_overtakes - a.net_overtakes;
      return a.final_position - b.final_position;
    });
  }, [driversData, positionSnapshots, overtakesData, drivers]);

  // Animation loop
  useEffect(() => {
    if (!isPlaying) return;

    const animate = (timestamp: number) => {
      const deltaTime = timestamp - lastUpdateRef.current;
      
      if (deltaTime >= (1000 / (playbackSpeed * 3))) {
        setCurrentTime(prev => {
          const next = prev + (100 / positionSnapshots.length) * playbackSpeed;
          return next >= 100 ? 100 : next;
        });
        lastUpdateRef.current = timestamp;
      }
      
      if (currentTime < 100) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsPlaying(false);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, playbackSpeed, currentTime, positionSnapshots.length]);

  // Control functions
  const handlePlay = () => setIsPlaying(!isPlaying);
  const handleReset = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  // Get all drivers for position flow
  const allDrivers = useMemo(() => {
    if (!driversData?.data || !positionSnapshots.length) return [];
    
    // Get all driver numbers from driversData (not filtered by position data)
    const allDriverNumbers = driversData.data.map((driver: any) => driver.driver_number);
    
    return allDriverNumbers.sort((a, b) => {
      // Sort by starting position, use a high number (99) if no position data
      const startPosA = positionSnapshots[0]?.positions[a] || 99;
      const startPosB = positionSnapshots[0]?.positions[b] || 99;
      return startPosA - startPosB;
    });
  }, [driversData, positionSnapshots]);

  const isLoading = isSessionLoading || isPositionLoading || isDriversLoading || isOvertakesLoading;

  // Show loading if we're still fetching session data and don't have an external key
  const showSessionLoading = !externalSessionKey && isSessionLoading;
  
  // If we don't have a valid session key, show error
  const showNoSessionError = !effectiveSessionKey && !isLoading;
  
  // Show general loading
  const showGeneralLoading = isLoading && effectiveSessionKey;
  
  // Show no data error
  const showNoDataError = !isLoading && effectiveSessionKey && positionSnapshots.length === 0;

  if (showSessionLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-pulse text-muted-foreground">Loading session data...</div>
        </div>
      </div>
    );
  }

  if (showNoSessionError) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No session data available</p>
      </div>
    );
  }

  if (showGeneralLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Overtakes Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Car className="h-8 w-8 mx-auto mb-2 animate-pulse" />
              <p className="text-muted-foreground">Loading race data...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (showNoDataError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Overtakes Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">No overtakes data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentSnapshotIndex = Math.floor((currentTime / 100) * (positionSnapshots.length - 1));
  const totalOvertakes = overtakesData?.data?.length || 0;

  // Debug info - ensure all dependencies are available
  const debugInfo = useMemo(() => {
    if (!driversData?.data || !positionSnapshots || !driverStats) {
      return {
        totalDriversInData: 0,
        driversWithColors: 0,
        allDriversCount: 0,
        snapshotsCount: 0,
        firstSnapshotPositions: 0,
        driverStatsCount: 0
      };
    }
    
    return {
      totalDriversInData: driversData.data.length,
      driversWithColors: Object.keys(drivers).length,
      allDriversCount: allDrivers.length,
      snapshotsCount: positionSnapshots.length,
      firstSnapshotPositions: positionSnapshots[0] ? Object.keys(positionSnapshots[0].positions).length : 0,
      driverStatsCount: driverStats.length
    };
  }, [driversData, drivers, allDrivers, positionSnapshots, driverStats]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5" />
              Race Overtakes Analysis - {sessionName}
            </CardTitle>
            <div className="flex items-center gap-4 mt-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                {totalOvertakes} Total Overtakes
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Snapshot {currentSnapshotIndex + 1}/{positionSnapshots.length}
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {debugInfo.allDriversCount} Drivers Loaded
              </Badge>
              {currentSnapshot && currentSnapshot.overtakes.length > 0 && (
                <Badge variant="destructive">
                  {currentSnapshot.overtakes.length} Active Now!
                </Badge>
              )}
            </div>
            {/* Debug Info */}
            <div className="text-xs text-muted-foreground mt-2 grid grid-cols-3 gap-2">
              <span>Data: {debugInfo.totalDriversInData} drivers</span>
              <span>Colors: {debugInfo.driversWithColors} mapped</span>
              <span>Stats: {debugInfo.driverStatsCount} processed</span>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Unified Control Panel */}
        <div className="bg-muted/20 rounded-lg p-4 space-y-3">
          {/* Progress bar */}
          <div className="space-y-2">
            <Slider
              value={[currentTime]}
              onValueChange={([value]) => setCurrentTime(value)}
              max={100}
              step={0.1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Race Start</span>
              <span>{currentTime.toFixed(1)}% Complete</span>
              <span>Race Finish</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentTime(Math.max(0, currentTime - 10))}>
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button onClick={handlePlay} size="sm">
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentTime(Math.min(100, currentTime + 10))}>
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm">Speed:</span>
              {[1, 2, 4, 8].map(speed => (
                <button
                  key={speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  className={`px-2 py-1 rounded text-xs ${
                    playbackSpeed === speed
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Layout - Two Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Left: Position Flow with 20 Lines */}
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <TrendingUp className="h-4 w-4" />
              Position Flow (P1-P20)
            </h3>
            
            <div className="bg-muted/10 rounded-lg p-4 h-[500px] overflow-hidden">
              <div className="relative h-full">
                {/* 20 Position lines */}
                <div className="absolute inset-0 flex flex-col justify-between py-2">
                  {Array.from({ length: 20 }, (_, i) => i + 1).map(pos => (
                    <div key={pos} className="relative">
                      <div className="h-0.5 bg-muted/50 w-full"></div>
                      <span className="absolute -left-8 -top-2 text-xs text-muted-foreground">P{pos}</span>
                    </div>
                  ))}
                </div>

                {/* Driver position dots */}
                <div className="absolute inset-0 pl-2">
                  {allDrivers && allDrivers.length > 0 && allDrivers.map((driverNumber) => {
                    const driver = drivers[driverNumber];
                    if (!driver) return null;

                    // Get position data for this driver
                    const startPos = positionSnapshots[0]?.positions[driverNumber];
                    const currentPos = currentSnapshot?.positions[driverNumber];
                    const progress = currentTime / 100;

                    // Check if driver ever had position data
                    const hadPositionData = positionSnapshots.some(snapshot => snapshot.positions[driverNumber]);
                    
                    // Determine display position and status
                    let displayPos: number;
                    let isDNF = false;
                    
                    if (!hadPositionData) {
                      // Driver never participated (DNS)
                      displayPos = 21; // Show below P20
                      isDNF = true;
                    } else if (currentPos) {
                      // Driver has current position
                      displayPos = Math.min(currentPos, 20);
                    } else if (startPos) {
                      // Driver had starting position but no current (DNF)
                      displayPos = Math.min(startPos, 20);
                      isDNF = currentTime > 10; // Only mark as DNF if we're into the race
                    } else {
                      // Fallback
                      displayPos = 20;
                      isDNF = true;
                    }
                    
                    // Calculate Y position (cap at P20 for visual purposes)
                    const visualPos = Math.min(displayPos, 20);
                    const currentY = ((visualPos - 1) / 19) * 100;
                    
                    return (
                      <div
                        key={driverNumber}
                        className={`absolute transition-all duration-500 ${
                          selectedDriver === driverNumber ? 'z-20 scale-110' : 'z-10'
                        } ${isDNF ? 'opacity-60' : ''}`}
                        style={{
                          left: `${progress * 90}%`,
                          top: `${currentY}%`,
                          transform: 'translate(-50%, -50%)'
                        }}
                      >
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 shadow cursor-pointer transition-all duration-300 ${
                            selectedDriver === driverNumber
                              ? 'border-white shadow-lg'
                              : displayPos === 1
                                ? 'border-yellow-400'
                                : displayPos === 2
                                  ? 'border-gray-400'
                                  : displayPos === 3
                                    ? 'border-amber-400'
                                    : 'border-white/20'
                          } ${isDNF ? 'grayscale' : ''}`}
                          style={{
                            backgroundColor: driver.color,
                            color: driver.color === '#FFFFFF' ? '#000' : '#fff',
                          }}
                          onClick={() => setSelectedDriver(
                            selectedDriver === driverNumber ? null : driverNumber
                          )}
                          title={`${driver.acronym} - P${displayPos}${isDNF ? ' (DNF)' : ''}`}
                        >
                          {driver.number}
                        </div>
                        {isDNF && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full text-white text-xs flex items-center justify-center">
                            ×
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Driver Statistics Grid */}
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Users className="h-4 w-4" />
              Driver Statistics
            </h3>
            
            <div className="grid grid-cols-1 gap-2 max-h-[500px] overflow-y-auto">
              {driverStats && driverStats.length > 0 && driverStats.map(stat => (
                <div
                  key={stat.driver_number}
                  className={`flex items-center gap-2 p-3 rounded border transition-all duration-300 cursor-pointer ${
                    selectedDriver === stat.driver_number
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-muted hover:bg-muted/30'
                  } ${stat.status === 'dnf' ? 'opacity-70' : ''}`}
                  onClick={() => setSelectedDriver(
                    selectedDriver === stat.driver_number ? null : stat.driver_number
                  )}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold border-2 relative"
                    style={{
                      backgroundColor: stat.color,
                      color: stat.color === '#FFFFFF' ? '#000' : '#fff',
                      borderColor: stat.color
                    }}
                  >
                    {stat.driver_number}
                    {stat.status === 'dnf' && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center">
                        ×
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{stat.acronym}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <span>
                        P{stat.starting_position}→{stat.status === 'dnf' ? 'DNF' : `P${stat.final_position}`}
                      </span>
                      <span className={`font-medium ${
                        stat.status === 'dnf' ? 'text-red-600' :
                        stat.position_change > 0 ? 'text-green-600' : 
                        stat.position_change < 0 ? 'text-red-600' : 'text-muted-foreground'
                      }`}>
                        {stat.status === 'dnf' ? 'DNF' :
                         stat.position_change > 0 ? `+${stat.position_change}` : 
                         stat.position_change === 0 ? '±0' : stat.position_change}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-sm font-bold text-green-600">{stat.overtakes_made}</div>
                    <div className="text-xs text-red-600">{stat.overtakes_suffered}</div>
                  </div>
                  
                  <div className="text-right">
                    <div className={`text-sm font-bold ${stat.net_overtakes >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {stat.net_overtakes >= 0 ? '+' : ''}{stat.net_overtakes}
                    </div>
                    <div className="text-xs text-muted-foreground">Net</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default OvertakesAnalysis;