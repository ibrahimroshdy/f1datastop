import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Thermometer, Cloud, Droplets, Wind } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOpenF1SessionFromErgast, useDrivers, useSession, useRaceControl } from "@/hooks/useOpenF1Data";
import { useWeatherData } from "@/hooks/useOpenF1Data";
import { processOpenF1WeatherData } from "@/utils/apiAdapters";
import { Line, LineChart, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, ReferenceLine } from "recharts";
import DriverSelectionPanel from './charts/DriverSelectionPanel';
import { Driver } from '@/hooks/useTelemetryData';

interface WeatherAnalysisProps {
  year: number;
  round: string;
  sessionType?: string;
  sessionKey?: number;
}

const WeatherAnalysis: React.FC<WeatherAnalysisProps> = ({
  year,
  round,
  sessionType = "Race",
  sessionKey: externalSessionKey
}) => {
  const [selectedDrivers, setSelectedDrivers] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState("temperature");
  const [combinedView, setCombinedView] = useState<boolean>(true);
  
  // After the useState declarations, add this hook to reset state when session changes  
  useEffect(() => {
    // Reset drivers and ensure UI updates when session changes
    setSelectedDrivers([]);
    
    console.log("Session changed in WeatherAnalysis to:", externalSessionKey);
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
  // For session markers, fetch meeting sessions (if meeting key available)
  const meetingKey = sessionData?.data?.meeting_key;
  const { data: meetingSessions } = useSession(meetingKey || 0);
  const { data: raceControlData } = useRaceControl(effectiveSessionKey);
  
  // Get weather data for this session
  const {
    data: weatherData,
    isLoading: isWeatherLoading,
    error: weatherError
  } = useWeatherData(effectiveSessionKey);
  
  // Also fetch driver data for consistent UI (for future lap-by-lap weather correlation)
  const {
    data: driversData,
    isLoading: isDriversLoading
  } = useDrivers(effectiveSessionKey);
  
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
  
  // Handle driver selection (this is for future use in lap-by-lap weather correlation)
  const toggleDriverSelection = (driverNumber: number) => {
    setSelectedDrivers(prev => {
      if (prev.includes(driverNumber)) {
        return prev.filter(d => d !== driverNumber);
      } else {
        return [...prev, driverNumber];
      }
    });
  };
  
  // Process weather data
  const processedData = React.useMemo(() => {
    if (!weatherData?.data || weatherData.data.length === 0) return [];
    return processOpenF1WeatherData(weatherData.data);
  }, [weatherData]);
  
  // Get the most recent weather readings
  const currentWeather = React.useMemo(() => {
    if (processedData.length === 0) return null;
    return processedData[processedData.length - 1];
  }, [processedData]);
  
  // Compute time markers: session start/end and qualifying parts if present
  const sessionMarkers = React.useMemo(() => {
    const markers: Array<{ x: number; label: string; color: string }> = [];
    // Use race control messages for robust markers
    const rc: any[] = raceControlData?.data || [];

    // Only add ANY markers for qualifying sessions
    const sessionName = `${sessionType || ''} ${sessionData?.data?.session_name || ''} ${sessionData?.data?.session_type || ''}`.toLowerCase();
    const isQualifyingSession = sessionName.includes('qualifying');

    if (!isQualifyingSession) {
      // Do not render any markers for non-qualifying sessions
      return [];
    }

    // Start/End from session when available
    let ds = sessionData?.data?.date_start ? new Date(sessionData.data.date_start).getTime() : null;
    let de = sessionData?.data?.date_end ? new Date(sessionData.data.date_end).getTime() : null;
    // Fallback to data range if session metadata not available (e.g., external session key)
    if ((!ds || !de) && processedData.length > 0) {
      ds = processedData[0]?.time ?? ds;
      de = processedData[processedData.length - 1]?.time ?? de;
    }
    if (typeof ds === 'number' && !isNaN(ds)) markers.push({ x: ds, label: 'Start', color: '#22c55e' });
    if (typeof de === 'number' && !isNaN(de)) markers.push({ x: de, label: 'End', color: '#ef4444' });

    // Qualifying phase markers via GREEN LIGHT - PIT EXIT OPEN
    const greenLightMessages = rc
      .filter(msg => String(msg.message || '').toUpperCase().includes('GREEN LIGHT - PIT EXIT OPEN'))
      .map(msg => ({ time: new Date(msg.date).getTime(), message: msg.message }))
      .sort((a, b) => a.time - b.time);

    greenLightMessages.forEach((msg, index) => {
      if (index === 0) markers.push({ x: msg.time, label: 'Q1', color: '#60a5fa' });
      else if (index === 1) markers.push({ x: msg.time, label: 'Q2', color: '#f59e0b' });
      else if (index === 2) markers.push({ x: msg.time, label: 'Q3', color: '#10b981' });
    });

    // Session lifecycle markers (qualifying only)
    rc.forEach((msg) => {
      const text = String(msg.message || '').toLowerCase();
      const t = new Date(msg.date).getTime();
      if (typeof t !== 'number' || isNaN(t)) return;
      if (text.includes('session start') || text.includes('green flag')) {
        markers.push({ x: t, label: 'Start', color: '#22c55e' });
      }
      if (text.includes('session finish') || text.includes('chequered')) {
        markers.push({ x: t, label: 'End', color: '#ef4444' });
      }
    });
    // Debug weather data time range
    const minTime = processedData.length ? processedData[0].time : undefined;
    const maxTime = processedData.length ? processedData[processedData.length - 1].time : undefined;
    console.log('Weather data time range:', 
      minTime ? new Date(minTime).toISOString() : 'no min', 
      'to', 
      maxTime ? new Date(maxTime).toISOString() : 'no max'
    );
    console.log('Markers before filtering:', markers.map(m => ({ label: m.label, time: new Date(m.x).toISOString() })));
    
    // Clamp to data range and deduplicate sensibly
    const inRange = markers.filter(m => {
      if (typeof m.x !== 'number') return false;
      const inTimeRange = !(typeof minTime === 'number' && m.x < minTime) && !(typeof maxTime === 'number' && m.x > maxTime);
      if (!inTimeRange) {
        console.log('Filtering out marker', m.label, 'at', new Date(m.x).toISOString(), 'outside range');
      }
      return inTimeRange;
    });

    // Reduce duplicates: keep earliest Start/Q1/Q2/Q3, keep latest End
    const grouped = inRange.reduce((acc: Record<string, { x: number; label: string; color: string }[]>, m) => {
      const key = m.label.toUpperCase();
      acc[key] = acc[key] || [];
      acc[key].push(m);
      return acc;
    }, {});

    const result: Array<{ x: number; label: string; color: string }> = [];
    Object.entries(grouped).forEach(([label, arr]) => {
      if (label === 'END') {
        const last = arr.reduce((a, b) => (a.x > b.x ? a : b));
        result.push(last);
      } else if (label === 'START' || label === 'Q1' || label === 'Q2' || label === 'Q3') {
        const first = arr.reduce((a, b) => (a.x < b.x ? a : b));
        result.push(first);
      } else {
        // default: keep first occurrence
        result.push(arr[0]);
      }
    });

    // Sort by time for consistent rendering
    result.sort((a, b) => a.x - b.x);
    
    console.log('Final markers after processing:', result.map(m => ({ 
      label: m.label, 
      time: new Date(m.x).toISOString(),
      localTime: new Date(m.x).toLocaleTimeString(),
      timestamp: m.x,
      isValidNumber: typeof m.x === 'number' && !isNaN(m.x)
    })));
    
    // Debug: Also log first few weather data points for comparison
    if (processedData.length > 0) {
      console.log('First few weather data points:', processedData.slice(0, 3).map(d => ({
        time: d.time,
        timestamp: d.time,
        formatted: new Date(d.time).toISOString()
      })));
    }
    
    // Debug: Check for any invalid markers
    const invalidMarkers = result.filter(m => typeof m.x !== 'number' || isNaN(m.x));
    if (invalidMarkers.length > 0) {
      console.error('Invalid markers found:', invalidMarkers);
    }
    
    return result;
  }, [sessionData, meetingSessions, processedData, raceControlData]);
  
  // Helper function to format time for the x-axis
  const formatTimeForAxis = (time: number) => {
    const date = new Date(time);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };
  
  // Get unit and domain for the selected weather metric
  const getMetricInfo = () => {
    switch (activeTab) {
      case "temperature":
        return { 
          unit: "°C", 
          label: "Temperature", 
          domain: [0, 60],
          dataKeys: [
            { key: "air_temperature", name: "Air Temperature", color: "#3b82f6" },
            { key: "track_temperature", name: "Track Temperature", color: "#f59e0b" }
          ]
        };
      case "wind":
        return { 
          unit: "m/s", 
          label: "Wind Speed", 
          domain: [0, 20],
          dataKeys: [
            { key: "wind_speed", name: "Wind Speed", color: "#10b981" }
          ]
        };
      case "humidity":
        return { 
          unit: "%", 
          label: "Humidity", 
          domain: [0, 100],
          dataKeys: [
            { key: "humidity", name: "Humidity", color: "#6366f1" }
          ]
        };
      case "pressure":
        return { 
          unit: "mbar", 
          label: "Air Pressure", 
          domain: [980, 1040],
          dataKeys: [
            { key: "pressure", name: "Pressure", color: "#8b5cf6" }
          ]
        };
      default:
        return { 
          unit: "", 
          label: "", 
          domain: [0, 100],
          dataKeys: [] 
        };
    }
  };
  
  const { unit, label, domain, dataKeys } = getMetricInfo();
  
  const isLoading = isSessionLoading || isWeatherLoading;
  const hasNoData = !isLoading && (!weatherData?.data || weatherData.data.length === 0);
  const hasError = !!weatherError || (!isLoading && !effectiveSessionKey);
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <Thermometer className="h-5 w-5" />
            Weather Analysis
          </CardTitle>
          <div className="flex items-center gap-2">
            <button
              className={`px-2.5 py-1.5 rounded text-[11px] sm:text-xs border transition-colors ${combinedView ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-foreground border-border hover:bg-muted/80'}`}
              onClick={() => setCombinedView(true)}
            >Combined</button>
            <button
              className={`px-2.5 py-1.5 rounded text-[11px] sm:text-xs border transition-colors ${!combinedView ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-foreground border-border hover:bg-muted/80'}`}
              onClick={() => setCombinedView(false)}
            >Single</button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-[220px] w-full" />
          </div>
        ) : hasError ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">
              {weatherError?.toString() || "No OpenF1 weather data available for this race."}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {year >= new Date().getFullYear() ? 
                `${new Date().getFullYear()} season data is not yet fully available in the OpenF1 API. Please check back later or select a previous season.` :
                "Weather data is only available for recent races (2023 onwards)."}
            </p>
          </div>
        ) : hasNoData ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">No weather data available for this session.</p>
            {year >= new Date().getFullYear() && (
              <p className="text-sm text-muted-foreground mt-2">
                {new Date().getFullYear()} season data is still being collected and may not be complete.
              </p>
            )}
          </div>
        ) : (
          <> 
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 sm:mb-6">
              <div className="bg-primary/5 rounded-md p-3 flex flex-col">
                <span className="text-xs text-muted-foreground">Air Temp</span>
                <div className="flex items-end justify-between mt-1">
                  <span className="text-2xl font-semibold">
                    {currentWeather?.air_temperature.toFixed(1)}°C
                  </span>
                  <Thermometer className="h-4 w-4 text-blue-500" />
                </div>
              </div>
              
              <div className="bg-primary/5 rounded-md p-3 flex flex-col">
                <span className="text-xs text-muted-foreground">Track Temp</span>
                <div className="flex items-end justify-between mt-1">
                  <span className="text-2xl font-semibold">
                    {currentWeather?.track_temperature.toFixed(1)}°C
                  </span>
                  <Thermometer className="h-4 w-4 text-amber-500" />
                </div>
              </div>
              
              <div className="bg-primary/5 rounded-md p-3 flex flex-col">
                <span className="text-xs text-muted-foreground">Humidity</span>
                <div className="flex items-end justify-between mt-1">
                  <span className="text-2xl font-semibold">
                    {currentWeather?.humidity.toFixed(0)}%
                  </span>
                  <Droplets className="h-4 w-4 text-indigo-500" />
                </div>
              </div>
              
              <div className="bg-primary/5 rounded-md p-3 flex flex-col">
                <span className="text-xs text-muted-foreground">Wind</span>
                <div className="flex items-end justify-between mt-1">
                  <span className="text-2xl font-semibold">
                    {currentWeather?.wind_speed.toFixed(1)} m/s
                  </span>
                  <Wind className="h-4 w-4 text-emerald-500" />
                </div>
              </div>
            </div>
            
            {/* Driver selection panel - hidden for now, but will be enabled in a future update */}
            <div className="hidden mb-6">
              <div className="mb-2 text-sm text-muted-foreground">
                Select drivers to view lap-by-lap weather data:
              </div>
              {mappedDrivers.length > 0 && (
                <DriverSelectionPanel 
                  drivers={mappedDrivers}
                  selectedDrivers={selectedDrivers}
                  onToggleDriver={toggleDriverSelection}
                  multiSelect={true}
                />
              )}
            </div>
            
            {combinedView ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { id: 'temperature', title: 'Temperature', unit: '°C', domain: [0, 60], keys: [
                      { key: 'air_temperature', name: 'Air Temperature', color: '#3b82f6' },
                      { key: 'track_temperature', name: 'Track Temperature', color: '#f59e0b' },
                    ] },
                  { id: 'wind', title: 'Wind', unit: 'm/s', domain: [0, 20], keys: [
                      { key: 'wind_speed', name: 'Wind Speed', color: '#10b981' },
                    ] },
                  { id: 'humidity', title: 'Humidity', unit: '%', domain: [0, 100], keys: [
                      { key: 'humidity', name: 'Humidity', color: '#6366f1' },
                    ] },
                  { id: 'pressure', title: 'Pressure', unit: 'mbar', domain: [980, 1040], keys: [
                      { key: 'pressure', name: 'Pressure', color: '#8b5cf6' },
                    ] },
                ].map((m) => (
                  <div key={m.id} className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={processedData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.08} />
                        <XAxis
                          dataKey="time"
                          type="number"
                          domain={["dataMin", "dataMax"]}
                          scale="time"
                          allowDataOverflow
                          tickFormatter={formatTimeForAxis}
                          minTickGap={30}
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis domain={m.domain as any} unit={m.unit} width={40} tick={{ fontSize: 10 }} />
                        <Tooltip content={<CustomTooltip unit={m.unit} formatTime={formatTimeForAxis} />} />
                        {sessionMarkers
                          .filter(mrk => typeof mrk.x === 'number' && !isNaN(mrk.x))
                          .map((mrk, idx) => (
                          <ReferenceLine key={`marker-${m.id}-${idx}`} x={mrk.x} stroke={mrk.color} isFront ifOverflow="extendDomain" strokeDasharray="6 4" label={{ value: mrk.label, fill: mrk.color, position: 'insideTop', fontSize: 9 }} />
                        ))}
                        {m.keys.map(({ key, name, color }) => (
                          <Line key={key} type="monotone" dataKey={key} name={name} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ))}
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="grid grid-cols-4">
                  <TabsTrigger value="temperature">Temperature</TabsTrigger>
                  <TabsTrigger value="wind">Wind</TabsTrigger>
                  <TabsTrigger value="humidity">Humidity</TabsTrigger>
                  <TabsTrigger value="pressure">Pressure</TabsTrigger>
                </TabsList>
                <TabsContent value={activeTab} className="space-y-4">
                  <div className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={processedData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis
                          dataKey="time"
                          type="number"
                          domain={["dataMin", "dataMax"]}
                          scale="time"
                          allowDataOverflow
                          tickFormatter={formatTimeForAxis}
                          minTickGap={50}
                        />
                        <YAxis domain={domain} unit={unit} width={50} />
                        <Tooltip content={<CustomTooltip unit={unit} formatTime={formatTimeForAxis} />} />
                        {sessionMarkers
                          .filter(m => typeof m.x === 'number' && !isNaN(m.x))
                          .map((m, idx) => (
                          <ReferenceLine key={`marker-${idx}`} x={m.x} stroke={m.color} isFront ifOverflow="extendDomain" strokeDasharray="6 4" label={{ value: m.label, fill: m.color, position: 'insideTop', fontSize: 10 }} />
                        ))}
                        {dataKeys.map(({ key, name, color }) => (
                          <Line key={key} type="monotone" dataKey={key} name={name} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="text-sm text-muted-foreground text-center">
                    {activeTab === 'temperature' ? (
                      <p>Track temperature is typically higher than air temperature</p>
                    ) : activeTab === 'wind' ? (
                      <p>Wind speeds can significantly affect aerodynamics and car behavior</p>
                    ) : activeTab === 'humidity' ? (
                      <p>Higher humidity reduces air density, affecting engine performance</p>
                    ) : activeTab === 'pressure' ? (
                      <p>Atmospheric pressure influences engine power output</p>
                    ) : null}
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default WeatherAnalysis; 

// Custom tooltip with strong contrast for both dark and light themes
const CustomTooltip: React.FC<{ active?: boolean; payload?: any[]; label?: any; unit: string; formatTime: (t: number) => string }>
  = ({ active, payload, label, unit, formatTime }) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-border shadow-lg bg-background/95 backdrop-blur-sm text-foreground">
      <div className="px-3 py-2 text-xs font-medium">
        Time: {typeof label === 'number' ? formatTime(label) : label}
      </div>
      <div className="px-3 pb-2 space-y-1">
        {payload.map((p, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}></span>
            <span className="text-foreground">{p.name}</span>
            <span className="ml-auto font-semibold text-foreground">{p.value} {unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
};