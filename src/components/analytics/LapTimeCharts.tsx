import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, Tooltip, Legend, XAxis, YAxis } from "recharts";
import { AlertCircle, Clock, RefreshCw, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLapData, useDrivers, useOpenF1SessionFromErgast } from "@/hooks/useOpenF1Data";
import { formatTime } from "@/utils/lapTimeUtils";
import DriverSelectionPanel from './DriverSelectionPanel';
import { Driver } from '@/hooks/useTelemetryData';

interface LapTimeChartsProps {
  year: number;
  round: string;
  sessionType?: string;
  sessionKey?: number;
}

const LapTimeCharts: React.FC<LapTimeChartsProps> = ({
  year,
  round,
  sessionType = "Race",
  sessionKey: externalSessionKey
}) => {
  // State for selected drivers
  const [selectedDrivers, setSelectedDrivers] = useState<number[]>([]);
  
  // Reset state when session changes
  useEffect(() => {
    setSelectedDrivers([]);
    console.log("Session changed in LapTimeCharts to:", externalSessionKey);
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
  
  // Get a driver's information by number
  const getDriverInfo = (driverNumber: number) => {
    // Ensure the driver number is treated as a number
    const driverNum = typeof driverNumber === 'string' ? parseInt(driverNumber) : driverNumber;
    return mappedDrivers.find(d => d.driver_number === driverNum) || null;
  };
  
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
  
  // Prepare chart data
  const chartData = React.useMemo(() => {
    // Group laps by lap number
    const lapGroups: { [key: number]: any } = {};
    
    filteredLapData.forEach((lap: any) => {
      const lapNumber = lap.lap_number;
      
      if (!lapGroups[lapNumber]) {
        lapGroups[lapNumber] = { lap: lapNumber };
      }
      
      // Ignore pit out laps for cleaner chart
      if (!lap.is_pit_out_lap) {
        lapGroups[lapNumber][`driver_${lap.driver_number}`] = lap.lap_duration;
      }
    });
    
    // Convert to array and sort by lap number
    return Object.values(lapGroups).sort((a, b) => a.lap - b.lap);
  }, [filteredLapData]);
  
  const isLoading = isSessionLoading || isDriversLoading || isLapDataLoading;
  const hasError = !!lapDataError || (!isLoading && !effectiveSessionKey);
  const hasNoData = !isLoading && (!lapData?.data || lapData.data.length === 0);
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Lap Time Charts
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
                Select drivers to compare lap times:
              </div>
              <DriverSelectionPanel 
                drivers={mappedDrivers}
                selectedDrivers={selectedDrivers}
                onToggleDriver={toggleDriverSelection}
                multiSelect={true}
              />
              {selectedDrivers.length === 0 && mappedDrivers.length > 0 && (
                <div className="mt-2 text-xs text-muted-foreground text-center">
                  No drivers selected. Please select drivers to view their lap times.
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
            ) : selectedDrivers.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground">Please select at least one driver to view lap times.</p>
              </div>
            ) : (
              <div className="h-[450px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" opacity={0.2} />
                    <XAxis 
                      dataKey="lap" 
                      label={{ value: 'Lap Number', position: 'insideBottomRight', offset: -5 }}
                    />
                    <YAxis
                      label={{ value: 'Lap Time (seconds)', angle: -90, position: 'insideLeft' }}
                      tickFormatter={(value) => {
                        // Format as MM:SS.sss
                        const mins = Math.floor(value / 60);
                        const secs = (value % 60).toFixed(3);
                        return `${mins}:${secs.padStart(6, '0')}`;
                      }}
                    />
                    <Tooltip 
                      formatter={(value: any, name: string) => {
                        // Get driver number from the name (format: driver_XX)
                        const driverNumber = name.split('_')[1];
                        const driver = getDriverInfo(parseInt(driverNumber));
                        
                        // Format time
                        if (typeof value === 'number') {
                          const mins = Math.floor(value / 60);
                          const secs = (value % 60).toFixed(3);
                          return [`${mins}:${secs.padStart(6, '0')}`, driver?.name_acronym || driverNumber];
                        }
                        return [value, driver?.name_acronym || driverNumber];
                      }}
                      labelFormatter={(label) => `Lap ${label}`}
                      contentStyle={{ 
                        backgroundColor: '#1a1a1a',
                        borderColor: '#333',
                        borderRadius: '5px',
                        color: 'white'
                      }}
                    />
                    <Legend 
                      formatter={(value: string) => {
                        // Get driver number from the name (format: driver_XX)
                        const driverNumber = value.split('_')[1];
                        const driver = getDriverInfo(parseInt(driverNumber));
                        return driver?.name || `Driver ${driverNumber}`;
                      }}
                    />
                    
                    {/* Render lines for each selected driver */}
                    {selectedDrivers.map((driverNumber, index) => {
                      const driver = getDriverInfo(driverNumber);
                      
                      // First driver gets solid line, rest get dashed lines
                      const strokeDasharray = index === 0 ? "0" : "5 5";
                      
                      return (
                        <Line
                          key={driverNumber}
                          type="monotone"
                          dataKey={`driver_${driverNumber}`}
                          name={`driver_${driverNumber}`}
                          stroke={driver?.team_color || 'rgb(204, 204, 204)'}
                          strokeWidth={2}
                          dot={{ r: 3, strokeWidth: 1 }}
                          activeDot={{ r: 8, strokeWidth: 1 }}
                          strokeDasharray={strokeDasharray}
                          connectNulls
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            
            {/* Legend */}
            <div className="mt-4 text-xs text-muted-foreground">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-8 h-2 bg-gray-400" style={{ borderStyle: 'solid' }}></div>
                  <span>First Driver (Solid)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-8 h-2 bg-gray-400" style={{ borderStyle: 'dashed' }}></div>
                  <span>Other Drivers (Dashed)</span>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default LapTimeCharts; 