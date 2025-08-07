import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, Award, Medal, Clock, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useLapData, useDrivers, useOpenF1SessionFromErgast, usePositionData } from "@/hooks/useOpenF1Data";
import { formatTime } from "@/utils/lapTimeUtils";

interface SessionResultsProps {
  year: number;
  round: string;
  sessionType?: string;
  sessionKey?: number;
  sessionName?: string;
}

// Sorting types
type SortColumn = 'position' | 'driver' | 'constructor' | 'best_lap' | 'gap';
type SortDirection = 'asc' | 'desc';

interface ProcessedResult {
  position: number;
  driver_number: number;
  driver_name: string;
  driver_acronym: string;
  constructor_name: string;
  best_lap_time: number | null;
  gap_to_leader: string | null;
  total_laps: number;
}

const SessionResults: React.FC<SessionResultsProps> = ({
  year,
  round,
  sessionType = "Race",
  sessionKey: externalSessionKey,
  sessionName
}) => {
  // Add state for sorting
  const [sortColumn, setSortColumn] = useState<SortColumn>('position');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Reset state when session changes
  useEffect(() => {
    setSortColumn('position');
    setSortDirection('asc');
  }, [externalSessionKey]);

  // Get the OpenF1 session directly only if we don't have an external session key
  const { 
    data: sessionData, 
    isLoading: isSessionLoading 
  } = useOpenF1SessionFromErgast(
    externalSessionKey ? 0 : year, 
    externalSessionKey ? "" : round, 
    externalSessionKey ? "" : sessionType
  );

  // Use the external session key if provided, otherwise use the one from the hook
  const effectiveSessionKey = externalSessionKey || sessionData?.data?.session_key || 0;

  // Get drivers for the session
  const {
    data: driversData,
    isLoading: isDriversLoading
  } = useDrivers(effectiveSessionKey);

  // Get lap data for the session
  const {
    data: lapData,
    isLoading: isLapDataLoading,
    error: lapDataError
  } = useLapData(effectiveSessionKey);

  // Team colors mapping (same as LapTimeTab)
  const teamColors: { [key: string]: string } = {
    "Red Bull Racing": "rgb(6, 0, 239)", // Brighter blue
    "Ferrari": "rgb(255, 0, 0)", // Pure red
    "Mercedes": "rgb(0, 210, 190)", // Turquoise
    "McLaren": "rgb(255, 135, 0)", // Orange
    "Aston Martin": "rgb(0, 111, 98)", // Racing green
    "Alpine": "rgb(0, 144, 255)", // Blue
    "Williams": "rgb(0, 90, 255)", // Williams blue
    "RB": "rgb(30, 65, 255)", // RB blue
    "Haas F1 Team": "rgb(255, 255, 255)", // White 
    "Kick Sauber": "rgb(50, 205, 50)" // Lime green
  };

  // Get team color for a driver
  const getTeamColor = (driverNumber: number) => {
    const driver = driversData?.data?.find((d: any) => d.driver_number === driverNumber);
    if (!driver?.team_name) return 'rgb(153, 153, 153)';
    
    return teamColors[driver.team_name] || 'rgb(153, 153, 153)';
  };



  // Get position data to determine final race results
  const {
    data: positionData,
    isLoading: isPositionDataLoading,
    error: positionDataError
  } = usePositionData(effectiveSessionKey);

  // Process position data to get final race results
  const processedResults = useMemo(() => {
    if (!positionData?.data || !driversData?.data || !lapData?.data) return [];

    const driverResults: { [key: number]: ProcessedResult } = {};
    
    // Initialize results for each driver
    driversData.data.forEach((driver: any) => {
      driverResults[driver.driver_number] = {
        position: 0, // Will be determined from final position
        driver_number: driver.driver_number,
        driver_name: `${driver.first_name} ${driver.last_name}`,
        driver_acronym: driver.name_acronym || `${driver.first_name.charAt(0)}${driver.last_name.charAt(0)}${driver.driver_number}`,
        constructor_name: driver.team_name || 'Unknown',
        best_lap_time: null,
        gap_to_leader: null,
        total_laps: 0
      };
    });

    // Process lap data to find best times and total laps for each driver
    lapData.data.forEach((lap: any) => {
      const driverNumber = lap.driver_number;
      if (!driverResults[driverNumber]) return;

      const result = driverResults[driverNumber];
      result.total_laps++;

      // Update best lap time
      if (lap.lap_duration && (result.best_lap_time === null || lap.lap_duration < result.best_lap_time)) {
        result.best_lap_time = lap.lap_duration;
      }
    });

    // Get final positions from position data (last recorded position for each driver)
    const finalPositions: { [key: number]: { position: number; date: string } } = {};
    
    // Group position data by driver and find their final position
    positionData.data.forEach((position: any) => {
      const driverNumber = position.driver_number;
      const positionValue = position.position;
      
      // Keep track of the latest (highest) position for each driver
      if (!finalPositions[driverNumber] || position.date > finalPositions[driverNumber].date) {
        finalPositions[driverNumber] = {
          position: positionValue,
          date: position.date
        };
      }
    });

    // Apply final positions to results
    Object.keys(driverResults).forEach(driverNumberStr => {
      const driverNumber = parseInt(driverNumberStr);
      const finalPos = finalPositions[driverNumber];
      if (finalPos) {
        driverResults[driverNumber].position = finalPos.position;
      }
    });

    // Convert to array and sort by final race position
    const resultsArray = Object.values(driverResults)
      .filter(result => result.position > 0) // Only include drivers with valid positions
      .sort((a, b) => a.position - b.position);

    // Calculate gaps to leader based on best lap times
    resultsArray.forEach((result, index) => {
      if (index === 0) {
        result.gap_to_leader = "Leader";
      } else {
        const leaderTime = resultsArray[0].best_lap_time;
        if (result.best_lap_time && leaderTime) {
          const gap = result.best_lap_time - leaderTime;
          result.gap_to_leader = `+${formatTime(gap)}`;
        } else {
          result.gap_to_leader = "N/A";
        }
      }
    });

    return resultsArray;
  }, [positionData, lapData, driversData]);



  // Apply sorting
  const sortedResults = useMemo(() => {
    if (!processedResults.length) return [];

    return [...processedResults].sort((a, b) => {
      const dirMult = sortDirection === 'asc' ? 1 : -1;
      
      switch (sortColumn) {
        case 'position':
          return (a.position - b.position) * dirMult;
        case 'driver':
          return a.driver_name.localeCompare(b.driver_name) * dirMult;
        case 'constructor':
          return a.constructor_name.localeCompare(b.constructor_name) * dirMult;
        case 'best_lap':
          const aTime = a.best_lap_time || Infinity;
          const bTime = b.best_lap_time || Infinity;
          return (aTime - bTime) * dirMult;
        case 'gap':
          if (a.gap_to_leader === "Leader") return -dirMult;
          if (b.gap_to_leader === "Leader") return dirMult;
          if (a.gap_to_leader === "N/A") return dirMult;
          if (b.gap_to_leader === "N/A") return -dirMult;
          return a.position - b.position;
        default:
          return 0;
      }
    });
  }, [processedResults, sortColumn, sortDirection]);

  // Handle sorting when a column header is clicked
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Get sort indicator for a column
  const getSortIndicator = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="ml-1 h-4 w-4 inline-block text-muted-foreground/50" />;
    }
    
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-1 h-4 w-4 inline-block text-primary" /> 
      : <ArrowDown className="ml-1 h-4 w-4 inline-block text-primary" />;
  };

  // Get position badge with podium styling
  const getPositionBadge = (position: number) => {
    if (position === 1) {
      return (
        <div className="flex items-center gap-1">
          <Trophy className="h-4 w-4 text-yellow-500" />
          <span className="font-bold text-yellow-600">1</span>
        </div>
      );
    } else if (position === 2) {
      return (
        <div className="flex items-center gap-1">
          <Award className="h-4 w-4 text-gray-400" />
          <span className="font-bold text-gray-600">2</span>
        </div>
      );
    } else if (position === 3) {
      return (
        <div className="flex items-center gap-1">
          <Medal className="h-4 w-4 text-amber-600" />
          <span className="font-bold text-amber-700">3</span>
        </div>
      );
    }
    return <span className="font-semibold">{position}</span>;
  };

  const isLoading = isSessionLoading || isDriversLoading || isLapDataLoading || isPositionDataLoading;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array(10).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (lapDataError || positionDataError || !effectiveSessionKey) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Session Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              {lapDataError || positionDataError ? 'Failed to load session results' : 'No session data available'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Session Results - {sessionName || sessionType}
        </CardTitle>
        {sortedResults.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Showing results for {sortedResults.length} drivers
          </p>
        )}
      </CardHeader>
      <CardContent>
        {sortedResults.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No results available for this session</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 min-w-[80px]"
                    onClick={() => handleSort('position')}
                  >
                    Pos
                    {getSortIndicator('position')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 min-w-[120px]"
                    onClick={() => handleSort('constructor')}
                  >
                    Constructor
                    {getSortIndicator('constructor')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 min-w-[120px]"
                    onClick={() => handleSort('driver')}
                  >
                    Driver
                    {getSortIndicator('driver')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 text-right min-w-[100px]"
                    onClick={() => handleSort('best_lap')}
                  >
                    Time
                    {getSortIndicator('best_lap')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50 text-right min-w-[90px]"
                    onClick={() => handleSort('gap')}
                  >
                    Gap
                    {getSortIndicator('gap')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedResults.map((result) => {
                  const teamColor = getTeamColor(result.driver_number);
                  
                  return (
                    <TableRow 
                      key={result.driver_number}
                      className={`hover:bg-muted/30 ${
                        result.position <= 3 ? 'bg-muted/20' : ''
                      }`}
                    >
                      <TableCell className="font-medium">
                        {getPositionBadge(result.position)}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium uppercase tracking-wider font-mono" style={{
                          color: teamColor
                        }}>
                          {result.constructor_name}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-5 h-5 rounded-full flex items-center justify-center"
                            style={{
                              backgroundColor: teamColor,
                              border: '1px solid rgba(255, 255, 255, 0.1)'
                            }}
                          >
                            <span className="text-[10px] font-bold" style={{
                              color: teamColor === "rgb(255, 255, 255)" ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)'
                            }}>
                              {result.driver_number}
                            </span>
                          </div>
                          <span className="font-medium" style={{
                            color: teamColor
                          }}>
                            {result.driver_acronym}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-mono ${result.position === 1 ? 'text-purple-400 font-semibold' : ''}`}>
                          {result.best_lap_time ? formatTime(result.best_lap_time) : 'N/A'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-mono text-muted-foreground">
                          {result.gap_to_leader || 'N/A'}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SessionResults; 