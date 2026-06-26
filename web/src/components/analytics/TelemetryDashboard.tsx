import React, { useState, useEffect, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Gauge } from 'lucide-react';
import { F1Badge, F1ChartContainer } from "@/components/f1";
import { useTelemetryData } from "@/hooks/useTelemetryData";
import { useF1Metadata } from "@/hooks/useF1Metadata";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useThemeVariant } from '@/hooks/useThemeVariant';
import { cn } from '@/lib/utils';

interface TelemetryDashboardProps {
  year: number;
  round: string;
  sessionType?: string;
  sessionKey?: number;
}

type TelemetryMetric = 'speed' | 'throttle' | 'brake' | 'rpm' | 'gear' | 'drs';

const metricConfig: Record<TelemetryMetric, { label: string; unit: string }> = {
  speed: { label: 'Speed', unit: 'km/h' },
  throttle: { label: 'Throttle', unit: '%' },
  brake: { label: 'Brake', unit: '%' },
  rpm: { label: 'RPM', unit: 'rpm' },
  gear: { label: 'Gear', unit: '' },
  drs: { label: 'DRS', unit: '' },
};

const TelemetryDashboard: React.FC<TelemetryDashboardProps> = ({
  sessionKey
}) => {
  const [selectedDriver1, setSelectedDriver1] = useState<string>("");
  const [selectedDriver2, setSelectedDriver2] = useState<string>("");
  const [telemetryMetric, setTelemetryMetric] = useState<TelemetryMetric>("speed");

  const { isGlass } = useThemeVariant();

  // Use metadata hook for drivers and colors
  const { drivers, getDriverColor, isLoading: isMetadataLoading } = useF1Metadata();

  // Manage selected drivers for the hook
  const selectedDriversList = useMemo(() => {
    return [
      selectedDriver1 ? parseInt(selectedDriver1) : null,
      selectedDriver2 ? parseInt(selectedDriver2) : null
    ].filter((d): d is number => d !== null);
  }, [selectedDriver1, selectedDriver2]);

  // Fetch telemetry data
  const {
    telemetryData,
    isLoading: isTelemetryLoading,
    hasData
  } = useTelemetryData(sessionKey || 0, selectedDriversList);

  // Set default drivers once metadata is loaded
  useEffect(() => {
    if (drivers.length > 0 && !selectedDriver1 && !selectedDriver2) {
      const d1 = drivers.find(d => d.code === "VER")?.permanentNumber || drivers[0]?.permanentNumber;
      const d2 = drivers.find(d => d.code === "LEC")?.permanentNumber || drivers[1]?.permanentNumber;
      if (d1) setSelectedDriver1(d1);
      if (d2) setSelectedDriver2(d2);
    }
  }, [drivers, selectedDriver1, selectedDriver2]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!hasData) return { times: [], series: [] };

    const d1Data = selectedDriver1 ? telemetryData[parseInt(selectedDriver1)] || [] : [];
    const d2Data = selectedDriver2 ? telemetryData[parseInt(selectedDriver2)] || [] : [];

    const maxLength = Math.max(d1Data.length, d2Data.length);
    const times: number[] = [];
    const driver1Values: (number | null)[] = [];
    const driver2Values: (number | null)[] = [];

    for (let i = 0; i < maxLength; i++) {
      const p1 = d1Data[i];
      const p2 = d2Data[i];

      times.push(p1?.time || p2?.time || i);
      driver1Values.push(p1 ? p1[telemetryMetric] : null);
      driver2Values.push(p2 ? p2[telemetryMetric] : null);
    }

    const series: Array<{ data: (number | null)[]; label: string; color: string; showMark: boolean }> = [];

    if (selectedDriver1) {
      const driver = drivers.find(d => d.permanentNumber === selectedDriver1);
      series.push({
        data: driver1Values,
        label: driver?.code || selectedDriver1,
        color: getDriverColor(driver?.driverId || ""),
        showMark: false,
      });
    }

    if (selectedDriver2 && selectedDriver2 !== "none") {
      const driver = drivers.find(d => d.permanentNumber === selectedDriver2);
      series.push({
        data: driver2Values,
        label: driver?.code || selectedDriver2,
        color: getDriverColor(driver?.driverId || ""),
        showMark: false,
      });
    }

    return { times, series };
  }, [hasData, telemetryData, selectedDriver1, selectedDriver2, telemetryMetric, drivers, getDriverColor]);

  // Recharts consumes an array of row objects keyed by series label.
  // Build rows from the {times, series} shape above without altering it.
  const rechartsRows = useMemo(() => {
    return chartData.times.map((time, i) => {
      const row: Record<string, number | null> = { time };
      chartData.series.forEach(s => {
        row[s.label] = s.data[i] ?? null;
      });
      return row;
    });
  }, [chartData]);

  const getDriverCode = (number: string) => {
    const driver = drivers.find(d => d.permanentNumber === number);
    return driver?.code || number;
  };

  if (!sessionKey) {
    return (
      <div className="min-h-[300px] flex flex-col items-center justify-center p-4 text-center">
        <Gauge className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="font-medium text-foreground">Select a Session</p>
        <p className="text-xs text-muted-foreground mt-1">
          Select a specific session (Practice, Qualifying, or Race) to view telemetry.
        </p>
      </div>
    );
  }

  const isLoading = isTelemetryLoading || isMetadataLoading;

  // Token-driven chart colors (axis ticks, gridlines, tooltip surfaces).
  const tickColor = 'hsl(var(--muted-foreground))';
  const gridColor = 'hsl(var(--border))';
  const formatTime = (value: number) =>
    typeof value === 'number' ? value.toFixed(1) : String(value);
  const metricUnit = metricConfig[telemetryMetric].unit;
  const yAxisLabel = `${metricConfig[telemetryMetric].label}${
    metricUnit ? ` (${metricUnit})` : ''
  }`;

  // Custom tooltip: time header + one row per driver series.
  const TelemetryTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const rows = payload.filter((p: any) => p.value != null);
    if (!rows.length) return null;
    return (
      <div className="rounded-md border border-border bg-card/95 px-2 py-1.5 text-xs shadow-premium-sm">
        <div className="font-mono tabular-nums text-muted-foreground mb-1">
          {formatTime(label)}s
        </div>
        {rows.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: p.color || p.stroke }}
            />
            <span className="font-bold w-9 text-foreground">{p.dataKey}</span>
            <span className="font-mono tabular-nums text-foreground">
              {p.value.toFixed(1)}
              {metricUnit ? ` ${metricUnit}` : ''}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={selectedDriver1} onValueChange={setSelectedDriver1}>
          <SelectTrigger className="w-[120px] h-8 text-xs font-mono">
            <SelectValue placeholder="Driver 1" />
          </SelectTrigger>
          <SelectContent>
            {drivers.map((driver) => (
              <SelectItem key={`d1-${driver.driverId}`} value={driver.permanentNumber}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getDriverColor(driver.driverId) }}
                  />
                  <span className="text-xs font-mono">{driver.code}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-xs text-muted-foreground">vs</span>

        <Select value={selectedDriver2} onValueChange={setSelectedDriver2}>
          <SelectTrigger className="w-[120px] h-8 text-xs font-mono">
            <SelectValue placeholder="Driver 2" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {drivers.map((driver) => (
              <SelectItem key={`d2-${driver.driverId}`} value={driver.permanentNumber}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getDriverColor(driver.driverId) }}
                  />
                  <span className="text-xs font-mono">{driver.code}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <div className="flex flex-wrap gap-1">
          {(Object.keys(metricConfig) as TelemetryMetric[]).map(metric => {
            const active = telemetryMetric === metric;
            return (
              <button
                key={metric}
                onClick={() => setTelemetryMetric(metric)}
                className={cn(
                  "px-2 py-1 rounded-md text-xs font-medium transition-fast",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {metricConfig[metric].label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Driver Legend */}
      <div className="flex items-center gap-4">
        {selectedDriver1 && (
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: getDriverColor(drivers.find(d => d.permanentNumber === selectedDriver1)?.driverId || "") }}
            />
            <span className="text-xs font-mono font-medium text-foreground">{getDriverCode(selectedDriver1)}</span>
          </div>
        )}
        {selectedDriver2 && selectedDriver2 !== "none" && (
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: getDriverColor(drivers.find(d => d.permanentNumber === selectedDriver2)?.driverId || "") }}
            />
            <span className="text-xs font-mono font-medium text-foreground">{getDriverCode(selectedDriver2)}</span>
          </div>
        )}
        <F1Badge variant="time" className="ml-auto">
          {metricConfig[telemetryMetric].label}
          {metricUnit && ` (${metricUnit})`}
        </F1Badge>
      </div>

      {/* Chart */}
      <F1ChartContainer
        isLoading={isLoading}
        useSkeleton
        isEmpty={!isLoading && !hasData}
        emptyTitle="No telemetry data"
        emptyDescription="Select different drivers or check data availability"
        minHeight={350}
      >
        <ResponsiveContainer width="100%" height={350}>
          <LineChart
            data={rechartsRows}
            margin={{ left: 10, right: 20, top: 20, bottom: 40 }}
          >
            <CartesianGrid
              vertical={false}
              stroke={gridColor}
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="time"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={formatTime}
              tickLine={false}
              tick={{ fontSize: 10, fill: tickColor, fontFamily: 'var(--font-mono, monospace)' }}
              label={{
                value: 'Time (s)',
                position: 'insideBottom',
                offset: -10,
                fontSize: 11,
                fill: tickColor,
              }}
            />
            <YAxis
              width={55}
              tickLine={false}
              tick={{ fontSize: 10, fill: tickColor, fontFamily: 'var(--font-mono, monospace)' }}
              label={{
                value: yAxisLabel,
                angle: -90,
                position: 'insideLeft',
                style: { textAnchor: 'middle', fontSize: 11, fill: tickColor },
              }}
            />
            <Tooltip content={<TelemetryTooltip />} />
            {chartData.series.map(s => (
              <Line
                key={s.label}
                type="linear"
                dataKey={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </F1ChartContainer>

      {/* Stats Summary */}
      {hasData && chartData.series.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {chartData.series.map(s => {
            const validValues = s.data.filter((v): v is number => v !== null);
            const max = validValues.length > 0 ? Math.max(...validValues) : 0;
            const min = validValues.length > 0 ? Math.min(...validValues) : 0;
            const avg = validValues.length > 0 ? validValues.reduce((a, b) => a + b, 0) / validValues.length : 0;

            return (
              <div
                key={s.label}
                className={cn(
                  "rounded-lg p-3 border border-border",
                  isGlass ? "bg-muted/20" : "bg-muted/40"
                )}
                style={{ borderLeftColor: s.color, borderLeftWidth: 3 }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-xs font-mono font-semibold text-foreground">{s.label}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">Max</div>
                    <div className="font-mono tabular-nums font-medium text-foreground">{max.toFixed(1)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Min</div>
                    <div className="font-mono tabular-nums font-medium text-foreground">{min.toFixed(1)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Avg</div>
                    <div className="font-mono tabular-nums font-medium text-foreground">{avg.toFixed(1)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TelemetryDashboard;
