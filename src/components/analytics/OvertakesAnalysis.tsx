import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Car } from "lucide-react";
import { usePositionData, useDrivers, useOvertakes, useLaps, useStartingGrid, useOpenF1SessionFromErgast } from "@/hooks/useOpenF1Data";
import RaceAnimationFlow from './RaceAnimationFlow';
import DriverStatsGrid from './DriverStatsGrid';

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
  lapNumber?: number;
  totalLaps?: number;
}

interface DriverInfo {
  number: number;
  name: string;
  acronym: string;
  team: string;
  color: string;
}

const OvertakesAnalysis: React.FC<OvertakesAnalysisProps> = ({
  year,
  round,
  sessionKey: externalSessionKey,
  sessionName = "Race"
}) => {
  const [selectedDriver, setSelectedDriver] = useState<number | null>(null);
  const [focusMode, setFocusMode] = useState<boolean>(false);

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
  const { data: lapsData, isLoading: isLapsLoading } = useLaps(effectiveSessionKey);
  const { data: startingGridData, isLoading: isStartingGridLoading } = useStartingGrid(effectiveSessionKey);
  
  // Debug the starting grid data
  console.log(`Starting grid debug - sessionKey: ${effectiveSessionKey}, loading: ${isStartingGridLoading}, data:`, startingGridData);

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
    if (!driversData?.data) {
      console.log('No drivers data available');
      return {};
    }
    
    console.log(`Processing ${driversData.data.length} drivers from API`);
    
    const driverMap: { [key: number]: DriverInfo } = {};
    driversData.data.forEach((driver: any) => {
      driverMap[driver.driver_number] = {
        number: driver.driver_number,
        name: `${driver.first_name} ${driver.last_name}`,
        acronym: driver.name_acronym || `${driver.first_name.charAt(0)}${driver.last_name.charAt(0)}${driver.driver_number}`,
        team: driver.team_name || 'Unknown',
        color: teamColors[driver.team_name] || '#666666'
      };
      console.log(`Driver ${driver.driver_number}: ${driver.first_name} ${driver.last_name} (${driver.team_name})`);
    });
    
    console.log(`Created driver map with ${Object.keys(driverMap).length} drivers`);
    return driverMap;
  }, [driversData]);

  // Precompute related drivers based on overtakes data for the selected driver
  const relatedDrivers = useMemo((): Set<number> => {
    const related = new Set<number>();
    if (!selectedDriver) return related;
    const list: any[] = overtakesData?.data || [];
    for (const o of list) {
      if (o.overtaking_driver_number === selectedDriver) {
        related.add(o.overtaken_driver_number);
      }
      if (o.overtaken_driver_number === selectedDriver) {
        related.add(o.overtaking_driver_number);
      }
    }
    return related;
  }, [selectedDriver, overtakesData]);

  // Process position data into snapshots with lap information
  const positionSnapshots = useMemo((): PositionSnapshot[] => {
    // POSITION DATA is now the primary source - we need it to initialize drivers
    if (!positionData?.data) return [];

    const positionsByTime: { [timestamp: string]: { [driverNumber: number]: number } } = {};
    const overtakesByTime: { [timestamp: string]: Array<{overtaking: number, overtaken: number, position: number}> } = {};
    const lapsByTime: { [timestamp: string]: number } = {};
    
    // Process position data - this is our primary source
    // Only include valid positions (1-20, or reasonable race positions)
    positionData.data.forEach((pos: any) => {
      // Filter out invalid positions
      if (!pos.position || pos.position < 1 || pos.position > 25) {
        return; // Skip invalid position data
      }
      
      const timestamp = new Date(pos.date).toISOString();
      if (!positionsByTime[timestamp]) positionsByTime[timestamp] = {};
      positionsByTime[timestamp][pos.driver_number] = pos.position;
    });

    // Process overtakes data for statistics (optional)
    if (overtakesData?.data) {
      overtakesData.data.forEach((overtake: any) => {
        const timestamp = new Date(overtake.date).toISOString();
        if (!overtakesByTime[timestamp]) overtakesByTime[timestamp] = [];
        overtakesByTime[timestamp].push({
          overtaking: overtake.overtaking_driver_number,
          overtaken: overtake.overtaken_driver_number,
          position: overtake.position
        });
      });
    }

    // Process lap data to map timestamps to lap numbers
    if (lapsData?.data) {
      lapsData.data.forEach((lap: any) => {
        if (lap.date_start) {
          const timestamp = new Date(lap.date_start).toISOString();
          lapsByTime[timestamp] = lap.lap_number;
        }
      });
    }

    // Calculate total laps
    const totalLaps = lapsData?.data ? Math.max(...lapsData.data.map((lap: any) => lap.lap_number || 0)) : 0;

    // Create initial snapshot - combine starting grid with all drivers that appear in data
    const initialPositions: { [driverNumber: number]: number } = {};
    
    // Add from starting grid if available
    if (startingGridData?.data) {
      startingGridData.data.forEach((gridEntry: any) => {
        initialPositions[gridEntry.driver_number] = gridEntry.position;
      });
    }
    
    // If no starting grid, create initial positions from first appearance of each driver
    if (Object.keys(initialPositions).length === 0) {
      console.log('No starting grid data, creating initial positions from position data');
      const allDriversInRace = new Set<number>();
      
      // Collect all drivers that appear in position data
      Object.values(positionsByTime).forEach(positions => {
        Object.keys(positions).forEach(driverNum => {
          allDriversInRace.add(parseInt(driverNum));
        });
      });
      
      // Create initial positions for each driver based on their first appearance
      let position = 1;
      Array.from(allDriversInRace).sort((a, b) => a - b).forEach(driverNum => {
        if (position <= 20) {
          initialPositions[driverNum] = position++;
        }
      });
      
      console.log(`Created initial positions for ${Object.keys(initialPositions).length} drivers:`, 
        Object.entries(initialPositions).map(([num, pos]) => `${num}:P${pos}`).join(', '));
    }

    const timestamps = Object.keys(positionsByTime).sort();
    const snapshots: PositionSnapshot[] = [];
    
    // Add initial snapshot if we have any starting positions
    if (Object.keys(initialPositions).length > 0) {
      snapshots.push({
        timestamp: new Date(timestamps[0] || Date.now()),
        positions: initialPositions,
        overtakes: [],
        lapNumber: 1,
        totalLaps: totalLaps
      });
    }

    let lastPositions: { [driverNumber: number]: number } = { ...initialPositions };
    let currentLap = 1;

    timestamps.forEach((timestamp, index) => {
      const currentPositions = { ...lastPositions, ...positionsByTime[timestamp] };
      
      // Try to determine lap number from timestamp
      const lapNumber = lapsByTime[timestamp] || currentLap;
      
      // Update current lap for next iteration
      if (lapsByTime[timestamp]) {
        currentLap = lapsByTime[timestamp];
      } else if (index > 0) {
        // Estimate lap based on race progress
        const progress = index / (timestamps.length - 1);
        currentLap = Math.max(1, Math.floor(progress * totalLaps));
      }

      snapshots.push({
        timestamp: new Date(timestamp),
        positions: currentPositions,
        overtakes: overtakesByTime[timestamp] || [],
        lapNumber: lapNumber,
        totalLaps: totalLaps
      });
      lastPositions = currentPositions;
    });

    console.log(`Created ${snapshots.length} position snapshots`);
    if (snapshots.length > 0) {
      const firstSnapshot = snapshots[0];
      const lastSnapshot = snapshots[snapshots.length - 1];
      console.log(`First snapshot: ${Object.keys(firstSnapshot.positions).length} drivers, positions:`, 
        Object.entries(firstSnapshot.positions).map(([num, pos]) => `${num}:P${pos}`).join(', '));
      console.log(`Last snapshot: ${Object.keys(lastSnapshot.positions).length} drivers`);
    }
    return snapshots;
  }, [positionData, overtakesData, lapsData, startingGridData]);

  const isLoading = isSessionLoading || isPositionLoading || isDriversLoading || isOvertakesLoading || isLapsLoading || isStartingGridLoading;

  // Show loading if we're still fetching session data and don't have an external key
  const showSessionLoading = !externalSessionKey && isSessionLoading;
  
  // If we don't have a valid session key, show error
  const showNoSessionError = !effectiveSessionKey && !isLoading;
  
  // Show general loading
  const showGeneralLoading = isLoading && effectiveSessionKey;
  
  // Show no data error only if we have no position data (overtakes are optional)
  const showNoDataError = !isLoading && effectiveSessionKey && (!positionData?.data || positionData.data.length === 0);

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
            <p className="text-muted-foreground">No position data available for this session</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalOvertakes = overtakesData?.data?.length || 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Global controls */}
      <div className="flex items-center justify-end gap-2 flex-wrap">
        <button
          className={`px-2.5 sm:px-3 py-1.5 rounded text-[11px] sm:text-xs border transition-colors ${
            focusMode ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-foreground border-border hover:bg-muted/80'
          } ${!selectedDriver ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={() => selectedDriver && setFocusMode((v) => !v)}
          title="Show only the selected driver and their direct overtake rivals"
        >
          Focus {focusMode ? 'On' : 'Off'}{!selectedDriver ? ' (select a driver)' : ''}
        </button>
      </div>

      {/* Race Animation Flow */}
      <RaceAnimationFlow 
        drivers={drivers}
        positionSnapshots={positionSnapshots}
        totalOvertakes={totalOvertakes}
        selectedDriver={selectedDriver}
        onDriverSelect={setSelectedDriver}
        startingGridData={startingGridData}
        relatedDrivers={relatedDrivers}
        focusMode={focusMode}
      />
      
      {/* Driver Statistics Grid */}
      <DriverStatsGrid 
        drivers={drivers}
        positionSnapshots={positionSnapshots}
        overtakesData={overtakesData?.data || []}
        selectedDriver={selectedDriver}
        onDriverSelect={setSelectedDriver}
        startingGridData={startingGridData}
        relatedDrivers={relatedDrivers}
        focusMode={focusMode}
      />
    </div>
  );
};

export default OvertakesAnalysis;