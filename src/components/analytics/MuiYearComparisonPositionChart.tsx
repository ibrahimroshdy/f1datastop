import React, { useState, useEffect, useMemo } from 'react';
import { LineChart } from '@mui/x-charts/LineChart';
import { ThemeProvider, createTheme } from '@mui/material/styles';
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

  // Create MUI theme
  const muiTheme = useMemo(() => createTheme({
    palette: {
      mode: isDark ? 'dark' : 'light',
      primary: { main: '#e10600' },
      background: {
        default: isDark ? 'hsl(222 47% 8%)' : '#fff',
        paper: isDark ? 'hsl(222 47% 11%)' : '#fff',
      },
    },
    typography: { fontFamily: 'inherit' },
  }), [isDark]);

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

  // Build series for the chart
  const series = useMemo(() => {
    const result: any[] = [];

    selectedBaseDrivers.forEach((code) => {
      const driver = baseDrivers.find(d => d.code === code);
      if (driver) {
        result.push({
          dataKey: `${code}_${baseYear}`,
          label: `${code} (${baseYear})`,
          color: driver.color,
          showMark: false,
          curve: 'linear',
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
          showMark: false,
          curve: 'linear',
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

  return (
    <ThemeProvider theme={muiTheme}>
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
          <LineChart
            dataset={chartData}
            xAxis={[{
              dataKey: 'lap',
              label: 'Lap',
              tickLabelStyle: { fontSize: 10, fill: isDark ? '#a1a1aa' : '#666' },
            }]}
            yAxis={[{
              min: 1,
              max: 20,
              reverse: true,
              label: 'Position',
              tickLabelStyle: { fontSize: 10, fill: isDark ? '#a1a1aa' : '#666' },
            }]}
            series={series}
            height={350}
            margin={{ top: 20, right: 20, bottom: 40, left: 50 }}
            slotProps={{ legend: { hidden: true } }}
            grid={{ vertical: false, horizontal: true }}
            sx={{
              '.MuiLineElement-root': { strokeWidth: 1.5 },
              '.MuiChartsGrid-line': {
                stroke: isDark ? '#333' : '#e5e5e5',
                strokeDasharray: '3 3',
              },
            }}
          />
        </div>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-3 text-xs">
          {series.map((s: any) => (
            <div key={s.dataKey} className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 rounded" style={{ backgroundColor: s.color }} />
              <span className="text-muted-foreground">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </ThemeProvider>
  );
};

export default MuiYearComparisonPositionChart;

