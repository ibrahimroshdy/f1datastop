import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useLapTimes, useRaceResults } from '@/hooks/useF1Data';
import { TEAM_COLORS } from '@/constants/f1Colors';
import { useTheme } from '@/context/ThemeContext';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MuiYearComparisonPositionChartProps {
  baseYear: number;
  baseRound: string;
  comparisonYear: number;
  comparisonRound: string;
}

interface DriverData {
  code: string;
  name: string;
  team: string;
  color: string;
}

const getTeamColor = (team: string): string => {
  let normalizedTeam = team?.toLowerCase() || '';
  if (normalizedTeam === 'alphatauri') normalizedTeam = 'rb';
  if (normalizedTeam === 'alfa') normalizedTeam = 'sauber';
  return TEAM_COLORS[normalizedTeam] || '#666666';
};

const MuiYearComparisonPositionChart: React.FC<MuiYearComparisonPositionChartProps> = ({
  baseYear,
  baseRound,
  comparisonYear,
  comparisonRound,
}) => {
  const { baseTheme } = useTheme();
  const isDark = baseTheme === 'dark';

  const [baseDrivers, setBaseDrivers] = useState<DriverData[]>([]);
  const [comparisonDrivers, setComparisonDrivers] = useState<DriverData[]>([]);
  const [selectedBaseDrivers, setSelectedBaseDrivers] = useState<string[]>([]);
  const [selectedComparisonDrivers, setSelectedComparisonDrivers] = useState<string[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Data hooks
  const { data: baseLapData, isLoading: baseLoading } = useLapTimes(baseYear, baseRound);
  const { data: comparisonLapData, isLoading: comparisonLoading } = useLapTimes(comparisonYear, comparisonRound);
  const { data: baseResults, isLoading: baseResultsLoading } = useRaceResults(baseYear, baseRound);
  const { data: comparisonResults, isLoading: comparisonResultsLoading } = useRaceResults(comparisonYear, comparisonRound);

  // Process driver lists
  useEffect(() => {
    if (baseResults?.data?.Results) {
      const drivers = baseResults.data.Results.map((r: any) => ({
        code: r.Driver.code || r.Driver.familyName.substring(0, 3).toUpperCase(),
        name: `${r.Driver.givenName} ${r.Driver.familyName}`,
        team: r.Constructor?.constructorId || 'unknown',
        color: getTeamColor(r.Constructor?.constructorId),
      }));
      setBaseDrivers(drivers);
      if (selectedBaseDrivers.length === 0) {
        setSelectedBaseDrivers(drivers.slice(0, 3).map((d: DriverData) => d.code));
      }
    }
  }, [baseResults]);

  useEffect(() => {
    if (comparisonResults?.data?.Results) {
      const drivers = comparisonResults.data.Results.map((r: any) => ({
        code: r.Driver.code || r.Driver.familyName.substring(0, 3).toUpperCase(),
        name: `${r.Driver.givenName} ${r.Driver.familyName}`,
        team: r.Constructor?.constructorId || 'unknown',
        color: getTeamColor(r.Constructor?.constructorId),
      }));
      setComparisonDrivers(drivers);
      if (selectedComparisonDrivers.length === 0) {
        setSelectedComparisonDrivers(drivers.slice(0, 3).map((d: DriverData) => d.code));
      }
    }
  }, [comparisonResults]);

  // Process position data
  useEffect(() => {
    if (!baseLapData?.data?.Laps || !comparisonLapData?.data?.Laps) return;

    setIsProcessing(true);

    const baseLaps = baseLapData.data.Laps;
    const comparisonLaps = comparisonLapData.data.Laps;
    const maxLaps = Math.max(baseLaps.length, comparisonLaps.length);

    const processedData = [];

    for (let i = 0; i < maxLaps; i++) {
      const lapNum = i + 1;
      const dataPoint: any = { lap: lapNum };

      // Base year positions
      const baseLapTimings = baseLaps[i]?.Timings || [];
      baseLapTimings.forEach((t: any) => {
        const code = t.driverId.substring(0, 3).toUpperCase();
        const position = parseInt(t.position);
        if (!isNaN(position) && selectedBaseDrivers.includes(code)) {
          dataPoint[`${code}_${baseYear}`] = position;
        }
      });

      // Comparison year positions
      const compLapTimings = comparisonLaps[i]?.Timings || [];
      compLapTimings.forEach((t: any) => {
        const code = t.driverId.substring(0, 3).toUpperCase();
        const position = parseInt(t.position);
        if (!isNaN(position) && selectedComparisonDrivers.includes(code)) {
          dataPoint[`${code}_${comparisonYear}`] = position;
        }
      });

      processedData.push(dataPoint);
    }

    setChartData(processedData);
    setIsProcessing(false);
  }, [baseLapData, comparisonLapData, selectedBaseDrivers, selectedComparisonDrivers, baseYear, comparisonYear]);

  // Build series descriptors for the chart (base year solid, comparison year dashed)
  const series = useMemo(() => {
    const result: { dataKey: string; label: string; color: string; dashed: boolean }[] = [];

    selectedBaseDrivers.forEach((code) => {
      const driver = baseDrivers.find(d => d.code === code);
      if (driver) {
        result.push({
          dataKey: `${code}_${baseYear}`,
          label: `${code} (${baseYear})`,
          color: driver.color,
          dashed: false,
        });
      }
    });

    selectedComparisonDrivers.forEach((code) => {
      const driver = comparisonDrivers.find(d => d.code === code);
      if (driver) {
        result.push({
          dataKey: `${code}_${comparisonYear}`,
          label: `${code} (${comparisonYear})`,
          color: driver.color,
          dashed: true,
        });
      }
    });

    return result;
  }, [selectedBaseDrivers, selectedComparisonDrivers, baseDrivers, comparisonDrivers, baseYear, comparisonYear]);

  // Toggle driver selection
  const toggleBaseDriver = (code: string) => {
    setSelectedBaseDrivers(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const toggleComparisonDriver = (code: string) => {
    setSelectedComparisonDrivers(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const isLoading = baseLoading || comparisonLoading || baseResultsLoading || comparisonResultsLoading || isProcessing;

  if (isLoading) {
    return (
      <div className="h-[400px] flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-sm text-muted-foreground">Loading position data...</p>
      </div>
    );
  }

  if (!chartData.length) {
    return (
      <div className="h-[400px] flex flex-col items-center justify-center">
        <AlertCircle className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">No position data available</p>
      </div>
    );
  }

  // Custom tooltip: sorted by position (P1 first), formatted as "P{n}"
  const PositionTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const rows = payload
      .filter((p: any) => p.value != null)
      .sort((a: any, b: any) => a.value - b.value);
    if (!rows.length) return null;
    return (
      <div className="rounded-md border border-border bg-background/95 px-2 py-1.5 text-[11px] shadow-md">
        <div className="font-mono text-muted-foreground mb-1">Lap {label}</div>
        {rows.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.stroke }} />
            <span className="font-bold">{p.dataKey}</span>
            <span className="font-mono">P{p.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Driver Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Base Year Drivers */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="text-xs">{baseYear}</Badge>
            <span className="text-xs text-muted-foreground">Select drivers</span>
          </div>
          <ScrollArea className="h-[80px] border rounded-md p-2">
            <div className="flex flex-wrap gap-1.5">
              {baseDrivers.map((driver) => (
                <button
                  key={driver.code}
                  onClick={() => toggleBaseDriver(driver.code)}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-medium transition-all border",
                    selectedBaseDrivers.includes(driver.code)
                      ? "border-current opacity-100"
                      : "border-transparent opacity-50 hover:opacity-75"
                  )}
                  style={{
                    borderColor: selectedBaseDrivers.includes(driver.code) ? driver.color : 'transparent',
                    backgroundColor: selectedBaseDrivers.includes(driver.code) ? `${driver.color}20` : 'transparent',
                    color: driver.color,
                  }}
                >
                  {driver.code}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Comparison Year Drivers */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="text-xs">{comparisonYear}</Badge>
            <span className="text-xs text-muted-foreground">Select drivers</span>
          </div>
          <ScrollArea className="h-[80px] border rounded-md p-2">
            <div className="flex flex-wrap gap-1.5">
              {comparisonDrivers.map((driver) => (
                <button
                  key={driver.code}
                  onClick={() => toggleComparisonDriver(driver.code)}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-medium transition-all border",
                    selectedComparisonDrivers.includes(driver.code)
                      ? "border-current opacity-100"
                      : "border-transparent opacity-50 hover:opacity-75"
                  )}
                  style={{
                    borderColor: selectedComparisonDrivers.includes(driver.code) ? driver.color : 'transparent',
                    backgroundColor: selectedComparisonDrivers.includes(driver.code) ? `${driver.color}20` : 'transparent',
                    color: driver.color,
                  }}
                >
                  {driver.code}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[350px]">
        <ResponsiveContainer width="100%" height={350}>
          <LineChart
            data={chartData}
            margin={{ top: 20, right: 20, bottom: 40, left: 50 }}
          >
            <CartesianGrid
              vertical={false}
              stroke={isDark ? '#333' : '#e5e5e5'}
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="lap"
              type="number"
              domain={[1, 'dataMax']}
              allowDecimals={false}
              tickLine={false}
              label={{ value: 'Lap', position: 'insideBottom', offset: -10, fontSize: 11, fill: isDark ? '#a1a1aa' : '#666' }}
              tick={{ fontSize: 10, fill: isDark ? '#a1a1aa' : '#666' }}
            />
            <YAxis
              reversed
              domain={[1, 20]}
              allowDecimals={false}
              tickLine={false}
              width={50}
              label={{ value: 'Position', angle: -90, position: 'insideLeft', fontSize: 11, fill: isDark ? '#a1a1aa' : '#666' }}
              tick={{ fontSize: 10, fill: isDark ? '#a1a1aa' : '#666' }}
            />
            <Tooltip content={<PositionTooltip />} />
            {series.map((s) => (
              <Line
                key={s.dataKey}
                type="linear"
                dataKey={s.dataKey}
                name={s.label}
                stroke={s.color}
                strokeWidth={1.5}
                strokeDasharray={s.dashed ? '5 3' : undefined}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-3 text-xs">
        {series.map((s) => (
          <div key={s.dataKey} className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 rounded" style={{ backgroundColor: s.color }} />
            <span className="text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MuiYearComparisonPositionChart;
