import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { TEAM_COLORS } from "@/constants/f1Colors";
import { getPitStops, getRaceResults } from "@/services/f1Service";
import { toast } from "sonner";

interface PitStopTableProps {
  year: number;
  round: string;
}

interface DriverPitStop {
  driverId: string;
  code: string;
  name: string;
  team: string;
  stops: {
    lap: number;
    time: string;
    duration: number;
    totalDuration: number;
  }[];
}

interface DriverInfo {
  code: string;
  name: string;
  team: string;
}

const PitStopTable = ({ year, round }: PitStopTableProps) => {
  const [pitStopData, setPitStopData] = useState<DriverPitStop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [circuitName, setCircuitName] = useState<string>("Loading...");

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

        // Set circuit name
        setCircuitName(resultsResponse.data.Circuit?.circuitName || resultsResponse.data.raceName || "Unknown Circuit");

        // Then get pit stop data
        const pitStopsResponse = await getPitStops(year, round);
        if (!pitStopsResponse?.data?.Races?.[0]?.PitStops) {
          throw new Error("No pit stop data available");
        }

        // Process pit stop data
        const pitStops = pitStopsResponse.data.Races[0].PitStops;
        const driversMap = new Map<string, DriverPitStop>();

        pitStops.forEach((stop: any) => {
          const driverId = stop.driverId;
          const driver = driverInfo.get(driverId);
          
          if (!driver) return;

          if (!driversMap.has(driverId)) {
            driversMap.set(driverId, {
              driverId,
              code: driver.code,
              name: driver.name,
              team: driver.team,
              stops: []
            });
          }

          const driverData = driversMap.get(driverId)!;
          const duration = parseFloat(stop.duration);
          
          driverData.stops.push({
            lap: parseInt(stop.lap),
            time: stop.time.split('T')[1], // Extract time part only
            duration,
            totalDuration: driverData.stops.reduce((sum, s) => sum + s.duration, duration)
          });
        });

        // Convert map to array and sort by total pit time
        const processedData = Array.from(driversMap.values())
          .sort((a, b) => {
            const aTotalTime = a.stops.reduce((sum, stop) => sum + stop.duration, 0);
            const bTotalTime = b.stops.reduce((sum, stop) => sum + stop.duration, 0);
            return aTotalTime - bTotalTime;
          });

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
        <h2 className="text-2xl font-bold tracking-tight">Pit Stop Details</h2>
        <Badge variant="outline" className="mt-2">
          {circuitName}
        </Badge>
      </div>
      <div className="h-[calc(100%-80px)] overflow-y-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px] bg-background sticky top-0">Driver</TableHead>
              <TableHead className="w-[120px] bg-background sticky top-0">Team</TableHead>
              <TableHead className="w-[80px] text-right bg-background sticky top-0">Stops</TableHead>
              <TableHead className="w-[120px] text-right bg-background sticky top-0">Total Time</TableHead>
              <TableHead className="bg-background sticky top-0">Stop Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pitStopData.map((driver) => (
              <TableRow key={driver.driverId}>
                <TableCell className="font-medium">{driver.code}</TableCell>
                <TableCell>
                  <div 
                    className="flex items-center gap-2"
                    style={{ borderLeft: `3px solid ${TEAM_COLORS[driver.team] || '#666'}` }}
                  >
                    <span className="pl-2 capitalize">{driver.team.replace('_', ' ')}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">{driver.stops.length}</TableCell>
                <TableCell className="text-right font-mono">
                  {driver.stops.reduce((sum, stop) => sum + stop.duration, 0).toFixed(3)}s
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {driver.stops.map((stop, index) => (
                      <Badge 
                        key={`${driver.driverId}-stop-${index}`}
                        variant="outline"
                        className="whitespace-nowrap"
                      >
                        Lap {stop.lap}: {stop.duration.toFixed(3)}s
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