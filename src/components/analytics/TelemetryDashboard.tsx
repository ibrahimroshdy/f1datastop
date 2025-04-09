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
import { Avatar } from "@/components/ui/avatar";

interface TelemetryDashboardProps {
  year: number;
  round: string;
  sessionType?: string;
}

// Helper function to determine if a color is light or dark
const isColorLight = (color: string) => {
  // Default to dark if color is not provided or invalid
  if (!color || color === 'transparent') return false;
  
  // Convert hex to RGB
  let r, g, b;
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    r = parseInt(hex.substr(0, 2), 16);
    g = parseInt(hex.substr(2, 2), 16);
    b = parseInt(hex.substr(4, 2), 16);
  } else if (color.startsWith('rgb')) {
    const rgbMatch = color.match(/(\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      r = parseInt(rgbMatch[1], 10);
      g = parseInt(rgbMatch[2], 10);
      b = parseInt(rgbMatch[3], 10);
    } else {
      return false;
    }
  } else {
    return false;
  }

  // Calculate perceived brightness using YIQ formula
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return yiq >= 128; // Consider colors with brightness >= 128 as light
};

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
  
  // Get the OpenF1 session directly
  // Note: round is now expected to be either a meeting_key or special value like "last"/"next"
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
    lapData,
    loadDriverData,
    driverLoadingState
  } = useTelemetryData(sessionKey || 0, selectedDrivers);
  
  // IMPORTANT: Do not add 'limit' parameter to any OpenF1 car_data API calls
  // The OpenF1 API has an issue where adding a limit parameter causes it to return no data
  
  // Check for 500 errors and update state
  useEffect(() => {
    if (errorMessage && errorMessage.includes("500")) {
      setHasServerError(true);
    }
  }, [errorMessage]);
  
  // Handle driver selection
  const toggleDriverSelection = (driverNum: number) => {
    setSelectedDrivers(prev => {
      // If driver is already selected, remove them from selection
      if (prev.includes(driverNum)) {
        return prev.filter(d => d !== driverNum);
      } else {
        // Allow selecting multiple drivers (no limit)
        const newSelection = [...prev, driverNum];
        
        // Load data for the newly selected driver if it's not already loaded or loading
        if (!telemetryData[driverNum] && !driverLoadingState[driverNum]) {
          loadDriverData(driverNum);
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
  
  // More efficient search function that doesn't need to scan the entire array
  // This is faster than the original implementation for large datasets
  const findClosestDataPointEfficient = (data: TelemetryDataPoint[], targetTime: number, maxWindow: number): TelemetryDataPoint | null => {
    if (!data || data.length === 0) return null;
    
    const firstTime = data[0].time;
    const lastTime = data[data.length - 1].time;
    
    // Quick bounds check
    if (targetTime < firstTime - maxWindow || targetTime > lastTime + maxWindow) {
      return null;
    }
    
    // Estimate position using linear interpolation
    const position = Math.floor((targetTime - firstTime) / (lastTime - firstTime) * (data.length - 1));
    const index = Math.max(0, Math.min(position, data.length - 1));
    
    // Search outward from the estimated position
    let closestPoint = data[index];
    let minDistance = Math.abs(data[index].time - targetTime);
    
    // Only search up to a certain number of points in each direction
    const searchLimit = Math.min(100, Math.floor(data.length / 10));
    
    // Search forward
    for (let i = 1; i <= searchLimit; i++) {
      const checkIndex = index + i;
      if (checkIndex >= data.length) break;
      
      const distance = Math.abs(data[checkIndex].time - targetTime);
      if (distance > minDistance && distance > maxWindow) break; // Stop if we're getting further away
      
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = data[checkIndex];
      }
    }
    
    // Search backward
    for (let i = 1; i <= searchLimit; i++) {
      const checkIndex = index - i;
      if (checkIndex < 0) break;
      
      const distance = Math.abs(data[checkIndex].time - targetTime);
      if (distance > minDistance && distance > maxWindow) break; // Stop if we're getting further away
      
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = data[checkIndex];
      }
    }
    
    // Only return if within the maximum window
    return minDistance <= maxWindow ? closestPoint : null;
  };
  
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
  
  // Helper function to create a data point at a specific time
  const createDataPointAtTime = (time: number, activeDriverData: {[key: string]: { data: TelemetryDataPoint[], driver: Driver }}) => {
    const dataPoint: any = { time };
    let hasValidData = false;
    
    // Process each active driver's data
    Object.values(activeDriverData).forEach(({ data, driver }) => {
      if (!data || !Array.isArray(data) || data.length === 0) return;
      
      try {
        const closestPoint = findClosestDataPointEfficient(data, time, 5000);
        
        if (closestPoint) {
          const driverKey = driver.name_acronym;
          
          // Get value based on current tab
          let dataValue: number | null = null;
          
          switch (activeTab) {
            case "speed": 
              dataValue = typeof closestPoint.speed === 'number' ? closestPoint.speed : null;
              break;
            case "rpm": 
              dataValue = typeof closestPoint.rpm === 'number' ? closestPoint.rpm : null;
              break;
            case "throttle": 
              dataValue = typeof closestPoint.throttle === 'number' ? closestPoint.throttle : null;
              break;
            case "brake": 
              dataValue = typeof closestPoint.brake === 'number' ? closestPoint.brake : null;
              break;
            case "gear": 
              dataValue = typeof closestPoint.gear === 'number' ? closestPoint.gear : null;
              break;
            case "drs": 
              dataValue = typeof closestPoint.drs === 'number' ? (closestPoint.drs > 0 ? 1 : 0) : null;
              break;
          }
          
          if (dataValue !== null) {
            dataPoint[driverKey] = dataValue;
            dataPoint[`${driverKey}_color`] = driver.team_color;
            hasValidData = true;
          }
        }
      } catch (error) {
        console.error(`Error processing data point for driver ${driver.driver_number}:`, error);
      }
    });
    
    return hasValidData ? dataPoint : null;
  };
  
  // Define the generateChartData function BEFORE it's used
  // Extracted function to generate chart data with different time steps
  const generateChartData = (startTime: number, endTime: number, timeStep: number, maxPoints: number) => {
    console.time(`generateChartData with step ${timeStep}ms`);
    try {
      // Create combined dataset with all drivers - pre-allocate array size
      const combinedData: any[] = new Array(Math.min(maxPoints, 300));
      
      // Performance optimization: Pre-filter the driver data to avoid loops
      const activeDriverData: {[key: string]: {
        data: TelemetryDataPoint[], 
        driver: Driver
      }} = {};
      
      // Only process selected drivers that have data
      const driversToProcess = selectedDrivers.filter(
        driverNum => !!telemetryData[driverNum] && telemetryData[driverNum].length > 0
      );
      
      console.log(`Processing ${driversToProcess.length} drivers with data`);
      
      // Skip processing if no drivers have data
      if (driversToProcess.length === 0) {
        console.timeEnd(`generateChartData with step ${timeStep}ms`);
        return [];
      }
      
      driversToProcess.forEach(driverNum => {
        const driver = availableDrivers.find(d => d.driver_number === driverNum);
        if (driver) {
          activeDriverData[driverNum] = { 
            data: telemetryData[driverNum],
            driver 
          };
        }
      });
      
      // Count of active drivers for more efficient processing
      const activeDriverCount = Object.keys(activeDriverData).length;
      
      // If no drivers to show, return empty array
      if (activeDriverCount === 0) {
        console.timeEnd(`generateChartData with step ${timeStep}ms`);
        return [];
      }
      
      // Performance optimization: Only sample the timepoints we need for the chart
      let index = 0;
      
      // Don't use Date.now() for time range calculation - just use the provided times
      // This was causing issues with historical data
      const actualStartTime = startTime;
      
      for (let time = actualStartTime; time <= endTime && index < maxPoints; time += timeStep) {
        const dataPoint: any = { time };
        let hasValidData = false;
        
        // Process each active driver's data
        Object.values(activeDriverData).forEach(({ data, driver }) => {
          // Skip if data isn't valid
          if (!data || !Array.isArray(data) || data.length === 0) return;
          
          try {
            const closestPoint = findClosestDataPointEfficient(data, time, 5000);
            
            if (closestPoint) {
              const driverKey = driver.name_acronym;
              
              // Validate data and set it immediately - simplify processing
              let dataValue: number | null = null;
              
              switch (activeTab) {
                case "speed": 
                  dataValue = typeof closestPoint.speed === 'number' ? closestPoint.speed : null;
                  break;
                case "rpm": 
                  dataValue = typeof closestPoint.rpm === 'number' ? closestPoint.rpm : null;
                  break;
                case "throttle": 
                  dataValue = typeof closestPoint.throttle === 'number' ? closestPoint.throttle : null;
                  break;
                case "brake": 
                  dataValue = typeof closestPoint.brake === 'number' ? closestPoint.brake : null;
                  break;
                case "gear": 
                  dataValue = typeof closestPoint.gear === 'number' ? closestPoint.gear : null;
                  break;
                case "drs": 
                  dataValue = typeof closestPoint.drs === 'number' ? (closestPoint.drs > 0 ? 1 : 0) : null;
                  break;
              }
              
              if (dataValue !== null) {
                dataPoint[driverKey] = dataValue;
                dataPoint[`${driverKey}_color`] = driver.team_color;
                hasValidData = true;
              }
            }
          } catch (error) {
            console.error(`Error processing data point for driver ${driver.driver_number}:`, error);
          }
        });
        
        // Only add points that have valid data
        if (hasValidData) {
          combinedData[index++] = dataPoint;
        }
      }
      
      // Remove any undefined entries
      const finalData = combinedData.filter(Boolean);
      console.log(`Generated ${finalData.length} chart data points`);
      return finalData;
    } catch (error) {
      console.error('Error in generateChartData:', error);
      return [];
    } finally {
      console.timeEnd(`generateChartData with step ${timeStep}ms`);
    }
  };
  
  // Replace the entire generateFullSessionChartData function with a simpler version
  const generateFullSessionChartData = (startTime: number, endTime: number, timeStep: number, maxPoints: number) => {
    try {
      // Start with a very simple approach
      const result = [];
      const driverMap = {};
      
      // Get available drivers with data
      selectedDrivers.forEach(driverNum => {
        if (telemetryData[driverNum] && telemetryData[driverNum].length > 0) {
          const driver = availableDrivers.find(d => d.driver_number === driverNum);
          if (driver) {
            driverMap[driverNum] = {
              acronym: driver.name_acronym,
              color: driver.team_color,
              data: telemetryData[driverNum]
            };
          }
        }
      });
      
      // If no drivers have data, return empty
      if (Object.keys(driverMap).length === 0) {
        return [];
      }
      
      // Create time points at regular intervals
      const timePoints = [];
      const totalPoints = Math.min(1500, maxPoints); // Increase from 500 to 1500 points for higher resolution
      const actualTimeStep = Math.max(1000, Math.ceil((endTime - startTime) / totalPoints));
      
      for (let t = startTime; t <= endTime; t += actualTimeStep) {
        timePoints.push(t);
      }
      
      // Make sure we include the end time
      if (timePoints[timePoints.length - 1] !== endTime) {
        timePoints.push(endTime);
      }
      
      // For each time point, gather data from all drivers
      timePoints.forEach(time => {
        const point = { time };
        let hasData = false;
        
        // Get data for each driver at this time point
        Object.values(driverMap).forEach((driver: any) => {
          // Find the closest data point (within 10 seconds)
          const driverData = driver.data;
          if (!driverData || driverData.length === 0) return;
          
          let closest = null;
          let minDiff = 10000; // 10 seconds max difference
          
          for (let i = 0; i < driverData.length; i++) {
            const diff = Math.abs(driverData[i].time - time);
            if (diff < minDiff) {
              minDiff = diff;
              closest = driverData[i];
            }
          }
          
          if (closest) {
            // Get the value based on selected tab
            let value = null;
            
            switch (activeTab) {
              case "speed": value = closest.speed; break;
              case "rpm": value = closest.rpm; break;
              case "throttle": value = closest.throttle; break;
              case "brake": value = closest.brake; break;
              case "gear": value = closest.gear; break;
              case "drs": value = closest.drs > 0 ? 1 : 0; break;
            }
            
            if (value !== null && value !== undefined) {
              point[driver.acronym] = value;
              hasData = true;
            }
          }
        });
        
        if (hasData) {
          result.push(point);
        }
      });
      
      return result;
    } catch (error) {
      console.error('Error generating chart data:', error);
      return [];
    }
  };
  
  // A more aggressive version of createDataPointAtTime that tries harder to find data
  const createEmergencyDataPoint = (time: number, activeDriverData: {[key: string]: { data: TelemetryDataPoint[], driver: Driver }}) => {
    const dataPoint: any = { time };
    let hasValidData = false;
    
    // Process each active driver's data
    Object.values(activeDriverData).forEach(({ data, driver }) => {
      if (!data || !Array.isArray(data) || data.length === 0) return;
      
      try {
        // Use a much wider time window (10 seconds) to find points
        const timeWindow = 10000;
        
        // Try to find a point within this wider window
        const closestPoint = findClosestPointWithinWindow(data, time, timeWindow);
        
        if (closestPoint) {
          const driverKey = driver.name_acronym;
          
          // Get value based on current tab
          let dataValue: number | null = null;
          
          switch (activeTab) {
            case "speed": 
              dataValue = typeof closestPoint.speed === 'number' ? closestPoint.speed : null;
              break;
            case "rpm": 
              dataValue = typeof closestPoint.rpm === 'number' ? closestPoint.rpm : null;
              break;
            case "throttle": 
              dataValue = typeof closestPoint.throttle === 'number' ? closestPoint.throttle : null;
              break;
            case "brake": 
              dataValue = typeof closestPoint.brake === 'number' ? closestPoint.brake : null;
              break;
            case "gear": 
              dataValue = typeof closestPoint.gear === 'number' ? closestPoint.gear : null;
              break;
            case "drs": 
              dataValue = typeof closestPoint.drs === 'number' ? (closestPoint.drs > 0 ? 1 : 0) : null;
              break;
          }
          
          if (dataValue !== null) {
            dataPoint[driverKey] = dataValue;
            dataPoint[`${driverKey}_color`] = driver.team_color;
            hasValidData = true;
          }
        }
      } catch (error) {
        console.error(`Error processing emergency data point for driver ${driver.driver_number}:`, error);
      }
    });
    
    return hasValidData ? dataPoint : null;
  };
  
  // Helper to find a point within a specific time window
  const findClosestPointWithinWindow = (data: TelemetryDataPoint[], targetTime: number, timeWindow: number): TelemetryDataPoint | null => {
    if (!data || data.length === 0) return null;
    
    // For very large datasets, we can't afford to scan the entire array
    // Try to use binary search first to find the approximate position
    const firstTime = data[0].time;
    const lastTime = data[data.length - 1].time;
    
    // Safety check for invalid time range
    if (isNaN(firstTime) || isNaN(lastTime) || firstTime >= lastTime) {
      return null;
    }
    
    // Check if target time is within the data range
    if (targetTime < firstTime - timeWindow || targetTime > lastTime + timeWindow) {
      return null;
    }
    
    // Estimate index using linear interpolation
    const timeRange = lastTime - firstTime;
    const index = Math.floor((targetTime - firstTime) * (data.length - 1) / timeRange);
    const safeIndex = Math.max(0, Math.min(index, data.length - 1));
    
    // Look for the closest point within the time window
    let closestPoint = null;
    let closestDistance = timeWindow + 1; // Start with something larger than our window
    
    // Search in both directions from the estimated index
    for (let i = safeIndex; i < data.length; i++) {
      const distance = Math.abs(data[i].time - targetTime);
      if (distance > closestDistance) break; // We're moving away from the target
      if (distance <= timeWindow && distance < closestDistance) {
        closestDistance = distance;
        closestPoint = data[i];
      }
    }
    
    for (let i = safeIndex - 1; i >= 0; i--) {
      const distance = Math.abs(data[i].time - targetTime);
      if (distance > closestDistance) break; // We're moving away from the target
      if (distance <= timeWindow && distance < closestDistance) {
        closestDistance = distance;
        closestPoint = data[i];
      }
    }
    
    return closestPoint;
  };
  
  // Process data for the selected metric and time range
  const chartData = React.useMemo(() => {
    if (!hasData || !timeRange) return [];
    
    try {
      // Use selected time range if available, otherwise use the full range
      const [startTime, endTime] = selectedTimeRange || timeRange;
      
      // Safety check for invalid time ranges that might cause loops
      if (!startTime || !endTime || isNaN(startTime) || isNaN(endTime) || startTime >= endTime) {
        return [];
      }
      
      // EXTREME Performance optimization: Use a much larger time step to reduce data points
      // For car telemetry, we don't need millisecond precision in the chart
      const timeStep = 2000; // 2 second time step - extreme performance improvement
      
      // Pre-compute the number of data points to allocate array
      const timeDiff = endTime - startTime;
      // Add protection against extremely large time ranges
      if (timeDiff <= 0 || timeDiff > 24 * 60 * 60 * 1000) {
        return [];
      }
      
      const numPoints = Math.ceil(timeDiff / timeStep);
      
      // Increased point limit: Use a maximum of 500 points for the full session
      const MAX_CHART_POINTS = 500;
      
      // If we'd generate too many points, use a calculated time step that will give us exactly MAX_CHART_POINTS
      if (numPoints > MAX_CHART_POINTS) {
        // Calculate a time step that will evenly distribute MAX_CHART_POINTS across the entire session
        const calculatedTimeStep = Math.ceil(timeDiff / MAX_CHART_POINTS);
        
        // Generate data with special handling to ensure first and last points are included
        const data = generateFullSessionChartData(startTime, endTime, calculatedTimeStep, MAX_CHART_POINTS);
        
        // Debug the generated data for multiple drivers
        if (selectedDrivers.length > 1) {
          const samplePoint = data.length > 0 ? data[0] : null;
          console.log('Sample data point:', samplePoint);
          
          // Check if all selected drivers have data
          selectedDrivers.forEach(driverNum => {
            const driver = availableDrivers.find(d => d.driver_number === driverNum);
            if (driver) {
              const driverKey = driver.name_acronym;
              const pointsWithData = data.filter(p => p[driverKey] !== undefined);
              console.log(`Driver ${driverKey} has data in ${pointsWithData.length}/${data.length} points`);
            }
          });
        }
        
        return data;
      }
      
      // For small data sets, use the normal time step
      const data = generateChartData(startTime, endTime, timeStep, numPoints);
      
      // Debug the generated data for multiple drivers
      if (selectedDrivers.length > 1) {
        const samplePoint = data.length > 0 ? data[0] : null;
        console.log('Sample data point:', samplePoint);
        
        // Check if all selected drivers have data
        selectedDrivers.forEach(driverNum => {
          const driver = availableDrivers.find(d => d.driver_number === driverNum);
          if (driver) {
            const driverKey = driver.name_acronym;
            const pointsWithData = data.filter(p => p[driverKey] !== undefined);
            console.log(`Driver ${driverKey} has data in ${pointsWithData.length}/${data.length} points`);
          }
        });
      }
      
      return data;
    } catch (error) {
      return [];
    }
  }, [telemetryData, availableDrivers, selectedDrivers, activeTab, timeRange, selectedTimeRange, hasData]);

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
              {year >= 2025 ? 
                "2025 season data is not yet fully available in the OpenF1 API. Please check back later or select a previous season from the Season dropdown above." :
                "OpenF1 data is only available for recent races (2023 onwards)."}
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
              {year >= 2025 ? 
                "2025 season data is still being collected and not all sessions have complete telemetry information. Some driver data may be available while detailed telemetry is still pending. If you see drivers listed but no telemetry charts, this is likely why." :
                hasServerError 
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
        ) : availableDrivers.length > 0 ? (
          <>
            {/* Driver selection area - shown whenever drivers are available */}
            <div className="mb-6">
              <div className="mb-2 text-sm text-muted-foreground">
                Select a driver to load their telemetry data:
              </div>
              <div className="flex flex-wrap gap-2">
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
                    {driverLoadingState[driver.driver_number] && (
                      <span className="ml-1">
                        <div className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin border-current opacity-80" />
                      </span>
                    )}
                    {telemetryData[driver.driver_number] && !driverLoadingState[driver.driver_number] && (
                      <span className="ml-1 text-xs">✓</span>
                    )}
                  </Button>
                ))}
              </div>
              {selectedDrivers.length === 0 && (
                <div className="mt-4 text-center text-sm text-muted-foreground">
                  Click on a driver above to load their telemetry data
                </div>
              )}
            </div>
            
            {/* Show this when no data is available for selected drivers */}
            {!hasData && (
              <div className="py-8 text-center">
                <p className="text-muted-foreground">
                  No telemetry data found for selected drivers.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {year >= 2025 ? (
                    <>
                      2025 season data is still being collected and not all sessions have complete telemetry information.
                      <br />
                      <span className="text-xs mt-2 block">
                        While driver information is available, detailed telemetry data may not be present yet for this session. 
                        You can try selecting different drivers or check the Laps tab, as sometimes lap timing data is available 
                        even when detailed telemetry isn't. Data is continuously being updated, so please check back later.
                      </span>
                    </>
                  ) : (
                    "The OpenF1 API doesn't have telemetry data for the selected drivers in this session."
                  )}
                </p>
                <div className="mt-4 text-sm text-muted-foreground">
                  Try selecting a different driver or race session.
                </div>
              </div>
            )}
            
            {/* Only show the chart area when we have data */}
            {hasData && (
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
                          <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                          <XAxis 
                            dataKey="time" 
                            tickFormatter={formatTimeForAxis}
                            minTickGap={80}
                            tick={{ fontSize: 11 }}
                            interval="preserveEnd"
                          />
                          <YAxis 
                            domain={domain} 
                            unit={unit} 
                            width={50} 
                            tick={{ fontSize: 11 }}
                            tickCount={5}
                          />
                          
                          {/* Fixed lap indicators with proper date conversion */}
                          {lapData && lapData.length > 0 && selectedDrivers.length > 0 &&
                            lapData
                              .filter(lap => {
                                if (!lap.date_start) return false;
                                const time = new Date(lap.date_start).getTime();
                                return lap.driver_number === selectedDrivers[0] && 
                                    lap.lap_number > 0 && 
                                    !isNaN(time);
                              })
                              .map(lap => {
                                const time = new Date(lap.date_start).getTime();
                                return (
                                  <ReferenceLine
                                    key={`lap-${lap.lap_number}`}
                                    x={time}
                                    stroke="#666"
                                    strokeWidth={1}
                                    strokeDasharray="3 3"
                                    label={{
                                      value: `Lap ${lap.lap_number}`,
                                      position: 'insideTopRight',
                                      fill: '#fff',
                                      fontSize: 11
                                    }}
                                  />
                                );
                              })
                          }
                          
                          <Tooltip 
                            formatter={(value: any, name: string) => [`${value} ${unit}`, name]}
                            labelFormatter={(time) => {
                              const date = new Date(time as number);
                              // Find the lap for this time
                              let lapInfo = "";
                              if (lapData && lapData.length > 0 && selectedDrivers.length > 0) {
                                const driverLaps = lapData.filter(lap => lap.driver_number === selectedDrivers[0]);
                                const currentLap = driverLaps.find(lap => {
                                  if (!lap.date_start || !lap.date_end) return false;
                                  const startTime = new Date(lap.date_start).getTime();
                                  const endTime = new Date(lap.date_end).getTime();
                                  return time >= startTime && time <= endTime;
                                });
                                
                                if (currentLap) {
                                  const lapTime = formatTime(currentLap.lap_time);
                                  lapInfo = ` (Lap ${currentLap.lap_number}: ${lapTime})`;
                                }
                              }
                              return `${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}${lapInfo}`;
                            }}
                            contentStyle={{
                              backgroundColor: '#1a1a1a',
                              borderColor: '#333',
                              borderRadius: '5px'
                            }}
                          />
                          
                          {/* Render lines for each driver */}
                          {selectedDrivers.map(driverNum => {
                            const driver = availableDrivers.find(d => d.driver_number === driverNum);
                            if (!driver) return null;
                            
                            const driverKey = driver.name_acronym;
                            
                            return (
                              <Line
                                key={driverNum}
                                type="monotone"
                                dataKey={driverKey}
                                name={driverKey}
                                stroke={driver.team_color}
                                strokeWidth={2.5}
                                dot={false}
                                activeDot={{ r: 5, stroke: driver.team_color, strokeWidth: 2, fill: '#fff' }}
                                connectNulls={true}
                                isAnimationActive={false}
                              />
                            );
                          })}
                          
                          {/* Custom legend showing driver info */}
                          <Legend 
                            content={(props) => {
                              const { payload } = props;
                              if (!payload || payload.length === 0) return null;
                              
                              return (
                                <div style={{ 
                                  display: 'flex', 
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                  marginTop: '10px',
                                  gap: '20px'
                                }}>
                                  {selectedDrivers.map(driverNum => {
                                    const driver = availableDrivers.find(d => d.driver_number === driverNum);
                                    if (!driver) return null;
                                    
                                    return (
                                      <div key={driverNum} style={{ 
                                        display: 'flex', 
                                        alignItems: 'center',
                                        gap: '5px'
                                      }}>
                                        <div style={{ 
                                          width: '16px', 
                                          height: '3px', 
                                          backgroundColor: driver.team_color,
                                          borderRadius: '1px'
                                        }} />
                                        <span style={{ 
                                          fontSize: '12px',
                                          color: driver.team_color
                                        }}>
                                          {driver.name_acronym} ({driver.driver_number})
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <p className="text-muted-foreground text-sm">
                          Select a driver and metric to view telemetry data
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </>
        ) : (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">No driver data available for this race.</p>
            <p className="text-sm text-muted-foreground mt-2">
              {year >= 2025 ? 
                "2025 season data is still being collected. Driver and telemetry data may be added in the coming days. Please check back later or select a previous season from the dropdown above." :
                "The OpenF1 API doesn't have data for this session."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TelemetryDashboard;