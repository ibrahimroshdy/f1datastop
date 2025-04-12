import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTelemetryData, TelemetryDataPoint, Driver } from "@/hooks/useTelemetryData";
import { useOpenF1SessionFromErgast } from "@/hooks/useOpenF1Data";
import { Line, LineChart, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Gauge, RefreshCw, Loader2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatTime } from "@/utils/lapTimeUtils";
import { Avatar } from "@/components/ui/avatar";
import DriverSelectionPanel from "./DriverSelectionPanel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SessionOption {
  session_key: number;
  session_name: string;
  session_type: string;
  date_start: string;
  date_end: string;
  meeting_key: number;
  location: string;
  circuit_short_name: string;
}

interface TelemetryDashboardProps {
  year: number;
  round: string;
  sessionType?: string;
  sessionKey?: number;
}

// Define interface for the session data structure
interface SessionData {
  session_key: number;
  session_name: string;
  session_type: string;
  date_start: string;
  date_end: string;
  meeting_key: number;
  location: string;
  circuit_short_name: string;
  country_name: string;
  year: number;
}

interface SessionResponse {
  data: SessionData | null;
}

// Add this new type definition after other interfaces
interface SpeedTrap {
  speed: number;
  driverNumber: number;
  time: number;
  lap?: number;  // Add lap information
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
  sessionType = "Race",
  sessionKey: externalSessionKey
}) => {
  const [selectedDrivers, setSelectedDrivers] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState("speed");
  const [dataTimeWindow, setDataTimeWindow] = useState<number>(30); // 30 seconds window
  const [selectedTimeRange, setSelectedTimeRange] = useState<[number, number] | null>(null);
  const [isTabLoading, setIsTabLoading] = useState(false);
  const [hasServerError, setHasServerError] = useState(false);
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
  
  // After the useState declarations, add this hook to reset data when session changes
  useEffect(() => {
    // Reset selected drivers when the session changes
    setSelectedDrivers([]);
    setHasServerError(false);
    
    console.log("Session changed in TelemetryDashboard to:", externalSessionKey);
    
    // Clear session details cache when session changes
    setSessionDetails(null);
  }, [externalSessionKey]);
  
  // Use the session key from props if provided, otherwise use the hook
  const { 
    data: sessionData, 
    isLoading: isSessionLoading 
  } = useOpenF1SessionFromErgast(
    externalSessionKey ? 0 : year, 
    externalSessionKey ? "" : round, 
    externalSessionKey ? "" : sessionType
  );
  
  // Determine the effective session key
  const effectiveSessionKey = externalSessionKey || sessionData?.data?.session_key || 0;
  
  // Use telemetryData hook before session details fetch
  const {
    telemetryData,
    availableDrivers: originalAvailableDrivers,
    isLoading,
    loadingProgress,
    errorMessage,
    hasData,
    timeRange,
    lapData,
    loadDriverData,
    driverLoadingState
  } = useTelemetryData(effectiveSessionKey, selectedDrivers);
  
  // Check for 500 errors and update state, but only if we don't have data
  useEffect(() => {
    if (errorMessage) {
      // Only set server error if we don't have any data to display
      if (!hasData && Object.keys(telemetryData).length === 0) {
        if (errorMessage.includes("500")) {
          setHasServerError(true);
        } else if (errorMessage.includes("HTML instead of") || errorMessage.includes("HTML instead of data")) {
          setHasServerError(true);
          console.error("API returned HTML instead of JSON data:", errorMessage);
        }
      } else {
        // If we have data, don't show the error
        console.log("Ignoring error message because we already have data to display:", errorMessage);
        setHasServerError(false);
      }
    } else {
      setHasServerError(false);
    }
  }, [errorMessage, hasData, telemetryData]);

  // Additional check to ensure we don't show errors if data is loaded
  useEffect(() => {
    if (hasData && Object.keys(telemetryData).length > 0) {
      setHasServerError(false);
    }
  }, [hasData, telemetryData]);
  
  // Use manual fetch only when we need to get session details for display
  const [sessionDetails, setSessionDetails] = useState<any>(null);
  useEffect(() => {
    // Only fetch session details if we have an external session key and no details yet
    if (externalSessionKey && !sessionDetails) {
      const fetchSessionDetails = async () => {
        try {
          const response = await fetch(`/api/openf1/sessions?session_key=${externalSessionKey}`);
          
          if (!response.ok) {
            // Only set server error for critical response status codes
            if (response.status >= 500) {
              console.error(`API request failed with status ${response.status}`);
              setHasServerError(true);
              throw new Error(`API request failed with status ${response.status}`);
            } else {
              console.warn(`API request returned status ${response.status}, will try to parse response anyway`);
            }
          }
          
          // Check for HTML response
          const contentType = response.headers.get('content-type');
          let data;
          
          if (!contentType || !contentType.includes('application/json')) {
            // Get the response as text for debugging
            const textResponse = await response.text();
            console.error('API returned non-JSON response:', contentType, textResponse.substring(0, 100) + '...');
            
            // If it looks like HTML, handle it specially - but don't set server error if we can recover
            if (textResponse.trim().startsWith('<!DOCTYPE') || textResponse.trim().startsWith('<html')) {
              console.error('Server returned HTML instead of JSON - attempting to recover');
              
              // Only set server error if this is going to be a problem
              if (!hasData && Object.keys(telemetryData).length === 0) {
                setHasServerError(true);
              }
              
              // Try to continue without these details - don't throw
              return;
            }
            
            // Try to parse as JSON anyway, in case the content-type header is wrong
            try {
              data = JSON.parse(textResponse);
            } catch (e) {
              console.error('Failed to parse response as JSON:', e);
              
              // Only set server error if we don't have data to show
              if (!hasData && Object.keys(telemetryData).length === 0) {
                setHasServerError(true);
              }
              
              // Try to continue without these details - don't throw
              return;
            }
          } else {
            // Normal JSON parsing
            data = await response.json();
          }
          
          if (data && data[0]) {
            setSessionDetails({ data: data[0] });
          }
        } catch (error) {
          console.error("Error fetching session details:", error);
          
          // Only set server error if we don't have data to show
          if (!hasData && Object.keys(telemetryData).length === 0) {
            setHasServerError(true);
          }
        }
      };
      
      fetchSessionDetails();
    }
  }, [externalSessionKey, sessionDetails, hasData, telemetryData]);
  
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
          try {
            loadDriverData(driverNum).catch(error => {
              console.error(`Failed to load data for driver ${driverNum}:`, error);
              // No need to update driver state here as the loadDriverData function already handles errors
            });
          } catch (error) {
            console.error(`Error initiating data load for driver ${driverNum}:`, error);
          }
        }
        
        return newSelection;
      }
    });
  };
  
  // Create driverData object for the driver selection panel
  const normalizedDriverData = React.useMemo(() => {
    // Create a data structure that matches what DriverSelectionPanel expects
    const result: { [key: number]: any } = {};
    
    // Add data for drivers with telemetry data
    Object.entries(telemetryData).forEach(([driverNum, data]) => {
      if (data && data.length > 0) {
        result[parseInt(driverNum)] = data;
      }
    });
    
    // Also add data for selected drivers (even if they have errors)
    selectedDrivers.forEach(driverNum => {
      if (!result[driverNum]) {
        result[driverNum] = { length: 1 }; // Minimal data to trigger the checkmark
      }
    });
    
    return result;
  }, [telemetryData, selectedDrivers]);
  
  // Update the auto-select logic
  useEffect(() => {
    if (originalAvailableDrivers.length > 0 && selectedDrivers.length === 0) {
      // Check specific drivers that should be auto-selected, in order of preference
      const priorityDrivers = [1, 44, 4, 14, 55]; // VER, HAM, NOR, ALO, SAI
      
      for (const driverToCheck of priorityDrivers) {
        const driverExists = originalAvailableDrivers.find(d => d.driver_number === driverToCheck);
        if (driverExists) {
          console.log(`Auto-selecting driver ${driverToCheck} (${driverExists.name_acronym})`);
          setSelectedDrivers([driverToCheck]);
          
          // Pre-load this driver's data
          if (!telemetryData[driverToCheck] && !driverLoadingState[driverToCheck]) {
            console.log(`Pre-loading data for driver ${driverToCheck}`);
            loadDriverData(driverToCheck).catch(error => {
              console.error(`Failed to load data for driver ${driverToCheck}:`, error);
              // If first driver fails, try the next one in the list
              if (priorityDrivers.indexOf(driverToCheck) < priorityDrivers.length - 1) {
                const nextDriver = priorityDrivers[priorityDrivers.indexOf(driverToCheck) + 1];
                const driverExists = originalAvailableDrivers.find(d => d.driver_number === nextDriver);
                if (driverExists) {
                  setSelectedDrivers([nextDriver]);
                }
              }
            });
          }
          
          return; // Exit early once we find a valid driver
        }
      }
      
      // If none of the priority drivers are found, select the first available driver
      if (originalAvailableDrivers.length > 0) {
        const firstDriver = originalAvailableDrivers[0];
        console.log(`No priority drivers found, selecting first available driver:`, firstDriver);
        setSelectedDrivers([firstDriver.driver_number]);
      }
    }
  }, [originalAvailableDrivers, selectedDrivers, telemetryData, driverLoadingState, loadDriverData]);
  
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
        return { unit: "", label: "DRS", domain: [0, 1.2] };
      default:
        return { unit: "", label: "", domain: [0, 100] };
    }
  };
  
  const { unit, label, domain } = getMetricInfo();

  // Calculate the fastest speed from selected drivers' data
  const maxSpeedInfo = React.useMemo(() => {
    if (activeTab !== "speed" || !hasData) return null;
    
    let maxSpeed = 0;
    let maxSpeedDriver = null;
    
    // Check all selected drivers
    selectedDrivers.forEach(driverNum => {
      if (telemetryData[driverNum] && telemetryData[driverNum].length > 0) {
        // Find maximum speed for this driver
        const speeds = telemetryData[driverNum].map(point => point.speed);
        const driverMaxSpeed = Math.max(...speeds);
        
        // Update global maximum if this driver's max is higher
        if (driverMaxSpeed > maxSpeed) {
          maxSpeed = driverMaxSpeed;
          maxSpeedDriver = driverNum;
        }
      }
    });
    
    return maxSpeed > 0 && maxSpeedDriver ? {
      speed: maxSpeed,
      driverNumber: maxSpeedDriver
    } : null;
  }, [activeTab, hasData, selectedDrivers, telemetryData]);

  // Handle tab change with loading indicator
  const handleTabChange = (value: string) => {
    setIsTabLoading(true);
    setActiveTab(value);
    // Use a small timeout to simulate processing and prevent the UI from feeling jarring
    setTimeout(() => {
      setIsTabLoading(false);
    }, 500);
  };
  
  // Fix issue with multiple drivers by making sure chart data includes all drivers
  const chartData = React.useMemo(() => {
    if (!hasData || !timeRange) {
      console.log("No data or timeRange available");
      
      // Debugging: Log the status of each selected driver's data
      selectedDrivers.forEach(driverNum => {
        const driverData = telemetryData[driverNum];
        console.log(`Driver ${driverNum} data status:`, 
          driverData ? `${driverData.length} points available` : 'No data available');
      });
      
      return [];
    }
    
    try {
      // Use selected time range if available, otherwise use the full range
      const [startTime, endTime] = selectedTimeRange || timeRange;
      
      // Safety check for invalid time ranges that might cause loops
      if (!startTime || !endTime || isNaN(startTime) || isNaN(endTime) || startTime >= endTime) {
        console.log("Invalid time range:", startTime, endTime);
        return [];
      }
      
      // Create separate array of points for each driver
      const driverDataPoints: {[key: string]: any[]} = {};
      
      // Get available drivers with data
      const driversWithData = selectedDrivers.filter(driverNum => 
        telemetryData[driverNum] && 
        telemetryData[driverNum].length > 0
      );
      
      if (driversWithData.length === 0) {
        console.log("No drivers with data");
        return [];
      }
      
      console.log(`Processing ${driversWithData.length} drivers with data`);
      
      // For each driver, process their data with smoothing
      driversWithData.forEach(driverNum => {
        const driver = originalAvailableDrivers.find(d => d.driver_number === driverNum);
        if (!driver) return;
        
        const driverKey = driver.name_acronym;
        const data = telemetryData[driverNum];
        
        // Filter to points within the selected time range
        const filteredData = data.filter(
          point => point.time >= startTime && point.time <= endTime
        );
        
        // Apply intelligent sampling to reduce noise while preserving important features
        // This gives us smoother lines while maintaining critical telemetry patterns
        const smoothedData = [];
        
        // For extremely smooth charts, we need a completely different approach with much more aggressive sampling
        // Use a fixed interval skip of 75 points to get a sparse but smooth representation
        const EXTREME_SKIP_RATE = 75;
        
        // We'll sample very sparsely but ensure we include critical points
        // Always include the first and last points
        if (filteredData.length > 0) {
          smoothedData.push(filteredData[0]);
          
          // Sample the middle using the skip rate
          for (let i = EXTREME_SKIP_RATE; i < filteredData.length - EXTREME_SKIP_RATE; i += EXTREME_SKIP_RATE) {
            // Include a point every 75 points
            if (i < filteredData.length) {
              smoothedData.push(filteredData[i]);
            }
          }
          
          // Always include the last point to close the graph properly
          if (filteredData.length > 1) {
            smoothedData.push(filteredData[filteredData.length - 1]);
          }
          
          // For DRS and gear changes, we need to preserve those state changes
          if (activeTab === "drs" || activeTab === "gear") {
            // Scan for important state changes that would be missed by the extreme skipping
            for (let i = 1; i < filteredData.length - 1; i++) {
              // Skip points we've already included through regular sampling
              if (i % EXTREME_SKIP_RATE === 0) continue;
              
              // Check if this point represents a state change
              const prevVal = activeTab === "drs" ? filteredData[i-1].drs : filteredData[i-1].gear;
              const currVal = activeTab === "drs" ? filteredData[i].drs : filteredData[i].gear;
              const nextVal = activeTab === "drs" ? filteredData[i+1].drs : filteredData[i+1].gear;
              
              // If this is a transition point (state change), include it
              if (prevVal !== currVal || currVal !== nextVal) {
                smoothedData.push(filteredData[i]);
              }
            }
            
            // Sort the data points by time
            smoothedData.sort((a, b) => a.time - b.time);
          }
          
          console.log(`Ultra smoothed data for ${driverKey}: ${filteredData.length} → ${smoothedData.length} points (${Math.round(smoothedData.length/filteredData.length*100)}%)`);
        } else {
          console.log(`No filtered data for ${driverKey} in the selected time range`);
        }
        
        // Add these points to the driver's data
        driverDataPoints[driverKey] = smoothedData.map(point => {
          const dataPoint: any = { time: point.time };
          
          // Add the specific metric data based on active tab
          switch (activeTab) {
            case "speed": dataPoint[driverKey] = point.speed; break;
            case "rpm": dataPoint[driverKey] = point.rpm; break;
            case "throttle": dataPoint[driverKey] = point.throttle; break;
            case "brake": dataPoint[driverKey] = point.brake; break;
            case "gear": dataPoint[driverKey] = point.gear; break;
            case "drs": dataPoint[driverKey] = point.drs; break;
          }
          
          // Add team color for this driver
          dataPoint[`${driverKey}_color`] = driver.team_color;
          
          return dataPoint;
        });
      });
      
      // Find the driver with the most data points to use as reference
      let referenceDriver = "";
      let maxPoints = 0;
      
      Object.entries(driverDataPoints).forEach(([driver, points]) => {
        if (points.length > maxPoints) {
          referenceDriver = driver;
          maxPoints = points.length;
        }
      });
      
      console.log(`Using ${referenceDriver} as reference with ${maxPoints} points`);
      
      // If no reference driver found or no data points, return empty array
      if (!referenceDriver || maxPoints === 0) {
        return [];
      }
      
      // Create a merged timeline that includes all drivers' time points
      const allTimePoints = new Set<number>();
      
      // Collect all time points from all drivers
      Object.values(driverDataPoints).forEach(points => {
        points.forEach(point => {
          allTimePoints.add(point.time);
        });
      });
      
      // Convert to array and sort
      const timePoints = Array.from(allTimePoints).sort((a, b) => a - b);
      
      // Build the final chart data with all drivers
      const result = timePoints.map(time => {
        const point: any = { time };
        
        Object.entries(driverDataPoints).forEach(([driver, points]) => {
          // Find the closest point in time for this driver
          const exactPoint = points.find(p => p.time === time);
          
          if (exactPoint) {
            // If we have an exact match for this time point, use it
            point[driver] = exactPoint[driver];
            point[`${driver}_color`] = exactPoint[`${driver}_color`];
          } else {
            // Find the closest points before and after
            const pointsBefore = points.filter(p => p.time < time).sort((a, b) => b.time - a.time);
            const pointsAfter = points.filter(p => p.time > time).sort((a, b) => a.time - b.time);
            
            const before = pointsBefore.length > 0 ? pointsBefore[0] : null;
            const after = pointsAfter.length > 0 ? pointsAfter[0] : null;
            
            // If we have points on both sides, interpolate
            if (before && after) {
              const beforeVal = before[driver];
              const afterVal = after[driver];
              const beforeTime = before.time;
              const afterTime = after.time;
              
              // Linear interpolation
              const ratio = (time - beforeTime) / (afterTime - beforeTime);
              const interpolatedValue = beforeVal + ratio * (afterVal - beforeVal);
              
              point[driver] = interpolatedValue;
              point[`${driver}_color`] = before[`${driver}_color`];
            } else if (before) {
              // Use the last point before
              point[driver] = before[driver];
              point[`${driver}_color`] = before[`${driver}_color`];
            } else if (after) {
              // Use the first point after
              point[driver] = after[driver];
              point[`${driver}_color`] = after[`${driver}_color`];
            }
          }
        });
        
        return point;
      });
      
      console.log(`Generated ${result.length} chart data points for ${Object.keys(driverDataPoints).length} drivers`);
      return result;
    } catch (error) {
      console.error('Error generating chart data:', error);
      return [];
    }
  }, [telemetryData, originalAvailableDrivers, selectedDrivers, activeTab, timeRange, selectedTimeRange, hasData]);

  // Add a function to find the first driver with available data
  const findFirstDriverWithData = () => {
    // Prioritize these drivers in this order
    const priorityDrivers = [1, 44, 55, 4, 18, 11, 63];
    
    // Try to find drivers with data in priority order
    for (const driverNum of priorityDrivers) {
      if (telemetryData[driverNum] && telemetryData[driverNum].length > 0) {
        return driverNum;
      }
    }
    
    // If none of the priority drivers have data, check all drivers
    for (const driverNum in telemetryData) {
      if (telemetryData[driverNum] && telemetryData[driverNum].length > 0) {
        return parseInt(driverNum);
      }
    }
    
    // If no driver has data, return the first available driver
    if (originalAvailableDrivers.length > 0) {
      return originalAvailableDrivers[0].driver_number;
    }
    
      return null;
    }
    
  // Add an effect to check if the selected driver has data available
  useEffect(() => {
    // Only run this if we have selected drivers but no data is showing
    if (selectedDrivers.length > 0 && !hasData && !isLoading) {
      console.log("Selected drivers don't have data yet:", selectedDrivers);
      
      // Find a driver with data available
      const driverWithData = findFirstDriverWithData();
      
      if (driverWithData && !selectedDrivers.includes(driverWithData)) {
        console.log(`Switching to driver ${driverWithData} which has data available`);
        setSelectedDrivers([driverWithData]);
      }
    }
  }, [selectedDrivers, hasData, isLoading, telemetryData]);

  // Add debugging logs for production issue tracking
  useEffect(() => {
    // Verbose logging to help debug the production issue
    const debugInfo = {
      domain: window.location.hostname,
      hasDrivers: originalAvailableDrivers.length > 0,
      selectedDrivers,
      hasData,
      hasServerError,
      errorMessage,
      loadingProgress,
      telemetryDataKeys: Object.keys(telemetryData),
      dataPointCounts: Object.entries(telemetryData).map(([driver, points]) => ({
        driver, 
        points: Array.isArray(points) ? points.length : 0
      }))
    };
    
    console.log('[TelemetryDashboard] State:', debugInfo);
    
    // When loaded data, log success
    if (hasData && Object.keys(telemetryData).length > 0) {
      console.log('[TelemetryDashboard] Successfully loaded telemetry data:', 
        Object.keys(telemetryData).length, 'drivers with data');
    }
    
    // If there's an unexpected error state, log detailed info
    if (hasServerError && hasData) {
      console.warn('[TelemetryDashboard] Unexpected state: both hasServerError and hasData are true');
    }
  }, [hasData, hasServerError, originalAvailableDrivers.length, selectedDrivers, errorMessage, telemetryData]);

  // Calculate top speed traps for each driver
  const driverTopSpeeds = React.useMemo(() => {
    if (!hasData || activeTab !== "speed") return null;
    
    const result: { [driverNum: number]: SpeedTrap[] } = {};
    
    // Process each driver's telemetry data
    selectedDrivers.forEach(driverNum => {
      if (telemetryData[driverNum] && telemetryData[driverNum].length > 0) {
        // Get all speed points for this driver
        const driverData = telemetryData[driverNum];
        
        // Get this driver's lap data
        const driverLaps = lapData ? lapData.filter(lap => lap.driver_number === driverNum) : [];
        
        // Sort speeds in descending order and take top 15
        const topSpeeds = driverData
          .map(point => {
            // Find which lap this time belongs to
            let lapNumber;
            if (driverLaps.length > 0) {
              const matchingLap = driverLaps.find(lap => {
                if (!lap.date_start || !lap.date_end) return false;
                const startTime = new Date(lap.date_start).getTime();
                const endTime = new Date(lap.date_end).getTime();
                return point.time >= startTime && point.time <= endTime;
              });
              
              if (matchingLap) {
                lapNumber = matchingLap.lap_number;
              }
            }
            
            return { 
              speed: point.speed, 
              driverNumber: driverNum,
              time: point.time,
              lap: lapNumber
            };
          })
          .sort((a, b) => b.speed - a.speed)
          .slice(0, 15);
        
        if (topSpeeds.length > 0) {
          result[driverNum] = topSpeeds;
        }
      }
    });
    
    return result;
  }, [hasData, activeTab, selectedDrivers, telemetryData, lapData]);
  
  // Create sorted list of drivers by their max speed
  const sortedDriversBySpeed = React.useMemo(() => {
    if (!driverTopSpeeds) return [];
    
    return Object.entries(driverTopSpeeds)
      .map(([driverNum, speeds]) => ({
        driverNum: parseInt(driverNum),
        maxSpeed: speeds[0]?.speed || 0
      }))
      .sort((a, b) => b.maxSpeed - a.maxSpeed)
      .map(item => item.driverNum);
  }, [driverTopSpeeds]);
  
  // Calculate the global max speed across all drivers
  const globalMaxSpeed = React.useMemo(() => {
    if (!driverTopSpeeds) return 0;
    
    let max = 0;
    Object.values(driverTopSpeeds).forEach(speeds => {
      if (speeds[0] && speeds[0].speed > max) {
        max = speeds[0].speed;
      }
    });
    
    return max;
  }, [driverTopSpeeds]);

  return (
    <Card className="relative">
      <CardHeader className="space-y-1 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Telemetry Analysis
          </CardTitle>
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
        ) : !effectiveSessionKey ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">No OpenF1 data available for this race.</p>
            <p className="text-sm text-muted-foreground mt-2">
              {year >= 2025 ? 
                "2025 season data is not yet fully available in the OpenF1 API. Please check back later or select a previous season from the Season dropdown above." :
                "OpenF1 data is only available for recent races (2023 onwards)."}
            </p>
          </div>
        ) : hasData && originalAvailableDrivers.length > 0 ? (
          <>
            {/* Driver selection area - shown whenever data is available */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <div className="text-sm text-muted-foreground">
                  Select a driver to load their telemetry data:
                </div>
                {activeTab === "speed" && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      // Select all available drivers
                      const allDriverNumbers = originalAvailableDrivers.map(d => d.driver_number);
                      
                      // Load data for any drivers that don't have it yet
                      allDriverNumbers.forEach(driverNum => {
                        if (!telemetryData[driverNum] && !driverLoadingState[driverNum]) {
                          loadDriverData(driverNum).catch(error => {
                            console.error(`Failed to load data for driver ${driverNum}:`, error);
                          });
                        }
                      });
                      
                      setSelectedDrivers(allDriverNumbers);
                    }}
                    className="ml-2"
                  >
                    Select All Drivers
                  </Button>
                )}
              </div>
              <DriverSelectionPanel 
                drivers={originalAvailableDrivers}
                selectedDrivers={selectedDrivers}
                onToggleDriver={toggleDriverSelection}
                multiSelect={true}
                driverData={normalizedDriverData}
              />
              {selectedDrivers.length === 0 && (
                <div className="mt-4 text-center text-sm text-muted-foreground">
                  Click on a driver above to load their telemetry data
                </div>
              )}
            </div>
            
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
                  {activeTab === "speed" && driverTopSpeeds && sortedDriversBySpeed.length > 0 ? (
                    // Speed traps heatmap
                    <div className="w-full">
                      <div className="mb-3">
                        <div className="text-xl font-bold">Top 15 speed traps per driver</div>
                      </div>
                      
                      <div className="min-w-full grid gap-0">
                        {sortedDriversBySpeed.map(driverNum => {
                          const driver = originalAvailableDrivers.find(d => d.driver_number === driverNum);
                          if (!driver || !driverTopSpeeds[driverNum]) return null;
                          
                          const driverSpeeds = driverTopSpeeds[driverNum];
                          
                          return (
                            <div key={driverNum} className="grid grid-cols-[80px_1fr] mb-[1px]">
                              {/* Driver name/team */}
                              <div 
                                className="flex items-center justify-end pr-3 font-semibold text-sm h-8" 
                                style={{ color: driver.team_color }}
                              >
                                {driver.name_acronym}
                              </div>
                              
                              {/* Speed cells as continuous heatmap */}
                              <div className="flex h-8 w-full">
                                {driverSpeeds.map((speedData, index) => {
                                  // Calculate relative speed percentage within this driver's range
                                  const driverMaxSpeed = driverSpeeds[0].speed;
                                  const driverMinSpeed = driverSpeeds[driverSpeeds.length - 1].speed;
                                  const speedRange = driverMaxSpeed - driverMinSpeed;
                                  // Calculate percentage within the driver's own range
                                  const percentage = speedRange > 0 
                                    ? (speedData.speed - driverMinSpeed) / speedRange 
                                    : 1;
                                  
                                  // Generate a gradient from light orange/red to dark red
                                  // Higher percentage = darker/more intense red
                                  const r = Math.round(220 - (percentage * 80)); // 220 down to 140
                                  const g = Math.round(60 - (percentage * 40));  // 60 down to 20
                                  const b = Math.round(40 - (percentage * 20));  // 40 down to 20
                                  
                                  // Format display time if lap info isn't available
                                  const timeString = new Date(speedData.time).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                    hour12: false
                                  });
                                  
                                  return (
                                    <div 
                                      key={index}
                                      className="relative flex items-center justify-center h-full text-sm font-medium group"
                                      style={{ 
                                        backgroundColor: `rgb(${r}, ${g}, ${b})`,
                                        flex: 1,
                                        color: 'white'
                                      }}
                                    >
                                      {Math.round(speedData.speed)}
                                      <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-black/90 text-white text-xs px-2 py-1 rounded pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                        {speedData.speed.toFixed(1)} km/h
                                        {speedData.lap 
                                          ? ` | Lap ${speedData.lap}` 
                                          : ` | ${timeString}`
                                        }
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Speed range indicator */}
                      <div className="flex justify-between mt-4 text-xs items-center px-[80px]">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-4 bg-gradient-to-r from-[#dc3c2a] to-[#8c1d18] rounded-sm" />
                          <div className="text-muted-foreground">
                            Lower → Higher speed (per driver)
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Chart for all other tabs
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
                              // For DRS, format the ticks to show "On" and "Off" instead of 0 and 1
                              tickFormatter={activeTab === "drs" 
                                ? (value) => value === 0 ? "Off" : value === 1 ? "On" : ""
                                : undefined
                              }
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
                            
                            {/* Show max speed reference line only on speed tab */}
                            {activeTab === "speed" && maxSpeedInfo && (() => {
                              const driverInfo = maxSpeedInfo.driverNumber ? 
                                originalAvailableDrivers.find(d => d.driver_number === maxSpeedInfo.driverNumber) : null;
                              const driverColor = driverInfo?.team_color || "#ffcc00";
                              const driverName = driverInfo?.name_acronym || 
                                (maxSpeedInfo.driverNumber ? `#${maxSpeedInfo.driverNumber}` : "");
                              
                              return (
                                <ReferenceLine 
                                  y={maxSpeedInfo.speed}
                                  stroke={driverColor}
                                  strokeWidth={2}
                                  strokeDasharray="5 5"
                                  label={{ 
                                    value: `Max: ${maxSpeedInfo.speed.toFixed(1)} km/h (${driverName})`, 
                                    position: 'right',
                                    fill: driverColor,
                                    fontSize: 12,
                                    fontWeight: 'bold'
                                  }}
                                />
                              );
                            })()}
                            
                            <Tooltip 
                              formatter={(value: any, name: string, props: any) => {
                                // Extract driver name from the dataKey (name parameter)
                                const driverKey = name;
                                // Find the driver to get their team color for styling
                                const driver = originalAvailableDrivers.find(d => d.name_acronym === driverKey);
                                
                                // Format value based on the current tab
                                let formattedValue = `${value}`;
                                switch (activeTab) {
                                  case "speed":
                                    formattedValue = `${parseFloat(value).toFixed(2)} km/h`;
                                    break;
                                  case "rpm":
                                    formattedValue = `${parseFloat(value).toFixed(0)} RPM`;
                                    break;
                                  case "throttle":
                                  case "brake":
                                    formattedValue = `${parseFloat(value).toFixed(2)}%`;
                                    break;
                                  case "gear":
                                    formattedValue = `Gear ${parseFloat(value).toFixed(0)}`;
                                    break;
                                  case "drs":
                                    formattedValue = value === 1 ? "DRS Enabled" : "DRS Disabled";
                                    break;
                                }
                                
                                // Return formatted value with driver number
                                return [
                                  formattedValue,
                                  driver ? `${driverKey} (#${driver.driver_number})` : driverKey
                                ];
                              }}
                              labelFormatter={(label) => {
                                const date = new Date(label as number);
                                // Find the lap for this time
                                let lapInfo = "";
                                if (lapData && lapData.length > 0 && selectedDrivers.length > 0) {
                                  const driverLaps = lapData.filter(lap => lap.driver_number === selectedDrivers[0]);
                                  const currentLap = driverLaps.find(lap => {
                                    if (!lap.date_start || !lap.date_end) return false;
                                    const startTime = new Date(lap.date_start).getTime();
                                    const endTime = new Date(lap.date_end).getTime();
                                    return label >= startTime && label <= endTime;
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
                                borderRadius: '5px',
                                padding: '8px'
                              }}
                              itemStyle={{
                                padding: '4px 0'
                              }}
                              wrapperStyle={{
                                zIndex: 1000
                              }}
                              isAnimationActive={false}
                            />
                            
                            {/* Render lines for each driver */}
                            {selectedDrivers.map((driverNum, index) => {
                              const driver = originalAvailableDrivers.find(d => d.driver_number === driverNum);
                              if (!driver) return null;
                              
                              const driverKey = driver.name_acronym;
                              
                              // Check if this is a duplicate team color
                              const teamColorCount = selectedDrivers.filter(d => {
                                const driverInfo = originalAvailableDrivers.find(od => od.driver_number === d);
                                return driverInfo && driverInfo.team_color === driver.team_color;
                              }).length;
                              
                              // Find the index of this driver among those with the same team color
                              const sameColorIndex = selectedDrivers
                                .filter(d => {
                                  const driverInfo = originalAvailableDrivers.find(od => od.driver_number === d);
                                  return driverInfo && driverInfo.team_color === driver.team_color;
                                })
                                .indexOf(driverNum);
                              
                              // Use dotted line for the second driver with the same team color
                              const useDottedLine = teamColorCount > 1 && sameColorIndex > 0;
                              
                              // Special case for DRS - use step chart for clearer on/off visualization
                              if (activeTab === "drs") {
                                return (
                                  <Line
                                    key={driverNum}
                                    type="stepAfter"
                                    dataKey={driverKey}
                                    name={driverKey}
                                    stroke={driver.team_color}
                                    strokeWidth={3}
                                    dot={false}
                                    strokeDasharray={useDottedLine ? "5 5" : ""}
                                    activeDot={{ 
                                      r: 6, 
                                      stroke: driver.team_color, 
                                      strokeWidth: 2, 
                                      fill: '#fff',
                                      strokeOpacity: 0.8,
                                      fillOpacity: 0.8
                                    }}
                                    connectNulls={true}
                                    isAnimationActive={false}
                                  />
                                );
                              }
                              
                              // For extremely smooth rendering in other categories, apply curve smoothing
                              if (activeTab !== "gear") {
                                // Replace the stepAfter type with monotone for smoother curves
                                return (
                                  <Line
                                    key={driverNum}
                                    type="monotone"
                                    dataKey={driverKey}
                                    name={driverKey}
                                    stroke={driver.team_color}
                                    strokeWidth={3}
                                    strokeDasharray={useDottedLine ? "5 5" : ""}
                                    dot={false}
                                    activeDot={{ 
                                      r: 6, 
                                      stroke: driver.team_color, 
                                      strokeWidth: 2, 
                                      fill: '#fff',
                                      strokeOpacity: 0.8,
                                      fillOpacity: 0.8
                                    }}
                                    connectNulls={true}
                                    isAnimationActive={false}
                                  />
                                );
                              }
                              
                              return (
                                <Line
                                  key={driverNum}
                                  type="stepAfter"
                                  dataKey={driverKey}
                                  name={driverKey}
                                  stroke={driver.team_color}
                                  strokeWidth={3}
                                  strokeDasharray={useDottedLine ? "5 5" : ""}
                                  dot={false}
                                  activeDot={{ 
                                    r: 6, 
                                    stroke: driver.team_color, 
                                    strokeWidth: 2, 
                                    fill: '#fff',
                                    strokeOpacity: 0.8,
                                    fillOpacity: 0.8
                                  }}
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
                                      const driver = originalAvailableDrivers.find(d => d.driver_number === driverNum);
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
                  )}
                </TabsContent>
              </Tabs>
            )}
          </>
        ) : errorMessage || hasServerError ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">
              {hasServerError 
                ? errorMessage && errorMessage.includes("HTML instead of") 
                  ? "The F1 API is temporarily unavailable for this session. Please try again later."
                  : "Telemetry data is temporarily unavailable for this session." 
                : errorMessage}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {year >= 2025 ? 
                "2025 season data is still being collected and not all sessions have complete telemetry information. Some driver data may be available while detailed telemetry is still pending. If you see drivers listed but no telemetry charts, this is likely why." :
                hasServerError 
                  ? errorMessage && errorMessage.includes("HTML instead of")
                    ? "The F1 data service API is returning HTML pages instead of data. This is typically a temporary server-side issue with the F1 API provider."
                    : "The OpenF1 API may not have telemetry data for this particular session, or the service might be experiencing issues."
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
        ) : originalAvailableDrivers.length > 0 ? (
          <div className="mb-6">
            <div className="mb-2 text-sm text-muted-foreground">
              Select a driver to load their telemetry data:
            </div>
            <DriverSelectionPanel 
              drivers={originalAvailableDrivers}
              selectedDrivers={selectedDrivers}
              onToggleDriver={toggleDriverSelection}
              multiSelect={true}
              driverData={normalizedDriverData}
            />
            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground">
                Click on a driver above to load their telemetry data
              </p>
            </div>
          </div>
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