import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Timer, AlertCircle, Clock, RefreshCw, Zap, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLapData, useDrivers, useOpenF1SessionFromErgast } from "@/hooks/useOpenF1Data";
import { formatTime } from "@/utils/lapTimeUtils";
import DriverSelectionPanel from './DriverSelectionPanel';
import { Driver } from '@/hooks/useTelemetryData';

interface LapTimeTabProps {
  year: number;
  round: string;
  sessionType?: string;
  sessionKey?: number;
}

// Sorting types
type SortColumn = 'lap' | 'driver' | 'time' | 's1' | 's2' | 's3';
type SortDirection = 'asc' | 'desc';

const LapTimeTab: React.FC<LapTimeTabProps> = ({
  year,
  round,
  sessionType = "Race",
  sessionKey: externalSessionKey
}) => {
  const [selectedDrivers, setSelectedDrivers] = useState<number[]>([]);
  const [fastestLaps, setFastestLaps] = useState<{[key: number]: number}>({});
  const [fastestSectors, setFastestSectors] = useState<{
    sector1: {time: number, driver: number} | null,
    sector2: {time: number, driver: number} | null,
    sector3: {time: number, driver: number} | null
  }>({
    sector1: null,
    sector2: null,
    sector3: null
  });
  
  // Add state for showing only fastest times
  const [showOnlyFastest, setShowOnlyFastest] = useState<boolean>(true);
  
  // Add state for sorting
  const [sortColumn, setSortColumn] = useState<SortColumn>('lap');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // Track fastest sector times per driver
  const [driverFastestSectors, setDriverFastestSectors] = useState<{
    [driverNumber: number]: {
      sector1: { time: number, lapNumber: number } | null,
      sector2: { time: number, lapNumber: number } | null,
      sector3: { time: number, lapNumber: number } | null
    }
  }>({});
  
  // Reset state when session changes
  useEffect(() => {
    setSelectedDrivers([]);
    setFastestLaps({});
    setFastestSectors({
      sector1: null,
      sector2: null,
      sector3: null
    });
    setDriverFastestSectors({});
    setShowOnlyFastest(true);
    setSortColumn('lap');
    setSortDirection('asc');
    
    console.log("Session changed in LapTimeTab to:", externalSessionKey);
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
  
  // Get lap data for selected drivers (or all if none selected)
  const {
    data: lapData,
    isLoading: isLapDataLoading,
    error: lapDataError,
    refetch: refetchLapData
  } = useLapData(effectiveSessionKey);
  
  // Debug lap data to see driver numbers
  useEffect(() => {
    if (lapData?.data && lapData.data.length > 0) {
      console.log("First few lap entries:", lapData.data.slice(0, 5).map((lap: any) => ({
        driver: lap.driver_number,
        lap: lap.lap_number,
        time: lap.lap_duration
      })));
    }
  }, [lapData]);
  
  // Map API drivers to our Driver interface
  const mappedDrivers = React.useMemo(() => {
    if (!driversData?.data) return [];
    
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
      "Kick Sauber": "rgb(201, 45, 75)" // Darker red
    };
    
    // Map drivers and assign team colors
    const mapped = driversData.data.map((driver: any) => {
      // Make sure we have a valid team color, defaulting to a distinct gray if not found
      const teamColor = teamColors[driver.team_name] || "rgb(153, 153, 153)";
      
      return {
        driver_number: driver.driver_number,
        name: `${driver.first_name} ${driver.last_name}`,
        team_name: driver.team_name || "Unknown Team",
        team_color: teamColor,
        name_acronym: driver.name_acronym,
        isLoading: false,
        isDataLoaded: false
      };
    }) as Driver[];
    
    // Debug log to see what driver numbers we're getting
    console.log("Mapped drivers:", mapped.map(d => ({ 
      number: d.driver_number, 
      team: d.team_name, 
      color: d.team_color 
    })));
    
    return mapped;
  }, [driversData]);
  
  // Handle driver selection
  const toggleDriverSelection = (driverNumber: number) => {
    setSelectedDrivers(prev => {
      if (prev.includes(driverNumber)) {
        return prev.filter(d => d !== driverNumber);
      } else {
        return [...prev, driverNumber];
      }
    });
  };
  
  // Process lap data and compute fastest laps and sectors
  useEffect(() => {
    if (!lapData?.data || lapData.data.length === 0) return;
    
    // Track fastest laps and sectors
    const fastestLapTimes: {[key: number]: number} = {};
    let fastS1: {time: number, driver: number} | null = null;
    let fastS2: {time: number, driver: number} | null = null;
    let fastS3: {time: number, driver: number} | null = null;
    
    // Track fastest sector times per driver
    const driverSectors: {
      [driverNumber: number]: {
        sector1: { time: number, lapNumber: number } | null,
        sector2: { time: number, lapNumber: number } | null,
        sector3: { time: number, lapNumber: number } | null
      }
    } = {};
    
    lapData.data.forEach((lap: any) => {
      const driver = lap.driver_number;
      
      // Initialize driver's sectors if not already done
      if (!driverSectors[driver]) {
        driverSectors[driver] = {
          sector1: null,
          sector2: null,
          sector3: null
        };
      }
      
      // Compute lap time from sectors if available and lap_duration is null
      if (lap.lap_duration === null && 
          lap.duration_sector_1 !== null && 
          lap.duration_sector_2 !== null && 
          lap.duration_sector_3 !== null) {
        const lapTime = lap.duration_sector_1 + lap.duration_sector_2 + lap.duration_sector_3;
        
        // Update fastest lap for this driver
        if (!fastestLapTimes[driver] || lapTime < fastestLapTimes[driver]) {
          fastestLapTimes[driver] = lapTime;
        }
      } else if (lap.lap_duration !== null) {
        // If we have a direct lap time
        if (!fastestLapTimes[driver] || lap.lap_duration < fastestLapTimes[driver]) {
          fastestLapTimes[driver] = lap.lap_duration;
        }
      }
      
      // Track fastest sectors overall
      if (lap.duration_sector_1 !== null && (!fastS1 || lap.duration_sector_1 < fastS1.time)) {
        fastS1 = { time: lap.duration_sector_1, driver };
      }
      
      if (lap.duration_sector_2 !== null && (!fastS2 || lap.duration_sector_2 < fastS2.time)) {
        fastS2 = { time: lap.duration_sector_2, driver };
      }
      
      if (lap.duration_sector_3 !== null && (!fastS3 || lap.duration_sector_3 < fastS3.time)) {
        fastS3 = { time: lap.duration_sector_3, driver };
      }
      
      // Track fastest sectors per driver
      if (lap.duration_sector_1 !== null && 
          (!driverSectors[driver].sector1 || lap.duration_sector_1 < driverSectors[driver].sector1!.time)) {
        driverSectors[driver].sector1 = { 
          time: lap.duration_sector_1, 
          lapNumber: lap.lap_number 
        };
      }
      
      if (lap.duration_sector_2 !== null && 
          (!driverSectors[driver].sector2 || lap.duration_sector_2 < driverSectors[driver].sector2!.time)) {
        driverSectors[driver].sector2 = { 
          time: lap.duration_sector_2, 
          lapNumber: lap.lap_number 
        };
      }
      
      if (lap.duration_sector_3 !== null && 
          (!driverSectors[driver].sector3 || lap.duration_sector_3 < driverSectors[driver].sector3!.time)) {
        driverSectors[driver].sector3 = { 
          time: lap.duration_sector_3, 
          lapNumber: lap.lap_number 
        };
      }
    });
    
    setFastestLaps(fastestLapTimes);
    setFastestSectors({
      sector1: fastS1,
      sector2: fastS2, 
      sector3: fastS3
    });
    setDriverFastestSectors(driverSectors);
    
  }, [lapData]);
  
  // Get filtered lap data for the selected drivers
  const filteredLapData = React.useMemo(() => {
    if (!lapData?.data) return [];
    
    // If no drivers selected, show all drivers
    if (selectedDrivers.length === 0) {
      return lapData.data;
    }
    
    return lapData.data.filter((lap: any) => 
      selectedDrivers.includes(lap.driver_number)
    );
  }, [lapData, selectedDrivers]);
  
  // Get a driver's information by number
  const getDriverInfo = (driverNumber: number) => {
    // Ensure the driver number is treated as a number
    const driverNum = typeof driverNumber === 'string' ? parseInt(driverNumber) : driverNumber;
    return mappedDrivers.find(d => d.driver_number === driverNum) || null;
  };
  
  // Calculate whether a given sector is the fastest for a driver
  const isFastestSectorForDriver = (driverNumber: number, sectorNumber: number, sectorTime: number) => {
    if (!driverFastestSectors[driverNumber]) return false;
    
    if (sectorNumber === 1 && driverFastestSectors[driverNumber].sector1) {
      return Math.abs(driverFastestSectors[driverNumber].sector1!.time - sectorTime) < 0.001;
    }
    if (sectorNumber === 2 && driverFastestSectors[driverNumber].sector2) {
      return Math.abs(driverFastestSectors[driverNumber].sector2!.time - sectorTime) < 0.001;
    }
    if (sectorNumber === 3 && driverFastestSectors[driverNumber].sector3) {
      return Math.abs(driverFastestSectors[driverNumber].sector3!.time - sectorTime) < 0.001;
    }
    return false;
  };
  
  // Check if a sector time is the fastest overall in the session
  const isFastestSector = (driverNumber: number, sectorNumber: number, sectorTime: number) => {
    if (sectorNumber === 1 && fastestSectors.sector1?.driver === driverNumber) {
      return Math.abs(fastestSectors.sector1.time - sectorTime) < 0.001;
    }
    if (sectorNumber === 2 && fastestSectors.sector2?.driver === driverNumber) {
      return Math.abs(fastestSectors.sector2.time - sectorTime) < 0.001;
    }
    if (sectorNumber === 3 && fastestSectors.sector3?.driver === driverNumber) {
      return Math.abs(fastestSectors.sector3.time - sectorTime) < 0.001;
    }
    return false;
  };
  
  // Get the fastest overall lap time
  const absoluteFastestLap = React.useMemo(() => {
    if (Object.keys(fastestLaps).length === 0) return null;
    
    let fastest = Number.MAX_VALUE;
    let fastDriver = 0;
    
    Object.entries(fastestLaps).forEach(([driver, time]) => {
      if (time < fastest) {
        fastest = time;
        fastDriver = parseInt(driver);
      }
    });
    
    return { time: fastest, driver: fastDriver };
  }, [fastestLaps]);
  
  const isLoading = isSessionLoading || isDriversLoading || isLapDataLoading;
  const hasError = !!lapDataError || (!isLoading && !effectiveSessionKey);
  const hasNoData = !isLoading && (!lapData?.data || lapData.data.length === 0);
  
  // Group laps by driver and lap number for easier display
  const lapsGrouped = React.useMemo(() => {
    const groupedLaps: {[key: string]: any} = {};
    
    filteredLapData.forEach((lap: any) => {
      const driver = lap.driver_number;
      const lapNum = lap.lap_number;
      const key = `${driver}_${lapNum}`;
      
      if (!groupedLaps[key]) {
        groupedLaps[key] = {
          driver_number: driver,
          lap_number: lapNum,
          lap_duration: lap.lap_duration,
          duration_sector_1: lap.duration_sector_1,
          duration_sector_2: lap.duration_sector_2,
          duration_sector_3: lap.duration_sector_3,
          is_pit_out_lap: lap.is_pit_out_lap,
          date_start: lap.date_start
        };
      }
    });
    
    // Convert to array and sort by lap number and driver
    let lapsArray = Object.values(groupedLaps)
      .sort((a: any, b: any) => {
        if (a.lap_number !== b.lap_number) {
          return a.lap_number - b.lap_number;
        }
        return a.driver_number - b.driver_number;
      });
    
    // Filter to show only fastest sector times if showOnlyFastest is true
    if (showOnlyFastest) {
      const fastestLaps: {[key: number]: any} = {};
      
      // Collect driver's fastest sector laps
      Object.entries(driverFastestSectors).forEach(([driverStr, sectors]) => {
        const driver = parseInt(driverStr);
        
        if (sectors.sector1) {
          const lapKey = `${driver}_${sectors.sector1.lapNumber}`;
          fastestLaps[lapKey] = true;
        }
        
        if (sectors.sector2) {
          const lapKey = `${driver}_${sectors.sector2.lapNumber}`;
          fastestLaps[lapKey] = true;
        }
        
        if (sectors.sector3) {
          const lapKey = `${driver}_${sectors.sector3.lapNumber}`;
          fastestLaps[lapKey] = true;
        }
      });
      
      // Filter to only include fastest sector laps
      lapsArray = lapsArray.filter((lap: any) => {
        const key = `${lap.driver_number}_${lap.lap_number}`;
        return fastestLaps[key];
      });
    }
    
    // Apply sorting based on the selected column and direction
    lapsArray = lapsArray.sort((a: any, b: any) => {
      // Helper function to handle null values in comparison
      const compareValues = (aVal: any, bVal: any, dir: number) => {
        if (aVal === null && bVal === null) return 0;
        if (aVal === null) return dir;
        if (bVal === null) return -dir;
        return aVal < bVal ? -dir : (aVal > bVal ? dir : 0);
      };
      
      // Direction multiplier (1 for ascending, -1 for descending)
      const dirMult = sortDirection === 'asc' ? 1 : -1;
      
      // Sort by the selected column
      switch (sortColumn) {
        case 'lap':
          return (a.lap_number - b.lap_number) * dirMult;
          
        case 'driver':
          return (a.driver_number - b.driver_number) * dirMult;
          
        case 'time':
          // Calculate total lap times if needed
          const aTime = a.lap_duration || 
            (a.duration_sector_1 && a.duration_sector_2 && a.duration_sector_3 ? 
              a.duration_sector_1 + a.duration_sector_2 + a.duration_sector_3 : null);
          const bTime = b.lap_duration || 
            (b.duration_sector_1 && b.duration_sector_2 && b.duration_sector_3 ? 
              b.duration_sector_1 + b.duration_sector_2 + b.duration_sector_3 : null);
          return compareValues(aTime, bTime, dirMult);
          
        case 's1':
          return compareValues(a.duration_sector_1, b.duration_sector_1, dirMult);
          
        case 's2':
          return compareValues(a.duration_sector_2, b.duration_sector_2, dirMult);
          
        case 's3':
          return compareValues(a.duration_sector_3, b.duration_sector_3, dirMult);
          
        default:
          return 0;
      }
    });
    
    return lapsArray;
  }, [filteredLapData, showOnlyFastest, driverFastestSectors, sortColumn, sortDirection]);
  
  // Handle sorting when a column header is clicked
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction if the same column is clicked
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and reset direction to ascending
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
  
  // Create a "best theoretical lap" by combining fastest sectors
  const bestTheoreticalLap = React.useMemo(() => {
    const s1 = fastestSectors.sector1?.time || 0;
    const s2 = fastestSectors.sector2?.time || 0;
    const s3 = fastestSectors.sector3?.time || 0;
    
    if (s1 > 0 && s2 > 0 && s3 > 0) {
      return s1 + s2 + s3;
    }
    
    return null;
  }, [fastestSectors]);
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Laptimes Table
          </CardTitle>
          
          {/* Add Show Fastest Times button */}
          {!isLoading && !hasNoData && !hasError && (
            <Button 
              variant={showOnlyFastest ? "default" : "outline"} 
              size="sm"
              onClick={() => setShowOnlyFastest(!showOnlyFastest)}
              className="gap-1"
            >
              <Zap className="h-4 w-4" />
              {showOnlyFastest ? "Show All Times" : "Show Fastest Times"}
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        ) : hasError ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">
              {lapDataError?.toString() || "No OpenF1 lap data available for this race."}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {year >= 2025 ? 
                "2025 season data is not yet fully available in the OpenF1 API. Please check back later or select a previous season." :
                "Lap data is only available for recent races (2023 onwards)."}
            </p>
          </div>
        ) : (
          <>
            {/* Driver selection area */}
            <div className="mb-6">
              <div className="mb-2 text-sm text-muted-foreground">
                Select drivers to view their lap times:
              </div>
              <DriverSelectionPanel 
                drivers={mappedDrivers}
                selectedDrivers={selectedDrivers}
                onToggleDriver={toggleDriverSelection}
                multiSelect={true}
              />
              {selectedDrivers.length === 0 && mappedDrivers.length > 0 && (
                <div className="mt-2 text-xs text-muted-foreground text-center">
                  Showing all drivers. Select specific drivers to filter the data.
                </div>
              )}
            </div>
            
            {hasNoData ? (
              <div className="py-8 text-center flex-1 flex flex-col items-center justify-center">
                <p className="text-muted-foreground">No lap data available for this session.</p>
                {year >= 2025 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    2025 season data is still being collected and may not be complete.
                  </p>
                )}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4"
                  onClick={() => refetchLapData()}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            ) : (
              <>
                {/* Fastest laps section */}
                <div className="bg-primary/5 rounded-md p-4 mb-6">
                  <h3 className="font-medium text-sm mb-3 flex items-center gap-1.5">
                    <span className="text-purple-400">Session Fastest:</span>
                    <span className="bg-purple-400/20 rounded-sm px-1 py-0.5 text-[10px] text-purple-400 uppercase">Purple Times</span>
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Best lap */}
                    <div className="bg-background/40 p-3 rounded-md" style={{
                      borderLeft: absoluteFastestLap ? `4px solid ${getDriverInfo(absoluteFastestLap.driver)?.team_color || 'gray'}` : ''
                    }}>
                      <div className="text-xs text-muted-foreground mb-1">Fastest Lap</div>
                      {absoluteFastestLap && (
                        <div className="flex justify-between items-center">
                          <div className="font-semibold text-purple-400">
                            {formatTime(absoluteFastestLap.time)}
                          </div>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-5 h-5 rounded-full flex items-center justify-center"
                              style={{
                                backgroundColor: getDriverInfo(absoluteFastestLap.driver)?.team_color || 'rgb(204, 204, 204)',
                                border: '1px solid rgba(255, 255, 255, 0.1)'
                              }}
                            >
                              <span className="text-[10px] font-bold" style={{
                                color: getDriverInfo(absoluteFastestLap.driver)?.team_color === "rgb(255, 255, 255)" ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)'
                              }}>
                                {absoluteFastestLap.driver}
                              </span>
                            </div>
                            <span className="font-bold" style={{
                              color: getDriverInfo(absoluteFastestLap.driver)?.team_color || 'inherit'
                            }}>
                              {getDriverInfo(absoluteFastestLap.driver)?.name_acronym || absoluteFastestLap.driver}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Best theoretical lap */}
                    <div className="bg-background/40 p-3 rounded-md" style={{
                      borderLeft: `4px solid ${fastestSectors.sector1?.driver ? getDriverInfo(fastestSectors.sector1?.driver)?.team_color || 'gray' : 'gray'}`
                    }}>
                      <div className="text-xs text-muted-foreground mb-1">Theoretical Best</div>
                      {bestTheoreticalLap && (
                        <div className="flex justify-between items-center">
                          <div className="font-semibold text-purple-400">
                            {formatTime(bestTheoreticalLap)}
                          </div>
                          <div className="text-xs text-purple-400 font-semibold">
                            S1+S2+S3
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Best S1 */}
                    <div className="bg-background/40 p-3 rounded-md" style={{
                      borderLeft: fastestSectors.sector1 ? `4px solid ${getDriverInfo(fastestSectors.sector1.driver)?.team_color || 'gray'}` : ''
                    }}>
                      <div className="text-xs text-muted-foreground mb-1">Sector 1</div>
                      {fastestSectors.sector1 && (
                        <div className="flex justify-between items-center">
                          <div className="font-semibold text-purple-400">
                            {formatTime(fastestSectors.sector1.time)}
                          </div>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-5 h-5 rounded-full flex items-center justify-center"
                              style={{
                                backgroundColor: getDriverInfo(fastestSectors.sector1.driver)?.team_color || 'rgb(204, 204, 204)',
                                border: '1px solid rgba(255, 255, 255, 0.1)'
                              }}
                            >
                              <span className="text-[10px] font-bold" style={{
                                color: getDriverInfo(fastestSectors.sector1.driver)?.team_color === "rgb(255, 255, 255)" ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)'
                              }}>
                                {fastestSectors.sector1.driver}
                              </span>
                            </div>
                            <span className="font-bold" style={{
                              color: getDriverInfo(fastestSectors.sector1.driver)?.team_color || 'inherit'
                            }}>
                              {getDriverInfo(fastestSectors.sector1.driver)?.name_acronym || fastestSectors.sector1.driver}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Best S2 */}
                    <div className="bg-background/40 p-3 rounded-md" style={{
                      borderLeft: fastestSectors.sector2 ? `4px solid ${getDriverInfo(fastestSectors.sector2.driver)?.team_color || 'gray'}` : ''
                    }}>
                      <div className="text-xs text-muted-foreground mb-1">Sector 2</div>
                      {fastestSectors.sector2 && (
                        <div className="flex justify-between items-center">
                          <div className="font-semibold text-purple-400">
                            {formatTime(fastestSectors.sector2.time)}
                          </div>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-5 h-5 rounded-full flex items-center justify-center"
                              style={{
                                backgroundColor: getDriverInfo(fastestSectors.sector2.driver)?.team_color || 'rgb(204, 204, 204)',
                                border: '1px solid rgba(255, 255, 255, 0.1)'
                              }}
                            >
                              <span className="text-[10px] font-bold" style={{
                                color: getDriverInfo(fastestSectors.sector2.driver)?.team_color === "rgb(255, 255, 255)" ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)'
                              }}>
                                {fastestSectors.sector2.driver}
                              </span>
                            </div>
                            <span className="font-bold" style={{
                              color: getDriverInfo(fastestSectors.sector2.driver)?.team_color || 'inherit'
                            }}>
                              {getDriverInfo(fastestSectors.sector2.driver)?.name_acronym || fastestSectors.sector2.driver}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Best S3 - Only on small screens, adds an extra row */}
                    <div className="bg-background/40 p-3 rounded-md md:hidden" style={{
                      borderLeft: fastestSectors.sector3 ? `4px solid ${getDriverInfo(fastestSectors.sector3.driver)?.team_color || 'gray'}` : ''
                    }}>
                      <div className="text-xs text-muted-foreground mb-1">Sector 3</div>
                      {fastestSectors.sector3 && (
                        <div className="flex justify-between items-center">
                          <div className="font-semibold text-purple-400">
                            {formatTime(fastestSectors.sector3.time)}
                          </div>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-5 h-5 rounded-full flex items-center justify-center"
                              style={{
                                backgroundColor: getDriverInfo(fastestSectors.sector3.driver)?.team_color || 'rgb(204, 204, 204)',
                                border: '1px solid rgba(255, 255, 255, 0.1)'
                              }}
                            >
                              <span className="text-[10px] font-bold" style={{
                                color: getDriverInfo(fastestSectors.sector3.driver)?.team_color === "rgb(255, 255, 255)" ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)'
                              }}>
                                {fastestSectors.sector3.driver}
                              </span>
                            </div>
                            <span className="font-bold" style={{
                              color: getDriverInfo(fastestSectors.sector3.driver)?.team_color || 'inherit'
                            }}>
                              {getDriverInfo(fastestSectors.sector3.driver)?.name_acronym || fastestSectors.sector3.driver}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Lap times table */}
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead 
                          className="w-[80px] cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleSort('lap')}
                        >
                          <div className="flex items-center">
                            Lap {getSortIndicator('lap')}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="w-[120px] cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleSort('driver')}
                        >
                          <div className="flex items-center">
                            Driver {getSortIndicator('driver')}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="w-[120px] hidden md:table-cell"
                        >
                          <div className="flex items-center">
                            Constructor
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleSort('time')}
                        >
                          <div className="flex items-center">
                            Time {getSortIndicator('time')}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="hidden sm:table-cell cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleSort('s1')}
                        >
                          <div className="flex items-center">
                            S1 {getSortIndicator('s1')}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="hidden sm:table-cell cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleSort('s2')}
                        >
                          <div className="flex items-center">
                            S2 {getSortIndicator('s2')}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="hidden sm:table-cell cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleSort('s3')}
                        >
                          <div className="flex items-center">
                            S3 {getSortIndicator('s3')}
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lapsGrouped.length > 0 ? (
                        lapsGrouped.map((lap: any, index: number) => {
                          const driver = getDriverInfo(lap.driver_number);
                          
                          // Calculate total lap time from sectors if not directly available
                          let totalLapTime = lap.lap_duration;
                          if (totalLapTime === null && 
                              lap.duration_sector_1 !== null && 
                              lap.duration_sector_2 !== null && 
                              lap.duration_sector_3 !== null) {
                            totalLapTime = lap.duration_sector_1 + lap.duration_sector_2 + lap.duration_sector_3;
                          }
                          
                          // Check if this is the fastest lap for this driver
                          const isFastestLap = totalLapTime !== null && 
                            fastestLaps[lap.driver_number] === totalLapTime;
                          
                          // Check if this is the absolute fastest lap of the session
                          const isAbsoluteFastestLap = absoluteFastestLap && 
                            totalLapTime !== null && 
                            Math.abs(absoluteFastestLap.time - totalLapTime) < 0.001 && 
                            absoluteFastestLap.driver === lap.driver_number;
                          
                          // Check if sectors are fastest for this driver
                          const isS1FastestForDriver = isFastestSectorForDriver(lap.driver_number, 1, lap.duration_sector_1);
                          const isS2FastestForDriver = isFastestSectorForDriver(lap.driver_number, 2, lap.duration_sector_2);
                          const isS3FastestForDriver = isFastestSectorForDriver(lap.driver_number, 3, lap.duration_sector_3);
                          
                          // Check if sectors are fastest overall
                          const isS1FastestOverall = isFastestSector(lap.driver_number, 1, lap.duration_sector_1);
                          const isS2FastestOverall = isFastestSector(lap.driver_number, 2, lap.duration_sector_2);
                          const isS3FastestOverall = isFastestSector(lap.driver_number, 3, lap.duration_sector_3);
                          
                          return (
                            <TableRow key={index} className={`
                              ${lap.is_pit_out_lap ? 'opacity-60' : ''}
                              ${isAbsoluteFastestLap ? 'bg-purple-400/5' : ''}
                              ${(isS1FastestOverall || isS2FastestOverall || isS3FastestOverall) && !isAbsoluteFastestLap ? 'bg-purple-400/5' : ''}
                            `}>
                              <TableCell>
                                {lap.lap_number}
                                {lap.is_pit_out_lap && (
                                  <span className="ml-1 text-xs text-muted-foreground">(Out)</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-5 h-5 rounded-full flex items-center justify-center"
                                    style={{
                                      backgroundColor: driver?.team_color || 'rgb(204, 204, 204)',
                                      border: '1px solid rgba(255, 255, 255, 0.1)'
                                    }}
                                  >
                                    <span className="text-[10px] font-bold" style={{
                                      color: driver?.team_color === "rgb(255, 255, 255)" ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)'
                                    }}>
                                      {driver?.driver_number}
                                    </span>
                                  </div>
                                  <span className="font-medium" style={{
                                    color: driver?.team_color || 'inherit'
                                  }}>
                                    {driver?.name_acronym || lap.driver_number}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-2 h-4 rounded-sm"
                                    style={{
                                      backgroundColor: driver?.team_color || 'rgb(204, 204, 204)'
                                    }}
                                  ></div>
                                  <span className="text-sm font-medium">
                                    {driver?.team_name || 'Unknown'}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className={`
                                  font-mono 
                                  ${isAbsoluteFastestLap ? 'text-purple-400 font-semibold' : ''} 
                                  ${isFastestLap && !isAbsoluteFastestLap ? 'text-green-400 font-semibold' : ''}
                                `}>
                                  {totalLapTime !== null ? formatTime(totalLapTime) : 'N/A'}
                                </span>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                <span className={`
                                  font-mono
                                  ${isS1FastestOverall ? 'text-purple-400 font-semibold' : ''}
                                  ${isS1FastestForDriver && !isS1FastestOverall ? 'text-green-400 font-semibold' : ''}
                                `}>
                                  {lap.duration_sector_1 !== null ? formatTime(lap.duration_sector_1) : 'N/A'}
                                </span>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                <span className={`
                                  font-mono
                                  ${isS2FastestOverall ? 'text-purple-400 font-semibold' : ''}
                                  ${isS2FastestForDriver && !isS2FastestOverall ? 'text-green-400 font-semibold' : ''}
                                `}>
                                  {lap.duration_sector_2 !== null ? formatTime(lap.duration_sector_2) : 'N/A'}
                                </span>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                <span className={`
                                  font-mono
                                  ${isS3FastestOverall ? 'text-purple-400 font-semibold' : ''}
                                  ${isS3FastestForDriver && !isS3FastestOverall ? 'text-green-400 font-semibold' : ''}
                                `}>
                                  {lap.duration_sector_3 !== null ? formatTime(lap.duration_sector_3) : 'N/A'}
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-4">
                            No lap data found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                
                {/* Legend */}
                <div className="mt-4 text-xs text-muted-foreground">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-purple-400 flex items-center justify-center"></div>
                      <span>Session fastest</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-green-400 flex items-center justify-center"></div>
                      <span>Driver fastest</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-gray-500 opacity-60 flex items-center justify-center"></div>
                      <span>Pit out lap</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default LapTimeTab; 