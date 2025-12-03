import React, { useState, useEffect, useMemo } from "react";
import { LineChart } from '@mui/x-charts/LineChart';
import { ChartsReferenceLine } from '@mui/x-charts/ChartsReferenceLine';
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";
import { Progress } from "@/components/ui/progress";
import { Loader2, Clock } from "lucide-react";
import { useLapTimeData, Driver } from "@/hooks/useLapTimeData";
import DriverSelector from "./DriverSelector";
import DisplayModeToggle from "./DisplayModeToggle";
import { F1ChartLoading } from "@/components/charts/F1ChartLoading";
import { F1ChartEmpty } from "@/components/charts/F1ChartEmpty";
import { F1ErrorState } from "@/components/f1/F1ErrorState";
import MuiThemeWrapper from "./MuiThemeWrapper";
import { useTheme } from "@/context/ThemeContext";

interface MuiLapTimeChartProps {
  year: number;
  round: string;
}

const MuiLapTimeChart: React.FC<MuiLapTimeChartProps> = ({ year, round }) => {
  const [displayMode, setDisplayMode] = useState<'absolute' | 'gap'>('absolute');
  const [isMobile, setIsMobile] = useState(false);
  const { baseTheme } = useTheme();

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  // Transform data for MUI X Charts
  const muiChartData = useMemo(() => {
    if (!chartData.length) return { xAxis: [], series: [] };

    const xAxisData = chartData.map(d => d.lap);
    
    const visibleDriversData = availableDrivers.filter(d => visibleDrivers.includes(d.code));
    
    const series = visibleDriversData.map(driver => ({
      data: chartData.map(d => d[driver.code] as number | null),
      label: driver.code,
      color: TEAM_COLORS[driver.team] || DRIVER_COLORS[driver.code] || "#666",
      showMark: true,
      curve: 'linear' as const,
      connectNulls: true,
    }));

    return { xAxisData, series };
  }, [chartData, availableDrivers, visibleDrivers]);

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

  // Format time for Y-axis
  const formatTime = (value: number) => {
    if (displayMode === 'absolute') {
      const mins = Math.floor(value / 60);
      const secs = (value % 60).toFixed(1);
      return `${mins}:${secs.padStart(4, '0')}`;
    } else {
      return `+${value.toFixed(1)}s`;
    }
  };

  return (
    <MuiThemeWrapper>
      <div className="h-full flex flex-col">
        <div className="flex flex-col md:flex-row gap-4 justify-between mb-4">
          <DisplayModeToggle displayMode={displayMode} onToggle={toggleDisplayMode} />
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
        
        <div className="flex-grow mt-4" style={{ minHeight: isMobile ? 300 : 400 }}>
          {muiChartData.series.length > 0 && (
            <LineChart
              xAxis={[{ 
                data: muiChartData.xAxisData,
                label: 'Lap',
                scaleType: 'linear',
                min: 1,
                max: maxLap,
              }]}
              yAxis={[{
                label: displayMode === 'absolute' ? 'Time (s)' : 'Gap (s)',
                valueFormatter: formatTime,
              }]}
              series={muiChartData.series}
              height={isMobile ? 300 : 400}
              margin={{ 
                top: 20, 
                right: isMobile ? 20 : 100, 
                bottom: 40, 
                left: isMobile ? 50 : 70 
              }}
              slotProps={{
                legend: {
                  direction: 'row',
                  position: { vertical: 'top', horizontal: 'right' },
                  padding: 0,
                  itemMarkWidth: 10,
                  itemMarkHeight: 10,
                  markGap: 5,
                  itemGap: 10,
                  labelStyle: {
                    fontSize: isMobile ? 10 : 12,
                  },
                  hidden: isMobile,
                },
              }}
              sx={{
                '.MuiLineElement-root': {
                  strokeWidth: 2,
                },
                '.MuiMarkElement-root': {
                  scale: '0.6',
                  strokeWidth: 1,
                },
                '.MuiChartsAxis-tickLabel': {
                  fill: baseTheme === 'light' ? '#666' : '#a1a1aa',
                  fontSize: isMobile ? 10 : 12,
                },
                '.MuiChartsAxis-label': {
                  fill: baseTheme === 'light' ? '#666' : '#a1a1aa',
                  fontSize: 12,
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
                  label={`Fastest: ${formatTime(fastestLapTime.time)} (${fastestLapTime.driver})`}
                  labelAlign="end"
                  lineStyle={{ 
                    stroke: '#c026d3', 
                    strokeDasharray: '4 4',
                    strokeWidth: 1.5,
                  }}
                  labelStyle={{
                    fill: '#c026d3',
                    fontSize: 11,
                  }}
                />
              )}
            </LineChart>
          )}
        </div>
      </div>
    </MuiThemeWrapper>
  );
};

export default MuiLapTimeChart;

