import React, { useState, useEffect, useCallback } from 'react';
import { Thermometer, Cloud, Droplets, Wind, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOpenF1SessionFromErgast, useDrivers, useSession, useRaceControl } from "@/hooks/useOpenF1Data";
import { useWeatherData } from "@/hooks/useOpenF1Data";
import { processOpenF1WeatherData } from "@/utils/apiAdapters";
import { LineChart } from '@mui/x-charts/LineChart';
import { ChartsReferenceLine } from '@mui/x-charts/ChartsReferenceLine';
import { HighlightScope, HighlightItemData } from '@mui/x-charts/context';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import MuiThemeWrapper from './MuiThemeWrapper';

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
  const { isGlass, baseTheme } = useTheme();
  const isDark = baseTheme === 'dark';
  
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
  
  const xAxisData = chartData.map(d => d.time);
  
  const isLoading = isSessionLoading || isWeatherLoading;
  const hasNoData = !isLoading && (!weatherData?.data || weatherData.data.length === 0);
  const hasError = !!weatherError || (!isLoading && !effectiveSessionKey);
  
  // Handle highlight change for synchronized hover
  const handleHighlightChange = useCallback((highlighted: HighlightItemData | null) => {
    if (highlighted?.dataIndex !== undefined) {
      setHighlightedIndex(highlighted.dataIndex);
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

  // Common chart props for synchronized hover
  const getChartProps = (seriesData: number[], color: string, label: string, yLabel: string, extraYAxisProps?: object) => ({
    xAxis: [{
      id: 'time-axis',
      data: xAxisData,
      scaleType: 'time' as const,
      valueFormatter: (value: number) => formatTimeForAxis(value),
      tickLabelStyle: { fontSize: 10, fill: isDark ? '#a1a1aa' : '#666' },
    }],
    yAxis: [{
      label: yLabel,
      labelStyle: { fontSize: 10, fill: isDark ? '#a1a1aa' : '#666' },
      tickLabelStyle: { fontSize: 10, fill: isDark ? '#a1a1aa' : '#666' },
      ...extraYAxisProps,
    }],
    series: [{
      data: seriesData,
      label,
      color,
      showMark: false,
      highlightScope: { highlighted: 'item', faded: 'global' } as HighlightScope,
    }],
    height: 180,
    margin: { left: 45, right: 10, top: 20, bottom: 25 },
    slotProps: {
      legend: { hidden: true },
    },
    onHighlightChange: handleHighlightChange,
    highlightedItem: highlightedIndex !== null ? { seriesId: 'auto-generated-id-0', dataIndex: highlightedIndex } : null,
  });

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
              <MuiThemeWrapper>
                <div className="h-[180px]">
                  <LineChart
                    xAxis={[{
                      id: 'time-axis',
                      data: xAxisData,
                      scaleType: 'time',
                      valueFormatter: (value) => formatTimeForAxis(value),
                      tickLabelStyle: { fontSize: 10, fill: isDark ? '#a1a1aa' : '#666' },
                    }]}
                    yAxis={[{
                      label: '°C',
                      labelStyle: { fontSize: 10, fill: isDark ? '#a1a1aa' : '#666' },
                      tickLabelStyle: { fontSize: 10, fill: isDark ? '#a1a1aa' : '#666' },
                    }]}
                    series={[
                      { 
                        data: chartData.map(d => d.air_temperature), 
                        label: 'Air',
                        color: '#3b82f6',
                        showMark: false,
                      },
                      { 
                        data: chartData.map(d => d.track_temperature), 
                        label: 'Track',
                        color: '#f59e0b',
                        showMark: false,
                      },
                    ]}
                    height={180}
                    margin={{ left: 40, right: 10, top: 20, bottom: 25 }}
                    slotProps={{ legend: { hidden: true } }}
                    onHighlightChange={handleHighlightChange}
                  />
                </div>
              </MuiThemeWrapper>
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
              <MuiThemeWrapper>
                <div className="h-[180px]">
                  <LineChart
                    xAxis={[{
                      id: 'time-axis',
                      data: xAxisData,
                      scaleType: 'time',
                      valueFormatter: (value) => formatTimeForAxis(value),
                      tickLabelStyle: { fontSize: 10, fill: isDark ? '#a1a1aa' : '#666' },
                    }]}
                    yAxis={[{
                      label: 'm/s',
                      labelStyle: { fontSize: 10, fill: isDark ? '#a1a1aa' : '#666' },
                      tickLabelStyle: { fontSize: 10, fill: isDark ? '#a1a1aa' : '#666' },
                    }]}
                    series={[
                      { 
                        data: chartData.map(d => d.wind_speed), 
                        label: 'Wind',
                        color: '#10b981',
                        showMark: false,
                      },
                    ]}
                    height={180}
                    margin={{ left: 40, right: 10, top: 20, bottom: 25 }}
                    slotProps={{ legend: { hidden: true } }}
                    onHighlightChange={handleHighlightChange}
                  />
                </div>
              </MuiThemeWrapper>
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
              <MuiThemeWrapper>
                <div className="h-[180px]">
                  <LineChart
                    xAxis={[{
                      id: 'time-axis',
                      data: xAxisData,
                      scaleType: 'time',
                      valueFormatter: (value) => formatTimeForAxis(value),
                      tickLabelStyle: { fontSize: 10, fill: isDark ? '#a1a1aa' : '#666' },
                    }]}
                    yAxis={[{
                      label: '%',
                      labelStyle: { fontSize: 10, fill: isDark ? '#a1a1aa' : '#666' },
                      tickLabelStyle: { fontSize: 10, fill: isDark ? '#a1a1aa' : '#666' },
                      min: 0,
                      max: 100,
                    }]}
                    series={[
                      { 
                        data: chartData.map(d => d.humidity), 
                        label: 'Humidity',
                        color: '#6366f1',
                        showMark: false,
                      },
                    ]}
                    height={180}
                    margin={{ left: 40, right: 10, top: 20, bottom: 25 }}
                    slotProps={{ legend: { hidden: true } }}
                    onHighlightChange={handleHighlightChange}
                  />
                </div>
              </MuiThemeWrapper>
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
              <MuiThemeWrapper>
                <div className="h-[180px]">
                  <LineChart
                    xAxis={[{
                      id: 'time-axis',
                      data: xAxisData,
                      scaleType: 'time',
                      valueFormatter: (value) => formatTimeForAxis(value),
                      tickLabelStyle: { fontSize: 10, fill: isDark ? '#a1a1aa' : '#666' },
                    }]}
                    yAxis={[{
                      label: 'mbar',
                      labelStyle: { fontSize: 10, fill: isDark ? '#a1a1aa' : '#666' },
                      tickLabelStyle: { fontSize: 10, fill: isDark ? '#a1a1aa' : '#666' },
                    }]}
                    series={[
                      { 
                        data: chartData.map(d => d.pressure), 
                        label: 'Pressure',
                        color: '#8b5cf6',
                        showMark: false,
                      },
                    ]}
                    height={180}
                    margin={{ left: 50, right: 10, top: 20, bottom: 25 }}
                    slotProps={{ legend: { hidden: true } }}
                    onHighlightChange={handleHighlightChange}
                  />
                </div>
              </MuiThemeWrapper>
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
          <MuiThemeWrapper>
            <div className="h-[280px]">
              <LineChart
                xAxis={[{
                  data: xAxisData,
                  scaleType: 'time',
                  valueFormatter: (value) => formatTimeForAxis(value),
                  tickLabelStyle: { fontSize: 11 },
                }]}
                yAxis={[{
                  label: 'Temperature (°C)',
                  labelStyle: { fontSize: 11 },
                  tickLabelStyle: { fontSize: 11 },
                }]}
                series={[
                  { 
                    data: chartData.map(d => d.air_temperature), 
                    label: 'Air Temperature',
                    color: '#3b82f6',
                    showMark: false,
                  },
                  { 
                    data: chartData.map(d => d.track_temperature), 
                    label: 'Track Temperature',
                    color: '#f59e0b',
                    showMark: false,
                  },
                ]}
                height={280}
                margin={{ left: 50, right: 20, top: 20, bottom: 30 }}
                slotProps={{
                  legend: { 
                    direction: 'row',
                    position: { vertical: 'top', horizontal: 'right' },
                    labelStyle: { fontSize: 11 },
                  },
                }}
              />
            </div>
          </MuiThemeWrapper>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Track temperature is typically higher than air temperature due to solar radiation
          </p>
        </TabsContent>
        
        <TabsContent value="wind" className="mt-3">
          <MuiThemeWrapper>
            <div className="h-[280px]">
              <LineChart
                xAxis={[{
                  data: xAxisData,
                  scaleType: 'time',
                  valueFormatter: (value) => formatTimeForAxis(value),
                  tickLabelStyle: { fontSize: 11 },
                }]}
                yAxis={[{
                  label: 'Wind Speed (m/s)',
                  labelStyle: { fontSize: 11 },
                  tickLabelStyle: { fontSize: 11 },
                  min: 0,
                }]}
                series={[
                  { 
                    data: chartData.map(d => d.wind_speed), 
                    label: 'Wind Speed',
                    color: '#10b981',
                    showMark: false,
                    area: true,
                  },
                ]}
                height={280}
                margin={{ left: 50, right: 20, top: 20, bottom: 30 }}
                slotProps={{
                  legend: { hidden: true },
                }}
              />
            </div>
          </MuiThemeWrapper>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Wind speeds affect aerodynamics and car behavior on high-speed corners
          </p>
        </TabsContent>
        
        <TabsContent value="humidity" className="mt-3">
          <MuiThemeWrapper>
            <div className="h-[280px]">
              <LineChart
                xAxis={[{
                  data: xAxisData,
                  scaleType: 'time',
                  valueFormatter: (value) => formatTimeForAxis(value),
                  tickLabelStyle: { fontSize: 11 },
                }]}
                yAxis={[{
                  label: 'Humidity (%)',
                  labelStyle: { fontSize: 11 },
                  tickLabelStyle: { fontSize: 11 },
                  min: 0,
                  max: 100,
                }]}
                series={[
                  { 
                    data: chartData.map(d => d.humidity), 
                    label: 'Humidity',
                    color: '#6366f1',
                    showMark: false,
                    area: true,
                  },
                ]}
                height={280}
                margin={{ left: 50, right: 20, top: 20, bottom: 30 }}
                slotProps={{
                  legend: { hidden: true },
                }}
              />
            </div>
          </MuiThemeWrapper>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Higher humidity reduces air density, affecting engine performance
          </p>
        </TabsContent>
        
        <TabsContent value="pressure" className="mt-3">
          <MuiThemeWrapper>
            <div className="h-[280px]">
              <LineChart
                xAxis={[{
                  data: xAxisData,
                  scaleType: 'time',
                  valueFormatter: (value) => formatTimeForAxis(value),
                  tickLabelStyle: { fontSize: 11 },
                }]}
                yAxis={[{
                  label: 'Pressure (mbar)',
                  labelStyle: { fontSize: 11 },
                  tickLabelStyle: { fontSize: 11 },
                }]}
                series={[
                  { 
                    data: chartData.map(d => d.pressure), 
                    label: 'Atmospheric Pressure',
                    color: '#8b5cf6',
                    showMark: false,
                    area: true,
                  },
                ]}
                height={280}
                margin={{ left: 55, right: 20, top: 20, bottom: 30 }}
                slotProps={{
                  legend: { hidden: true },
                }}
              />
            </div>
          </MuiThemeWrapper>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Atmospheric pressure influences engine power output and aerodynamic downforce
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WeatherAnalysis;
