import React, { useState, useEffect, useCallback } from 'react';
import { Thermometer, Cloud, Droplets, Wind, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOpenF1SessionFromErgast } from '@/hooks/useOpenF1Data';
import { useWeatherData } from "@/hooks/useOpenF1Data";
import { processOpenF1WeatherData } from "@/utils/apiAdapters";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';

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
  const [activeTab, setActiveTab] = useState("all");
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const { isGlass } = useTheme();

  // Reset state when session changes  
  useEffect(() => {
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
  
  // Get weather data for this session
  const {
    data: weatherData,
    isLoading: isWeatherLoading,
    error: weatherError
  } = useWeatherData(effectiveSessionKey);
  
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
  
  // Format time for the x-axis
  const formatTimeForAxis = (time: number) => {
    const date = new Date(time);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };
  
  // Prepare chart data
  const chartData = React.useMemo(() => {
    if (processedData.length === 0) return [];
    // Sample data to avoid too many points (max 100 points)
    const step = Math.max(1, Math.floor(processedData.length / 100));
    return processedData.filter((_, i) => i % step === 0);
  }, [processedData]);
  

  const isLoading = isSessionLoading || isWeatherLoading;
  const hasNoData = !isLoading && (!weatherData?.data || weatherData.data.length === 0);
  const hasError = !!weatherError || (!isLoading && !effectiveSessionKey);

  // Handle highlight change for synchronized hover (driven by recharts onMouseMove)
  const handleHighlightChange = useCallback((state: any) => {
    if (state?.isTooltipActive && state.activeTooltipIndex !== undefined && state.activeTooltipIndex !== null) {
      setHighlightedIndex(state.activeTooltipIndex);
    } else {
      setHighlightedIndex(null);
    }
  }, []);
  
  // Stat card component
  const StatCard = ({ 
    label, 
    value, 
    unit, 
    icon: Icon, 
    color 
  }: { 
    label: string; 
    value: string; 
    unit: string; 
    icon: React.ElementType; 
    color: string;
  }) => (
    <div className={cn(
      "rounded-lg p-3 flex flex-col",
      isGlass ? "bg-white/5 border border-white/10" : "bg-muted/50"
    )}>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</span>
      <div className="flex items-end justify-between">
        <span className="text-xl font-semibold tabular-nums">{value}<span className="text-sm ml-0.5">{unit}</span></span>
        <Icon className={cn("h-4 w-4", color)} />
      </div>
    </div>
  );

  // Recharts theming helpers
  const tickColor = 'hsl(var(--chart-axis))';
  const gridColor = 'hsl(var(--chart-grid))';
  const axisTick = { fontSize: 10, fill: tickColor };

  // Shared themed x-axis (time) props for recharts
  const timeXAxisProps = {
    dataKey: 'time' as const,
    type: 'number' as const,
    scale: 'time' as const,
    domain: ['dataMin', 'dataMax'] as [string, string],
    tickFormatter: (value: number) => formatTimeForAxis(value),
    tickLine: false,
    tick: axisTick,
  };

  // Custom tooltip rendering each active series with its unit
  const WeatherTooltip = ({ active, payload, label, unit }: any) => {
    if (!active || !payload?.length) return null;
    const rows = payload.filter((p: any) => p.value != null);
    if (!rows.length) return null;
    return (
      <div className="rounded-md border border-border bg-background/95 px-2 py-1.5 text-[11px] shadow-md">
        <div className="font-mono text-muted-foreground mb-1">{formatTimeForAxis(label)}</div>
        {rows.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.stroke }} />
            <span className="font-medium">{p.name}</span>
            <span className="font-mono ml-auto">{Number(p.value).toFixed(1)}{unit}</span>
          </div>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
        <p className="text-sm text-muted-foreground">Loading weather data...</p>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="min-h-[300px] flex flex-col items-center justify-center p-4 text-center">
        <Cloud className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-muted-foreground font-medium">Weather data unavailable</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          {year >= new Date().getFullYear() 
            ? "Current season data may not be available yet"
            : "Weather data is only available for races from 2023 onwards"}
        </p>
      </div>
    );
  }

  if (hasNoData) {
    return (
      <div className="min-h-[300px] flex flex-col items-center justify-center p-4 text-center">
        <Cloud className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">No weather data for this session</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Current Conditions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard 
          label="Air Temp"
          value={currentWeather?.air_temperature.toFixed(1) || '--'}
          unit="°C"
          icon={Thermometer}
          color="text-blue-500"
        />
        <StatCard 
          label="Track Temp"
          value={currentWeather?.track_temperature.toFixed(1) || '--'}
          unit="°C"
          icon={Thermometer}
          color="text-amber-500"
        />
        <StatCard 
          label="Humidity"
          value={currentWeather?.humidity.toFixed(0) || '--'}
          unit="%"
          icon={Droplets}
          color="text-indigo-500"
        />
        <StatCard 
          label="Wind Speed"
          value={currentWeather?.wind_speed.toFixed(1) || '--'}
          unit="m/s"
          icon={Wind}
          color="text-emerald-500"
        />
      </div>
      
      {/* Charts */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={cn(
          "inline-flex h-8 w-auto",
          isGlass && "bg-white/5 border border-white/10"
        )}>
          <TabsTrigger value="all" className="text-xs px-3">Overview</TabsTrigger>
          <TabsTrigger value="temp" className="text-xs px-3">Temp</TabsTrigger>
          <TabsTrigger value="wind" className="text-xs px-3">Wind</TabsTrigger>
          <TabsTrigger value="humidity" className="text-xs px-3">Humidity</TabsTrigger>
          <TabsTrigger value="pressure" className="text-xs px-3">Pressure</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="mt-3">
          <div 
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            onMouseLeave={() => setHighlightedIndex(null)}
          >
            {/* Temperature Chart */}
            <div className={cn(
              "rounded-lg p-2",
              isGlass ? "bg-white/5 border border-white/10" : "bg-muted/30"
            )}>
              <div className="flex items-center gap-2 mb-1 px-2">
                <Thermometer className="h-3 w-3 text-blue-500" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Temperature</span>
              </div>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart
                    data={chartData}
                    margin={{ left: 40, right: 10, top: 20, bottom: 25 }}
                    onMouseMove={handleHighlightChange}
                    onMouseLeave={() => setHighlightedIndex(null)}
                  >
                    <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                    <XAxis {...timeXAxisProps} />
                    <YAxis
                      width={40}
                      tickLine={false}
                      tick={axisTick}
                      label={{ value: '°C', angle: -90, position: 'insideLeft', fontSize: 10, fill: tickColor }}
                    />
                    <Tooltip content={<WeatherTooltip unit="°C" />} />
                    <Line
                      type="monotone"
                      dataKey="air_temperature"
                      name="Air"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="track_temperature"
                      name="Track"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            {/* Wind Chart */}
            <div className={cn(
              "rounded-lg p-2",
              isGlass ? "bg-white/5 border border-white/10" : "bg-muted/30"
            )}>
              <div className="flex items-center gap-2 mb-1 px-2">
                <Wind className="h-3 w-3 text-emerald-500" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Wind Speed</span>
              </div>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart
                    data={chartData}
                    margin={{ left: 40, right: 10, top: 20, bottom: 25 }}
                    onMouseMove={handleHighlightChange}
                    onMouseLeave={() => setHighlightedIndex(null)}
                  >
                    <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                    <XAxis {...timeXAxisProps} />
                    <YAxis
                      width={40}
                      tickLine={false}
                      tick={axisTick}
                      label={{ value: 'm/s', angle: -90, position: 'insideLeft', fontSize: 10, fill: tickColor }}
                    />
                    <Tooltip content={<WeatherTooltip unit=" m/s" />} />
                    <Line
                      type="monotone"
                      dataKey="wind_speed"
                      name="Wind"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            {/* Humidity Chart */}
            <div className={cn(
              "rounded-lg p-2",
              isGlass ? "bg-white/5 border border-white/10" : "bg-muted/30"
            )}>
              <div className="flex items-center gap-2 mb-1 px-2">
                <Droplets className="h-3 w-3 text-indigo-500" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Humidity</span>
              </div>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart
                    data={chartData}
                    margin={{ left: 40, right: 10, top: 20, bottom: 25 }}
                    onMouseMove={handleHighlightChange}
                    onMouseLeave={() => setHighlightedIndex(null)}
                  >
                    <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                    <XAxis {...timeXAxisProps} />
                    <YAxis
                      domain={[0, 100]}
                      width={40}
                      tickLine={false}
                      tick={axisTick}
                      label={{ value: '%', angle: -90, position: 'insideLeft', fontSize: 10, fill: tickColor }}
                    />
                    <Tooltip content={<WeatherTooltip unit="%" />} />
                    <Line
                      type="monotone"
                      dataKey="humidity"
                      name="Humidity"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            {/* Pressure Chart */}
            <div className={cn(
              "rounded-lg p-2",
              isGlass ? "bg-white/5 border border-white/10" : "bg-muted/30"
            )}>
              <div className="flex items-center gap-2 mb-1 px-2">
                <Cloud className="h-3 w-3 text-purple-500" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Pressure</span>
              </div>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart
                    data={chartData}
                    margin={{ left: 50, right: 10, top: 20, bottom: 25 }}
                    onMouseMove={handleHighlightChange}
                    onMouseLeave={() => setHighlightedIndex(null)}
                  >
                    <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                    <XAxis {...timeXAxisProps} />
                    <YAxis
                      domain={['auto', 'auto']}
                      width={50}
                      tickLine={false}
                      tick={axisTick}
                      label={{ value: 'mbar', angle: -90, position: 'insideLeft', fontSize: 10, fill: tickColor }}
                    />
                    <Tooltip content={<WeatherTooltip unit=" mbar" />} />
                    <Line
                      type="monotone"
                      dataKey="pressure"
                      name="Pressure"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          
          {/* Synced data display when hovering */}
          {highlightedIndex !== null && chartData[highlightedIndex] && (
            <div className={cn(
              "mt-3 p-3 rounded-lg text-xs flex items-center justify-center gap-6 flex-wrap",
              isGlass ? "bg-white/5 border border-white/10" : "bg-muted/50"
            )}>
              <span className="font-mono text-muted-foreground">
                {formatTimeForAxis(chartData[highlightedIndex].time)}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                Air: {chartData[highlightedIndex].air_temperature.toFixed(1)}°C
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Track: {chartData[highlightedIndex].track_temperature.toFixed(1)}°C
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Wind: {chartData[highlightedIndex].wind_speed.toFixed(1)} m/s
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                Humidity: {chartData[highlightedIndex].humidity.toFixed(0)}%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                Pressure: {chartData[highlightedIndex].pressure.toFixed(0)} mbar
              </span>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="temp" className="mt-3">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart
                data={chartData}
                margin={{ left: 50, right: 20, top: 20, bottom: 30 }}
              >
                <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                <XAxis {...timeXAxisProps} tick={{ fontSize: 11, fill: tickColor }} />
                <YAxis
                  width={50}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: tickColor }}
                  label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft', fontSize: 11, fill: tickColor }}
                />
                <Tooltip content={<WeatherTooltip unit="°C" />} />
                <Legend wrapperStyle={{ fontSize: 11 }} align="right" verticalAlign="top" />
                <Line
                  type="monotone"
                  dataKey="air_temperature"
                  name="Air Temperature"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="track_temperature"
                  name="Track Temperature"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Track temperature is typically higher than air temperature due to solar radiation
          </p>
        </TabsContent>
        
        <TabsContent value="wind" className="mt-3">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart
                data={chartData}
                margin={{ left: 50, right: 20, top: 20, bottom: 30 }}
              >
                <defs>
                  <linearGradient id="windGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                <XAxis {...timeXAxisProps} tick={{ fontSize: 11, fill: tickColor }} />
                <YAxis
                  domain={[0, 'auto']}
                  width={50}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: tickColor }}
                  label={{ value: 'Wind Speed (m/s)', angle: -90, position: 'insideLeft', fontSize: 11, fill: tickColor }}
                />
                <Tooltip content={<WeatherTooltip unit=" m/s" />} />
                <Area
                  type="monotone"
                  dataKey="wind_speed"
                  name="Wind Speed"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#windGradient)"
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Wind speeds affect aerodynamics and car behavior on high-speed corners
          </p>
        </TabsContent>
        
        <TabsContent value="humidity" className="mt-3">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart
                data={chartData}
                margin={{ left: 50, right: 20, top: 20, bottom: 30 }}
              >
                <defs>
                  <linearGradient id="humidityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                <XAxis {...timeXAxisProps} tick={{ fontSize: 11, fill: tickColor }} />
                <YAxis
                  domain={[0, 100]}
                  width={50}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: tickColor }}
                  label={{ value: 'Humidity (%)', angle: -90, position: 'insideLeft', fontSize: 11, fill: tickColor }}
                />
                <Tooltip content={<WeatherTooltip unit="%" />} />
                <Area
                  type="monotone"
                  dataKey="humidity"
                  name="Humidity"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#humidityGradient)"
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Higher humidity reduces air density, affecting engine performance
          </p>
        </TabsContent>
        
        <TabsContent value="pressure" className="mt-3">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart
                data={chartData}
                margin={{ left: 55, right: 20, top: 20, bottom: 30 }}
              >
                <defs>
                  <linearGradient id="pressureGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                <XAxis {...timeXAxisProps} tick={{ fontSize: 11, fill: tickColor }} />
                <YAxis
                  domain={['auto', 'auto']}
                  width={55}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: tickColor }}
                  label={{ value: 'Pressure (mbar)', angle: -90, position: 'insideLeft', fontSize: 11, fill: tickColor }}
                />
                <Tooltip content={<WeatherTooltip unit=" mbar" />} />
                <Area
                  type="monotone"
                  dataKey="pressure"
                  name="Atmospheric Pressure"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fill="url(#pressureGradient)"
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Atmospheric pressure influences engine power output and aerodynamic downforce
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WeatherAnalysis;
