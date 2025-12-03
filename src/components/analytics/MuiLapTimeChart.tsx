import React, { useState, useEffect, useMemo, useCallback } from "react";
import { LineChart } from '@mui/x-charts/LineChart';
import { ChartsReferenceLine } from '@mui/x-charts/ChartsReferenceLine';
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";
import { Progress } from "@/components/ui/progress";
import { Loader2, Clock, Wrench } from "lucide-react";
import { useLapTimeData, Driver } from "@/hooks/useLapTimeData";
import DriverSelector from "./DriverSelector";
import DisplayModeToggle from "./DisplayModeToggle";
import { F1ChartLoading } from "@/components/charts/F1ChartLoading";
import { F1ChartEmpty } from "@/components/charts/F1ChartEmpty";
import { F1ErrorState } from "@/components/f1/F1ErrorState";
import MuiThemeWrapper from "./MuiThemeWrapper";
import { useTheme } from "@/context/ThemeContext";
import { getPitStops } from "@/services/f1Service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MuiLapTimeChartProps {
  year: number;
  round: string;
}

interface PitStopData {
  driver: string;
  lap: number;
  duration: string;
  team?: string;
  stop?: number; // Pit stop number (1, 2, 3...)
}

const MuiLapTimeChart: React.FC<MuiLapTimeChartProps> = ({ year, round }) => {
  const [displayMode, setDisplayMode] = useState<'absolute' | 'gap'>('absolute');
  const [isMobile, setIsMobile] = useState(false);
  const [showPitStops, setShowPitStops] = useState(true);
  const [pitStops, setPitStops] = useState<PitStopData[]>([]);
  const [pitStopsLoading, setPitStopsLoading] = useState(false);
  const { baseTheme } = useTheme();
  const isDark = baseTheme === 'dark';

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Fetch pit stop data
  useEffect(() => {
    const fetchPitStops = async () => {
      setPitStopsLoading(true);
      try {
        const response = await getPitStops(year, round);
        if (response?.data?.Races?.[0]?.PitStops) {
          // Group by driver to assign stop numbers
          const stopsByDriver: { [driver: string]: number } = {};
          const pitStopData = response.data.Races[0].PitStops.map((ps: any) => {
            const driverId = ps.driverId;
            stopsByDriver[driverId] = (stopsByDriver[driverId] || 0) + 1;
            return {
              driver: driverId,
              lap: parseInt(ps.lap, 10),
              duration: ps.duration,
              stop: stopsByDriver[driverId],
              team: '',
            };
          });
          setPitStops(pitStopData);
        } else {
          setPitStops([]);
        }
      } catch (error) {
        console.error('Error fetching pit stops:', error);
        setPitStops([]);
      } finally {
        setPitStopsLoading(false);
      }
    };

    if (year && round) {
      fetchPitStops();
    }
  }, [year, round]);

  const {
    chartData,
    availableDrivers,
    selectedDrivers,
    visibleDrivers,
    hoveredDriver,
    isLoading,
    isError,
    loadingProgress,
    errorMessage,
    maxLap,
    fastestLapTime,
    handleDriverToggle,
    handleDriverHover,
    getAverageTime,
    retryCount,
  } = useLapTimeData(year, round, displayMode);

  const toggleDisplayMode = () => {
    setDisplayMode(prev => prev === 'absolute' ? 'gap' : 'absolute');
  };

  // Map driver IDs to codes and team colors for matching
  const driverIdToInfo = useMemo(() => {
    const map: { [id: string]: { code: string; team: string } } = {};
    availableDrivers.forEach(d => {
      map[d.driverId.toLowerCase()] = { code: d.code, team: d.team };
      map[d.code.toLowerCase()] = { code: d.code, team: d.team };
    });
    return map;
  }, [availableDrivers]);

  // Transform data for MUI X Charts and calculate Y-axis bounds
  const { muiChartData, yAxisMin, yAxisMax, teammateIndices } = useMemo(() => {
    if (!chartData.length) return { muiChartData: { xAxisData: [], series: [] }, yAxisMin: 0, yAxisMax: 100, teammateIndices: [] };

    const xAxisData = chartData.map(d => d.lap);
    
    const visibleDriversData = availableDrivers.filter(d => visibleDrivers.includes(d.code));
    
    // Calculate min and max values for Y-axis from visible drivers' data
    let allValues: number[] = [];
    
    // Track teammates - second driver from same team gets dashed line
    const teamDriverCounts: { [team: string]: number } = {};
    const secondTeammateIdx: number[] = [];
    
    const series = visibleDriversData.map((driver, idx) => {
      const data = chartData.map(d => {
        const val = d[driver.code] as number | null;
        if (val !== null && val !== undefined && !isNaN(val)) {
          allValues.push(val);
        }
        return val;
      });
      
      // Check if this is a second teammate
      const teamCount = teamDriverCounts[driver.team] || 0;
      teamDriverCounts[driver.team] = teamCount + 1;
      
      if (teamCount > 0) {
        secondTeammateIdx.push(idx);
      }
      
      return {
        data,
        label: driver.code,
        color: TEAM_COLORS[driver.team] || DRIVER_COLORS[driver.code] || "#666",
        showMark: false,
        curve: 'linear' as const,
        connectNulls: true,
      };
    });

    // Calculate appropriate Y-axis bounds with padding
    let minVal = allValues.length > 0 ? Math.min(...allValues) : 60;
    let maxVal = allValues.length > 0 ? Math.max(...allValues) : 120;
    
    // Add 5% padding
    const range = maxVal - minVal;
    const padding = range * 0.05;
    minVal = Math.max(0, minVal - padding);
    maxVal = maxVal + padding;

    return { 
      muiChartData: { xAxisData, series },
      yAxisMin: minVal,
      yAxisMax: maxVal,
      teammateIndices: secondTeammateIdx,
    };
  }, [chartData, availableDrivers, visibleDrivers]);
  
  // Get pit stops for visible drivers only with enriched data
  const visiblePitStops = useMemo(() => {
    if (!showPitStops || pitStops.length === 0) return [];
    
    const visibleCodes = visibleDrivers.map(code => code.toLowerCase());
    
    return pitStops.filter(ps => {
      const info = driverIdToInfo[ps.driver.toLowerCase()];
      return info && visibleCodes.includes(info.code.toLowerCase());
    }).map(ps => {
      const info = driverIdToInfo[ps.driver.toLowerCase()];
      return {
        ...ps,
        driverCode: info?.code || ps.driver,
        team: info?.team || '',
      };
    });
  }, [pitStops, visibleDrivers, driverIdToInfo, showPitStops]);
  
  // Group pit stops by lap with driver info and pit stop numbers
  const pitStopsByLap = useMemo(() => {
    const lapsMap = new Map<number, { 
      drivers: string[]; 
      teams: string[]; 
      stops: number[]; 
      durations: string[];
    }>();
    
    visiblePitStops.forEach(ps => {
      const existing = lapsMap.get(ps.lap) || { drivers: [], teams: [], stops: [], durations: [] };
      existing.drivers.push(ps.driverCode);
      existing.teams.push(ps.team);
      existing.stops.push(ps.stop || 1);
      existing.durations.push(ps.duration);
      lapsMap.set(ps.lap, existing);
    });
    
    return Array.from(lapsMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([lap, info]) => ({ lap, ...info }));
  }, [visiblePitStops]);


  // Render loading state with progress indicator
  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-4 relative">
        <F1ChartLoading chartType="line" height={350} />
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center justify-center space-y-4 w-3/4 max-w-md p-6 rounded-lg bg-card border shadow-lg">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
              <div className="relative p-3 bg-primary/10 rounded-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            </div>
            
            <div className="w-full space-y-3">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span className="font-medium">Loading lap times...</span>
                <span className="font-mono tabular-nums">{loadingProgress}%</span>
              </div>
              <Progress 
                value={loadingProgress} 
                className="h-2 w-full" 
              />
              
              {errorMessage ? (
                <p className="text-amber-600 text-sm font-medium text-center">{errorMessage}</p>
              ) : (
                <p className="text-muted-foreground text-sm text-center">
                  Fetching lap data for all drivers...
                </p>
              )}
              
              {retryCount > 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  Rate limit reached. Retry {retryCount}/15
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handle error state
  if (isError && chartData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <F1ErrorState
          type="rate-limit"
          title="Unable to Load Lap Times"
          message="The F1 API rate limit was reached. Please wait a moment and try again."
          variant="card"
        />
      </div>
    );
  }

  // Handle no data state
  if (chartData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <F1ChartEmpty
          chartType="line"
          title="No Lap Time Data"
          message="Lap time data is not available for this race. This may be because the race hasn't occurred yet."
          icon={<Clock className="h-12 w-12 text-muted-foreground" />}
        />
      </div>
    );
  }

  // Format time for Y-axis (MM:SS.s format)
  const formatTime = (value: number) => {
    if (displayMode === 'absolute') {
      const mins = Math.floor(value / 60);
      const secs = (value % 60).toFixed(1);
      return `${mins}:${secs.padStart(4, '0')}`;
    } else {
      return `+${value.toFixed(1)}s`;
    }
  };

  // Calculate chart height based on available space
  const chartHeight = isMobile ? 220 : 280;

  return (
    <MuiThemeWrapper>
      <div className="h-full flex flex-col">
        <div className="flex flex-row gap-1.5 items-center mb-2">
          <DisplayModeToggle displayMode={displayMode} onToggle={toggleDisplayMode} />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPitStops(!showPitStops)}
            className={cn(
              "h-6 gap-1 text-[10px] px-2",
              showPitStops 
                ? "bg-zinc-700/50 text-zinc-200 hover:bg-zinc-700/70" 
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            )}
          >
            <Wrench className="h-3 w-3" />
            Pits
            {visiblePitStops.length > 0 && (
              <span className="text-[9px] text-zinc-400">({visiblePitStops.length})</span>
            )}
          </Button>
        </div>
        
        {/* Driver selection grid */}
        <DriverSelector 
          availableDrivers={availableDrivers}
          selectedDrivers={selectedDrivers}
          onDriverToggle={handleDriverToggle}
          onDriverHover={handleDriverHover}
          displayMode={displayMode}
          fastestLapTime={fastestLapTime}
          getAverageTime={getAverageTime}
        />
        
        <div className="flex-1 mt-2 min-h-0">
          {muiChartData.series.length > 0 && (
            <LineChart
              xAxis={[{ 
                data: muiChartData.xAxisData,
                label: 'Lap',
                scaleType: 'linear',
                min: 1,
                max: maxLap,
                tickLabelStyle: {
                  fontSize: isMobile ? 10 : 11,
                },
              }]}
              yAxis={[{
                label: displayMode === 'absolute' ? 'Time' : 'Gap',
                min: displayMode === 'gap' ? 0 : yAxisMin,
                max: displayMode === 'gap' ? undefined : yAxisMax,
                valueFormatter: formatTime,
                tickLabelStyle: {
                  fontSize: isMobile ? 10 : 11,
                },
              }]}
              series={muiChartData.series}
              height={chartHeight}
              margin={{ 
                top: 10, 
                right: isMobile ? 10 : 20, 
                bottom: 35, 
                left: isMobile ? 55 : 65 
              }}
              hideLegend
              sx={{
                '.MuiLineElement-root': {
                  strokeWidth: 2,
                },
                // Apply dashed lines to second teammates
                ...teammateIndices.reduce((acc: any, idx: number) => {
                  acc[`.MuiLineElement-series-${idx}`] = {
                    strokeDasharray: '5 3',
                  };
                  return acc;
                }, {}),
                '.MuiChartsAxis-tickLabel': {
                  fill: baseTheme === 'light' ? '#666' : '#a1a1aa',
                  fontSize: isMobile ? 10 : 11,
                },
                '.MuiChartsAxis-label': {
                  fill: baseTheme === 'light' ? '#666' : '#a1a1aa',
                  fontSize: 11,
                },
                '.MuiChartsGrid-line': {
                  stroke: baseTheme === 'light' ? '#e5e5e5' : '#333',
                  strokeDasharray: '3 3',
                },
              }}
              grid={{ vertical: false, horizontal: true }}
            >
              {fastestLapTime && displayMode === 'absolute' && (
                <ChartsReferenceLine 
                  y={fastestLapTime.time}
                  label={`FL: ${formatTime(fastestLapTime.time)} (${fastestLapTime.driver})`}
                  labelAlign="end"
                  lineStyle={{ 
                    stroke: '#c026d3', 
                    strokeDasharray: '4 4',
                    strokeWidth: 1.5,
                  }}
                  labelStyle={{
                    fill: '#c026d3',
                    fontSize: 10,
                  }}
                />
              )}
              {showPitStops && pitStopsByLap.map((ps, idx) => {
                // Create label with driver code and pit stop duration
                // Use em-space (U+2003) for better indentation from the line
                const label = ps.drivers.map((d, i) => 
                  `${d} ${ps.durations[i]}s`
                ).join(' · ');
                
                return (
                  <ChartsReferenceLine 
                    key={`pit-${ps.lap}`}
                    x={ps.lap}
                    label={`  ${label}`}
                    labelAlign="start"
                    lineStyle={{ 
                      stroke: ps.teams[0] ? (TEAM_COLORS[ps.teams[0]] || '#f59e0b') : '#f59e0b', 
                      strokeDasharray: '2 4',
                      strokeWidth: 1.5,
                      opacity: 0.6,
                    }}
                    labelStyle={{
                      fill: ps.teams[0] ? (TEAM_COLORS[ps.teams[0]] || '#f59e0b') : '#f59e0b',
                      fontSize: 9,
                      fontWeight: 600,
                      opacity: 1,
                      writingMode: 'vertical-rl',
                      textOrientation: 'mixed',
                    }}
                  />
                );
              })}
            </LineChart>
          )}
        </div>
      </div>
    </MuiThemeWrapper>
  );
};

export default MuiLapTimeChart;
