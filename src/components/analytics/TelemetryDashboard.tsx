import React, { useState, useEffect, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Gauge, Activity, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTelemetryData } from "@/hooks/useTelemetryData";
import { useF1Metadata } from "@/hooks/useF1Metadata";
import { LineChart } from '@mui/x-charts/LineChart';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import MuiThemeWrapper from './MuiThemeWrapper';

interface TelemetryDashboardProps {
  year: number;
  round: string;
  sessionType?: string;
  sessionKey?: number;
}

type TelemetryMetric = 'speed' | 'throttle' | 'brake' | 'rpm' | 'gear' | 'drs';

const metricConfig: Record<TelemetryMetric, { label: string; unit: string; color: string }> = {
  speed: { label: 'Speed', unit: 'km/h', color: '#3b82f6' },
  throttle: { label: 'Throttle', unit: '%', color: '#22c55e' },
  brake: { label: 'Brake', unit: '%', color: '#ef4444' },
  rpm: { label: 'RPM', unit: 'rpm', color: '#f59e0b' },
  gear: { label: 'Gear', unit: '', color: '#8b5cf6' },
  drs: { label: 'DRS', unit: '', color: '#06b6d4' },
};

const TelemetryDashboard: React.FC<TelemetryDashboardProps> = ({
  year,
  round,
  sessionType,
  sessionKey
}) => {
  const [selectedDriver1, setSelectedDriver1] = useState<string>("");
  const [selectedDriver2, setSelectedDriver2] = useState<string>("");
  const [telemetryMetric, setTelemetryMetric] = useState<TelemetryMetric>("speed");
  const [activeTab, setActiveTab] = useState<string>("compare");
  
  const { isGlass, baseTheme } = useTheme();
  const isDark = baseTheme === 'dark';

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

  const getDriverCode = (number: string) => {
    const driver = drivers.find(d => d.permanentNumber === number);
    return driver?.code || number;
  };

  if (!sessionKey) {
    return (
      <div className="min-h-[300px] flex flex-col items-center justify-center p-4 text-center">
        <Gauge className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-muted-foreground font-medium">Select a Session</p>
        <p className="text-sm text-muted-foreground mt-1">
          Please select a specific session (Practice, Qualifying, or Race) to view telemetry.
        </p>
      </div>
    );
  }

  if (isTelemetryLoading || isMetadataLoading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
        <p className="text-sm text-muted-foreground">Loading telemetry data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={selectedDriver1} onValueChange={setSelectedDriver1}>
          <SelectTrigger className={cn("w-[120px] h-8 text-xs", isGlass && "bg-white/5 border-white/10")}>
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
                  <span className="text-xs">{driver.code}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-xs text-muted-foreground">vs</span>

        <Select value={selectedDriver2} onValueChange={setSelectedDriver2}>
          <SelectTrigger className={cn("w-[120px] h-8 text-xs", isGlass && "bg-white/5 border-white/10")}>
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
                  <span className="text-xs">{driver.code}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <div className="flex gap-1">
          {(Object.keys(metricConfig) as TelemetryMetric[]).map(metric => (
            <button
              key={metric}
              onClick={() => setTelemetryMetric(metric)}
              className={cn(
                "px-2 py-1 rounded text-[10px] font-medium transition-colors",
                telemetryMetric === metric
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {metricConfig[metric].label}
            </button>
          ))}
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
            <span className="text-xs font-medium">{getDriverCode(selectedDriver1)}</span>
          </div>
        )}
        {selectedDriver2 && selectedDriver2 !== "none" && (
          <div className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: getDriverColor(drivers.find(d => d.permanentNumber === selectedDriver2)?.driverId || "") }}
            />
            <span className="text-xs font-medium">{getDriverCode(selectedDriver2)}</span>
          </div>
        )}
        <Badge variant="outline" className="text-[10px] ml-auto">
          {metricConfig[telemetryMetric].label}
          {metricConfig[telemetryMetric].unit && ` (${metricConfig[telemetryMetric].unit})`}
        </Badge>
      </div>

      {/* Chart */}
      {!hasData ? (
        <div className={cn(
          "min-h-[300px] flex flex-col items-center justify-center rounded-lg",
          isGlass ? "bg-white/5 border border-white/10" : "bg-muted/30"
        )}>
          <Activity className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-sm">No telemetry data available</p>
          <p className="text-xs text-muted-foreground mt-1">Select different drivers or check data availability</p>
        </div>
      ) : (
        <MuiThemeWrapper>
          <div className="h-[350px]">
            <LineChart
              xAxis={[{
                data: chartData.times,
                label: 'Time (s)',
                scaleType: 'linear',
                tickLabelStyle: { fontSize: 10, fill: isDark ? '#a1a1aa' : '#666' },
                valueFormatter: (value) => typeof value === 'number' ? value.toFixed(1) : String(value),
              }]}
              yAxis={[{
                label: `${metricConfig[telemetryMetric].label}${metricConfig[telemetryMetric].unit ? ` (${metricConfig[telemetryMetric].unit})` : ''}`,
                tickLabelStyle: { fontSize: 10, fill: isDark ? '#a1a1aa' : '#666' },
              }]}
              series={chartData.series}
              height={350}
              margin={{ left: 55, right: 20, top: 20, bottom: 40 }}
              slotProps={({
                legend: { hidden: true },
              } as any)}
              grid={{ vertical: false, horizontal: true }}
            />
          </div>
        </MuiThemeWrapper>
      )}

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
                  "rounded-lg p-3",
                  isGlass ? "bg-white/5 border border-white/10" : "bg-muted/30"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-xs font-semibold">{s.label}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div>
                    <div className="text-muted-foreground">Max</div>
                    <div className="font-mono font-medium">{max.toFixed(1)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Min</div>
                    <div className="font-mono font-medium">{min.toFixed(1)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Avg</div>
                    <div className="font-mono font-medium">{avg.toFixed(1)}</div>
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
