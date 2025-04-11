import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Timer, AlertCircle, Clock, RefreshCw } from "lucide-react";
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
  
  // Reset state when session changes
  useEffect(() => {
    setSelectedDrivers([]);
    setFastestLaps({});
    setFastestSectors({
      sector1: null,
      sector2: null,
      sector3: null
    });
    
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
  
  // Map API drivers to our Driver interface
  const mappedDrivers = React.useMemo(() => {
    if (!driversData?.data) return [];
    
    const teamColors: { [key: string]: string } = {
      "Red Bull Racing": "#0600EF",
      "Ferrari": "#DC0000",
      "Mercedes": "#00D2BE",
      "McLaren": "#FF8700",
      "Aston Martin": "#006F62",
      "Alpine": "#0090FF", 
      "Williams": "#005AFF",
      "RB": "#1E41FF",
      "Haas F1 Team": "#FFFFFF",
      "Kick Sauber": "#900000"
    };
    
    return driversData.data.map((driver: any) => ({
      driver_number: driver.driver_number,
      name: `${driver.first_name} ${driver.last_name}`,
      team_name: driver.team_name || "Unknown Team",
      team_color: teamColors[driver.team_name] || "#CCCCCC",
      name_acronym: driver.name_acronym,
      isLoading: false,
      isDataLoaded: false
    })) as Driver[];
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
    
    lapData.data.forEach((lap: any) => {
      const driver = lap.driver_number;
      
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
      
      // Track fastest sectors
      if (lap.duration_sector_1 !== null && (!fastS1 || lap.duration_sector_1 < fastS1.time)) {
        fastS1 = { time: lap.duration_sector_1, driver };
      }
      
      if (lap.duration_sector_2 !== null && (!fastS2 || lap.duration_sector_2 < fastS2.time)) {
        fastS2 = { time: lap.duration_sector_2, driver };
      }
      
      if (lap.duration_sector_3 !== null && (!fastS3 || lap.duration_sector_3 < fastS3.time)) {
        fastS3 = { time: lap.duration_sector_3, driver };
      }
    });
    
    setFastestLaps(fastestLapTimes);
    setFastestSectors({
      sector1: fastS1,
      sector2: fastS2, 
      sector3: fastS3
    });
    
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
    if (!driversData?.data) return null;
    return driversData.data.find((d: any) => d.driver_number === driverNumber) || null;
  };
  
  // Calculate whether a given sector is the fastest for a driver
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
    return Object.values(groupedLaps)
      .sort((a: any, b: any) => {
        if (a.lap_number !== b.lap_number) {
          return a.lap_number - b.lap_number;
        }
        return a.driver_number - b.driver_number;
      });
  }, [filteredLapData]);
  
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
            Lap Times Analysis
          </CardTitle>
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
                  <h3 className="font-medium text-sm mb-3">Session Fastest:</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Best lap */}
                    <div className="bg-background/40 p-3 rounded-md">
                      <div className="text-xs text-muted-foreground mb-1">Fastest Lap</div>
                      {absoluteFastestLap && (
                        <div className="flex justify-between items-center">
                          <div className="font-semibold">
                            {formatTime(absoluteFastestLap.time)}
                          </div>
                          <div>
                            <Badge className="text-xs" style={{
                              backgroundColor: getDriverInfo(absoluteFastestLap.driver)?.team_color || 'gray'
                            }}>
                              {getDriverInfo(absoluteFastestLap.driver)?.name_acronym || absoluteFastestLap.driver}
                            </Badge>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Best theoretical lap */}
                    <div className="bg-background/40 p-3 rounded-md">
                      <div className="text-xs text-muted-foreground mb-1">Theoretical Best</div>
                      {bestTheoreticalLap && (
                        <div className="flex justify-between items-center">
                          <div className="font-semibold">
                            {formatTime(bestTheoreticalLap)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            S1+S2+S3
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Best S1 */}
                    <div className="bg-background/40 p-3 rounded-md">
                      <div className="text-xs text-muted-foreground mb-1">Sector 1</div>
                      {fastestSectors.sector1 && (
                        <div className="flex justify-between items-center">
                          <div className="font-semibold">
                            {formatTime(fastestSectors.sector1.time)}
                          </div>
                          <div>
                            <Badge className="text-xs" style={{
                              backgroundColor: getDriverInfo(fastestSectors.sector1.driver)?.team_color || 'gray'
                            }}>
                              {getDriverInfo(fastestSectors.sector1.driver)?.name_acronym || fastestSectors.sector1.driver}
                            </Badge>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Best S2 */}
                    <div className="bg-background/40 p-3 rounded-md">
                      <div className="text-xs text-muted-foreground mb-1">Sector 2</div>
                      {fastestSectors.sector2 && (
                        <div className="flex justify-between items-center">
                          <div className="font-semibold">
                            {formatTime(fastestSectors.sector2.time)}
                          </div>
                          <div>
                            <Badge className="text-xs" style={{
                              backgroundColor: getDriverInfo(fastestSectors.sector2.driver)?.team_color || 'gray'
                            }}>
                              {getDriverInfo(fastestSectors.sector2.driver)?.name_acronym || fastestSectors.sector2.driver}
                            </Badge>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Best S3 - Only on small screens, adds an extra row */}
                    <div className="bg-background/40 p-3 rounded-md md:hidden">
                      <div className="text-xs text-muted-foreground mb-1">Sector 3</div>
                      {fastestSectors.sector3 && (
                        <div className="flex justify-between items-center">
                          <div className="font-semibold">
                            {formatTime(fastestSectors.sector3.time)}
                          </div>
                          <div>
                            <Badge className="text-xs" style={{
                              backgroundColor: getDriverInfo(fastestSectors.sector3.driver)?.team_color || 'gray'
                            }}>
                              {getDriverInfo(fastestSectors.sector3.driver)?.name_acronym || fastestSectors.sector3.driver}
                            </Badge>
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
                        <TableHead className="w-[80px]">Lap</TableHead>
                        <TableHead className="w-[100px]">Driver</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead className="hidden sm:table-cell">S1</TableHead>
                        <TableHead className="hidden sm:table-cell">S2</TableHead>
                        <TableHead className="hidden sm:table-cell">S3</TableHead>
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
                          
                          return (
                            <TableRow key={index} className={lap.is_pit_out_lap ? 'opacity-60' : ''}>
                              <TableCell>
                                {lap.lap_number}
                                {lap.is_pit_out_lap && (
                                  <span className="ml-1 text-xs text-muted-foreground">(Out)</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full" style={{
                                    backgroundColor: driver?.team_color || 'gray'
                                  }}></div>
                                  <span className="font-medium">
                                    {driver?.name_acronym || lap.driver_number}
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
                                  ${isFastestSector(lap.driver_number, 1, lap.duration_sector_1) ? 'text-purple-400 font-semibold' : ''}
                                `}>
                                  {lap.duration_sector_1 !== null ? formatTime(lap.duration_sector_1) : 'N/A'}
                                </span>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                <span className={`
                                  font-mono
                                  ${isFastestSector(lap.driver_number, 2, lap.duration_sector_2) ? 'text-purple-400 font-semibold' : ''}
                                `}>
                                  {lap.duration_sector_2 !== null ? formatTime(lap.duration_sector_2) : 'N/A'}
                                </span>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                <span className={`
                                  font-mono
                                  ${isFastestSector(lap.driver_number, 3, lap.duration_sector_3) ? 'text-purple-400 font-semibold' : ''}
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
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <span className="text-purple-400">■</span> Session fastest
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-green-400">■</span> Driver fastest
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="opacity-60">■</span> Pit out lap
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