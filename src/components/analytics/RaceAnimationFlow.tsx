import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  Car,
  TrendingUp,
  Users,
  Zap,
  Clock
} from "lucide-react";

interface Driver {
  number: number;
  name: string;
  acronym: string;
  team: string;
  color: string;
}

interface PositionSnapshot {
  timestamp: Date;
  positions: { [driverNumber: number]: number };
  overtakes: Array<{
    overtaking: number;
    overtaken: number;
    position: number;
  }>;
  lapNumber?: number;
  totalLaps?: number;
}

interface RaceAnimationFlowProps {
  drivers: { [key: number]: Driver };
  positionSnapshots: PositionSnapshot[];
  totalOvertakes: number;
  selectedDriver?: number | null;
  onDriverSelect?: (driverNumber: number | null) => void;
  startingGridData?: any;
  relatedDrivers?: Set<number>;
  focusMode?: boolean;
}

const RaceAnimationFlow: React.FC<RaceAnimationFlowProps> = ({
  drivers,
  positionSnapshots,
  totalOvertakes,
  selectedDriver = null,
  onDriverSelect,
  startingGridData,
  relatedDrivers,
  focusMode = false
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(2);
  
  const animationRef = useRef<number>();
  const lastUpdateRef = useRef<number>(0);

  // Get all drivers sorted by starting grid position
  const allDrivers = useMemo(() => {
    if (!drivers || !positionSnapshots.length) return [];
    
    // Get all drivers who appear in position data OR starting grid
    const allDriverNumbers = new Set<number>();
    
    // Add drivers from position snapshots (this ensures we get everyone who raced)
    positionSnapshots.forEach(snapshot => {
      Object.keys(snapshot.positions).forEach(driverNum => {
        allDriverNumbers.add(parseInt(driverNum));
      });
    });
    
    // Also add drivers from starting grid to catch any missing ones
    if (startingGridData?.data) {
      startingGridData.data.forEach((gridEntry: any) => {
        allDriverNumbers.add(gridEntry.driver_number);
      });
    }
    
    console.log(`Total driver numbers found: ${allDriverNumbers.size}:`, Array.from(allDriverNumbers).join(', '));
    console.log(`Available driver info for:`, Object.keys(drivers).join(', '));
    console.log(`Starting grid data:`, startingGridData?.data?.map((g: any) => `${g.driver_number}:P${g.position}`).join(', ') || 'none');
    
    // Filter to only include drivers we have driver info for
    const validDrivers = Array.from(allDriverNumbers).filter(num => drivers[num]);
    console.log(`Valid drivers (with driver info): ${validDrivers.length}:`, validDrivers.join(', '));
    
    // Create grid position map for sorting
    const gridPositions: { [driverNumber: number]: number } = {};
    if (startingGridData?.data) {
      startingGridData.data.forEach((gridEntry: any) => {
        gridPositions[gridEntry.driver_number] = gridEntry.position;
      });
    }
    
    // Check which drivers appear in ANY snapshot (not just the first one)
    const driversWithValidPositions = validDrivers.filter(driverNum => {
      const gridPos = gridPositions[driverNum];
      
      // Check if driver appears in ANY snapshot, not just the first
      const appearsInSnapshots = positionSnapshots.some(snapshot => 
        snapshot.positions[driverNum] && 
        snapshot.positions[driverNum] >= 1 && 
        snapshot.positions[driverNum] <= 25
      );
      
      const validPos = (gridPos && gridPos >= 1 && gridPos <= 25) || appearsInSnapshots;
      
      console.log(`Driver ${driverNum}: gridPos=${gridPos}, appearsInSnapshots=${appearsInSnapshots}, valid=${validPos}`);
      return validPos;
    });
    
    console.log(`Drivers with valid positions: ${driversWithValidPositions.length}:`, driversWithValidPositions.join(', '));
    
    // Sort by starting grid position
    const sortedDrivers = driversWithValidPositions.sort((a, b) => {
      const startPosA = gridPositions[a] || positionSnapshots[0]?.positions[a] || 99;
      const startPosB = gridPositions[b] || positionSnapshots[0]?.positions[b] || 99;
      return startPosA - startPosB;
    });
    
    console.log(`Found ${sortedDrivers.length} drivers with valid positions:`, 
      sortedDrivers.map(num => `${num}:P${gridPositions[num] || positionSnapshots[0]?.positions[num] || '?'}`).join(', '));
    
    return sortedDrivers;
  }, [drivers, positionSnapshots, startingGridData]);

  // Current snapshot based on time
  const currentSnapshot = useMemo(() => {
    if (positionSnapshots.length === 0) return null;
    const index = Math.min(
      Math.floor((currentTime / 100) * (positionSnapshots.length - 1)),
      positionSnapshots.length - 1
    );
    return positionSnapshots[index];
  }, [positionSnapshots, currentTime]);

  // Animation loop
  useEffect(() => {
    if (!isPlaying) return;

    const animate = (timestamp: number) => {
      const deltaTime = timestamp - lastUpdateRef.current;
      
      if (deltaTime >= (1000 / (playbackSpeed * 3))) {
        setCurrentTime(prev => {
          const next = prev + (100 / Math.max(positionSnapshots.length, 1)) * playbackSpeed;
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

  const currentSnapshotIndex = Math.floor((currentTime / 100) * Math.max(positionSnapshots.length - 1, 0));

  if (!positionSnapshots.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Race Animation Flow
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">No race data available for animation</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5" />
              Race Animation Flow
            </CardTitle>
            <div className="flex items-center gap-2 mt-2 flex-wrap sm:flex-nowrap overflow-x-auto whitespace-nowrap">
              <Badge variant="outline" className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                {totalOvertakes} Total Overtakes
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {currentSnapshot?.lapNumber && currentSnapshot?.totalLaps 
                  ? `Lap ${currentSnapshot.lapNumber}/${currentSnapshot.totalLaps}`
                  : `Snapshot ${currentSnapshotIndex + 1}/${positionSnapshots.length}`
                }
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {allDrivers.length} Drivers
              </Badge>
              {startingGridData?.data && (
                <Badge variant="outline" className="flex items-center gap-1">
                  🏁 {startingGridData.data.length} Grid Positions
                </Badge>
              )}
              {currentSnapshot && currentSnapshot.overtakes.length > 0 && (
                <Badge variant="destructive">
                  {currentSnapshot.overtakes.length} Active Now!
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Control Panel */}
        <div className="bg-muted/20 rounded-lg p-3 sm:p-4 space-y-3">
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
              <span>
                {currentSnapshot?.lapNumber && currentSnapshot?.totalLaps 
                  ? `Lap ${currentSnapshot.lapNumber}/${currentSnapshot.totalLaps}`
                  : `${currentTime.toFixed(1)}% Complete`
                }
              </span>
              <span>Race Finish</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
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
              <span className="text-xs sm:text-sm">Speed:</span>
              {[1, 2, 4, 8].map(speed => (
                <button
                  key={speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  className={`px-2 py-1 rounded text-[11px] sm:text-xs ${
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

        {/* Position Flow Visualization */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-base sm:text-lg font-semibold">
              <TrendingUp className="h-4 w-4" />
              Position Flow (P1-P20)
            </h3>
            <Badge variant="outline" className="text-[10px] sm:text-xs">
              {allDrivers.length} drivers initialized
            </Badge>
          </div>
          
          <div className="bg-muted/10 rounded-lg p-2 sm:p-4 h-[400px] sm:h-[550px] overflow-hidden">
            <div className="relative h-full">
              {/* Lap counter overlay */}
              {currentSnapshot && (
                <div className="absolute top-2 right-2 sm:right-3 z-30 bg-background/80 backdrop-blur-sm border border-border rounded-md px-2.5 py-1 shadow-sm">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none">Lap</div>
                  <div className="text-xs sm:text-sm font-semibold leading-tight">
                    {currentSnapshot.lapNumber && currentSnapshot.totalLaps
                      ? `${currentSnapshot.lapNumber}/${currentSnapshot.totalLaps}`
                      : `${currentTime.toFixed(0)}%`}
                  </div>
                </div>
              )}
              {/* Driver position dots - clean layout without position lines */}
              <div className="absolute inset-0 p-2 sm:p-4">
                {(() => {
                  // Calculate positions for all drivers first to handle overlaps
                  const driverPositions: any[] = allDrivers.map((driverNumber, driverIndex) => {
                    const driver = drivers[driverNumber];
                    if (!driver) return null;

                    const gridPos = startingGridData?.data?.find((grid: any) => grid.driver_number === driverNumber)?.position;
                    let earliestValidPos = null;
                    for (const snapshot of positionSnapshots) {
                      if (snapshot.positions[driverNumber] && 
                          snapshot.positions[driverNumber] >= 1 && 
                          snapshot.positions[driverNumber] <= 20) {
                        earliestValidPos = snapshot.positions[driverNumber];
                        break;
                      }
                    }
                    const baseStartingPos = (gridPos && gridPos >= 1 && gridPos <= 20) ? gridPos : earliestValidPos;
                    const currentPos = currentSnapshot?.positions[driverNumber];
                    
                    let displayPos;
                    if (!baseStartingPos) {
                      const fallbackPos = driverIndex + 1;
                      displayPos = Math.min(fallbackPos, 20);
                    } else {
                      if (currentPos && currentPos >= 1 && currentPos <= 20) {
                        displayPos = currentPos;
                      } else if (currentPos && currentPos > 20) {
                        displayPos = 20;
                      } else {
                        displayPos = baseStartingPos;
                      }
                    }
                    displayPos = Math.max(1, Math.min(displayPos, 20));
                    
                    return {
                      driverNumber,
                      driverIndex,
                      displayPos,
                      driver,
                      gridPos,
                      currentPos,
                      baseStartingPos
                    };
                  }).filter(Boolean) as any[];
                  
                  // Group drivers by position and assign horizontal offsets
                  const positionGroups: { [pos: number]: Array<any> } = {};
                  driverPositions.forEach(driverData => {
                    if (!positionGroups[driverData.displayPos]) {
                      positionGroups[driverData.displayPos] = [];
                    }
                    positionGroups[driverData.displayPos].push(driverData);
                  });
                  
                  // Assign horizontal offsets within each position group
                  Object.values(positionGroups).forEach(group => {
                    group.forEach((driverData, indexInGroup) => {
                      driverData.horizontalOffset = indexInGroup * 8; // 8px spacing between overlapping drivers
                    });
                  });
                  
                  return driverPositions.map((driverData) => {
                    const { driverNumber, displayPos, driver, horizontalOffset } = driverData;
                    const progress = currentTime / 100;
                    const currentPos = currentSnapshot?.positions[driverNumber];
                    
                    // Determine DNF status
                    let isDNF = false;
                    if (currentPos && currentPos > 20) {
                      isDNF = true;
                    } else if (!currentPos && currentTime > 50) {
                      const hadEarlierPosition = positionSnapshots.slice(0, Math.floor(positionSnapshots.length * 0.3))
                        .some(snap => snap.positions[driverNumber] && snap.positions[driverNumber] <= 20);
                      isDNF = hadEarlierPosition;
                    }
                    
                    // Calculate Y position - free-flowing without position lines
                    const visualPos = Math.max(1, Math.min(displayPos, 20));
                    const currentY = ((visualPos - 1) / 19) * 90; // Better spread across the full height
                  
                    // Check if this driver is involved in current overtakes
                    const isOvertaking = currentSnapshot?.overtakes.some(o => 
                      o.overtaking === driverNumber || o.overtaken === driverNumber
                    );
                    
                    // Determine if this driver should be highlighted when a driver is selected
                    let shouldHighlight = true;
                    let isRelatedDriver = false;
                    
                    if (selectedDriver !== null && selectedDriver !== driverNumber) {
                      // Check if this driver is related to the selected driver through overtakes
                      const hasOvertakeRelation = relatedDrivers?.has(driverNumber);

                      if (hasOvertakeRelation) {
                        isRelatedDriver = true;
                        shouldHighlight = true;
                      } else {
                        shouldHighlight = !focusMode; // hide/dim only when focus mode is on
                      }
                    }
                  
                  return (
                    <div
                      key={driverNumber}
                      className={`absolute transition-all duration-500 ${
                        selectedDriver === driverNumber ? 'z-30 scale-125' : 
                        isRelatedDriver ? 'z-20 scale-110' : 'z-10'
                      } ${isDNF ? 'opacity-60' : ''} ${isOvertaking ? 'animate-pulse' : ''} ${
                        !shouldHighlight ? (focusMode ? 'opacity-0 pointer-events-none' : 'opacity-30') : ''
                      }`}
                      style={{
                        left: `calc(${progress * 90}% + ${horizontalOffset}px)`,
                        top: `${currentY}%`,
                        transform: 'translate(-50%, -50%)'
                      }}
                    >
                      <div className="relative">
                        {/* Position text - now floating next to driver */}
                        <div className={`absolute -left-7 sm:-left-10 top-1/2 -translate-y-1/2 text-[10px] sm:text-sm font-bold px-1 py-0.5 rounded ${
                          selectedDriver === driverNumber ? 'text-blue-600 bg-blue-50' :
                          isRelatedDriver ? 'text-orange-600 bg-orange-50' :
                          displayPos === 1 ? 'text-yellow-600 bg-yellow-50' :
                          displayPos <= 3 ? 'text-gray-600 bg-gray-50' :
                          'text-muted-foreground bg-muted/20'
                        }`}>
                          P{displayPos}
                        </div>
                        
                        <div
                          className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-white text-[10px] sm:text-xs font-bold border-2 shadow-xl cursor-pointer transition-all duration-500 ${
                            selectedDriver === driverNumber
                              ? 'border-white shadow-2xl ring-4 ring-blue-400/50'
                              : isRelatedDriver
                                ? 'border-orange-400 shadow-orange-400/70 ring-2 ring-orange-400/30'
                                : displayPos === 1
                                  ? 'border-yellow-400 shadow-yellow-400/60'
                                  : displayPos === 2
                                    ? 'border-gray-300 shadow-gray-400/60'
                                    : displayPos === 3
                                      ? 'border-amber-500 shadow-amber-600/60'
                                      : 'border-white/40'
                          } ${isDNF ? 'grayscale' : ''} ${isOvertaking ? 'ring-2 ring-red-500' : ''}`}
                          style={{
                            backgroundColor: driver.color,
                            color: driver.color === '#FFFFFF' ? '#000' : '#fff',
                          }}
                          onClick={() => onDriverSelect?.(
                            selectedDriver === driverNumber ? null : driverNumber
                          )}
                          title={`${driver.acronym} (${driver.name}) - Current: P${displayPos}${driverData.baseStartingPos ? ` | Started: P${driverData.baseStartingPos}` : ''}${isDNF ? ' (DNF)' : ''}${isOvertaking ? ' - OVERTAKING!' : ''}`}
                        >
                          {driver.number}
                        </div>
                      </div>
                      
                      {/* DNF indicator */}
                      {isDNF && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full text-white text-xs flex items-center justify-center">
                          ×
                        </div>
                      )}
                      
                      {/* Winner crown */}
                      {displayPos === 1 && !isDNF && currentTime > 90 && (
                        <div className="absolute -top-2 -left-1 text-yellow-400">
                          👑
                        </div>
                      )}
                      
                      {/* Overtake indicator */}
                      {isOvertaking && (
                        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
                        </div>
                      )}
                    </div>
                  );
                });
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Selected Driver Info */}
        {selectedDriver && drivers[selectedDriver] && (
          <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                style={{
                  backgroundColor: drivers[selectedDriver].color,
                  color: drivers[selectedDriver].color === '#FFFFFF' ? '#000' : '#fff',
                }}
              >
                {drivers[selectedDriver].number}
              </div>
              <div>
                <h4 className="font-semibold">{drivers[selectedDriver].name}</h4>
                <p className="text-sm text-muted-foreground">{drivers[selectedDriver].team}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-sm">
                  Current: <span className="font-bold">
                    P{currentSnapshot?.positions[selectedDriver] || 'N/A'}
                  </span>
                </p>
                {startingGridData?.data && (
                  <p className="text-xs text-muted-foreground">
                    Started: P{startingGridData.data.find((grid: any) => grid.driver_number === selectedDriver)?.position || 'N/A'}
                  </p>
                )}
              </div>
            </div>
            
            {/* Highlighting Legend */}
            <div className="mt-3 pt-3 border-t border-primary/20">
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded-full bg-blue-400 border-2 border-white ring-2 ring-blue-400/50"></div>
                  <span>Selected Driver</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded-full bg-orange-400 border-2 border-orange-400 ring-1 ring-orange-400/30"></div>
                  <span>Overtaking Partner</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded-full bg-gray-400 opacity-30"></div>
                  <span>Other Drivers (Dimmed)</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RaceAnimationFlow;