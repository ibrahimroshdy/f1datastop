import React, { useState, useEffect, useMemo } from "react";
import { LineChart } from '@mui/x-charts/LineChart';
import { TEAM_COLORS, DRIVER_COLORS } from "@/constants/f1Colors";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Loader2, TrendingUp } from "lucide-react";
import { usePositionChangeData } from "@/hooks/usePositionChangeData";
import DriverSelectionGrid from "./charts/DriverSelectionGrid";
import MuiThemeWrapper from "./MuiThemeWrapper";
import { useTheme } from "@/context/ThemeContext";
import { F1ChartEmpty } from "@/components/charts/F1ChartEmpty";
import { F1ErrorState } from "@/components/f1/F1ErrorState";

interface MuiPositionChartProps {
  year: number;
  round: string;
}

const MuiPositionChart: React.FC<MuiPositionChartProps> = ({ year, round }) => {
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
    handleDriverToggle,
    handleDriverHover,
    getPositionChangeSummary,
  } = usePositionChangeData(year, round);

  // Transform data for MUI X Charts
  const muiChartData = useMemo(() => {
    if (!chartData.length) return { xAxisData: [], series: [] };

    const xAxisData = chartData.map(d => d.lap);
    
    const visibleDriversData = availableDrivers.filter(d => visibleDrivers.includes(d.code));
    
    const series = visibleDriversData.map(driver => ({
      data: chartData.map(d => d[driver.code] as number | null),
      label: driver.code,
      color: TEAM_COLORS[driver.team] || DRIVER_COLORS[driver.code] || "#666",
      showMark: false,
      curve: 'stepAfter' as const,
      connectNulls: true,
    }));

    return { xAxisData, series };
  }, [chartData, availableDrivers, visibleDrivers]);

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

  return (
    <MuiThemeWrapper>
      <div className="h-full flex flex-col">
        {/* Driver selection grid */}
        <DriverSelectionGrid
          availableDrivers={availableDrivers}
          selectedDrivers={selectedDrivers}
          onDriverToggle={handleDriverToggle}
          onDriverHover={handleDriverHover}
          getPositionChangeSummary={getPositionChangeSummary}
        />
        
        <div className="flex-grow mt-4" style={{ minHeight: isMobile ? 300 : 400 }}>
          {muiChartData.series.length > 0 && (
            <LineChart
              xAxis={[{ 
                data: muiChartData.xAxisData,
                label: 'Lap',
                scaleType: 'linear',
                min: 0,
                max: maxLap,
              }]}
              yAxis={[{
                label: 'Position',
                min: 1,
                max: 20,
                reverse: true,
                tickNumber: 10,
              }]}
              series={muiChartData.series}
              height={isMobile ? 300 : 400}
              margin={{ 
                top: 20, 
                right: isMobile ? 20 : 100, 
                bottom: 40, 
                left: isMobile ? 40 : 60 
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
            />
          )}
        </div>
      </div>
    </MuiThemeWrapper>
  );
};

export default MuiPositionChart;

