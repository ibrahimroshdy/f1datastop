import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTelemetryData, TelemetryDataPoint, Driver } from "@/hooks/useTelemetryData";
import { useOpenF1SessionFromErgast } from "@/hooks/useOpenF1Data";
import { Line, LineChart, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Gauge, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatTime } from "@/utils/lapTimeUtils";

interface TelemetryDashboardProps {
  year: number;
  round: string;
  sessionType?: string;
}

const TelemetryDashboard: React.FC<TelemetryDashboardProps> = ({ 
  year, 
  round, 
  sessionType = "Race" 
}) => {
  const [selectedDrivers, setSelectedDrivers] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState("speed");
  const [dataTimeWindow, setDataTimeWindow] = useState<number>(30); // 30 seconds window
  const [selectedTimeRange, setSelectedTimeRange] = useState<[number, number] | null>(null);
  const [isTabLoading, setIsTabLoading] = useState(false);
  const [hasServerError, setHasServerError] = useState(false);
  
  // Get the OpenF1 session that matches this Ergast race
  const { 
    data: sessionData, 
    isLoading: isSessionLoading 
  } = useOpenF1SessionFromErgast(year, round, sessionType);
  
  const sessionKey = sessionData?.data?.session_key;
  
  // Get telemetry data for this session
  const {
    telemetryData,
    availableDrivers,
    isLoading,
    loadingProgress,
    errorMessage,
    hasData,
    timeRange,
    lapData
  } = useTelemetryData(sessionKey || 0, selectedDrivers);
  
  // Check for 500 errors and update state
  useEffect(() => {
    if (errorMessage && errorMessage.includes("500")) {
      setHasServerError(true);
    }
  }, [errorMessage]);
  
  // Handle driver selection
  const toggleDriverSelection = (driverNumber: number) => {
    setSelectedDrivers(prev => {
      if (prev.includes(driverNumber)) {
        return prev.filter(d => d !== driverNumber);
      } else {
        // Limit to 3 drivers at a time
        const newSelection = [...prev, driverNumber];
        if (newSelection.length > 3) {
          newSelection.shift(); // Remove the first driver
        }
        return newSelection;
      }
    });
  };
  
  // Auto-select first driver when available
  useEffect(() => {
    if (availableDrivers.length > 0 && selectedDrivers.length === 0) {
      setSelectedDrivers([availableDrivers[0].driver_number]);
    }
  }, [availableDrivers, selectedDrivers]);
  
  // Helper function to find closest data point in time
  const findClosestDataPoint = (data: TelemetryDataPoint[], targetTime: number): TelemetryDataPoint | null => {
    if (!data || data.length === 0) return null;
    
    let closestPoint = data[0];
    let minDistance = Math.abs(data[0].time - targetTime);
    
    for (let i = 1; i < data.length; i++) {
      const distance = Math.abs(data[i].time - targetTime);
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = data[i];
      }
    }
    
    // Only return if the point is within a reasonable time window (500ms)
    return minDistance <= 500 ? closestPoint : null;
  };
  
  // Helper function to downsample data for chart performance
  const downsampleData = (data: any[], targetPoints: number) => {
    if (data.length <= targetPoints) return data;
    
    const step = Math.floor(data.length / targetPoints);
    const result = [];
    
    for (let i = 0; i < data.length; i += step) {
      result.push(data[i]);
    }
    
    return result;
  };
  
  // Process data for the selected metric and time range
  const chartData = React.useMemo(() => {
    if (!hasData || !timeRange) return [];
    
    // Use selected time range if available, otherwise use the full range
    const [startTime, endTime] = selectedTimeRange || timeRange;
    
    // Create combined dataset with all drivers
    const combinedData: any[] = [];
    const timeStep = 100; // milliseconds
    
    // For each driver, find the closest data point to each time step
    for (let time = startTime; time <= endTime; time += timeStep) {
      const dataPoint: any = { time };
      
      Object.entries(telemetryData).forEach(([driverNumber, driverData]) => {
        const driver = availableDrivers.find(d => d.driver_number === parseInt(driverNumber));
        if (!driver) return;
        
        // Find closest data point
        const closestPoint = findClosestDataPoint(driverData, time);
        if (closestPoint) {
          const driverKey = `${driver.name_acronym}`;
          
          // Add data for the selected metric
          if (activeTab === "speed") {
            dataPoint[driverKey] = closestPoint.speed;
          } else if (activeTab === "rpm") {
            dataPoint[driverKey] = closestPoint.rpm;
          } else if (activeTab === "throttle") {
            dataPoint[driverKey] = closestPoint.throttle;
          } else if (activeTab === "brake") {
            dataPoint[driverKey] = closestPoint.brake;
          } else if (activeTab === "gear") {
            dataPoint[driverKey] = closestPoint.gear;
          } else if (activeTab === "drs") {
            dataPoint[driverKey] = closestPoint.drs > 0 ? 1 : 0;
          }
          
          // Add the driver color for the legend
          dataPoint[`${driverKey}_color`] = driver.team_color;
        }
      });
      
      combinedData.push(dataPoint);
    }
    
    // Downsample to reduce chart density
    return downsampleData(combinedData, 100); // Keep ~100 points
  }, [telemetryData, availableDrivers, selectedDrivers, activeTab, timeRange, selectedTimeRange, hasData]);
  
  // Helper function to format time for the x-axis
  const formatTimeForAxis = (time: number) => {
    const date = new Date(time);
    return `${date.getMinutes()}:${date.getSeconds().toString().padStart(2, '0')}`;
  };
  
  // Get the unit and label for the current metric
  const getMetricInfo = () => {
    switch (activeTab) {
      case "speed":
        return { unit: "km/h", label: "Speed", domain: [0, 350] };
      case "rpm":
        return { unit: "RPM", label: "Engine RPM", domain: [0, 15000] };
      case "throttle":
        return { unit: "%", label: "Throttle", domain: [0, 100] };
      case "brake":
        return { unit: "%", label: "Brake", domain: [0, 100] };
      case "gear":
        return { unit: "", label: "Gear", domain: [0, 8] };
      case "drs":
        return { unit: "", label: "DRS Activated", domain: [0, 1] };
      default:
        return { unit: "", label: "", domain: [0, 100] };
    }
  };
  
  const { unit, label, domain } = getMetricInfo();

  // Handle tab change with loading indicator
  const handleTabChange = (value: string) => {
    setIsTabLoading(true);
    setActiveTab(value);
    // Use a small timeout to simulate processing and prevent the UI from feeling jarring
    setTimeout(() => {
      setIsTabLoading(false);
    }, 500);
  };
  
  return (
    <Card className="relative">
      <CardHeader className="space-y-1 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Telemetry Analysis
          </CardTitle>
          {sessionData?.data && (
            <Badge variant="outline" className="ml-2">
              {sessionData.data.session_type || "Race"}
              {sessionData.data.session_name && ` - ${sessionData.data.session_name}`}
            </Badge>
          )}
        </div>
        
        {isLoading && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Loading telemetry data...</span>
              <span>{loadingProgress}%</span>
            </div>
            <Progress value={loadingProgress} max={100} className="h-1" />
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        {isSessionLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-[300px] w-full" />
          </div>
        ) : !sessionKey ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">No OpenF1 data available for this race.</p>
            <p className="text-sm text-muted-foreground mt-2">
              OpenF1 data is only available for recent races (2023 onwards).
            </p>
          </div>
        ) : errorMessage || hasServerError ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">
              {hasServerError 
                ? "Telemetry data is temporarily unavailable for this session." 
                : errorMessage}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {hasServerError 
                ? "The OpenF1 API may not have telemetry data for this particular session, or the service might be experiencing issues."
                : "Please try again later or select a different race."}
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-4"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {availableDrivers.map(driver => (
                <Button
                  key={driver.driver_number}
                  variant={selectedDrivers.includes(driver.driver_number) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleDriverSelection(driver.driver_number)}
                  className="flex items-center gap-1"
                  style={{
                    backgroundColor: selectedDrivers.includes(driver.driver_number) 
                      ? driver.team_color 
                      : 'transparent',
                    color: selectedDrivers.includes(driver.driver_number) 
                      ? (isColorLight(driver.team_color) ? 'black' : 'white') 
                      : 'inherit',
                    borderColor: driver.team_color
                  }}
                >
                  <span className="font-mono">{driver.driver_number}</span>
                  <span className="hidden sm:inline ml-1">{driver.name_acronym}</span>
                </Button>
              ))}
            </div>
            
            <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
              <TabsList className="grid grid-cols-3 sm:grid-cols-6">
                <TabsTrigger value="speed">Speed</TabsTrigger>
                <TabsTrigger value="rpm">RPM</TabsTrigger>
                <TabsTrigger value="throttle">Throttle</TabsTrigger>
                <TabsTrigger value="brake">Brake</TabsTrigger>
                <TabsTrigger value="gear">Gear</TabsTrigger>
                <TabsTrigger value="drs">DRS</TabsTrigger>
              </TabsList>
              
              <TabsContent value={activeTab} className="space-y-4">
                <div className="h-[400px] w-full relative">
                  {isTabLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                        <p className="text-sm text-muted-foreground">Processing {activeTab} data...</p>
                      </div>
                    </div>
                  ) : null}
                  
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis 
                          dataKey="time" 
                          tickFormatter={formatTimeForAxis}
                          minTickGap={50}
                        />
                        <YAxis domain={domain} unit={unit} width={50} />
                        <Tooltip 
                          formatter={(value: any) => [`${value} ${unit}`, '']}
                          labelFormatter={(time) => `Time: ${formatTimeForAxis(time)}`}
                        />
                        <Legend />
                        
                        {selectedDrivers.map(driverNumber => {
                          const driver = availableDrivers.find(d => d.driver_number === driverNumber);
                          if (!driver) return null;
                          
                          return (
                            <Line
                              key={driverNumber}
                              type="monotone"
                              dataKey={driver.name_acronym}
                              name={`${driver.name_acronym} (${driver.driver_number})`}
                              stroke={driver.team_color}
                              strokeWidth={2}
                              dot={false}
                              activeDot={{ r: 6 }}
                              isAnimationActive={false}
                            />
                          );
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-muted-foreground">No telemetry data available.</p>
                    </div>
                  )}
                </div>
                
                <div className="text-sm text-muted-foreground text-center">
                  {activeTab === "speed" ? (
                    <p>Higher speed indicates straights or fast corners</p>
                  ) : activeTab === "rpm" ? (
                    <p>RPM rises with gear and throttle application</p>
                  ) : activeTab === "throttle" ? (
                    <p>100% means full throttle application</p>
                  ) : activeTab === "brake" ? (
                    <p>100% indicates maximum brake pressure</p>
                  ) : activeTab === "gear" ? (
                    <p>F1 cars have 8 forward gears</p>
                  ) : activeTab === "drs" ? (
                    <p>Active when the Drag Reduction System is open</p>
                  ) : null}
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </CardContent>
    </Card>
  );
};

// Helper to determine if a color is light or dark for text contrast
const isColorLight = (color: string): boolean => {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155;
};

export default TelemetryDashboard; 