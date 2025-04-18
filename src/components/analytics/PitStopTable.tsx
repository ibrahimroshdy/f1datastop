import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ArrowDownIcon, ArrowUpIcon, ArrowUpDown } from "lucide-react";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { getPitStops, getRaceResults } from "@/services/f1Service";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import TeamLogo from "@/components/common/TeamLogo";

// Helper function to format milliseconds into a readable format
const formatMilliseconds = (ms: number): string => {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  return minutes > 0 
    ? `${minutes}:${seconds.toFixed(3).padStart(6, '0')}` 
    : seconds.toFixed(3);
};

interface PitStopTableProps {
  year: number;
  round: string;
}

interface DriverPitStop {
  driverId: string;
  driver: string;
  stops: number;
  lap?: number;
  timeOfDay?: string;
  time?: string; // pit stop duration
  formattedTime?: string;
  totalTime: number;
  team: string;
  pitStops: Array<{
    lap: number;
    time: string;
    formattedTime: string;
  }>;
}

interface DriverInfo {
  code: string;
  name: string;
  team: string;
}

// Define sort keys for type safety
type SortKey = 'stop' | 'driver' | 'lap' | 'time' | 'totalTime' | 'team';

const PitStopTable = ({ year, round }: PitStopTableProps) => {
  const [pitStopData, setPitStopData] = useState<DriverPitStop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [circuitName, setCircuitName] = useState<string>("Loading...");
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
    key: 'totalTime',
    direction: 'asc'
  });

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // First get race results to get driver info and team colors
        const resultsResponse = await getRaceResults(year, round);
        if (!resultsResponse?.data?.Results) {
          throw new Error("No race results available");
        }

        // Set circuit name
        setCircuitName(resultsResponse.data.Circuit?.circuitName || resultsResponse.data.raceName || "Unknown Circuit");

        // Create a map of driver information
        const driverInfo = new Map<string, DriverInfo>(
          resultsResponse.data.Results.map((result: any) => [
            result.Driver.driverId,
            {
              code: result.Driver.code || result.Driver.familyName.substring(0, 3).toUpperCase(),
              name: `${result.Driver.givenName} ${result.Driver.familyName}`,
              team: result.Constructor?.constructorId || "unknown"
            }
          ])
        );

        // Then get pit stop data
        const pitStopsResponse = await getPitStops(year, round);
        if (!pitStopsResponse?.data?.Races?.[0]?.PitStops) {
          throw new Error("No pit stop data available");
        }

        // Process pit stop data
        const pitStops = pitStopsResponse.data.Races[0].PitStops;
        
        // Group pit stops by driver
        const driversMap = new Map();
        
        pitStops.forEach((stop: any) => {
          const driverId = stop.driverId;
          const driver = driverInfo.get(driverId);
          
          if (!driver) return;
          
          // Convert duration to seconds
          const duration = parseFloat(stop.duration);
          
          // If this is the first time we're seeing this driver
          if (!driversMap.has(driverId)) {
            driversMap.set(driverId, {
              driverId,
              driver: driver.code,
              stops: 1,
              totalTime: duration,
              team: driver.team,
              pitStops: [{
                lap: parseInt(stop.lap),
                time: stop.duration,
                formattedTime: stop.duration,
              }]
            });
          } else {
            // Update existing driver data
            const driverData = driversMap.get(driverId);
            driverData.stops += 1;
            driverData.totalTime += duration;
            driverData.pitStops.push({
              lap: parseInt(stop.lap),
              time: stop.duration,
              formattedTime: stop.duration,
            });
          }
        });

        // Convert map to array
        const processedData = Array.from(driversMap.values());
        setPitStopData(processedData);
      } catch (err: any) {
        console.error("Error fetching pit stop data:", err);
        setError(err.message || "Failed to load pit stop data");
        toast.error("Failed to load pit stop data");
      } finally {
        setIsLoading(false);
      }
    };

    if (year && round) {
      fetchData();
    }
  }, [year, round]);

  // Sort the data based on the current sort configuration
  const sortedData = useMemo(() => {
    return [...pitStopData].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortConfig.key) {
        case 'driver':
          aValue = a.driver;
          bValue = b.driver;
          break;
        case 'team':
          aValue = a.team;
          bValue = b.team;
          break;
        case 'stop':
          aValue = a.stops;
          bValue = b.stops;
          break;
        case 'totalTime':
          aValue = a.totalTime;
          bValue = b.totalTime;
          break;
        default:
          aValue = a.totalTime;
          bValue = b.totalTime;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      } else {
        const numA = typeof aValue === 'number' ? aValue : 0;
        const numB = typeof bValue === 'number' ? bValue : 0;
        return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
      }
    });
  }, [pitStopData, sortConfig]);

  // Handle column header click for sorting
  const handleSort = (key: SortKey) => {
    setSortConfig(current => {
      // If clicking the same column, toggle direction
      if (current.key === key) {
        return {
          key,
          direction: current.direction === 'asc' ? 'desc' : 'asc'
        };
      }
      // If clicking a new column, sort ascending by default
      return { key, direction: 'asc' };
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pit Stop Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || pitStopData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pit Stop Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[400px] text-center">
            <AlertCircle className="h-8 w-8 mb-4" />
            <p className="font-medium mb-1">No pit stop data available</p>
            <p className="text-sm text-muted-foreground">
              {error || "Try selecting a different race"}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full">
      <div className="mb-4">
        <h2 className="text-xl font-bold tracking-tight">Pit Stop Details</h2>
        <Badge variant="outline" className="mt-2">
          {circuitName}
        </Badge>
      </div>
      <div className="h-[calc(100%-80px)] overflow-y-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                className="w-[100px] bg-background sticky top-0 cursor-pointer hover:bg-accent/50"
                onClick={() => handleSort('driver')}
              >
                <div className="flex items-center justify-between">
                  Driver
                  {sortConfig.key === 'driver' ? (
                    sortConfig.direction === 'asc' ? (
                      <ArrowUpIcon className="h-4 w-4 ml-1" />
                    ) : (
                      <ArrowDownIcon className="h-4 w-4 ml-1" />
                    )
                  ) : (
                    <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />
                  )}
                </div>
              </TableHead>
              <TableHead 
                className="w-[120px] bg-background sticky top-0 cursor-pointer hover:bg-accent/50 text-center"
                onClick={() => handleSort('team')}
              >
                <div className="flex items-center justify-center">
                  Team
                  {sortConfig.key === 'team' ? (
                    sortConfig.direction === 'asc' ? (
                      <ArrowUpIcon className="h-4 w-4 ml-1" />
                    ) : (
                      <ArrowDownIcon className="h-4 w-4 ml-1" />
                    )
                  ) : (
                    <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />
                  )}
                </div>
              </TableHead>
              <TableHead 
                className="w-[80px] text-right bg-background sticky top-0 cursor-pointer hover:bg-accent/50"
                onClick={() => handleSort('stop')}
              >
                <div className="flex items-center justify-end">
                  Stops
                  {sortConfig.key === 'stop' ? (
                    sortConfig.direction === 'asc' ? (
                      <ArrowUpIcon className="h-4 w-4 ml-1" />
                    ) : (
                      <ArrowDownIcon className="h-4 w-4 ml-1" />
                    )
                  ) : (
                    <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />
                  )}
                </div>
              </TableHead>
              <TableHead 
                className="w-[120px] text-right bg-background sticky top-0 cursor-pointer hover:bg-accent/50"
                onClick={() => handleSort('totalTime')}
              >
                <div className="flex items-center justify-end">
                  Total Time
                  {sortConfig.key === 'totalTime' ? (
                    sortConfig.direction === 'asc' ? (
                      <ArrowUpIcon className="h-4 w-4 ml-1" />
                    ) : (
                      <ArrowDownIcon className="h-4 w-4 ml-1" />
                    )
                  ) : (
                    <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />
                  )}
                </div>
              </TableHead>
              <TableHead className="bg-background sticky top-0">Stop Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((driver) => (
              <TableRow key={driver.driverId}>
                <TableCell>
                  <div 
                    className="flex items-center gap-2"
                    style={{ borderLeft: `3px solid ${TEAM_COLORS[driver.team] || '#666'}` }}
                  >
                    <span className="pl-2 font-medium">{driver.driver}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center justify-center w-full">
                          <TeamLogo constructorId={driver.team} size="sm" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="capitalize">{driver.team.replace('_', ' ')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell className="text-right">{driver.stops}</TableCell>
                <TableCell className="text-right font-mono">
                  {driver.totalTime.toFixed(3)}s
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {driver.pitStops.map((stop, index) => (
                      <Badge 
                        key={`${driver.driverId}-stop-${index}`}
                        variant="outline"
                        className="whitespace-nowrap"
                      >
                        Lap {stop.lap}: {stop.formattedTime}s
                      </Badge>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default PitStopTable; 