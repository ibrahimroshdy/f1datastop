import React, { useState, useEffect, useCallback } from 'react';
import { Thermometer, Droplets, Wind, Gauge } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDbWeather } from "@/hooks/useWarehouse";
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
import { chartTheme, ScopeDefs, scopeFadeId, SCOPE_GLOW } from "@/lib/chartTheme";
import { F1ChartContainer, F1EmptyState, F1ErrorState, F1Skeleton } from '@/components/f1';

interface WeatherAnalysisProps {
  year: number;
  round: string;
  /** Canonical session code (R/Q/S/SQ/FP1-3). */
  session?: string;
}

// Weather metric series — single source of truth for stroke + legend swatch.
// Hues are defined as named CSS variables in index.css (DESIGN.md §1.7).
const WEATHER_SERIES = {
  air: 'hsl(var(--weather-air))',
  track: 'hsl(var(--weather-track))',
  wind: 'hsl(var(--weather-wind))',
  humidity: 'hsl(var(--weather-humidity))',
  pressure: 'hsl(var(--weather-pressure))',
} as const;

const underlineTabTrigger =
  "rounded-none border-b-2 border-transparent bg-transparent px-3 pb-2 pt-1 text-xs uppercase tracking-wider shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none";

const WeatherAnalysis: React.FC<WeatherAnalysisProps> = ({
  year,
  round,
  session = "R",
}) => {
  const [activeTab, setActiveTab] = useState("all");
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

  // Reset state when session changes
  useEffect(() => {
    setHighlightedIndex(null);
  }, [session, round]);

  // FastF1-native weather from the warehouse (get_weather RPC).
  const {
    data: weatherRows,
    isLoading,
    error: weatherError,
  } = useDbWeather(year, parseInt(round, 10), session);

  // Map DB rows -> the chart shape. `time` is seconds elapsed into the session.
  const processedData = React.useMemo(() => {
    if (!weatherRows || weatherRows.length === 0) return [];
    return weatherRows
      .filter((w) => w.time_seconds != null)
      .map((w) => ({
        time: Number(w.time_seconds),
        air_temperature: Number(w.air_temp ?? 0),
        track_temperature: Number(w.track_temp ?? 0),
        humidity: Number(w.humidity ?? 0),
        wind_speed: Number(w.wind_speed ?? 0),
        pressure: Number(w.pressure ?? 0),
      }));
  }, [weatherRows]);

  // Get the most recent weather readings
  const currentWeather = React.useMemo(() => {
    if (processedData.length === 0) return null;
    return processedData[processedData.length - 1];
  }, [processedData]);

  // Format the x-axis: seconds elapsed -> m:ss into the session.
  const formatTimeForAxis = (time: number) => {
    const s = Math.max(0, Math.floor(Number(time)));
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, "0")}`;
  };

  // Prepare chart data
  const chartData = React.useMemo(() => {
    if (processedData.length === 0) return [];
    // Sample data to avoid too many points (max 100 points)
    const step = Math.max(1, Math.floor(processedData.length / 100));
    return processedData.filter((_, i) => i % step === 0);
  }, [processedData]);

  const hasNoData = !isLoading && processedData.length === 0;
  const hasError = !!weatherError;

  // Handle highlight change for synchronized hover (driven by recharts onMouseMove)
  const handleHighlightChange = useCallback((state: any) => {
    if (state?.isTooltipActive && state.activeTooltipIndex !== undefined && state.activeTooltipIndex !== null) {
      setHighlightedIndex(state.activeTooltipIndex);
    } else {
      setHighlightedIndex(null);
    }
  }, []);

  // Compact metric tile (label eyebrow + mono value/unit + icon)
  const MetricTile = ({
    label,
    value,
    unit,
    icon: Icon,
    color,
  }: {
    label: string;
    value: string;
    unit: string;
    icon: React.ElementType;
    color: string;
  }) => (
    <div className="flex flex-col rounded-md border border-border bg-muted/40 p-2.5">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
        <Icon className="h-3.5 w-3.5" style={{ color }} />
      </div>
      <span className="font-mono text-lg font-semibold tabular-nums leading-none">
        {value}
        <span className="ml-0.5 text-xs text-muted-foreground">{unit}</span>
      </span>
    </div>
  );

  // Recharts theming helpers — Telemetry Terminal "scope" theme (see chartTheme.tsx)
  const tickColor = chartTheme.tick.fill;
  const gridColor = chartTheme.grid;
  const axisColor = chartTheme.axis;
  const axisTick = chartTheme.tick;

  // Shared themed x-axis (time) props for recharts
  const timeXAxisProps = {
    dataKey: 'time' as const,
    type: 'number' as const,
    scale: 'time' as const,
    domain: ['dataMin', 'dataMax'] as [string, string],
    tickFormatter: (value: number) => formatTimeForAxis(value),
    tickLine: false,
    tick: axisTick,
    stroke: axisColor,
  };

  // Custom tooltip rendering each active series with its unit
  const WeatherTooltip = ({ active, payload, label, unit }: any) => {
    if (!active || !payload?.length) return null;
    const rows = payload.filter((p: any) => p.value != null);
    if (!rows.length) return null;
    return (
      <div className="rounded-lg border border-border bg-card px-2 py-1.5 font-mono text-xs shadow-card">
        <div className="mb-1 uppercase tracking-[0.1em] tabular-nums text-muted-foreground">{formatTimeForAxis(label)}</div>
        {rows.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.stroke }} />
            <span className="font-medium">{p.name}</span>
            <span className="ml-auto tabular-nums">{Number(p.value).toFixed(1)}{unit}</span>
          </div>
        ))}
      </div>
    );
  };

  // Compact chart-panel header (icon swatch + eyebrow)
  const ChartHeading = ({
    icon: Icon,
    label,
    color,
  }: {
    icon: React.ElementType;
    label: string;
    color: string;
  }) => (
    <div className="mb-1 flex items-center gap-2 px-2">
      <Icon className="h-3 w-3" style={{ color }} />
      <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</span>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <F1Skeleton key={i} className="h-16 rounded-md" />
          ))}
        </div>
        <F1Skeleton className="h-7 w-64" />
        <F1Skeleton className="h-[180px] w-full rounded-md" />
      </div>
    );
  }

  if (hasError) {
    return (
      <F1ErrorState
        type="generic"
        variant="inline"
        title="Weather data unavailable"
        message={
          year >= new Date().getFullYear()
            ? "Current season data may not be available yet."
            : "Weather data is only available for races from 2023 onwards."
        }
        className="py-8"
      />
    );
  }

  if (hasNoData) {
    return (
      <F1EmptyState
        type="no-data"
        title="No weather data"
        description="No weather telemetry was recorded for this session."
        size="sm"
        className="py-8"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Current conditions — compact metric strip */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <MetricTile
          label="Air Temp"
          value={currentWeather?.air_temperature.toFixed(1) || '--'}
          unit="°C"
          icon={Thermometer}
          color={WEATHER_SERIES.air}
        />
        <MetricTile
          label="Track Temp"
          value={currentWeather?.track_temperature.toFixed(1) || '--'}
          unit="°C"
          icon={Thermometer}
          color={WEATHER_SERIES.track}
        />
        <MetricTile
          label="Humidity"
          value={currentWeather?.humidity.toFixed(0) || '--'}
          unit="%"
          icon={Droplets}
          color={WEATHER_SERIES.humidity}
        />
        <MetricTile
          label="Wind Speed"
          value={currentWeather?.wind_speed.toFixed(1) || '--'}
          unit="m/s"
          icon={Wind}
          color={WEATHER_SERIES.wind}
        />
      </div>

      {/* Charts */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="inline-flex h-auto w-full justify-start gap-0 rounded-none border-b border-border bg-transparent p-0">
          <TabsTrigger value="all" className={underlineTabTrigger}>Overview</TabsTrigger>
          <TabsTrigger value="temp" className={underlineTabTrigger}>Temp</TabsTrigger>
          <TabsTrigger value="wind" className={underlineTabTrigger}>Wind</TabsTrigger>
          <TabsTrigger value="humidity" className={underlineTabTrigger}>Humidity</TabsTrigger>
          <TabsTrigger value="pressure" className={underlineTabTrigger}>Pressure</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-3">
          <div
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            onMouseLeave={() => setHighlightedIndex(null)}
          >
            {/* Temperature Chart */}
            <div className="rounded-md border border-border bg-muted/40 p-2">
              <ChartHeading icon={Thermometer} label="Temperature" color={WEATHER_SERIES.air} />
              <F1ChartContainer minHeight={180} isEmpty={chartData.length === 0}>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart
                    data={chartData}
                    margin={{ left: 40, right: 10, top: 20, bottom: 25 }}
                    onMouseMove={handleHighlightChange}
                    onMouseLeave={() => setHighlightedIndex(null)}
                  >
                    <defs>
                      <ScopeDefs id="air" color={WEATHER_SERIES.air} />
                      <ScopeDefs id="track" color={WEATHER_SERIES.track} />
                    </defs>
                    <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                    <XAxis {...timeXAxisProps} />
                    <YAxis
                      width={40}
                      tickLine={false}
                      tick={axisTick}
                      stroke={axisColor}
                      label={{ value: '°C', angle: -90, position: 'insideLeft', fontSize: 11, fill: tickColor }}
                    />
                    <Tooltip content={<WeatherTooltip unit="°C" />} cursor={chartTheme.cursor} />
                    <Line
                      type="monotone"
                      dataKey="air_temperature"
                      name="Air"
                      stroke={WEATHER_SERIES.air}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                      filter={SCOPE_GLOW}
                    />
                    <Line
                      type="monotone"
                      dataKey="track_temperature"
                      name="Track"
                      stroke={WEATHER_SERIES.track}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                      filter={SCOPE_GLOW}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </F1ChartContainer>
            </div>

            {/* Wind Chart */}
            <div className="rounded-md border border-border bg-muted/40 p-2">
              <ChartHeading icon={Wind} label="Wind Speed" color={WEATHER_SERIES.wind} />
              <F1ChartContainer minHeight={180} isEmpty={chartData.length === 0}>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart
                    data={chartData}
                    margin={{ left: 40, right: 10, top: 20, bottom: 25 }}
                    onMouseMove={handleHighlightChange}
                    onMouseLeave={() => setHighlightedIndex(null)}
                  >
                    <defs>
                      <ScopeDefs id="wind" color={WEATHER_SERIES.wind} />
                    </defs>
                    <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                    <XAxis {...timeXAxisProps} />
                    <YAxis
                      width={40}
                      tickLine={false}
                      tick={axisTick}
                      stroke={axisColor}
                      label={{ value: 'm/s', angle: -90, position: 'insideLeft', fontSize: 11, fill: tickColor }}
                    />
                    <Tooltip content={<WeatherTooltip unit=" m/s" />} cursor={chartTheme.cursor} />
                    <Line
                      type="monotone"
                      dataKey="wind_speed"
                      name="Wind"
                      stroke={WEATHER_SERIES.wind}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                      filter={SCOPE_GLOW}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </F1ChartContainer>
            </div>

            {/* Humidity Chart */}
            <div className="rounded-md border border-border bg-muted/40 p-2">
              <ChartHeading icon={Droplets} label="Humidity" color={WEATHER_SERIES.humidity} />
              <F1ChartContainer minHeight={180} isEmpty={chartData.length === 0}>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart
                    data={chartData}
                    margin={{ left: 40, right: 10, top: 20, bottom: 25 }}
                    onMouseMove={handleHighlightChange}
                    onMouseLeave={() => setHighlightedIndex(null)}
                  >
                    <defs>
                      <ScopeDefs id="humidity" color={WEATHER_SERIES.humidity} />
                    </defs>
                    <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                    <XAxis {...timeXAxisProps} />
                    <YAxis
                      domain={[0, 100]}
                      width={40}
                      tickLine={false}
                      tick={axisTick}
                      stroke={axisColor}
                      label={{ value: '%', angle: -90, position: 'insideLeft', fontSize: 11, fill: tickColor }}
                    />
                    <Tooltip content={<WeatherTooltip unit="%" />} cursor={chartTheme.cursor} />
                    <Line
                      type="monotone"
                      dataKey="humidity"
                      name="Humidity"
                      stroke={WEATHER_SERIES.humidity}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                      filter={SCOPE_GLOW}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </F1ChartContainer>
            </div>

            {/* Pressure Chart */}
            <div className="rounded-md border border-border bg-muted/40 p-2">
              <ChartHeading icon={Gauge} label="Pressure" color={WEATHER_SERIES.pressure} />
              <F1ChartContainer minHeight={180} isEmpty={chartData.length === 0}>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart
                    data={chartData}
                    margin={{ left: 50, right: 10, top: 20, bottom: 25 }}
                    onMouseMove={handleHighlightChange}
                    onMouseLeave={() => setHighlightedIndex(null)}
                  >
                    <defs>
                      <ScopeDefs id="pressure" color={WEATHER_SERIES.pressure} />
                    </defs>
                    <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                    <XAxis {...timeXAxisProps} />
                    <YAxis
                      domain={['auto', 'auto']}
                      width={50}
                      tickLine={false}
                      tick={axisTick}
                      stroke={axisColor}
                      label={{ value: 'mbar', angle: -90, position: 'insideLeft', fontSize: 11, fill: tickColor }}
                    />
                    <Tooltip content={<WeatherTooltip unit=" mbar" />} cursor={chartTheme.cursor} />
                    <Line
                      type="monotone"
                      dataKey="pressure"
                      name="Pressure"
                      stroke={WEATHER_SERIES.pressure}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                      filter={SCOPE_GLOW}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </F1ChartContainer>
            </div>
          </div>

          {/* Synced data readout when hovering */}
          {highlightedIndex !== null && chartData[highlightedIndex] && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 rounded-md border border-border bg-muted/40 p-2.5 text-xs">
              <span className="font-mono tabular-nums text-muted-foreground">
                {formatTimeForAxis(chartData[highlightedIndex].time)}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: WEATHER_SERIES.air }} />
                Air <span className="font-mono tabular-nums">{chartData[highlightedIndex].air_temperature.toFixed(1)}°C</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: WEATHER_SERIES.track }} />
                Track <span className="font-mono tabular-nums">{chartData[highlightedIndex].track_temperature.toFixed(1)}°C</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: WEATHER_SERIES.wind }} />
                Wind <span className="font-mono tabular-nums">{chartData[highlightedIndex].wind_speed.toFixed(1)} m/s</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: WEATHER_SERIES.humidity }} />
                Humidity <span className="font-mono tabular-nums">{chartData[highlightedIndex].humidity.toFixed(0)}%</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: WEATHER_SERIES.pressure }} />
                Pressure <span className="font-mono tabular-nums">{chartData[highlightedIndex].pressure.toFixed(0)} mbar</span>
              </span>
            </div>
          )}
        </TabsContent>

        <TabsContent value="temp" className="mt-3">
          <F1ChartContainer minHeight={280} isEmpty={chartData.length === 0}>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart
                data={chartData}
                margin={{ left: 50, right: 20, top: 20, bottom: 30 }}
              >
                <defs>
                  <ScopeDefs id="air" color={WEATHER_SERIES.air} />
                  <ScopeDefs id="track" color={WEATHER_SERIES.track} />
                </defs>
                <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                <XAxis {...timeXAxisProps} />
                <YAxis
                  width={50}
                  tickLine={false}
                  tick={axisTick}
                  stroke={axisColor}
                  label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft', fontSize: 11, fill: tickColor }}
                />
                <Tooltip content={<WeatherTooltip unit="°C" />} cursor={chartTheme.cursor} />
                <Legend wrapperStyle={{ fontSize: 11 }} align="right" verticalAlign="top" />
                <Line
                  type="monotone"
                  dataKey="air_temperature"
                  name="Air Temperature"
                  stroke={WEATHER_SERIES.air}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  filter={SCOPE_GLOW}
                />
                <Line
                  type="monotone"
                  dataKey="track_temperature"
                  name="Track Temperature"
                  stroke={WEATHER_SERIES.track}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  filter={SCOPE_GLOW}
                />
              </LineChart>
            </ResponsiveContainer>
          </F1ChartContainer>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Track temperature is typically higher than air temperature due to solar radiation
          </p>
        </TabsContent>

        <TabsContent value="wind" className="mt-3">
          <F1ChartContainer minHeight={280} isEmpty={chartData.length === 0}>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart
                data={chartData}
                margin={{ left: 50, right: 20, top: 20, bottom: 30 }}
              >
                <defs>
                  <ScopeDefs id="wind" color={WEATHER_SERIES.wind} />
                </defs>
                <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                <XAxis {...timeXAxisProps} />
                <YAxis
                  domain={[0, 'auto']}
                  width={50}
                  tickLine={false}
                  tick={axisTick}
                  stroke={axisColor}
                  label={{ value: 'Wind Speed (m/s)', angle: -90, position: 'insideLeft', fontSize: 11, fill: tickColor }}
                />
                <Tooltip content={<WeatherTooltip unit=" m/s" />} cursor={chartTheme.cursor} />
                <Area
                  type="monotone"
                  dataKey="wind_speed"
                  name="Wind Speed"
                  stroke={WEATHER_SERIES.wind}
                  strokeWidth={2}
                  fill={`url(#${scopeFadeId("wind")})`}
                  dot={false}
                  isAnimationActive={false}
                  filter={SCOPE_GLOW}
                />
              </AreaChart>
            </ResponsiveContainer>
          </F1ChartContainer>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Wind speeds affect aerodynamics and car behavior on high-speed corners
          </p>
        </TabsContent>

        <TabsContent value="humidity" className="mt-3">
          <F1ChartContainer minHeight={280} isEmpty={chartData.length === 0}>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart
                data={chartData}
                margin={{ left: 50, right: 20, top: 20, bottom: 30 }}
              >
                <defs>
                  <ScopeDefs id="humidity" color={WEATHER_SERIES.humidity} />
                </defs>
                <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                <XAxis {...timeXAxisProps} />
                <YAxis
                  domain={[0, 100]}
                  width={50}
                  tickLine={false}
                  tick={axisTick}
                  stroke={axisColor}
                  label={{ value: 'Humidity (%)', angle: -90, position: 'insideLeft', fontSize: 11, fill: tickColor }}
                />
                <Tooltip content={<WeatherTooltip unit="%" />} cursor={chartTheme.cursor} />
                <Area
                  type="monotone"
                  dataKey="humidity"
                  name="Humidity"
                  stroke={WEATHER_SERIES.humidity}
                  strokeWidth={2}
                  fill={`url(#${scopeFadeId("humidity")})`}
                  dot={false}
                  isAnimationActive={false}
                  filter={SCOPE_GLOW}
                />
              </AreaChart>
            </ResponsiveContainer>
          </F1ChartContainer>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Higher humidity reduces air density, affecting engine performance
          </p>
        </TabsContent>

        <TabsContent value="pressure" className="mt-3">
          <F1ChartContainer minHeight={280} isEmpty={chartData.length === 0}>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart
                data={chartData}
                margin={{ left: 55, right: 20, top: 20, bottom: 30 }}
              >
                <defs>
                  <ScopeDefs id="pressure" color={WEATHER_SERIES.pressure} />
                </defs>
                <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
                <XAxis {...timeXAxisProps} />
                <YAxis
                  domain={['auto', 'auto']}
                  width={55}
                  tickLine={false}
                  tick={axisTick}
                  stroke={axisColor}
                  label={{ value: 'Pressure (mbar)', angle: -90, position: 'insideLeft', fontSize: 11, fill: tickColor }}
                />
                <Tooltip content={<WeatherTooltip unit=" mbar" />} cursor={chartTheme.cursor} />
                <Area
                  type="monotone"
                  dataKey="pressure"
                  name="Atmospheric Pressure"
                  stroke={WEATHER_SERIES.pressure}
                  strokeWidth={2}
                  fill={`url(#${scopeFadeId("pressure")})`}
                  dot={false}
                  isAnimationActive={false}
                  filter={SCOPE_GLOW}
                />
              </AreaChart>
            </ResponsiveContainer>
          </F1ChartContainer>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Atmospheric pressure influences engine power output and aerodynamic downforce
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WeatherAnalysis;
