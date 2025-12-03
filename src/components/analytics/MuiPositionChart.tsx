import React, { useState, useEffect, useMemo } from "react";
import { LineChart } from '@mui/x-charts/LineChart';
import { ChartsReferenceLine } from '@mui/x-charts/ChartsReferenceLine';
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Loader2, TrendingUp, Wrench } from "lucide-react";
import { usePositionChangeData } from "@/hooks/usePositionChangeData";
import DriverSelectionGrid from "./charts/DriverSelectionGrid";
import MuiThemeWrapper from "./MuiThemeWrapper";
import { useTheme } from "@/context/ThemeContext";
import { F1ChartEmpty } from "@/components/charts/F1ChartEmpty";
import { F1ErrorState } from "@/components/f1/F1ErrorState";
import { getPitStops } from "@/services/f1Service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MuiPositionChartProps {
  year: number;
  round: string;
}

interface PitStopData {
  driver: string;
  lap: number;
  duration: string;
  stop?: number;
}

const MuiPositionChart: React.FC<MuiPositionChartProps> = ({ year, round }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [showPitStops, setShowPitStops] = useState(true);
  const [pitStops, setPitStops] = useState<PitStopData[]>([]);
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
      try {
        const response = await getPitStops(year, round);
        if (response?.data?.Races?.[0]?.PitStops) {
          const stopsByDriver: { [driver: string]: number } = {};
          const pitStopData = response.data.Races[0].PitStops.map((ps: any) => {
            const driverId = ps.driverId;
            stopsByDriver[driverId] = (stopsByDriver[driverId] || 0) + 1;
            return {
              driver: driverId,
              lap: parseInt(ps.lap, 10),
              duration: ps.duration,
              stop: stopsByDriver[driverId],
            };
          });
          setPitStops(pitStopData);
        } else {
          setPitStops([]);
        }
      } catch (error) {
        console.error('Error fetching pit stops:', error);
        setPitStops([]);
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
    handleDriverToggle,
    handleDriverHover,
    getPositionChangeSummary,
  } = usePositionChangeData(year, round);

  // Map driver IDs to codes and team colors for matching
  const driverIdToInfo = useMemo(() => {
    const map: { [id: string]: { code: string; team: string } } = {};
    availableDrivers.forEach(d => {
      map[d.driverId.toLowerCase()] = { code: d.code, team: d.team };
      map[d.code.toLowerCase()] = { code: d.code, team: d.team };
    });
    return map;
  }, [availableDrivers]);

  // Transform data for MUI X Charts
  const { muiChartData, teammateIndices } = useMemo(() => {
    if (!chartData.length) return { muiChartData: { xAxisData: [], series: [] }, teammateIndices: [] };

    const xAxisData = chartData.map(d => d.lap);
    
    const visibleDriversData = availableDrivers.filter(d => visibleDrivers.includes(d.code));
    
    // Track teammates - second driver from same team gets dashed line
    const teamDriverCounts: { [team: string]: number } = {};
    const secondTeammateIdx: number[] = [];
    
    const series = visibleDriversData.map((driver, idx) => {
      // Check if this is a second teammate
      const teamCount = teamDriverCounts[driver.team] || 0;
      teamDriverCounts[driver.team] = teamCount + 1;
      
      if (teamCount > 0) {
        secondTeammateIdx.push(idx);
      }
      
      return {
        data: chartData.map(d => d[driver.code] as number | null),
        label: driver.code,
        color: TEAM_COLORS[driver.team] || DRIVER_COLORS[driver.code] || "#666",
        showMark: false, // No dots for cleaner look
        curve: 'stepAfter' as const,
        connectNulls: true,
      };
    });

    return { 
      muiChartData: { xAxisData, series },
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

  // Group pit stops by lap with driver info
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
        <Skeleton className="h-full w-full opacity-30" />
        <div className="absolute flex flex-col items-center justify-center space-y-6 w-3/4 max-w-md p-6 rounded-lg bg-card border shadow-lg">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <div className="w-full space-y-2">
            <Progress 
              value={loadingProgress} 
              className="h-2 w-full" 
            />
            <p className="text-sm text-muted-foreground text-center">
              {errorMessage || "Loading position data..."}
            </p>
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
          title="Unable to Load Position Data"
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
          title="No Position Data"
          message="Position data is not available for this race."
          icon={<TrendingUp className="h-12 w-12 text-muted-foreground" />}
        />
      </div>
    );
  }

  const chartHeight = isMobile ? 220 : 280;

  return (
    <MuiThemeWrapper>
      <div className="h-full flex flex-col">
        {/* Pit stop toggle */}
        <div className="flex justify-end mb-2">
          <Button
            variant={showPitStops ? "default" : "outline"}
            size="sm"
            onClick={() => setShowPitStops(!showPitStops)}
            className="h-7 gap-1.5 text-xs"
          >
            <Wrench className="h-3.5 w-3.5" />
            Pit Stops
            {visiblePitStops.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 text-[10px] px-1.5">
                {visiblePitStops.length}
              </Badge>
            )}
          </Button>
        </div>

        {/* Pit stops summary for visible drivers */}
        {showPitStops && visiblePitStops.length > 0 && (
          <div className={cn(
            "flex flex-wrap gap-1 mb-2 p-1.5 rounded-md text-[9px]",
            isDark ? "bg-zinc-900/50 border border-zinc-800" : "bg-zinc-50 border border-zinc-200"
          )}>
            {Object.entries(
              visiblePitStops.reduce((acc, ps) => {
                if (!acc[ps.driverCode]) acc[ps.driverCode] = [];
                acc[ps.driverCode].push(ps);
                return acc;
              }, {} as { [driver: string]: typeof visiblePitStops })
            ).map(([driver, stops]) => {
              const team = stops[0]?.team || '';
              const teamColor = TEAM_COLORS[team] || '#666';
              return (
                <div 
                  key={driver} 
                  className={cn(
                    "flex items-center gap-1 px-1.5 py-0.5 rounded",
                    isDark ? "bg-zinc-800" : "bg-white border border-zinc-200"
                  )}
                  style={{ borderLeft: `2px solid ${teamColor}` }}
                >
                  <span className="font-bold">{driver}</span>
                  <span className="text-muted-foreground">:</span>
                  {stops.sort((a, b) => (a.stop || 1) - (b.stop || 1)).map((stop, i) => (
                    <span key={i} className="flex items-center gap-0.5">
                      <span className="text-muted-foreground">P{stop.stop || i+1}</span>
                      <span className="font-mono text-amber-500">L{stop.lap}</span>
                      <span className="font-mono text-emerald-500">{stop.duration}s</span>
                      {i < stops.length - 1 && <span className="text-muted-foreground mx-0.5">|</span>}
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Driver selection grid */}
        <DriverSelectionGrid
          availableDrivers={availableDrivers}
          selectedDrivers={selectedDrivers}
          onDriverToggle={handleDriverToggle}
          onDriverHover={handleDriverHover}
          getPositionChangeSummary={getPositionChangeSummary}
        />
        
        <div className="flex-1 mt-2 min-h-0">
          {muiChartData.series.length > 0 && (
            <LineChart
              xAxis={[{ 
                data: muiChartData.xAxisData,
                label: 'Lap',
                scaleType: 'linear',
                min: 0,
                max: maxLap,
                tickLabelStyle: {
                  fontSize: isMobile ? 10 : 11,
                },
              }]}
              yAxis={[{
                label: 'Position',
                min: 1,
                max: 20,
                reverse: true,
                tickNumber: 10,
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
                left: isMobile ? 35 : 45 
              }}
              slotProps={{
                legend: {
                  hidden: true, // Hide legend - we have the driver selector grid
                },
              }}
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
              {showPitStops && pitStopsByLap.map((ps) => {
                const label = ps.drivers.map((d, i) => 
                  `${d}:P${ps.stops[i]}`
                ).join(' ');
                
                return (
                  <ChartsReferenceLine 
                    key={`pit-${ps.lap}`}
                    x={ps.lap}
                    label={label}
                    labelAlign="start"
                    lineStyle={{ 
                      stroke: ps.teams[0] ? (TEAM_COLORS[ps.teams[0]] || '#f59e0b') : '#f59e0b', 
                      strokeDasharray: '2 4',
                      strokeWidth: 1.5,
                      opacity: 0.7,
                    }}
                    labelStyle={{
                      fill: ps.teams[0] ? (TEAM_COLORS[ps.teams[0]] || '#f59e0b') : '#f59e0b',
                      fontSize: 7,
                      fontWeight: 600,
                      opacity: 0.9,
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

export default MuiPositionChart;
