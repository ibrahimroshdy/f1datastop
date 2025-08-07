import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Users } from "lucide-react";

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

interface DriverStatsGridProps {
  drivers: { [key: number]: Driver };
  positionSnapshots: PositionSnapshot[];
  overtakesData: any[];
  selectedDriver: number | null;
  onDriverSelect: (driverNumber: number | null) => void;
  startingGridData?: any;
  relatedDrivers?: Set<number>;
  focusMode?: boolean;
}

const DriverStatsGrid: React.FC<DriverStatsGridProps> = ({
  drivers,
  positionSnapshots,
  overtakesData,
  selectedDriver,
  onDriverSelect,
  startingGridData,
  relatedDrivers,
  focusMode = false
}) => {
  // Calculate driver statistics
  const driverStats = useMemo((): DriverStats[] => {
    if (!drivers || !positionSnapshots.length) return [];
    
    console.log(`Processing driver stats for ${Object.keys(drivers).length} drivers`);

    const stats: { [key: number]: DriverStats } = {};
    const firstSnapshot = positionSnapshots[0];
    const lastSnapshot = positionSnapshots[positionSnapshots.length - 1];

    // Get all drivers from starting grid first, then supplement with drivers data
    const allDriverNumbers = new Set<number>();
    
    // Add all drivers from starting grid
    if (startingGridData?.data) {
      startingGridData.data.forEach((gridEntry: any) => {
        allDriverNumbers.add(gridEntry.driver_number);
      });
    }
    
    // Add any additional drivers from drivers data
    Object.values(drivers).forEach((driver) => {
      allDriverNumbers.add(driver.number);
    });
    
    // Initialize stats for all drivers (prioritizing those in starting grid)
    Array.from(allDriverNumbers).forEach((driverNumber) => {
      const driver = drivers[driverNumber];
      if (!driver) return; // Skip if we don't have driver info
      // Check if driver ever had position data
      const hadPositionData = positionSnapshots.some(snapshot => snapshot.positions[driverNumber]);
      
      // Get starting grid position if available, otherwise use first snapshot
      const gridPos = startingGridData?.data?.find((grid: any) => grid.driver_number === driverNumber)?.position;
      
      // Use more lenient position validation (1-25 to catch edge cases)
      const validGridPos = (gridPos && gridPos >= 1 && gridPos <= 25) ? gridPos : null;
      
      // Find the earliest valid position for this driver in ANY snapshot (not just first)
      let earliestValidPos = null;
      for (const snapshot of positionSnapshots) {
        if (snapshot.positions[driverNumber] && 
            snapshot.positions[driverNumber] >= 1 && 
            snapshot.positions[driverNumber] <= 25) {
          earliestValidPos = snapshot.positions[driverNumber];
          break; // Use the first valid position we find
        }
      }
      
      let startPos = validGridPos || earliestValidPos;
      
      // If no valid starting position, create a fallback
      if (!startPos) {
        console.log(`Driver ${driverNumber}: No valid starting position, using fallback`);
        startPos = 20; // Default to back of grid
      }
      
      console.log(`Driver ${driverNumber} (${driver.name}): gridPos=${gridPos}, startPos=${startPos}`);
      
      const finalPos = lastSnapshot?.positions[driverNumber];
      
      // Determine driver status based on final position
      let status: 'running' | 'dnf' = 'running';
      let displayFinalPos = finalPos;
      
      if (!finalPos) {
        // No final position - check if they had position data during race
        if (!hadPositionData) {
          status = 'dnf'; // DNS (Did Not Start)
          displayFinalPos = 21;
        } else {
          status = 'dnf'; // DNF (Did Not Finish)
          displayFinalPos = 21;
        }
      } else if (finalPos > 20) {
        // Finished but outside points
        status = 'dnf';
        displayFinalPos = finalPos; // Keep actual position for reference
      } else {
        // Normal finish in points
        displayFinalPos = finalPos;
      }

      stats[driverNumber] = {
        driver_number: driverNumber,
        name: driver.name,
        acronym: driver.acronym,
        team: driver.team,
        color: driver.color,
        overtakes_made: 0,
        overtakes_suffered: 0,
        net_overtakes: 0,
        starting_position: startPos,
        final_position: displayFinalPos,
        position_change: status === 'dnf' ? -(displayFinalPos - startPos) : (startPos - (finalPos || startPos)),
        status: status
      };
    });

    // Process overtakes to get accurate counts (if available)
    if (overtakesData && overtakesData.length > 0) {
      overtakesData.forEach((overtake: any) => {
        const overtakingNumber = overtake.overtaking_driver_number;
        const overtakenNumber = overtake.overtaken_driver_number;

        if (stats[overtakingNumber]) stats[overtakingNumber].overtakes_made++;
        if (stats[overtakenNumber]) stats[overtakenNumber].overtakes_suffered++;
      });
    }

    // Calculate net overtakes
    Object.values(stats).forEach(stat => {
      stat.net_overtakes = stat.overtakes_made - stat.overtakes_suffered;
    });

    // Sort by net overtakes, then by final position
    return Object.values(stats).sort((a, b) => {
      if (b.net_overtakes !== a.net_overtakes) return b.net_overtakes - a.net_overtakes;
      return a.final_position - b.final_position;
    });
  }, [drivers, positionSnapshots, overtakesData, startingGridData]);

  if (!driverStats.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Driver Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">No driver statistics available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Driver Statistics ({driverStats.length} drivers)
          </CardTitle>
        </CardHeader>
        <CardContent>
        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10 gap-2 max-h-none sm:max-h-[400px] overflow-visible sm:overflow-y-auto">
          {driverStats.map(stat => {
            // Determine if this driver should be highlighted when a driver is selected
            let shouldHighlight = true;
            let isRelatedDriver = false;
            
            if (selectedDriver !== null && selectedDriver !== stat.driver_number) {
              // Check if this driver has overtaking relationship with selected driver
              const hasOvertakeRelation = relatedDrivers?.has(stat.driver_number);
              if (hasOvertakeRelation) {
                isRelatedDriver = true;
                shouldHighlight = true;
              } else {
                shouldHighlight = !focusMode;
              }
            }
            
            // Adaptive text colors for better contrast on highlighted cards
            const isSelected = selectedDriver === stat.driver_number;
            const nameTextClass = isSelected
              ? 'text-blue-900'
              : isRelatedDriver
                ? 'text-orange-900'
                : 'text-foreground';
            const teamTextClass = isSelected
              ? 'text-blue-700'
              : isRelatedDriver
                ? 'text-orange-700'
                : 'text-muted-foreground';
            const posTextClass = isSelected
              ? 'text-blue-900'
              : isRelatedDriver
                ? 'text-orange-900'
                : 'text-foreground';

            return (
            <div
              key={stat.driver_number}
              className={`flex flex-col items-center gap-1 p-2 rounded border transition-all duration-500 cursor-pointer min-w-0 ${
                selectedDriver === stat.driver_number
                  ? 'border-blue-400 bg-blue-50 shadow-lg ring-2 ring-blue-400/50 scale-105'
                  : isRelatedDriver
                    ? 'border-orange-400 bg-orange-50 shadow-md ring-1 ring-orange-400/30'
                    : 'border-muted hover:bg-muted/30 hover:shadow-sm'
              } ${stat.status === 'dnf' ? 'opacity-70' : ''} ${
                !shouldHighlight ? (focusMode ? 'opacity-20 pointer-events-none grayscale' : 'opacity-40 grayscale') : ''
              }`}
              onClick={() => onDriverSelect(
                selectedDriver === stat.driver_number ? null : stat.driver_number
              )}
            >
              {/* Driver Number Circle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 relative shrink-0"
                    style={{
                      backgroundColor: stat.color,
                      color: stat.color === '#FFFFFF' ? '#000' : '#fff',
                      borderColor: stat.color
                    }}
                  >
                    {stat.driver_number}
                    {stat.status === 'dnf' && (
                      <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full text-white text-xs flex items-center justify-center">
                        ×
                      </div>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{stat.name}</p>
                  <p className="text-sm text-muted-foreground">Driver #{stat.driver_number} - {stat.team}</p>
                  {stat.status === 'dnf' && <p className="text-sm text-red-500">Did Not Finish (DNF)</p>}
                </TooltipContent>
              </Tooltip>
              
              {/* Driver Info */}
              <div className="text-center min-w-0 w-full">
                <div className={`text-[11px] sm:text-xs font-semibold truncate ${nameTextClass}`}>{stat.acronym}</div>
                <div className={`text-[10px] sm:text-xs truncate leading-tight ${teamTextClass}`} title={stat.team}>
                  {stat.team.length > 8 ? stat.team.substring(0, 8) + '...' : stat.team}
                </div>
              </div>
              
              {/* Position Change */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-center w-full cursor-help">
                    <div className={`text-xs font-semibold ${posTextClass}`}>
                      P{stat.starting_position}→{stat.status === 'dnf' ? 'DNF' : `P${stat.final_position}`}
                    </div>
                    <div className={`text-xs font-medium ${
                      stat.status === 'dnf' ? 'text-red-600' :
                      stat.position_change > 0 ? 'text-green-600' : 
                      stat.position_change < 0 ? 'text-red-600' : 'text-muted-foreground'
                    }`}>
                      {stat.status === 'dnf' ? 'DNF' :
                       stat.position_change > 0 ? `+${stat.position_change}` : 
                       stat.position_change === 0 ? '±0' : stat.position_change}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">Position Flow</p>
                  <p className="text-sm">Started: P{stat.starting_position}</p>
                  <p className="text-sm">Finished: {stat.status === 'dnf' ? 'Did Not Finish' : `P${stat.final_position}`}</p>
                  {stat.status !== 'dnf' && (
                    <p className={`text-sm ${
                      stat.position_change > 0 ? 'text-green-600' : 
                      stat.position_change < 0 ? 'text-red-600' : 'text-muted-foreground'
                    }`}>
                      {stat.position_change > 0 ? `Gained ${stat.position_change} positions` : 
                       stat.position_change < 0 ? `Lost ${Math.abs(stat.position_change)} positions` : 
                       'No position change'}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
              
              {/* Overtakes Stats - Compact */}
              <div className="grid grid-cols-3 gap-1 w-full text-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help">
                      <div className="text-xs font-bold text-green-600">{stat.overtakes_made}</div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">Overtakes Made</p>
                    <p className="text-sm">Number of drivers this driver overtook during the race</p>
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help">
                      <div className="text-xs font-bold text-red-600">{stat.overtakes_suffered}</div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">Overtakes Suffered</p>
                    <p className="text-sm">Number of times this driver was overtaken by others</p>
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help">
                      <div className={`text-xs font-bold ${stat.net_overtakes >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {stat.net_overtakes >= 0 ? '+' : ''}{stat.net_overtakes}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">Net Overtakes</p>
                    <p className="text-sm">Overtakes Made minus Overtakes Suffered</p>
                    <p className="text-xs text-muted-foreground">
                      {stat.net_overtakes > 0 ? 'Positive = More aggressive/successful' : 
                       stat.net_overtakes < 0 ? 'Negative = More overtaken than overtaking' : 
                       'Zero = Balanced overtaking activity'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            );
          })}
        </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default DriverStatsGrid;